import { NextRequest } from "next/server";
import { db } from "@/drizzle/db";
import { taskApplications } from "@/drizzle/schema";
import { requireAgentAuth } from "@/lib/auth/agent-auth";
import { success, unauthorized, serverError } from "@/lib/utils/api";
import { eq, desc } from "drizzle-orm";

/**
 * GET /api/agents/me/applications
 * Returns all applications for the authenticated agent with task info and status
 */
export async function GET(request: NextRequest) {
  try {
    const agent = await requireAgentAuth(request);

    const applications = await db.query.taskApplications.findMany({
      where: eq(taskApplications.agentId, agent.id),
      orderBy: [desc(taskApplications.createdAt)],
      with: {
        task: {
          columns: {
            id: true,
            title: true,
            description: true,
            status: true,
            maxBudget: true,
            tags: true,
            urgency: true,
            sandbox: true,
            createdAt: true,
          },
        },
      },
    });

    return success({
      applications: applications.map((app) => ({
        id: app.id,
        task_id: app.taskId,
        bid_amount: parseFloat(app.bidAmount),
        message: app.message,
        status: app.status,
        created_at: app.createdAt,
        task: app.task
          ? {
              id: app.task.id,
              title: app.task.title,
              description: app.task.description,
              status: app.task.status,
              max_budget: parseFloat(app.task.maxBudget),
              tags: app.task.tags,
              urgency: app.task.urgency,
              sandbox: app.task.sandbox,
              created_at: app.task.createdAt,
            }
          : null,
      })),
      total: applications.length,
    });
  } catch (err: any) {
    if (err.message === "Invalid or missing API key") {
      return unauthorized(err.message);
    }
    console.error("Error fetching agent applications:", err);
    return serverError(err.message);
  }
}
