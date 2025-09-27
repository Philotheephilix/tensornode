import os
import json
import tempfile
import logging
import time
import ast
from datetime import datetime
from flask import Flask, request, jsonify
from werkzeug.utils import secure_filename
from flask_cors import CORS

logging.basicConfig(level=logging.INFO)

from fluence.vm import (
    FluenceVMManager,
    get_active_vms,
    get_vm_by_id,
    execute_command_on_vm,
    upload_file_to_vm,
)
from utils.docker_setup import (
    build_docker_setup_command,
    build_docker_setup_from_local,
    build_docker_stop_command,
)


# ------------------------
# Scoring helpers
# ------------------------
def _coalesce(*values: object, default: object | None = None) -> object | None:
    for v in values:
        if isinstance(v, str) and v.strip():
            return v
        if v is not None and not isinstance(v, (str, bytes)):
            return v
    return default


def _extract_wallet_id(obj: dict) -> str | None:
    """Best-effort extraction of a wallet identifier from a JSON object."""
    for key in ("walletId", "wallet_id", "wallet", "walletAddress", "address", "minerAddress", "miner_address"):
        val = obj.get(key)
        if isinstance(val, str) and val.strip():
            return val.strip()
    # Sometimes nested under validator or vm record
    validator = obj.get("validator")
    if isinstance(validator, dict):
        for key in ("walletId", "wallet", "address"):
            val = validator.get(key)
            if isinstance(val, str) and val.strip():
                return val.strip()
    # Fallback to VM identifiers if wallet not present
    for key in ("vmId", "vm_id", "id"):
        val = obj.get(key)
        if isinstance(val, (str, int)):
            return str(val)
    return None


def _extract_question(obj: dict) -> str | None:
    for key in ("question", "prompt", "input", "text", "message"):
        val = obj.get(key)
        if isinstance(val, str) and val.strip():
            return val.strip()
    return None


def _extract_truth(obj: dict) -> str | None:
    for key in ("truth", "groundTruth", "ground_truth", "answerKey", "gold"):
        val = obj.get(key)
        if isinstance(val, str) and val.strip():
            return val.strip()
    return None


def _extract_candidate(obj: dict) -> str | None:
    # Common places to find a model answer
    for key in ("answer", "response", "result", "output", "text", "message"):
        val = obj.get(key)
        if isinstance(val, str) and val.strip():
            return val.strip()
        if isinstance(val, dict):
            # e.g. { response: { text: "..." } }
            nested = val.get("text") or val.get("message") or val.get("answer") or val.get("output")
            if isinstance(nested, str) and nested.strip():
                return nested.strip()
    # Sometimes under validator.response
    validator = obj.get("validator")
    if isinstance(validator, dict):
        resp = validator.get("response")
        if isinstance(resp, dict):
            text = resp.get("text") or resp.get("message") or resp.get("answer") or resp.get("output")
            if isinstance(text, str) and text.strip():
                return text.strip()
    return None


