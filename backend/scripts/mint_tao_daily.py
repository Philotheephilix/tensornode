import json
import os
import sys
import math
import argparse
from datetime import datetime, timedelta, timezone


def _utc_now_iso() -> str:
    return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"


def _should_run(last_runs: list[str], min_interval_hours: int) -> bool:
    if not last_runs:
        return True
    try:
        last = last_runs[-1]
        ts = datetime.fromisoformat(last.replace('Z', ''))
        return datetime.utcnow() - ts >= timedelta(hours=min_interval_hours)
    except Exception:
        return True


def _parse_consensus_time(ts: str) -> datetime:
    # Hedera mirror consensus_timestamp like "1695840000.123456789"
    try:
        if "." in ts:
            sec, nano = ts.split(".", 1)
            return datetime.fromtimestamp(int(sec), tz=timezone.utc)
        return datetime.fromtimestamp(int(ts), tz=timezone.utc)
    except Exception:
        return datetime.min.replace(tzinfo=timezone.utc)


def _fetch_master_scores(base_url: str, topic_id: str, hours: int = 24, limit: int = 500) -> dict:
    """Fetch final_scores messages from master topic within the last `hours` and compute per-wallet average."""
    try:
        import requests  # type: ignore
    except Exception:
        print("[mint-tao] The 'requests' package is required. pip install requests")
        return {}

    url = f"{base_url.rstrip('/')}/api/topic/messages?topicId={topic_id}&limit={limit}&order=desc"
    try:
        resp = requests.get(url, timeout=60)
        data = resp.json() if resp.ok else {}
    except Exception as e:
        print(f"[mint-tao] Failed to fetch master scores: {e}")
        return {}

    messages = (data.get("data", {}) or {}).get("messages") or data.get("messages") or []
    cutoff = datetime.utcnow().replace(tzinfo=timezone.utc) - timedelta(hours=hours)

    per_wallet_scores: dict[str, list[int]] = {}
    for m in messages:
        try:
            # Filter by consensus timestamp
            cts = m.get("consensus_timestamp") or m.get("consensusTimestamp")
            if cts:
                when = _parse_consensus_time(str(cts))
                if when < cutoff:
                    continue
            # Parse the decoded message JSON
            raw = m.get("message")
            if not isinstance(raw, str):
                continue
            obj = json.loads(raw)
            if not isinstance(obj, dict):
                continue
            if obj.get("type") not in ("final_scores", "scores"):
                continue
            scores = obj.get("scores")
            if not isinstance(scores, list):
                continue
            for rec in scores:
                if not isinstance(rec, dict):
                    continue
                wallet = rec.get("walletId") or rec.get("wallet") or rec.get("address")
                val = rec.get("score")
                if isinstance(wallet, str) and wallet.strip() and isinstance(val, (int, float)):
                    per_wallet_scores.setdefault(wallet.strip(), []).append(int(val))
        except Exception:
            continue

    # Compute averages
    avg_scores: dict[str, int] = {}
    for wallet, arr in per_wallet_scores.items():
        if not arr:
            continue
        avg_scores[wallet] = int(round(sum(arr) / len(arr)))
    return avg_scores


def _fetch_recent_validators(base_url: str, topic_id: str, hours: int = 24, limit: int = 500) -> list[str]:
    """Return unique accountIds that posted validator_submit within last hours."""
    try:
        import requests  # type: ignore
    except Exception:
        return []
    url = f"{base_url.rstrip('/')}/api/topic/messages?topicId={topic_id}&limit={limit}&order=desc"
    try:
        resp = requests.get(url, timeout=60)
        data = resp.json() if resp.ok else {}
    except Exception:
        return []
    messages = (data.get("data", {}) or {}).get("messages") or data.get("messages") or []
    cutoff = datetime.utcnow().replace(tzinfo=timezone.utc) - timedelta(hours=hours)
    out: set[str] = set()
    for m in messages:
        try:
            cts = m.get("consensus_timestamp") or m.get("consensusTimestamp")
            if cts:
                when = _parse_consensus_time(str(cts))
                if when < cutoff:
                    continue
            raw = m.get("message")
            if not isinstance(raw, str):
                continue
            obj = json.loads(raw)
            if not isinstance(obj, dict):
                continue
            if obj.get("type") != "validator_submit":
                continue
            acc = obj.get("accountId")
            if isinstance(acc, str) and acc.strip():
                out.add(acc.strip())
        except Exception:
            continue
    return sorted(list(out))


