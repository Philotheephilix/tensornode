import os
import json
import tempfile
import logging
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
    return jsonify(vms)


@app.route("/vms/<vm_id>", methods=["GET"])
def get_vm(vm_id: str):
    _ = create_manager()
    vm = get_vm_by_id(vm_id)
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
    logging.info("Validator input: %s", user_input)
    return jsonify({"valid": True, "input": user_input})


if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    app.run(host="0.0.0.0", port=port) 