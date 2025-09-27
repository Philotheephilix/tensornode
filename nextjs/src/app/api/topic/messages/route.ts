import { NextRequest } from 'next/server';
import { createErrorResponse, createSuccessResponse } from '@/lib/api-utils';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
	try {
		const { searchParams } = new URL(req.url);
		const topicId = searchParams.get('topicId');
		const limit = parseInt(searchParams.get('limit') || '10', 10);
		const order = (searchParams.get('order') || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';

		if (!topicId) return createErrorResponse('Missing topicId');
		if (!Number.isFinite(limit) || limit <= 0) return createErrorResponse('Invalid limit');

		const mirrorUrl = `https://testnet.mirrornode.hedera.com/api/v1/topics/${encodeURIComponent(topicId)}/messages?limit=${limit}&order=${order}`;
		const resp = await fetch(mirrorUrl);
		if (!resp.ok) return createErrorResponse(`Mirror node error: ${resp.status}`, resp.status);
		const data = await resp.json();

		const messages = (data?.messages ?? []).map((m: any) => {
			let decoded = '';
			try {
				if (typeof m.message === 'string') decoded = Buffer.from(m.message, 'base64').toString('utf8');
			} catch {}
			return { ...m, messageBase64: m.message, message: decoded };
		});

		return createSuccessResponse({
			network: 'testnet',
			order,
			limit,
			topicId,
			messages,
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Unknown error';
		return createErrorResponse(message);
	}
} 