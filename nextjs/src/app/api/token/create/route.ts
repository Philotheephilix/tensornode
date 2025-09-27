import { NextRequest } from 'next/server';
import { createErrorResponse, createSuccessResponse } from '@/lib/api-utils';
import { AccountId, PrivateKey, Client, TokenCreateTransaction, TokenType } from '@hashgraph/sdk';
import { z } from 'zod';

export const runtime = 'nodejs';

const CreateSchema = z.object({
	tokenName: z.string().min(1),
	tokenSymbol: z.string().min(1),
	initialSupply: z.number().int().nonnegative(),
	decimals: z.number().int().min(0).max(18).optional().default(0),
});

export async function POST(req: NextRequest) {
	let client: Client | undefined;
	try {
		const body = await req.json();
		const { tokenName, tokenSymbol, initialSupply, decimals } = CreateSchema.parse(body);

		const MY_ACCOUNT_ID = AccountId.fromString('0.0.5864744');
		const MY_PRIVATE_KEY = PrivateKey.fromStringED25519('d04f46918ebce20abe26f7d34e5018ac2ba8aa7ffacf9f817656789b36f76207');

		client = Client.forTestnet();
		client.setOperator(MY_ACCOUNT_ID, MY_PRIVATE_KEY);

		const txTokenCreate = await new TokenCreateTransaction()
			.setTokenName(tokenName)
			.setTokenSymbol(tokenSymbol)
			.setTokenType(TokenType.FungibleCommon)
			.setTreasuryAccountId(MY_ACCOUNT_ID)
			.setInitialSupply(initialSupply)
			.setDecimals(decimals)
			.setSupplyKey(MY_PRIVATE_KEY.publicKey)
			.freezeWith(client);

		const signTxTokenCreate = await txTokenCreate.sign(MY_PRIVATE_KEY);
		const txTokenCreateResponse = await signTxTokenCreate.execute(client);
		const receiptTokenCreateTx = await txTokenCreateResponse.getReceipt(client);

		const status = receiptTokenCreateTx.status.toString();
		const transactionId = txTokenCreateResponse.transactionId.toString();
		const tokenId = receiptTokenCreateTx.tokenId?.toString();
		const hashscanUrl = `https://hashscan.io/testnet/tx/${transactionId}`;

		return createSuccessResponse({
			network: 'testnet',
			status,
			transactionId,
			hashscanUrl,
			tokenId,
			tokenName,
			tokenSymbol,
			initialSupply,
			decimals,
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Unknown error';
		return createErrorResponse(message);
	} finally {
		if (client) client.close();
	}
} 