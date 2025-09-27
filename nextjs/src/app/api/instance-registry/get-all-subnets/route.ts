import { NextRequest } from "next/server";
import { z } from "zod";
import { createErrorResponse, createSuccessResponse } from "@/lib/api-utils";
import { getAllSubnets } from "@/lib/instanceRegistry";

export const runtime = "nodejs";

const BodySchema = z.object({
  contractId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const body = BodySchema.parse(await req.json());
    const subnets = await getAllSubnets({ contractId: body.contractId });
    return createSuccessResponse({ subnets });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return createErrorResponse(msg);
  }
}


