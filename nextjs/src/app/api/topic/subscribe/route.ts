import { NextRequest } from 'next/server';
import { createErrorResponse } from '@/lib/api-utils';
import { AccountId, PrivateKey, Client, TopicMessageQuery, TopicId } from '@hashgraph/sdk';

export const runtime = 'nodejs';

function serializeUnknownError(err: unknown): Record<string, unknown> {
	if (err instanceof Error) {
		return { name: err.name, message: err.message, stack: err.stack };
	}
	if (typeof err === 'object' && err !== null) {
		try {
			return JSON.parse(JSON.stringify(err));
		} catch {}
		const result: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(err as Record<string, unknown>)) {
			if (
				value === null ||
				typeof value === 'string' ||
				typeof value === 'number' ||
				typeof value === 'boolean'
			) {
				result[key] = value;
				continue;
			}
			try {
				result[key] = JSON.parse(JSON.stringify(value));
			} catch {
				result[key] = String(value);
			}
		}
		return result;
	}
	return { message: String(err) };
}

export async function GET(req: NextRequest) {
	let client: Client | undefined;
	let subscription: any | undefined;
	try {
		const { searchParams } = new URL(req.url);
		const topicIdParam = searchParams.get('topicId');
		const startTimeParam = searchParams.get('startTime');
		if (!topicIdParam) return createErrorResponse('Missing topicId');

		const encoder = new TextEncoder();
		let closed = false;

		const stream = new ReadableStream<Uint8Array>({
			start(controller) {
				function send(obj: unknown) {
					controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
				}

				// Initial event with topicId
				send({ type: 'init', topicId: topicIdParam });

				// SDK setup
				const MY_ACCOUNT_ID = AccountId.fromString('0.0.5864744');
				const MY_PRIVATE_KEY = PrivateKey.fromStringED25519('d04f46918ebce20abe26f7d34e5018ac2ba8aa7ffacf9f817656789b36f76207');
				client = Client.forTestnet();
				client.setOperator(MY_ACCOUNT_ID, MY_PRIVATE_KEY);

				const query = new TopicMessageQuery().setTopicId(TopicId.fromString(topicIdParam));
				if (startTimeParam) {
					const numeric = Number(startTimeParam);
					if (Number.isFinite(numeric)) {
						query.setStartTime(new Date(numeric * 1000));
					}
				}

				subscription = query.subscribe(
					client,
					(msg: any) => {
						if (closed) return;
						let text: string | undefined;
						try {
							const contents = msg?.contents as Uint8Array | undefined | null;
							if (contents && contents.length > 0) {
								text = new TextDecoder().decode(contents);
							}
						} catch {}
						send({
							type: 'message',
							topicId: topicIdParam,
							sequenceNumber: msg?.sequenceNumber,
							consensusTimestamp: msg?.consensusTimestamp?.toString?.(),
							contents: text,
						});
					},
					(err: unknown) => {
						if (closed) return;
						// Some SDK versions surface message-like objects here. Detect and treat as message.
						try {
							const e: any = err as any;
							if (e && (e.contents || e.sequenceNumber || e.consensusTimestamp)) {
								let text: string | undefined;
								try {
									let bytes: Uint8Array | undefined;
									const c = e.contents;
									if (c instanceof Uint8Array) {
										bytes = c;
									} else if (c && typeof c === 'object' && (c as any).type === 'Buffer' && Array.isArray((c as any).data)) {
										bytes = Uint8Array.from((c as any).data);
									}
									if (bytes && bytes.length > 0) {
										text = new TextDecoder().decode(bytes);
									}
								} catch {}
								send({
									type: 'message',
									topicId: topicIdParam,
									sequenceNumber: e?.sequenceNumber,
									consensusTimestamp: e?.consensusTimestamp?.toString?.(),
									contents: text,
								});
								return;
							}
						} catch {}
						send({ type: 'error', error: serializeUnknownError(err) });
					},
				);

				// Keep-alive pings every 30s
				const ping = setInterval(() => {
					if (!closed) controller.enqueue(encoder.encode(`: ping\n\n`));
				}, 30000);

				// Close handling
				req.signal.addEventListener('abort', () => {
					closed = true;
					clearInterval(ping);
					try { subscription?.unsubscribe?.(); } catch {}
					try { client?.close(); } catch {}
					controller.close();
				});
			},
			cancel() {
				closed = true;
				try { subscription?.unsubscribe?.(); } catch {}
				try { client?.close(); } catch {}
			},
		});

		return new Response(stream, {
			headers: {
				'Content-Type': 'text/event-stream',
				'Cache-Control': 'no-cache, no-transform',
				'Connection': 'keep-alive',
			},
			status: 200,
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Unknown error';
		return createErrorResponse(message);
	}
} 