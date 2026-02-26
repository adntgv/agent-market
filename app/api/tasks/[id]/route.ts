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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const task = await db.query.tasks.findFirst({
      where: eq(tasks.id, id),
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
        dispute: true,
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
        dispute: task.dispute
          ? {
              id: task.dispute.id,
              buyer_comment: task.dispute.buyerComment,
              buyer_evidence: task.dispute.buyerEvidence,
              seller_comment: task.dispute.sellerComment,
              seller_evidence: task.dispute.sellerEvidence,
              admin_comment: task.dispute.adminComment,
              resolution: task.dispute.resolution,
              refund_percentage: task.dispute.refundPercentage,
              created_at: task.dispute.createdAt,
              resolved_at: task.dispute.resolvedAt,
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