def _parse_messages_to_pairs(messages: list[dict]) -> list[dict]:
    """
    Convert an array of decoded topic messages (as dicts) into scoring pairs:
    Each pair: { walletId, question, truth, candidate }
    The function is resilient to varied message shapes.
    """
    pairs: list[dict] = []
    last_truth: str | None = None
    last_question: str | None = None

    for msg in messages:
        # Hedera mirror message shape from Next.js: { message: string, ... }
        raw = msg.get("message") if isinstance(msg, dict) else None
        parsed: dict | None = None
        if isinstance(raw, str) and raw.strip():
            try:
                parsed = json.loads(raw)
            except Exception:
                # Fallback 1: try to extract JSON object substring
                try:
                    start = raw.find('{')
                    end = raw.rfind('}')
                    if start != -1 and end != -1 and end > start:
                        candidate_json = raw[start:end+1]
                        parsed = json.loads(candidate_json)
                except Exception:
                    parsed = None
                # Fallback 2: permissive Python literal (single quotes)
                if parsed is None:
                    try:
                        lit = ast.literal_eval(raw)
                        if isinstance(lit, dict):
                            parsed = lit
                    except Exception:
                        parsed = None
        # Some sources might already place JSON at top-level
        if parsed is None and isinstance(msg, dict) and any(k in msg for k in ("question", "prompt", "truth", "answer", "walletId", "vms")):
            parsed = msg
        if not isinstance(parsed, dict):
            try:
                # Log unparsed message preview for debugging
                preview = raw if isinstance(raw, str) else str(raw)
                if isinstance(preview, str) and len(preview) > 200:
                    preview = preview[:200] + "…"
                print({"parse_skip": preview})
            except Exception:
                pass
            continue

        # If a message carries multiple VM answers, e.g., { question, truth, vms: [...] }
        vms = parsed.get("vms")
        if isinstance(vms, list):
            q = _extract_question(parsed) or last_question
            t = _extract_truth(parsed) or last_truth
            if q:
                last_question = q
            if t:
                last_truth = t
            for vm in vms:
                if not isinstance(vm, dict):
                    continue
                wallet = _extract_wallet_id(vm) or _extract_wallet_id(parsed)
                cand = _extract_candidate(vm) or _extract_candidate(parsed)
                if wallet and cand:
                    pairs.append({"walletId": wallet, "question": q or "", "truth": t or "", "candidate": cand})
            continue

        # Single-answer message
        wallet = _extract_wallet_id(parsed)
        q = _extract_question(parsed) or last_question
        t = _extract_truth(parsed) or last_truth
        cand = _extract_candidate(parsed)

        # Update rolling question/truth context when present
        if _extract_question(parsed):
            last_question = _extract_question(parsed)
        if _extract_truth(parsed):
            last_truth = _extract_truth(parsed)

        if wallet and cand:
            pairs.append({"walletId": wallet, "question": q or "", "truth": t or "", "candidate": cand})

    return pairs


def _openai_score_answer(question: str, truth: str, candidate: str) -> int:
    """Use OpenAI to produce an integer score 0-100 for the candidate vs truth."""
    try:
        import requests  # type: ignore
        api_key = os.getenv("OPENAI_API_KEY")
        model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
        if not api_key:
            # If API key missing, perform a basic lexical heuristic scoring
            if truth and candidate:
                overlap = len(set(truth.lower().split()) & set(candidate.lower().split()))
                total = len(set(truth.lower().split())) or 1
                return max(0, min(100, int(100 * overlap / total)))
            return 0

        if truth and str(truth).strip():
            system_prompt = (
                "You are a strict evaluator. Compare the candidate answer to the ground truth. "
                "Score 0-100. Penalize irrelevance and hallucinations. Favor concise correctness. "
                "Only output JSON like {\"score\": 0-100}."
            )
            user_prompt = json.dumps({
                "question": question,
                "ground_truth": truth,
                "candidate_answer": candidate,
                "instructions": "Return only JSON with an integer 'score' between 0 and 100",
            })
        else:
            # No ground truth available: score relevance and likely correctness wrt the question alone
            system_prompt = (
                "You are a strict evaluator. No ground truth is provided. "
                "Judge how relevant and likely-correct the candidate answer is to the question. "
                "Score 0-100. Off-topic or non-answers should receive very low scores (<10). "
                "Only output JSON like {\"score\": 0-100}."
            )
            user_prompt = json.dumps({
                "question": question,
                "candidate_answer": candidate,
                "instructions": "Return only JSON with an integer 'score' between 0 and 100",
            })

        resp = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                "temperature": 0.0,
            },
            timeout=30,
        )
        score: int = 0
        if resp.ok:
            body = resp.json()
            content = _coalesce(
                ((((body or {}).get("choices") or [{}])[0].get("message") or {}).get("content")),
                default="{}",
            )
            if isinstance(content, str):
                try:
                    data = json.loads(content)
                    raw = data.get("score")
                    if isinstance(raw, (int, float)):
                        score = int(raw)
                except Exception:
                    score = 0
        return max(0, min(100, score))
    except Exception:
        return 0


