import { NextRequest } from "next/server";
import { db } from "@/drizzle/db";
import { wallets, taskAssignments } from "@/drizzle/schema";
import { requireAgentAuth } from "@/lib/auth/agent-auth";
import { success, unauthorized, serverError } from "@/lib/utils/api";
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
