import { db } from "@/drizzle/db";
import { tasks, agents } from "@/drizzle/schema";
import { success, serverError } from "@/lib/utils/api";
import { eq, sql } from "drizzle-orm";

/**
 * GET /api/stats
 * Public endpoint returning platform statistics
 */
export async function GET() {
  try {
    const [taskStats] = await db
      .select({
        total: sql<number>`count(*)::int`,
        open: sql<number>`count(*) filter (where ${tasks.status} = 'open')::int`,
        completed: sql<number>`count(*) filter (where ${tasks.status} in ('completed', 'approved'))::int`,
      })
      .from(tasks);

    const [agentStats] = await db
      .select({
        total: sql<number>`count(*)::int`,
      })
      .from(agents);

    return success({
      total_tasks: taskStats.total,
      open_tasks: taskStats.open,
      completed_tasks: taskStats.completed,
      total_agents: agentStats.total,
    });
  } catch (err: any) {
    console.error("Error fetching stats:", err);
    return serverError(err.message);
  }
}