def _aggregate_scores(pairs: list[dict]) -> list[dict]:
    """Aggregate per-wallet average score from per-answer pairs."""
    by_wallet: dict[str, list[int]] = {}
    for p in pairs:
        wallet = str(p.get("walletId") or "unknown")
        score = int(p.get("score") or 0)
        by_wallet.setdefault(wallet, []).append(score)
    out: list[dict] = []
    for wallet, scores in by_wallet.items():
        avg = int(round(sum(scores) / max(1, len(scores))))
        out.append({"walletId": wallet, "score": avg})
    return out


def _fetch_topic_messages(topic_id: str, limit: int = 100, order: str = "asc") -> list[dict]:
    """Fetch decoded messages for a topic via Next.js API."""
    try:
        import requests  # type: ignore
        base = os.getenv("NEXT_API_BASE_URL", "http://localhost:3000")
        url = f"{base.rstrip('/')}/api/topic/messages?topicId={topic_id}&limit={limit}&order={order}"
        resp = requests.get(url, timeout=30)
        if not resp.ok:
            return []
        data = resp.json()
        if isinstance(data, dict):
            return list(data.get("data", {}).get("messages", [])) or list(data.get("messages", []))
        return []
    except Exception:
        return []


def _fetch_topic_messages_with_retry(topic_id: str, retries: int = 20, delay_seconds: float = 1.5, order: str = "desc") -> list[dict]:
    """Poll the Next.js messages endpoint to avoid race with submission and mirror lag."""
    for _ in range(max(1, retries)):
        msgs = _fetch_topic_messages(topic_id, limit=100, order=order)
        if msgs:
            return msgs
        time.sleep(max(0.0, delay_seconds))
    return []


def _submit_scores_to_topic(topic_id: str, scores_payload: dict) -> dict:
    """Submit a JSON message back to the topic via Next.js submit API."""
    try:
        import requests  # type: ignore
        base = os.getenv("NEXT_API_BASE_URL", "http://localhost:3000")
        url = f"{base.rstrip('/')}/api/topic/submit"
        body = {
            "topicId": topic_id,
            # Next.js expects message to be a string
            "message": json.dumps(scores_payload),
        }
        resp = requests.post(url, json=body, timeout=30)
        try:
            return resp.json() if resp.ok else {"status": resp.status_code, "error": resp.text}
        except Exception:
            return {"status": resp.status_code, "text": resp.text}
    except Exception as e:
        return {"error": str(e)}


def create_manager() -> FluenceVMManager:
    api_key = os.getenv("FLUENCE_API_KEY")
    manager = FluenceVMManager(api_key=api_key)
    manager.connect()
    return manager


app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})


# ------------------------
# VM deployment persistence
# ------------------------
DEPLOYMENTS_FILE = os.path.join(os.path.dirname(__file__), "vm_deployments.json")


def _utc_now_iso() -> str:
    return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"


def _ensure_list(value):
    if isinstance(value, list):
        return value
    if value is None:
        return []
    return [value]


def load_deployments() -> list[dict]:
    """Load and normalize deployments list from JSON file."""
    data: list[dict] = []
    if os.path.exists(DEPLOYMENTS_FILE):
        try:
            with open(DEPLOYMENTS_FILE, "r", encoding="utf-8") as f:
                raw = json.load(f)
        except Exception:
            raw = []
        # Normalize: flatten nested lists, keep only dict records
        flat: list[dict] = []
        for item in _ensure_list(raw):
            if isinstance(item, list):
                for sub in item:
                    if isinstance(sub, dict):
                        flat.append(sub)
            elif isinstance(item, dict):
                flat.append(item)
        # Ensure schema fields
        for rec in flat:
            if "status" not in rec:
                rec["status"] = "inactive"
        data = flat
    return data


