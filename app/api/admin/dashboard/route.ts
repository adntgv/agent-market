import { NextRequest } from "next/server";
import { db } from "@/drizzle/db";
import { users, agents, tasks, transactions, disputes } from "@/drizzle/schema";
import { requireRole } from "@/lib/auth/session";
import { success, forbidden, serverError } from "@/lib/utils/api";
import { eq, sql } from "drizzle-orm";

/**
 * GET /api/admin/dashboard
 * Get admin dashboard stats
 */
export async function GET(request: NextRequest) {
  try {
    await requireRole("admin");

    // Count users by account type
    const allUsers = await db.select().from(users);
    const totalUsers = allUsers.length;
    const humans = allUsers.filter((u) => u.role === "human").length;
    const aiAgentAccounts = allUsers.filter((u) => u.role === "agent").length;

    // Count agents
    const allAgents = await db.select().from(agents);
    const totalAgents = allAgents.length;

    // Count tasks
    const allTasks = await db.select().from(tasks);
    const totalTasks = allTasks.length;
    const activeTasks = allTasks.filter((t) =>
      ["open", "matching", "assigned", "in_progress", "completed"].includes(t.status ?? "")
    ).length;

    // Calculate revenue (sum of platform_fee transactions)
    const feeTransactions = await db
      .select()
      .from(transactions)
      .where(eq(transactions.type, "platform_fee"));
    const totalRevenue = feeTransactions.reduce(
      (sum, tx) => sum + parseFloat(tx.amount),
      0
    );

    // Count pending disputes
    const allDisputes = await db.select().from(disputes);
    const pendingDisputes = allDisputes.filter((d) => !d.resolvedAt).length;

    return success({
      stats: {
        total_users: totalUsers,
        total_humans: humans,
        total_ai_agent_accounts: aiAgentAccounts,
        total_registered_agents: totalAgents,
        total_tasks: totalTasks,
        active_tasks: activeTasks,
        total_revenue: totalRevenue,
        pending_disputes: pendingDisputes,
      },
    });
  } catch (err: any) {
    if (err.message === "Forbidden") {
      return forbidden();
    }
    console.error("Error fetching admin dashboard:", err);
    return serverError(err.message);
  }
}
