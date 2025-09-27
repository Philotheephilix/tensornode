import { NextRequest } from 'next/server';
import { createErrorResponse, createSuccessResponse } from '@/lib/api-utils';
import { z } from 'zod';
import { AccountId, PrivateKey, Client, TokenMintTransaction, TokenId } from '@hashgraph/sdk';

export const runtime = 'nodejs';

const MintSchema = z.object({
	tokenId: z.string().min(1),
	amount: z.number().int().positive(),
});

export async function POST(req: NextRequest) {
	let client: Client | undefined;
	try {
		const body = await req.json();
		const { tokenId, amount } = MintSchema.parse(body);

		const MY_ACCOUNT_ID = AccountId.fromString('0.0.5864744');
		const MY_PRIVATE_KEY = PrivateKey.fromStringED25519('d04f46918ebce20abe26f7d34e5018ac2ba8aa7ffacf9f817656789b36f76207');

		client = Client.forTestnet();
		client.setOperator(MY_ACCOUNT_ID, MY_PRIVATE_KEY);

		const txTokenMint = await new TokenMintTransaction()
			.setTokenId(TokenId.fromString(tokenId))
			.setAmount(amount)
			.freezeWith(client);

		const signTxTokenMint = await txTokenMint.sign(MY_PRIVATE_KEY);
		const txTokenMintResponse = await signTxTokenMint.execute(client);
		const receiptTokenMintTx = await txTokenMintResponse.getReceipt(client);

		const status = receiptTokenMintTx.status.toString();
		const transactionId = txTokenMintResponse.transactionId.toString();
		const hashscanUrl = `https://hashscan.io/testnet/tx/${transactionId}`;

		return createSuccessResponse({
			network: 'testnet',
			status,
			transactionId,
			hashscanUrl,
			tokenId,
			amount,
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Unknown error';
		return createErrorResponse(message);
	} finally {
		if (client) client.close();
	}
} 