def save_deployments(items: list[dict]) -> None:
    with open(DEPLOYMENTS_FILE, "w", encoding="utf-8") as f:
        json.dump(items, f, indent=2)


def _index_deployments_by_vm_id(deployments: list[dict]) -> dict:
    """Create an index from vmId -> deployment record (latest entry wins)."""
    idx: dict[str, dict] = {}
    for rec in deployments:
        vmid = str(rec.get("vmId") or rec.get("id") or "").strip()
        if vmid:
            idx[vmid] = rec
    return idx


def _attach_wallet_info(vm: dict, rec: dict | None) -> dict:
    """Return a copy of vm with wallet-related fields from rec (if available)."""
    if not isinstance(vm, dict):
        return vm
    if not isinstance(rec, dict):
        return dict(vm)
    out = dict(vm)
    if "walletAddress" in rec:
        out["walletAddress"] = rec.get("walletAddress")
    if "minerAddress" in rec:
        out["minerAddress"] = rec.get("minerAddress")
    return out


def _extract_vms_from_deploy_result(result: object) -> list[dict]:
    """Best-effort extraction of VM identifiers and names from Fluence deploy response."""
    vms: list[dict] = []
    def add(rec: dict):
        vm_id = rec.get("id") or rec.get("vmId") or rec.get("vm_id")
        if vm_id:
            vms.append({
                "vmId": vm_id,
                "vmName": rec.get("name") or rec.get("vmName") or "default-vm",
            })
    if isinstance(result, dict):
        # common containers
        for key in ("vms", "instances", "deployment", "items", "data"):
            val = result.get(key)
            if isinstance(val, list):
                for x in val:
                    if isinstance(x, dict):
                        add(x)
        # or a single vm directly
        add(result)
    elif isinstance(result, list):
        for x in result:
            if isinstance(x, dict):
                add(x)
    return vms


def record_new_vms_as_inactive(deploy_result: object, wallet_address: str | None) -> list[dict]:
    """Append newly created VMs to deployments file as inactive records."""
    records = load_deployments()
    extracted = _extract_vms_from_deploy_result(deploy_result)
    created: list[dict] = []
    for vm in extracted:
        rec = {
            "vmId": vm["vmId"],
            "vmName": vm.get("vmName") or "default-vm",
            "status": "inactive",
            "walletAddress": wallet_address,
            "createdAt": _utc_now_iso(),
        }
        records.append(rec)
        created.append(rec)
    if created:
        save_deployments(records)
    return created


def allocate_vm_to_miner(miner_address: str, instance_name: str, manager: FluenceVMManager) -> dict:
    """Allocate an inactive VM; create one if necessary, then mark active and assign ownership."""
    deployments = load_deployments()
    # Try reuse inactive
    for rec in deployments:
        if rec.get("status") == "inactive":
            rec["status"] = "active"
            rec["minerAddress"] = miner_address
            rec["instanceName"] = instance_name
            rec["assignedAt"] = _utc_now_iso()
            save_deployments(deployments)
            return rec

    # None available: create a new VM and assign it
    request_body = {
        "constraints": {
            "basicConfiguration": "cpu-4-ram-8gb-storage-25gb",
            "additionalResources": {},
            "hardware": None,
            "datacenter": None,
            "maxTotalPricePerEpochUsd": "1.5",
        },
        "instances": 1,
        "vmConfiguration": {
            "name": instance_name or "default-vm",
            "openPorts": [
                {"port": 22, "protocol": "tcp"},
                {"port": 3000, "protocol": "tcp"},
            ],
            "hostname": None,
            "osImage": "https://cloud-images.ubuntu.com/focal/current/focal-server-cloudimg-amd64.img",
            # Reuse the same SSH key as in fluence.vm default
            "sshKeys": [
                "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAICxtJrECnv5YDzeC/LWLjnAwjZeJ0JfpzZ5lPfME5T8a philosanjay5@gmail.com",
            ],
        },
    }
    deploy_result = manager.deploy_vm(request_body)
    new_records = record_new_vms_as_inactive(deploy_result, wallet_address=None)
    # Mark the first new VM as active for this miner
    deployments = load_deployments()
    assigned = None
    new_ids = {r["vmId"] for r in new_records}
    for rec in deployments:
        if rec.get("vmId") in new_ids and rec.get("status") == "inactive":
            rec["status"] = "active"
            rec["minerAddress"] = miner_address
            rec["instanceName"] = instance_name
            rec["assignedAt"] = _utc_now_iso()
            assigned = rec
            break
    if assigned is None and deployments:
        assigned = deployments[-1]
        assigned["status"] = "active"
        assigned["minerAddress"] = miner_address
        assigned["instanceName"] = instance_name
        assigned["assignedAt"] = _utc_now_iso()
    save_deployments(deployments)
    return assigned


