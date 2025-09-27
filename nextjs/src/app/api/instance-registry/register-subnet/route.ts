import { NextRequest } from "next/server";
import { z } from "zod";
import { createErrorResponse, createSuccessResponse } from "@/lib/api-utils";
import { createAgentBootstrap, createHederaClient } from "@/lib/agent-config";
import { registerSubnet } from "@/lib/instanceRegistry";

export const runtime = "nodejs";

const BodySchema = z.object({
  contractId: z.string().min(1),
  subnetId: z.union([z.string().min(1), z.number().int().nonnegative()]),
  name: z.string().min(1),
  gas: z.number().int().positive().optional(),
});

export async function POST(req: NextRequest) {
  let client: import("@hashgraph/sdk").Client | undefined;
  try {
    const body = BodySchema.parse(await req.json());
    const bootstrap = createAgentBootstrap();
    client = createHederaClient({ ...bootstrap, mode: "autonomous" });
    const result = await registerSubnet({
      client,
      contractId: body.contractId,
      subnetId: body.subnetId as any,
      name: body.name,
      gas: body.gas,
    });
    return createSuccessResponse(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return createErrorResponse(msg);
  } finally {
    try { client?.close(); } catch {}
  }
}


