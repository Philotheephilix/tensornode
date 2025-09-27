import { NextRequest } from 'next/server';
import { createErrorResponse, createSuccessResponse } from '@/lib/api-utils';
import { z } from 'zod';
import { AccountId, PrivateKey, Client, TokenMintTransaction, TransferTransaction, TokenId } from '@hashgraph/sdk';

export const runtime = 'nodejs';

const TransferSchema = z.object({
	tokenId: z.string().min(1),
	receiverAccount: z.string().min(1),
	amount: z.number().int().positive(),
	mintBeforeTransfer: z.boolean().optional().default(true),
});

export async function POST(req: NextRequest) {
	let client: Client | undefined;
	try {
		const body = await req.json();
		const { tokenId, receiverAccount, amount, mintBeforeTransfer } = TransferSchema.parse(body);

		const MY_ACCOUNT_ID = AccountId.fromString('0.0.5864744');
		const MY_PRIVATE_KEY = PrivateKey.fromStringED25519('d04f46918ebce20abe26f7d34e5018ac2ba8aa7ffacf9f817656789b36f76207');

		client = Client.forTestnet();
		client.setOperator(MY_ACCOUNT_ID, MY_PRIVATE_KEY);

		let mintTxId: string | undefined;
		if (mintBeforeTransfer) {
			const txTokenMint = await new TokenMintTransaction()
				.setTokenId(TokenId.fromString(tokenId))
				.setAmount(amount)
				.freezeWith(client);
			const signTxTokenMint = await txTokenMint.sign(MY_PRIVATE_KEY);
			const txTokenMintResponse = await signTxTokenMint.execute(client);
			await txTokenMintResponse.getReceipt(client);
			mintTxId = txTokenMintResponse.transactionId.toString();
		}

		const txTransfer = await new TransferTransaction()
			.addTokenTransfer(TokenId.fromString(tokenId), MY_ACCOUNT_ID, -amount)
			.addTokenTransfer(TokenId.fromString(tokenId), AccountId.fromString(receiverAccount), amount)
			.freezeWith(client);

		const signTxTransfer = await txTransfer.sign(MY_PRIVATE_KEY);
		const txTransferResponse = await signTxTransfer.execute(client);
		const receiptTransferTx = await txTransferResponse.getReceipt(client);

		const status = receiptTransferTx.status.toString();
		const transactionId = txTransferResponse.transactionId.toString();
		const hashscanUrl = `https://hashscan.io/testnet/tx/${transactionId}`;

		return createSuccessResponse({
			network: 'testnet',
			status,
			transactionId,
			hashscanUrl,
			tokenId,
			receiverAccount,
			amount,
			mintTransactionId: mintTxId,
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Unknown error';
		return createErrorResponse(message);
	} finally {
		if (client) client.close();
	}
} 