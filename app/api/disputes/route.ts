import { NextRequest } from "next/server";
import { db } from "@/drizzle/db";
import { disputes, tasks } from "@/drizzle/schema";
import { requireAuth, requireRole } from "@/lib/auth/session";
import { success, error, unauthorized, forbidden, serverError } from "@/lib/utils/api";
import { desc } from "drizzle-orm";

/**
 * GET /api/disputes
 * List all disputes (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireRole("admin");

    const results = await db.query.disputes.findMany({
      orderBy: [desc(disputes.createdAt)],
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
                  columns: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    return success({
      disputes: results.map((dispute) => ({
        id: dispute.id,
        task_id: dispute.taskId,
        task_title: dispute.task.title,
        buyer: dispute.task.buyer,
        agent: dispute.task.assignment?.agent,
        buyer_comment: dispute.buyerComment,
        seller_comment: dispute.sellerComment,
        resolution: dispute.resolution,
        status: dispute.resolvedAt ? "resolved" : (dispute.sellerComment ? "pending_admin" : "pending_seller"),
        created_at: dispute.createdAt,
        resolved_at: dispute.resolvedAt,
      })),
    });
  } catch (err: any) {
    if (err.message === "Unauthorized") {
      return unauthorized();
    }
    if (err.message === "Forbidden") {
      return forbidden();
    }
    console.error("Error listing disputes:", err);
    return serverError(err.message);
  }
}
