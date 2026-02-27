import { NextRequest } from "next/server";
import { db } from "@/drizzle/db";
import { agents, wallets, taskAssignments } from "@/drizzle/schema";
import { requireAgentAuth } from "@/lib/auth/agent-auth";
import { success, error, unauthorized, serverError } from "@/lib/utils/api";
import { eq, and, inArray } from "drizzle-orm";

/**
 * GET /api/agents/me
 * Returns agent profile, wallet balance, total earnings, completed tasks, active assignments
 */
export async function GET(request: NextRequest) {
  try {
    const agent = await requireAgentAuth(request);

    // Get wallet
    const wallet = await db.query.wallets.findFirst({
      where: eq(wallets.userId, agent.sellerId),
    });

    // Get active assignments
    const activeAssignments = await db.query.taskAssignments.findMany({
      where: and(
        eq(taskAssignments.agentId, agent.id),
        inArray(taskAssignments.status, ["assigned", "accepted", "in_progress"])
      ),
      with: {
        task: {
          columns: {
            id: true,
            title: true,
            status: true,
          },
        },
      },
    });

    return success({
      agent: {
        id: agent.id,
        name: agent.name,
        description: agent.description,
        tags: agent.tags,
        status: agent.status,
        pricing_model: agent.pricingModel,
        base_price: parseFloat(agent.basePrice),
        rating: parseFloat(agent.rating || "0"),
        total_tasks_completed: agent.totalTasksCompleted ?? 0,
        webhook_url: agent.webhookUrl,
        mcp_endpoint: agent.mcpEndpoint,
        created_at: agent.createdAt,
      },
      wallet: wallet
        ? {
            balance: parseFloat(wallet.balance),
            escrow_balance: parseFloat(wallet.escrowBalance),
          }
        : null,
      active_assignments: activeAssignments.map((a) => ({
        id: a.id,
        task_id: a.taskId,
        task_title: a.task?.title,
        task_status: a.task?.status,
        agreed_price: parseFloat(a.agreedPrice),
        status: a.status,
      })),
      seller: {
        id: agent.seller.id,
        username: agent.seller.username,
        email: agent.seller.email,
      },
    });
  } catch (err: any) {
    if (err.message === "Invalid or missing API key") {
      return unauthorized(err.message);
    }
    console.error("Error fetching agent status:", err);
    return serverError(err.message);
  }
}

/**
 * PATCH /api/agents/me
 * Update own agent profile (auth via API key)
 */
export async function PATCH(request: NextRequest) {
  try {
    const agent = await requireAgentAuth(request);
    const body = await request.json();

    const updates: Record<string, any> = {};

    if (body.name !== undefined) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;
    if (body.tags !== undefined) {
      if (!Array.isArray(body.tags)) {
        return error("tags must be an array of strings");
      }
      updates.tags = body.tags;
    }
    if (body.base_price !== undefined) {
      const price = parseFloat(body.base_price);
      if (isNaN(price) || price <= 0) {
        return error("base_price must be a positive number");
      }
      updates.basePrice = price.toFixed(2);
    }
    if (body.webhook_url !== undefined) {
      updates.webhookUrl = body.webhook_url || null;
    }
    if (body.mcp_endpoint !== undefined) {
      updates.mcpEndpoint = body.mcp_endpoint || null;
    }
    if (body.status !== undefined) {
      if (!["active", "inactive"].includes(body.status)) {
        return error("status must be 'active' or 'inactive'");
      }
      updates.status = body.status;
    }

    if (Object.keys(updates).length === 0) {
      return error("No valid fields to update. Supported: name, description, tags, base_price, webhook_url, mcp_endpoint, status");
    }

    updates.updatedAt = new Date();

    const [updated] = await db
      .update(agents)
      .set(updates)
      .where(eq(agents.id, agent.id))
      .returning();

    return success({
      agent: {
        id: updated.id,
        name: updated.name,
        description: updated.description,
        tags: updated.tags,
        base_price: parseFloat(updated.basePrice),
        status: updated.status,
        webhook_url: updated.webhookUrl,
        mcp_endpoint: updated.mcpEndpoint,
      },
    });
  } catch (err: any) {
    if (err.message === "Invalid or missing API key") {
      return unauthorized(err.message);
    }
    console.error("Error updating agent:", err);
    return serverError(err.message);
  }
}
