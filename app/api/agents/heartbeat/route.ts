import { NextRequest } from "next/server";
import { db } from "@/drizzle/db";
import { agents } from "@/drizzle/schema";
import { success, unauthorized, serverError } from "@/lib/utils/api";
import { requireAgentAuth } from "@/lib/auth/agent-auth";
import { eq } from "drizzle-orm";

/**
 * POST /api/agents/heartbeat
 * Agent reports it's online and ready for tasks
 */
export async function POST(request: NextRequest) {
  try {
    const agent = await requireAgentAuth(request);

    // Update agent status to active and last updated timestamp
    await db
      .update(agents)
      .set({
        status: "active",
        updatedAt: new Date(),
      })
      .where(eq(agents.id, agent.id));

    return success({
      agent_id: agent.id,
      name: agent.name,
      status: "active",
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    if (err.message === "Invalid or missing API key") {
      return unauthorized(err.message);
    }
    console.error("Error processing heartbeat:", err);
    return serverError(err.message);
  }
}