def _compute_distribution(total: int, avg_scores: dict[str, int], validators: list[str]) -> tuple[list[tuple[str, int]], int]:
    """Return list of (receiverAccount, amount) and leftover that remains in treasury.
    Fixed payouts:
      - 20% to 0.0.5864744
      - 35% to miners proportional to score
      - 20% to 0.0.6914866
      - remainder kept in treasury
    """
    payouts: list[tuple[str, int]] = []
    a_fixed = int(math.floor(0.20 * total))
    b_fixed = int(math.floor(0.20 * total))
    miners_pool = int(math.floor(0.35 * total))
    validators_pool = int(math.floor(0.25 * total))

    # Fixed recipients
    if a_fixed > 0:
        payouts.append(("0.0.5864744", a_fixed))
    if b_fixed > 0:
        payouts.append(("0.0.6914866", b_fixed))

    # Miners proportional allocation
    miner_items = [(w, max(0, int(s))) for w, s in avg_scores.items() if isinstance(w, str)]
    score_sum = sum(s for _, s in miner_items)
    miner_alloc_total = 0
    if miners_pool > 0 and score_sum > 0 and miner_items:
        # First pass: floor allocation
        shares = []  # (wallet, base_amount, remainder_fraction)
        for w, s in miner_items:
            raw = (miners_pool * s) / score_sum
            base = int(math.floor(raw))
            frac = raw - base
            if base > 0:
                payouts.append((w, base))
                miner_alloc_total += base
            shares.append((w, base, frac))
        # Distribute remaining due to rounding to highest fractions
        remaining = miners_pool - miner_alloc_total
        if remaining > 0:
            shares.sort(key=lambda x: x[2], reverse=True)
            idx = 0
            while remaining > 0 and idx < len(shares):
                w, base, _ = shares[idx]
                # Increase payout for this wallet by 1
                for i in range(len(payouts)):
                    if payouts[i][0] == w:
                        payouts[i] = (w, payouts[i][1] + 1)
                        break
                else:
                    payouts.append((w, 1))
                miner_alloc_total += 1
                remaining -= 1
                idx += 1

    distributed = sum(amount for _, amount in payouts)
    # Validators equal split of remaining 25%
    if validators_pool > 0 and validators:
        each = validators_pool // len(validators)
        remainder = validators_pool - each * len(validators)
        for acc in validators:
            if each > 0:
                payouts.append((acc, each))
        # Distribute remainder by +1 to first N
        for i in range(remainder):
            acc = validators[i % len(validators)]
            # bump that account by 1
            for j in range(len(payouts)):
                if payouts[j][0] == acc:
                    payouts[j] = (acc, payouts[j][1] + 1)
                    break

    distributed = sum(amount for _, amount in payouts)
    leftover = total - distributed
    return payouts, leftover


