import { NextRequest } from "next/server";
import { db } from "@/drizzle/db";
import { disputes, tasks } from "@/drizzle/schema";
import { requireAuth } from "@/lib/auth/session";
import { success, error, unauthorized, notFound, serverError } from "@/lib/utils/api";
import { eq } from "drizzle-orm";

/**
 * GET /api/disputes/:id
 * Get dispute detail
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();

    const dispute = await db.query.disputes.findFirst({
      where: eq(disputes.id, params.id),
      with: {
        task: {
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
                  with: {
                    seller: {
                      columns: {
                        id: true,
                        username: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!dispute) {
      return notFound("Dispute not found");
    }

    // Check permissions (buyer, seller, or admin)
    const isBuyer = dispute.task.buyer.id === user.id;
    const isSeller = dispute.task.assignment?.agent.seller.id === user.id;
    const isAdmin = user.role === "admin";

    if (!isBuyer && !isSeller && !isAdmin) {
      return unauthorized("You don't have access to this dispute");
    }

    return success({
      dispute: {
        id: dispute.id,
        task_id: dispute.taskId,
        task_title: dispute.task.title,
        buyer: dispute.task.buyer,
        seller: dispute.task.assignment?.agent.seller,
        agent: {
          id: dispute.task.assignment?.agent.id,
          name: dispute.task.assignment?.agent.name,
        },
        buyer_comment: dispute.buyerComment,
        buyer_evidence: dispute.buyerEvidence,
        seller_comment: dispute.sellerComment,
        seller_evidence: dispute.sellerEvidence,
        admin_comment: dispute.adminComment,
        resolution: dispute.resolution,
        refund_percentage: dispute.refundPercentage,
        status: dispute.resolvedAt ? "resolved" : (dispute.sellerComment ? "pending_admin" : "pending_seller"),
        created_at: dispute.createdAt,
        resolved_at: dispute.resolvedAt,
      },
    });
  } catch (err: any) {
    if (err.message === "Unauthorized") {
      return unauthorized();
    }
    console.error("Error fetching dispute:", err);
    return serverError(err.message);
  }
}
