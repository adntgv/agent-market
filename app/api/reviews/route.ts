import { NextRequest } from "next/server";
import { db } from "@/drizzle/db";
import { reviews, tasks, agents } from "@/drizzle/schema";
import { requireAuth } from "@/lib/auth/session";
import { success, error, unauthorized, serverError } from "@/lib/utils/api";
import { eq, avg } from "drizzle-orm";

/**
 * POST /api/reviews
 * Create a review for a task
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const { task_id, rating, comment } = body;

    if (!task_id || !rating) {
      return error("Missing required fields: task_id, rating");
    }

    if (rating < 1 || rating > 5) {
      return error("Rating must be between 1 and 5");
    }

    // Get task
    const task = await db.query.tasks.findFirst({
      where: eq(tasks.id, task_id),
      with: {
        assignment: {
          with: {
            agent: true,
          },
        },
      },
    });

    if (!task) {
      return error("Task not found");
    }

    if (task.status !== "approved") {
      return error("Can only review approved tasks");
    }

    // Determine reviewer/reviewee
    let revieweeId: string;
    if (task.buyerId === user.id) {
      // Buyer reviewing seller
      if (!task.assignment) {
        return error("No assignment found");
      }
      revieweeId = task.assignment.agent.sellerId;
    } else if (task.assignment && task.assignment.agent.sellerId === user.id) {
      // Seller reviewing buyer
      revieweeId = task.buyerId;
    } else {
      return unauthorized("You can only review tasks you're involved in");
    }

    // Check if review already exists
    const existingReview = await db.query.reviews.findFirst({
      where: (reviews, { and, eq }) =>
        and(eq(reviews.taskId, task_id), eq(reviews.reviewerId, user.id)),
    });

    if (existingReview) {
      return error("You have already reviewed this task");
    }

    // Create review
    const [review] = await db
      .insert(reviews)
      .values({
        taskId: task_id,
        reviewerId: user.id,
        revieweeId,
        rating,
        comment: comment || null,
      })
      .returning();

    // Update agent rating if seller is being reviewed
    if (task.assignment && revieweeId === task.assignment.agent.sellerId) {
      // Calculate new average rating for the agent
      const allReviews = await db.query.reviews.findMany({
        where: eq(reviews.revieweeId, revieweeId),
      });

      const avgRating =
        allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;

      await db
        .update(agents)
        .set({
          rating: avgRating.toFixed(2),
        })
        .where(eq(agents.id, task.assignment.agentId));
    }

    return success(
      {
        review: {
          id: review.id,
          task_id: review.taskId,
          rating: review.rating,
          created_at: review.createdAt,
        },
      },
      201
    );
  } catch (err: any) {
    if (err.message === "Unauthorized") {
      return unauthorized();
    }
    console.error("Error creating review:", err);
    return serverError(err.message);
  }
}
