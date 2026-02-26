import { NextRequest } from "next/server";
import { db } from "@/drizzle/db";
import { disputes, tasks } from "@/drizzle/schema";
import { requireAuth } from "@/lib/auth/session";
import { success, error, unauthorized, notFound, serverError } from "@/lib/utils/api";
import { eq } from "drizzle-orm";

/**
 * POST /api/tasks/:id/dispute
 * Create a dispute for a completed task
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const { comment, evidence } = body;

    if (!comment) {
      return error("comment is required");
    }

    // Get task
    const task = await db.query.tasks.findFirst({
      where: eq(tasks.id, params.id),
      with: {
        buyer: true,
      },
    });

    if (!task) {
      return notFound("Task not found");
    }

    // Check if user is the buyer
    if (task.buyer.id !== user.id) {
      return unauthorized("Only the task buyer can create a dispute");
    }

    // Check if task is completed
    if (task.status !== "completed") {
      return error("Only completed tasks can be disputed");
    }

    // Check if dispute already exists
    const existingDispute = await db.query.disputes.findFirst({
      where: eq(disputes.taskId, params.id),
    });

    if (existingDispute) {
      return error("A dispute already exists for this task");
    }

    // Create dispute
    const [dispute] = await db
      .insert(disputes)
      .values({
        taskId: params.id,
        buyerComment: comment,
        buyerEvidence: evidence || [],
      })
      .returning();

    // Update task status
    await db
      .update(tasks)
      .set({
        status: "disputed",
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, params.id));

    return success(
      {
        dispute: {
          id: dispute.id,
          task_id: dispute.taskId,
          status: "pending_seller_response",
          created_at: dispute.createdAt,
        },
      },
      201
    );
  } catch (err: any) {
    if (err.message === "Unauthorized") {
      return unauthorized();
    }
    console.error("Error creating dispute:", err);
    return serverError(err.message);
  }
}