@app.route("/deploy", methods=["POST"])
def deploy():
    manager = create_manager()
    body = request.get_json(silent=True) or None
    wallet_address = None
    if isinstance(body, dict):
        wallet_address = body.get("walletAddress") or body.get("wallet_address")
    result = manager.deploy_vm(body, wallet_address=wallet_address)
    try:
        record_new_vms_as_inactive(result, wallet_address=wallet_address)
    except Exception as e:
        logging.warning("Failed to record deployments as inactive: %s", e)
    return jsonify(result), 201 if isinstance(result, (list, dict)) else 200


@app.route("/allocate", methods=["POST"])
def allocate():
    manager = create_manager()
    data = request.get_json(force=True) or {}
    miner_address = (
        data.get("minerAddress")
        or data.get("walletAddress")
        or data.get("address")
    )
    instance_name = data.get("instanceName") or data.get("name") or "default-vm"
    if not miner_address:
        return jsonify({"error": "minerAddress is required"}), 400
    assigned = allocate_vm_to_miner(miner_address=miner_address, instance_name=instance_name, manager=manager)
    return jsonify(assigned), 200


@app.route("/vms", methods=["GET"])
def list_vms():
    _ = create_manager()
    vms = get_active_vms()
    # Merge wallet info from deployments registry
    try:
        deployments = load_deployments()
        index = _index_deployments_by_vm_id(deployments)
        augmented = []
        for vm in vms:
            vmid = str((vm.get("id") or vm.get("vmId") or "")).strip()
            rec = index.get(vmid)
            augmented.append(_attach_wallet_info(vm, rec))
        return jsonify(augmented)
    except Exception:
        # On any failure, fall back to raw VMs
        return jsonify(vms)


@app.route("/vms/<vm_id>", methods=["GET"])
def get_vm(vm_id: str):
    _ = create_manager()
    vm = get_vm_by_id(vm_id)
    # Attach wallet info if present in deployments registry
    try:
        deployments = load_deployments()
        index = _index_deployments_by_vm_id(deployments)
        rec = index.get(str(vm.get("id") or vm.get("vmId") or "").strip())
        vm = _attach_wallet_info(vm, rec)
    except Exception:
        pass
    return jsonify(vm)


@app.route("/vms", methods=["PATCH"])
def update_vms():
    manager = create_manager()
    data = request.get_json(force=True)
    updates = data.get("updates") or data
    if not isinstance(updates, list):
        return jsonify({"error": "updates must be a list"}), 400
    manager.update_vms(updates)
    return ("", 204)


@app.route("/vms", methods=["DELETE"])
def delete_vms():
    manager = create_manager()
    data = request.get_json(force=True)
    vm_ids = data.get("vmIds") or data.get("ids") or data
    if not isinstance(vm_ids, list):
        return jsonify({"error": "vmIds must be a list"}), 400
    manager.delete_vms(vm_ids)
    return ("", 204)


