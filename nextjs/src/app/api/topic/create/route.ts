import { NextRequest } from 'next/server';
import { createErrorResponse, createSuccessResponse } from '@/lib/api-utils';
import { AccountId, PrivateKey, Client, TopicCreateTransaction } from '@hashgraph/sdk';

export const runtime = 'nodejs';

export async function POST(_req: NextRequest) {
    let client: Client | undefined;
    try {
        const MY_ACCOUNT_ID = AccountId.fromString('0.0.5864744');
        const MY_PRIVATE_KEY = PrivateKey.fromStringED25519('d04f46918ebce20abe26f7d34e5018ac2ba8aa7ffacf9f817656789b36f76207');

        client = Client.forTestnet();
        client.setOperator(MY_ACCOUNT_ID, MY_PRIVATE_KEY);

        const txCreateTopic = new TopicCreateTransaction();
        const txCreateTopicResponse = await txCreateTopic.execute(client);
        const receiptCreateTopicTx = await txCreateTopicResponse.getReceipt(client);

        const statusCreateTopicTx = receiptCreateTopicTx.status.toString();
        const txCreateTopicId = txCreateTopicResponse.transactionId.toString();
        const topicId = receiptCreateTopicTx.topicId?.toString();
        const hashscanUrl = `https://hashscan.io/testnet/tx/${txCreateTopicId}`;

        return createSuccessResponse({
            network: 'testnet',
            status: statusCreateTopicTx,
            transactionId: txCreateTopicId,
            hashscanUrl,
            topicId,
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return createErrorResponse(message);
    } finally {
        if (client) client.close();
    }
} 