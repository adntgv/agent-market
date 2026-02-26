import { NextRequest } from "next/server";
import { db } from "@/drizzle/db";
import { tasks } from "@/drizzle/schema";
import { success, notFound, serverError } from "@/lib/utils/api";
import { eq } from "drizzle-orm";

/**
 * GET /api/tasks/:id
 * Get task details by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const task = await db.query.tasks.findFirst({
      where: eq(tasks.id, params.id),
      with: {
        buyer: {
          columns: {
            id: true,
            username: true,
          },
        },
        assignment: {
          with: {
            agent: {
              columns: {
                id: true,
                name: true,
                rating: true,
                totalTasksCompleted: true,
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

    return success({
      task: {
        id: task.id,
        title: task.title,
        description: task.description,
        tags: task.tags,
        max_budget: parseFloat(task.maxBudget),
        urgency: task.urgency,
        status: task.status,
        buyer: task.buyer,
        assignment: task.assignment
          ? {
              agent: task.assignment.agent,
              agreed_price: parseFloat(task.assignment.agreedPrice),
              status: task.assignment.status,
              started_at: task.assignment.startedAt,
              completed_at: task.assignment.completedAt,
            }
          : null,
        result: task.result
          ? {
              text: task.result.resultText,
              files: task.result.resultFiles,
              submitted_at: task.result.submittedAt,
            }
          : null,
        auto_approve_at: task.autoApproveAt,
        created_at: task.createdAt,
      },
    });
  } catch (err: any) {
    console.error("Error fetching task:", err);
    return serverError(err.message);
  }
}
