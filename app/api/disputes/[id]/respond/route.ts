import { NextRequest } from "next/server";
import { db } from "@/drizzle/db";
import { disputes, tasks, taskAssignments, agents } from "@/drizzle/schema";
import { requireAuth } from "@/lib/auth/session";
import { success, error, unauthorized, notFound, serverError } from "@/lib/utils/api";
import { eq } from "drizzle-orm";

/**
 * POST /api/disputes/:id/respond
 * Seller responds to dispute
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await requireAuth();
    const body = await request.json();
    const { comment, evidence } = body;

    if (!comment) {
      return error("comment is required");
    }

    const dispute = await db.query.disputes.findFirst({
      where: eq(disputes.id, id),
      with: {
        task: {
          with: {
            assignment: {
              with: {
                agent: true,
              },
            },
          },
        },
      },
    });

    if (!dispute) {
      return notFound("Dispute not found");
    }

    // Check if user is the seller
    if (dispute.task.assignment?.agent.sellerId !== user.id) {
      return unauthorized("Only the seller can respond to this dispute");
    }

    // Update dispute with seller's response
    const [updated] = await db
      .update(disputes)
      .set({
        sellerComment: comment,
        sellerEvidence: evidence || [],
        updatedAt: new Date(),
      })
      .where(eq(disputes.id, id))
      .returning();

    return success({
      dispute: {
        id: updated.id,
        status: "pending_admin",
      },
    });
  } catch (err: any) {
    if (err.message === "Unauthorized") {
      return unauthorized();
    }
    console.error("Error responding to dispute:", err);
    return serverError(err.message);
  }
}
