import json
import os
import sys
import argparse
from datetime import datetime


def _utc_now_iso() -> str:
    return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"


def main() -> int:
    parser = argparse.ArgumentParser(description="Create TAO token via Next.js /api/token/create and store deployment JSON")
    parser.add_argument("--name", default="TAO", help="Token name (default: TAO)")
    parser.add_argument("--symbol", default="TAO", help="Token symbol (default: TAO)")
    parser.add_argument("--initial", type=int, default=0, help="Initial supply (default: 0)")
    parser.add_argument("--decimals", type=int, default=0, help="Token decimals (default: 0)")
    parser.add_argument("--base", dest="base_url", default=os.getenv("NEXT_API_BASE_URL", "http://localhost:3000"), help="Base URL of Next.js app (default: env NEXT_API_BASE_URL or http://localhost:3000)")
    parser.add_argument("--out", dest="out_path", default=os.getenv("TAO_TOKEN_FILE", os.path.join(os.path.dirname(__file__), "..", "tao_token.json")), help="Path to write TAO deployment JSON (default: backend/tao_token.json)")
    parser.add_argument("--force", action="store_true", help="Overwrite existing deployment JSON and re-create token")
    args = parser.parse_args()

    out_path = os.path.abspath(args.out_path)
    if os.path.exists(out_path) and not args.force:
        print(f"[create-tao] Deployment file already exists: {out_path}. Use --force to overwrite.")
        return 0

    try:
        import requests  # type: ignore
    except Exception:
        print("[create-tao] The 'requests' package is required. pip install requests")
        return 2

    url = f"{args.base_url.rstrip('/')}/api/token/create"
    payload = {
        "tokenName": args.name,
        "tokenSymbol": args.symbol,
        "initialSupply": int(args.initial),
        "decimals": int(args.decimals),
    }

    print(f"[create-tao] Creating token at {url} with payload: {payload}")
    resp = requests.post(url, json=payload, timeout=60)
    try:
        body = resp.json()
    except Exception:
        print(f"[create-tao] Non-JSON response: HTTP {resp.status_code} {resp.text[:400]}")
        return 3

    if not resp.ok or not isinstance(body, dict) or not body.get("ok"):
        print(f"[create-tao] Error: {body}")
        return 4

    token_id = body.get("tokenId")
    if not token_id:
        print(f"[create-tao] Missing tokenId in response: {body}")
        return 5

    deployment = {
        "tokenId": token_id,
        "tokenName": body.get("tokenName") or args.name,
        "tokenSymbol": body.get("tokenSymbol") or args.symbol,
        "initialSupply": body.get("initialSupply") if body.get("initialSupply") is not None else args.initial,
        "decimals": body.get("decimals") if body.get("decimals") is not None else args.decimals,
        "network": body.get("network") or "testnet",
        "transactionId": body.get("transactionId"),
        "hashscanUrl": body.get("hashscanUrl"),
        "createdAt": _utc_now_iso(),
        "mint": {
            "amountPerDay": 7200,
            "lastRuns": [],
        },
    }

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(deployment, f, indent=2)
    print(f"[create-tao] Saved deployment JSON -> {out_path}\n[create-tao] tokenId={token_id}")
    return 0


if __name__ == "__main__":
    sys.exit(main())