@app.route("/vms/<vm_id>/exec", methods=["POST"])
def exec_on_vm(vm_id: str):
    manager = create_manager()
    data = request.get_json(force=True)
    command = data.get("command")
    if not command:
        return jsonify({"error": "command is required"}), 400
    key_path = data.get("key_path") or os.path.join(os.path.dirname(__file__), "keys", "fluence")
    username = data.get("username") or "ubuntu"
    code = manager.execute_on_vm(vm_id, command, key_path=key_path, username=username)
    return jsonify({"exit_code": code})


@app.route("/vms/<vm_id>/upload", methods=["POST"])
def upload_to_vm(vm_id: str):
    manager = create_manager()
    if "file" not in request.files:
        return jsonify({"error": "multipart file field 'file' is required"}), 400
    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "empty filename"}), 400
    remote_path = request.form.get("remote_path") or f"~/uploads/{secure_filename(file.filename)}"
    key_path = request.form.get("key_path") or os.path.join(os.path.dirname(__file__), "keys", "fluence")
    username = request.form.get("username") or "ubuntu"

    with tempfile.NamedTemporaryFile(delete=False) as tmp:
        file.save(tmp.name)
        tmp_path = tmp.name
    try:
        code = manager.upload_file(vm_id, tmp_path, remote_path, key_path=key_path, username=username)
    finally:
        try:
            os.remove(tmp_path)
        except Exception:
            pass
    return jsonify({"exit_code": code, "remote_path": remote_path})


@app.route("/vms/<vm_id>/docker/url", methods=["POST"])
def docker_from_url(vm_id: str):
    manager = create_manager()
    data = request.get_json(force=True)
    dockerfile_url = data.get("dockerfile_url")
    if not dockerfile_url:
        return jsonify({"error": "dockerfile_url is required"}), 400
    workdir = data.get("workdir") or "ubuntu-docker"
    key_path = data.get("key_path") or os.path.join(os.path.dirname(__file__), "keys", "fluence")
    username = data.get("username") or "ubuntu"

    cmd = build_docker_setup_command(dockerfile_url, workdir=workdir)
    code = manager.execute_on_vm(vm_id, cmd, key_path=key_path, username=username)
    return jsonify({"exit_code": code})


@app.route("/vms/<vm_id>/docker/local", methods=["POST"])
def docker_from_local(vm_id: str):
    manager = create_manager()
    # Expect a Dockerfile upload under 'file'
    if "file" not in request.files:
        return jsonify({"error": "multipart file field 'file' is required"}), 400
    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "empty filename"}), 400

    remote_dir = request.form.get("remote_dir") or "ubuntu-docker"
    exposed_port = int(request.form.get("port") or 3000)
    key_path = request.form.get("key_path") or os.path.join(os.path.dirname(__file__), "keys", "fluence")
    username = request.form.get("username") or "ubuntu"

    remote_dockerfile_path = f"~/{remote_dir}/Dockerfile"

    # Optionally inject GITHUB_TOKEN into git clone lines
    github_token = os.getenv("GITHUB_TOKEN")
    local_tmp = None
    with tempfile.NamedTemporaryFile(delete=False, mode="wb") as tmp:
        file.save(tmp)
        local_tmp = tmp.name

    try:
        if github_token:
            try:
                with open(local_tmp, "r+", encoding="utf-8") as f:
                    contents = f.read()
                    if "git clone https://github.com/" in contents:
                        contents = contents.replace(
                            "git clone https://github.com/",
                            f"git clone https://x-access-token:{github_token}@github.com/",
                        )
                        f.seek(0)
                        f.truncate(0)
                        f.write(contents)
            except Exception:
                pass

        up_rc = manager.upload_file(vm_id, local_tmp, remote_dockerfile_path, key_path=key_path, username=username)
        if up_rc != 0:
            return jsonify({"exit_code": up_rc, "error": "upload failed"}), 400

        cmd = build_docker_setup_from_local(remote_dockerfile_dir=remote_dir, exposed_port=exposed_port)
        code = manager.execute_on_vm(vm_id, cmd, key_path=key_path, username=username)
        return jsonify({"exit_code": code})
    finally:
        try:
            os.remove(local_tmp)
        except Exception:
            pass


