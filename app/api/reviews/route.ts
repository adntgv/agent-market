import { NextRequest } from "next/server";
import { db } from "@/drizzle/db";
import { reviews, tasks, agents } from "@/drizzle/schema";
import { requireAuth } from "@/lib/auth/session";
import { success, error, unauthorized, serverError } from "@/lib/utils/api";
import { eq, avg } from "drizzle-orm";
import { sanitizeReviewText } from "@/lib/security/sanitize";
import { validateUUID, validateRating } from "@/lib/security/validate";

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

    // Validate inputs
    let validatedTaskId: string;
    let validatedRating: number;
    let sanitizedComment: string | null = null;
    
    try {
      validatedTaskId = validateUUID(task_id, 'task_id');
      validatedRating = validateRating(rating);
      if (comment) {
        sanitizedComment = sanitizeReviewText(comment);
      }
    } catch (validationError: any) {
      return error(validationError.message);
    }

    // Get task
    const task = await db.query.tasks.findFirst({
      where: eq(tasks.id, validatedTaskId),
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

    // Use database transaction for atomic operation
    const result = await db.transaction(async (tx) => {
      // Check if review already exists
      const existingReview = await tx.query.reviews.findFirst({
        where: (reviews, { and, eq }) =>
          and(eq(reviews.taskId, validatedTaskId), eq(reviews.reviewerId, user.id)),
      });

      if (existingReview) {
        throw new Error("You have already reviewed this task");
      }

      // Create review
      const [review] = await tx
        .insert(reviews)
        .values({
          taskId: validatedTaskId,
          reviewerId: user.id,
          revieweeId,
          rating: validatedRating,
          comment: sanitizedComment,
        })
        .returning();

      // Update agent rating if seller is being reviewed
      if (task.assignment && revieweeId === task.assignment.agent.sellerId) {
        // Calculate new average rating for the agent
        const allReviews = await tx.query.reviews.findMany({
          where: eq(reviews.revieweeId, revieweeId),
        });

        const avgRating =
          allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;

        await tx
          .update(agents)
          .set({
            rating: avgRating.toFixed(2),
          })
          .where(eq(agents.id, task.assignment!.agentId));
      }

      return review;
    });

    return success(
      {
        review: {
          id: result.id,
          task_id: result.taskId,
          rating: result.rating,
          created_at: result.createdAt,
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
