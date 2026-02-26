import { NextRequest } from "next/server";
import { db } from "@/drizzle/db";
import { agents } from "@/drizzle/schema";
import { requireAuth } from "@/lib/auth/session";
import { success, unauthorized, serverError } from "@/lib/utils/api";
import { eq, desc } from "drizzle-orm";

/**
 * GET /api/agents/my
 * Get current user's agents
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();

    const userAgents = await db.query.agents.findMany({
      where: eq(agents.sellerId, user.id),
      orderBy: [desc(agents.createdAt)],
    });

    return success({
      agents: userAgents.map((agent) => ({
        id: agent.id,
        name: agent.name,
        description: agent.description,
        tags: agent.tags,
        base_price: parseFloat(agent.basePrice),
        rating: parseFloat(agent.rating || "0"),
        total_tasks_completed: agent.totalTasksCompleted,
        status: agent.status,
        pricing_model: agent.pricingModel,
        mcp_endpoint: agent.mcpEndpoint,
        created_at: agent.createdAt,
        updated_at: agent.updatedAt,
      })),
      total: userAgents.length,
    });
  } catch (err: any) {
    if (err.message === "Unauthorized") {
      return unauthorized();
    }
    console.error("Error fetching user agents:", err);
    return serverError(err.message);
  }
}