@app.route("/vms/<vm_id>/docker/stop", methods=["POST"])
def docker_stop(vm_id: str):
    manager = create_manager()
    data = request.get_json(silent=True) or {}
    container_name = data.get("container_name") or "my-ubuntu-container"
    key_path = data.get("key_path") or os.path.join(os.path.dirname(__file__), "keys", "fluence")
    username = data.get("username") or "ubuntu"

    cmd = build_docker_stop_command(container_name=container_name)
    code = manager.execute_on_vm(vm_id, cmd, key_path=key_path, username=username)

    # If container stop succeeded, unassociate VM from miner in deployments registry
    try:
        if code == 0:
            deployments = load_deployments()
            changed = False
            needle = str(vm_id).strip().lower()
            for rec in deployments:
                vmid = str(rec.get("vmId") or "").strip().lower()
                altid = str(rec.get("id") or "").strip().lower()
                if vmid == needle or altid == needle:
                    rec["status"] = "inactive"
                    rec.pop("minerAddress", None)
                    rec.pop("instanceName", None)
                    rec.pop("assignedAt", None)
                    rec["releasedAt"] = _utc_now_iso()
                    changed = True
                    break
            if changed:
                save_deployments(deployments)
    except Exception as e:
        logging.warning("Failed to update deployments registry on stop: %s", e)

    return jsonify({"exit_code": code})


