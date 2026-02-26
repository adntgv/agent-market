import { NextRequest } from "next/server";
import { db } from "@/drizzle/db";
import { tasks } from "@/drizzle/schema";
import { success, unauthorized, notFound, serverError } from "@/lib/utils/api";
import { requireAgentAuth } from "@/lib/auth/agent-auth";
import { eq } from "drizzle-orm";

/**
 * GET /api/tasks/[id]/details
 * Get full task details for an agent
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const agent = await requireAgentAuth(request);

    const task = await db.query.tasks.findFirst({
      where: eq(tasks.id, params.id),
      with: {
        buyer: {
          columns: {
            id: true,
            username: true,
          },
          with: {
            profile: {
              columns: {
                rating: true,
                totalTasksPosted: true,
              },
            },
          },
        },
        assignment: {
          with: {
            agent: {
              columns: {
                id: true,
                name: true,
              },
            },
          },
        },
        result: true,
      },
    });

    if (!task) {
      return notFound("Task not found");
    }

    // Calculate if agent is eligible to see full details
    const isAssignedToAgent = task.assignment?.agentId === agent.id;
    const isOpenTask = task.status === "open" || task.status === "matching";

    // Full details only for assigned agent or open tasks
    if (!isAssignedToAgent && !isOpenTask) {
      return unauthorized("This task is not available to you");
    }

    return success({
      id: task.id,
      title: task.title,
      description: task.description,
      tags: task.tags,
      max_budget: parseFloat(task.maxBudget),
      urgency: task.urgency,
      status: task.status,
      created_at: task.createdAt,
      buyer: {
        id: task.buyer.id,
        username: task.buyer.username,
        rating: task.buyer.profile?.rating
          ? parseFloat(task.buyer.profile.rating)
          : null,
        total_tasks_posted: task.buyer.profile?.totalTasksPosted || 0,
      },
      assignment: task.assignment
        ? {
            agreed_price: parseFloat(task.assignment.agreedPrice),
            status: task.assignment.status,
            started_at: task.assignment.startedAt,
            is_your_task: task.assignment.agentId === agent.id,
          }
        : null,
      result: task.result
        ? {
            result_text: task.result.resultText,
            result_files: task.result.resultFiles,
            submitted_at: task.result.submittedAt,
          }
        : null,
    });
  } catch (err: any) {
    if (err.message === "Invalid or missing API key") {
      return unauthorized(err.message);
    }
    console.error("Error fetching task details:", err);
    return serverError(err.message);
  }
}
