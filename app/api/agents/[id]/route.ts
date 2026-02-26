import { NextRequest } from "next/server";
import { db } from "@/drizzle/db";
import { agents, taskAssignments, reviews } from "@/drizzle/schema";
import { requireAuth } from "@/lib/auth/session";
import { success, error, unauthorized, notFound, serverError } from "@/lib/utils/api";
import { eq, and } from "drizzle-orm";

/**
 * GET /api/agents/:id
 * Get agent detail with stats
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const agent = await db.query.agents.findFirst({
      where: eq(agents.id, params.id),
      with: {
        seller: {
          columns: {
            id: true,
            username: true,
            createdAt: true,
          },
        },
        assignments: {
          with: {
            task: {
              columns: {
                id: true,
                title: true,
                status: true,
                createdAt: true,
              },
            },
          },
          limit: 10,
        },
      },
    });

    if (!agent) {
      return notFound("Agent not found");
    }

    // Get recent reviews
    const agentReviews = await db.query.reviews.findMany({
      where: eq(reviews.revieweeId, agent.sellerId),
      limit: 5,
      with: {
        reviewer: {
          columns: {
            username: true,
          },
        },
      },
    });

    return success({
      agent: {
        id: agent.id,
        name: agent.name,
        description: agent.description,
        tags: agent.tags,
        pricing_model: agent.pricingModel,
        base_price: parseFloat(agent.basePrice),
        rating: parseFloat(agent.rating || "0"),
        total_tasks_completed: agent.totalTasksCompleted,
        status: agent.status,
        seller: agent.seller,
        task_history: agent.assignments.map((a) => ({
          id: a.task.id,
          title: a.task.title,
          status: a.task.status,
          agreed_price: parseFloat(a.agreedPrice),
          completed_at: a.completedAt,
        })),
        recent_reviews: agentReviews.map((r) => ({
          rating: r.rating,
          comment: r.comment,
          reviewer: r.reviewer.username,
          created_at: r.createdAt,
        })),
      },
    });
  } catch (err: any) {
    console.error("Error fetching agent:", err);
    return serverError(err.message);
  }
}

/**
 * PATCH /api/agents/:id
 * Update agent details (seller only)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    const body = await request.json();

    const agent = await db.query.agents.findFirst({
      where: eq(agents.id, params.id),
    });

    if (!agent) {
      return notFound("Agent not found");
    }

    // Check if user owns this agent
    if (agent.sellerId !== user.id) {
      return unauthorized("You don't own this agent");
    }

    const updates: any = {};
    if (body.name) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;
    if (body.tags) updates.tags = body.tags;
    if (body.base_price) {
      if (parseFloat(body.base_price) <= 0) {
        return error("base_price must be greater than 0");
      }
      updates.basePrice = body.base_price.toString();
    }
    if (body.status && ["active", "inactive"].includes(body.status)) {
      updates.status = body.status;
    }

    const [updated] = await db
      .update(agents)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(agents.id, params.id))
      .returning();

    return success({
      agent: {
        id: updated.id,
        name: updated.name,
        description: updated.description,
        tags: updated.tags,
        base_price: parseFloat(updated.basePrice),
        status: updated.status,
      },
    });
  } catch (err: any) {
    if (err.message === "Unauthorized") {
      return unauthorized();
    }
    console.error("Error updating agent:", err);
    return serverError(err.message);
  }
}
