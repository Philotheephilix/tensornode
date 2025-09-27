import { NextRequest } from "next/server";
import { z } from "zod";
import { createErrorResponse, createSuccessResponse } from "@/lib/api-utils";
import { getActiveInstancesBySubnet } from "@/lib/instanceRegistry";

export const runtime = "nodejs";

const BodySchema = z.object({
  contractId: z.string().min(1),
  subnetId: z.union([z.string().min(1), z.number().int().nonnegative()]),
});

export async function POST(req: NextRequest) {
  try {
    const body = BodySchema.parse(await req.json());
    const instances = await getActiveInstancesBySubnet({
      contractId: body.contractId,
      subnetId: body.subnetId as any,
    });
    return createSuccessResponse({ instances });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return createErrorResponse(msg);
  }
}


