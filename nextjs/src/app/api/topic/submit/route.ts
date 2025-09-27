import { NextRequest } from 'next/server';
import { createErrorResponse, createSuccessResponse } from '@/lib/api-utils';
import { AccountId, PrivateKey, Client, TopicMessageSubmitTransaction, TopicId } from '@hashgraph/sdk';
import { z } from 'zod';

export const runtime = 'nodejs';

const SubmitSchema = z.object({
	topicId: z.string().min(1),
	message: z.string().min(1),
});

export async function POST(req: NextRequest) {
	let client: Client | undefined;
	try {
		const body = await req.json();
		const { topicId, message } = SubmitSchema.parse(body);

		const MY_ACCOUNT_ID = AccountId.fromString('0.0.5864744');
		const MY_PRIVATE_KEY = PrivateKey.fromStringED25519('d04f46918ebce20abe26f7d34e5018ac2ba8aa7ffacf9f817656789b36f76207');

		client = Client.forTestnet();
		client.setOperator(MY_ACCOUNT_ID, MY_PRIVATE_KEY);

		const txTopicMessageSubmit = await new TopicMessageSubmitTransaction()
			.setTopicId(TopicId.fromString(topicId))
			.setMessage(message);

		const txTopicMessageSubmitResponse = await txTopicMessageSubmit.execute(client);
		const receiptTopicMessageSubmitTx = await txTopicMessageSubmitResponse.getReceipt(client);

		const status = receiptTopicMessageSubmitTx.status.toString();
		const txId = txTopicMessageSubmitResponse.transactionId.toString();
		const hashscanUrl = `https://hashscan.io/testnet/tx/${txId}`;
		const submittedMessage = txTopicMessageSubmit.getMessage()?.toString();

		return createSuccessResponse({
			network: 'testnet',
			status,
			transactionId: txId,
			hashscanUrl,
			topicId,
			message: submittedMessage,
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Unknown error';
		return createErrorResponse(message);
	} finally {
		if (client) client.close();
	}
} 