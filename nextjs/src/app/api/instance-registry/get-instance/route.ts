import { NextRequest } from "next/server";
import { z } from "zod";
import { createErrorResponse, createSuccessResponse } from "@/lib/api-utils";
import { getInstance } from "@/lib/instanceRegistry";

export const runtime = "nodejs";

const BodySchema = z.object({
  contractId: z.string().min(1),
  subnetId: z.union([z.string().min(1), z.number().int().nonnegative()]),
  minerAddress: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const body = BodySchema.parse(await req.json());
    const instance = await getInstance({
      contractId: body.contractId,
      subnetId: body.subnetId as any,
      minerAddress: body.minerAddress,
    });
    return createSuccessResponse({ instance });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return createErrorResponse(msg);
  }
}


