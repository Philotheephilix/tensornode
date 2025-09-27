import { AccountId } from '@hashgraph/sdk';

export type AccountIdLike =
  | string
  | AccountId
  | { shard: string | number; realm: string | number; num: string | number }
  | [string | number, string | number, string | number];

function toAccountId(input: AccountIdLike): AccountId {
  if (input instanceof AccountId) return input;
  if (typeof input === 'string') return AccountId.fromString(input);
  if (Array.isArray(input)) {
    const [shard, realm, num] = input;
    return new AccountId(Number(shard), Number(realm), Number(num));
  }
  if (typeof input === 'object' && input !== null) {
    const { shard, realm, num } = input as { shard: string | number; realm: string | number; num: string | number };
    return new AccountId(Number(shard), Number(realm), Number(num));
  }
  throw new Error('Unsupported AccountIdLike input');
}

/**
 * Convert an `AccountId` (or 0.0.x string/tuple) to a 20-byte solidity address hex string (no 0x prefix).
 */
export function toSolidityAddress(address: AccountIdLike): string {
  const id = toAccountId(address);
  // SDK returns 40-char hex without 0x
  return id.toSolidityAddress();
}

/**
 * Parse a solidity address (with or without 0x) into shard/realm/num and string AccountId.
 */
export function fromSolidityAddress(address: string): { shard: string; realm: string; num: string; accountId: string } {
  const normalized = address.startsWith('0x') || address.startsWith('0X') ? address : `0x${address}`;
  const id = AccountId.fromSolidityAddress(normalized);
  return {
    shard: String(id.shard),
    realm: String(id.realm),
    num: String(id.num),
    accountId: id.toString(),
  };
} 