import { NextRequest } from "next/server";
import { db } from "@/drizzle/db";
import { tasks, taskAssignments, taskResults, notifications } from "@/drizzle/schema";
import { success, error, unauthorized, notFound, serverError, calculateAutoApproveTime } from "@/lib/utils/api";
import { requireAgentAuth } from "@/lib/auth/agent-auth";
import { eq, and } from "drizzle-orm";

/**
 * POST /api/tasks/[id]/submit
 * Agent submits deliverable for a task
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const agent = await requireAgentAuth(request);

    const body = await request.json();
    const { result_text, result_files = [] } = body;

    // Validation
    if (!result_text || result_text.trim().length === 0) {
      return error("result_text is required");
    }

    // Get task with assignment
    const task = await db.query.tasks.findFirst({
      where: eq(tasks.id, id),
      with: {
        assignment: true,
        buyer: true,
      },
    });

    if (!task) {
      return notFound("Task not found");
    }

    // Check if task is assigned to this agent
    if (!task.assignment || task.assignment.agentId !== agent.id) {
      return unauthorized("You are not assigned to this task");
    }

    // Check if task is in correct status
    if (
      task.status !== "assigned" &&
      task.status !== "in_progress"
    ) {
      return error("Task is not in a state that accepts submissions", 409);
    }

    // Check if already submitted
    const existingResult = await db.query.taskResults.findFirst({
      where: eq(taskResults.taskId, task.id),
    });

    if (existingResult) {
      return error("Task already has a submission", 409);
    }

    // Create result
    await db.insert(taskResults).values({
      taskId: task.id,
      resultText: result_text,
      resultFiles: result_files,
      submittedAt: new Date(),
    });

    // Update task status
    const autoApproveAt = calculateAutoApproveTime();
    await db
      .update(tasks)
      .set({
        status: "completed",
        completedAt: new Date(),
        autoApproveAt,
      })
      .where(eq(tasks.id, task.id));

    // Update assignment status
    await db
      .update(taskAssignments)
      .set({
        status: "completed",
        completedAt: new Date(),
      })
      .where(eq(taskAssignments.id, task.assignment.id));

    // Notify buyer
    await db.insert(notifications).values({
      userId: task.buyerId,
      type: "task_completed",
      message: `Agent ${agent.name} has submitted deliverables for task: ${task.title}. Please review and approve or dispute within 24 hours.`,
      referenceType: "task",
      referenceId: task.id,
    });

    return success({
      task_id: task.id,
      status: "completed",
      submitted_at: new Date().toISOString(),
      auto_approve_at: autoApproveAt.toISOString(),
      message: "Task submitted successfully. Awaiting buyer approval.",
    });
  } catch (err: any) {
    if (err.message === "Invalid or missing API key") {
      return unauthorized(err.message);
    }
    console.error("Error submitting task:", err);
    return serverError(err.message);
  }
}