@app.route("/validator", methods=["POST"])
def validator():
    data = request.get_json(force=True) or {}
    user_input = data.get("input") or data.get("text") or data.get("message")
    if not isinstance(user_input, str):
        return jsonify({"error": "input must be a string"}), 400

    vms = data.get("vms")
    if not isinstance(vms, list):
        vms = []

    # Iterate VMs, call their /api/chat, and attach results to the same JSON
    for vm in vms:
        try:
            if not isinstance(vm, dict):
                continue
            public_ip = vm.get("publicIp") or vm.get("public_ip")
            if public_ip:
                api_url = f"http://{public_ip}:3000/api/chat"
            else:
                vm.setdefault("validator", {})
                vm["validator"].update({
                    "error": "No publicIp or apiUrl provided for VM",
                })
                continue

            payload = {
                "prompt": f"{user_input} (Return only the answer)",
                "temperature": 0.2,
            }
            print(api_url)
            try:
                import requests  # type: ignore
                resp = requests.post(api_url, json=payload, timeout=30)
                status = resp.status_code
                try:
                    resp_json = resp.json()
                except Exception:
                    resp_json = {"text": resp.text}
                vm.setdefault("validator", {})
                vm["validator"].update({
                    "apiUrl": api_url,
                    "request": payload,
                    "status": status,
                    "response": resp_json,
                })
            except Exception as e:
                vm.setdefault("validator", {})
                vm["validator"].update({
                    "apiUrl": api_url,
                    "request": payload,
                    "error": str(e),
                })
        except Exception as e:
            logging.warning("Validator per-VM error: %s", e)

    data["vms"] = vms
    print(data)
    # Compute scores inline
    try:
        synthetic_messages = [{"message": json.dumps(data)}]
        pairs = _parse_messages_to_pairs(synthetic_messages)
        print({"validator_parse": {"pairs": len(pairs)}})
        for p in pairs:
            p["score"] = _openai_score_answer(
                question=str(p.get("question") or ""),
                truth=str(p.get("truth") or ""),
                candidate=str(p.get("candidate") or ""),
            )
            try:
                q = str(p.get("question") or "")
                t = str(p.get("truth") or "")
                c = str(p.get("candidate") or "")
                w = str(p.get("walletId") or "")
                def _trunc(s: str, n: int = 160) -> str:
                    return s if len(s) <= n else s[:n] + "…"
                print({
                    "validator_pair": "scored",
                    "walletId": w,
                    "score": p.get("score"),
                    "question": _trunc(q),
                    "truth": _trunc(t),
                    "candidate": _trunc(c),
                })
            except Exception:
                pass
        aggregated = _aggregate_scores(pairs)
        try:
            overall_avg = int(round(sum(int(a.get("score") or 0) for a in aggregated) / max(1, len(aggregated)))) if aggregated else 0
            print({
                "validator_summary": {
                    "pairs": len(pairs),
                    "wallets": len(aggregated),
                    "overall_avg": overall_avg,
                    "aggregated": aggregated,
                }
            })
        except Exception:
            pass
    except Exception as e:
        logging.warning("Validator scoring error: %s", e)
        pairs = []
        aggregated = []

    # Before returning, send this JSON as a string to the Next.js topic creation API
    try:
        import requests  # type: ignore
        payload_str = json.dumps(data)
        base = os.getenv("NEXT_API_BASE_URL", "http://localhost:3000")
        topic_url = f"{base.rstrip('/')}/api/topic/create"
        resp = requests.post(
            topic_url,
            data=payload_str,
            headers={"Content-Type": "text/plain"},
            timeout=30,
        )
        try:
            print(resp.json())
        except Exception:
            try:
                print({"create_topic_response_text": resp.text})
            except Exception:
                pass
        try:
            body = resp.json()
        except Exception:
            body = {"raw": resp.text}

        # Extract topicId from common response shapes
        topic_id = None
        if isinstance(body, dict):
            topic_id = body.get("topicId") or body.get("topic_id")
            if not topic_id and isinstance(body.get("data"), dict):
                topic_id = body["data"].get("topicId") or body["data"].get("topic_id")

        if not topic_id:
            return jsonify({
                "error": "Topic creation failed",
                "status": resp.status_code,
                "response": body,
            }), 502

        # Submit the VM results to the topic
        try:
            submit_url = f"{base.rstrip('/')}/api/topic/submit"
            submit_body = {
                "topicId": topic_id,
                "message": payload_str,
            }
            submit_resp = requests.post(submit_url, json=submit_body, timeout=30)
            try:
                print(submit_resp.json())
            except Exception:
                try:
                    print({"submit_response_text": submit_resp.text})
                except Exception:
                    pass
        except Exception:
            pass

        # Submit the aggregated scores to the same topic
        try:
            scores_payload = {
                "type": "scores",
                "topicId": topic_id,
                "timestamp": _utc_now_iso(),
                "scores": aggregated,
                "pairs": [{k: v for k, v in p.items() if k in ("walletId", "score")} for p in pairs],
            }
            submit_url = f"{base.rstrip('/')}/api/topic/submit"
            _ = requests.post(submit_url, json={"topicId": topic_id, "message": json.dumps(scores_payload)}, timeout=30)
        except Exception:
            pass

        # Also submit final wallet scores to master topic
        try:
            master_topic = os.getenv("MASTER_SCORE_TOPIC", "0.0.6916998")
            if isinstance(master_topic, str) and master_topic.strip():
                master_message = {
                    "type": "final_scores",
                    "sourceTopicId": topic_id,
                    "timestamp": _utc_now_iso(),
                    "scores": aggregated,  # [{ walletId, score }]
                }
                _ = requests.post(
                    submit_url,
                    json={"topicId": master_topic.strip(), "message": json.dumps(master_message)},
                    timeout=30,
                )
        except Exception:
            pass

        return jsonify({"topicId": topic_id})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    app.run(host="0.0.0.0", port=port) 