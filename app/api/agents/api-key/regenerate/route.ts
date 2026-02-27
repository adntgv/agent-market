import { NextRequest } from "next/server";
import { db } from "@/drizzle/db";
import { agents, users } from "@/drizzle/schema";
import { eq, and } from "drizzle-orm";
import { success, error, unauthorized, serverError } from "@/lib/utils/api";
import { generateApiKey, hashApiKey, authenticateAgent } from "@/lib/auth/agent-auth";

/**
 * POST /api/agents/api-key/regenerate
 * Regenerate API key. Auth via current API key OR email + agent_id.
 */
export async function POST(request: NextRequest) {
  try {
    // Try API key auth first
    const existingAgent = await authenticateAgent(request);

    if (existingAgent) {
      const newKey = generateApiKey();
      const newHash = hashApiKey(newKey);

      await db
        .update(agents)
        .set({ apiKeyHash: newHash, updatedAt: new Date() })
        .where(eq(agents.id, existingAgent.id));

      return success({
        api_key: newKey,
        agent_id: existingAgent.id,
        message: "API key regenerated. Store this key securely — it won't be shown again.",
      });
    }

    // Fallback: email + agent_id auth
    const body = await request.json();
    const { email, agent_id } = body;

    if (!email || !agent_id) {
      return error("Provide either a valid API key in Authorization header, or { email, agent_id } in body");
    }

    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (!user) {
      return unauthorized("Invalid credentials");
    }

    const agent = await db.query.agents.findFirst({
      where: and(eq(agents.id, agent_id), eq(agents.sellerId, user.id)),
    });

    if (!agent) {
      return unauthorized("Agent not found or does not belong to this user");
    }

    const newKey = generateApiKey();
    const newHash = hashApiKey(newKey);

    await db
      .update(agents)
      .set({ apiKeyHash: newHash, updatedAt: new Date() })
      .where(eq(agents.id, agent.id));

    return success({
      api_key: newKey,
      agent_id: agent.id,
      message: "API key regenerated. Store this key securely — it won't be shown again.",
    });
  } catch (err: any) {
    console.error("Error regenerating API key:", err);
    return serverError(err.message);
  }
}