def main() -> int:
    parser = argparse.ArgumentParser(description="Mint 7200 TAO tokens daily and distribute based on master scores")
    parser.add_argument("--base", dest="base_url", default=os.getenv("NEXT_API_BASE_URL", "http://localhost:3000"), help="Base URL of Next.js app (default: env NEXT_API_BASE_URL or http://localhost:3000)")
    parser.add_argument("--deployment", dest="deployment_path", default=os.getenv("TAO_TOKEN_FILE", os.path.join(os.path.dirname(__file__), "..", "tao_token.json")), help="Path to TAO deployment JSON (default: backend/tao_token.json)")
    parser.add_argument("--amount", type=int, default=7200, help="Amount to mint per run (default: 7200)")
    parser.add_argument("--min-hours", type=int, default=24, help="Minimum interval between runs in hours (default: 24)")
    parser.add_argument("--master-topic", default=os.getenv("MASTER_SCORE_TOPIC", "0.0.6916998"), help="Master score topic ID (default: env MASTER_SCORE_TOPIC or 0.0.6916998)")
    parser.add_argument("--force", action="store_true", help="Force mint even if interval not elapsed")
    args = parser.parse_args()

    deployment_path = os.path.abspath(args.deployment_path)
    if not os.path.exists(deployment_path):
        print(f"[mint-tao] Deployment file not found: {deployment_path}. Run create_tao_token.py first.")
        return 2

    try:
        with open(deployment_path, "r", encoding="utf-8") as f:
            deployment = json.load(f)
    except Exception as e:
        print(f"[mint-tao] Failed to read deployment JSON: {e}")
        return 3

    token_id = deployment.get("tokenId")
    if not token_id:
        print("[mint-tao] tokenId missing in deployment JSON")
        return 4

    last_runs = deployment.get("mint", {}).get("lastRuns", []) or []
    if not args.force and not _should_run(last_runs, args.min_hours):
        print("[mint-tao] Skipping: min interval not elapsed yet")
        return 0

    # 1) Fetch master scores for the last 24 hours
    avg_scores = _fetch_master_scores(args.base_url, args.master_topic, hours=24, limit=500)
    print(f"[mint-tao] Master scores (24h avg): {avg_scores}")
    # Also fetch active validators (last 24h)
    validators_topic = os.getenv("VALIDATORS_TOPIC", "0.0.6917106")
    validators = _fetch_recent_validators(args.base_url, validators_topic, hours=24, limit=500)
    print(f"[mint-tao] Active validators (24h): {validators}")

    # 2) Compute distribution plan
    payouts, leftover = _compute_distribution(int(args.amount), avg_scores, validators)
    print(f"[mint-tao] Distribution plan: payouts={payouts}, leftover={leftover}")

    try:
        import requests  # type: ignore
    except Exception:
        print("[mint-tao] The 'requests' package is required. pip install requests")
        return 5

    # 3) Mint total once
    mint_url = f"{args.base_url.rstrip('/')}/api/token/mint"
    mint_payload = {"tokenId": token_id, "amount": int(args.amount)}
    print(f"[mint-tao] Minting at {mint_url} with payload: {mint_payload}")
    resp = requests.post(mint_url, json=mint_payload, timeout=60)
    try:
        body = resp.json()
    except Exception:
        print(f"[mint-tao] Non-JSON response: HTTP {resp.status_code} {resp.text[:400]}")
        return 6
    if not resp.ok or not isinstance(body, dict) or not body.get("ok"):
        print(f"[mint-tao] Mint error: {body}")
        return 7

    # 4) Execute transfers for payouts using existing supply
    transfer_url = f"{args.base_url.rstrip('/')}/api/token/transfer"
    for receiver, amount in payouts:
        if amount <= 0:
            continue
        payload = {
            "tokenId": token_id,
            "receiverAccount": receiver,
            "amount": int(amount),
            "mintBeforeTransfer": False,
        }
        print(f"[mint-tao] Transferring {amount} to {receiver}")
        tr = requests.post(transfer_url, json=payload, timeout=60)
        try:
            tr_body = tr.json()
        except Exception:
            print(f"[mint-tao] Transfer non-JSON response: HTTP {tr.status_code} {tr.text[:300]}")
            return 9
        if not tr.ok or not isinstance(tr_body, dict) or not tr_body.get("ok"):
            print(f"[mint-tao] Transfer error for {receiver}: {tr_body}")
            return 10

    # 5) Record payout
    try:
        ts = _utc_now_iso()
        deployment.setdefault("mint", {}).setdefault("lastRuns", []).append(ts)
        payout_rec = {
            "timestamp": ts,
            "amount": int(args.amount),
            "payouts": [{"receiver": r, "amount": a} for r, a in payouts],
            "leftover": leftover,
            "masterTopic": args.master_topic,
        }
        deployment.setdefault("payouts", []).append(payout_rec)
        with open(deployment_path, "w", encoding="utf-8") as f:
            json.dump(deployment, f, indent=2)
        print(f"[mint-tao] Payout complete. Recorded in {deployment_path}")
    except Exception as e:
        print(f"[mint-tao] Payout complete but failed to update deployment JSON: {e}")
        return 8

    return 0


if __name__ == "__main__":
    sys.exit(main())


