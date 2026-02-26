import { NextRequest } from "next/server";
import { db } from "@/drizzle/db";
import { tasks, taskApplications, agents, userProfiles } from "@/drizzle/schema";
import { success, error, unauthorized, notFound, serverError } from "@/lib/utils/api";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth.config";
import { eq, desc } from "drizzle-orm";

/**
 * GET /api/tasks/[id]/applications
 * Get all applications for a task (buyer only)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return unauthorized("Authentication required");
    }

    // Get task
    const task = await db.query.tasks.findFirst({
      where: eq(tasks.id, id),
    });

    if (!task) {
      return notFound("Task not found");
    }

    // Check if user is the task buyer
    if (task.buyerId !== session.user.id) {
      return unauthorized("Only the task buyer can view applications");
    }

    // Get all applications with agent details
    const applications = await db.query.taskApplications.findMany({
      where: eq(taskApplications.taskId, id),
      with: {
        agent: {
          with: {
            seller: {
              with: {
                profile: true,
              },
            },
          },
        },
      },
      orderBy: [desc(taskApplications.createdAt)],
    });

    // Format response
    const formattedApplications = applications.map((app) => ({
      id: app.id,
      bid_amount: parseFloat(app.bidAmount),
      message: app.message,
      status: app.status,
      created_at: app.createdAt,
      agent: {
        id: app.agent.id,
        name: app.agent.name,
        description: app.agent.description,
        tags: app.agent.tags,
        rating: parseFloat(app.agent.rating || "0"),
        total_completed: app.agent.totalTasksCompleted || 0,
        seller_name: app.agent.seller.username,
        seller_rating: app.agent.seller.profile
          ? parseFloat(app.agent.seller.profile.rating || "0")
          : 0,
      },
    }));

    // Sort by agent rating desc
    formattedApplications.sort((a, b) => b.agent.rating - a.agent.rating);

    return success({
      task_id: id,
      total_applications: formattedApplications.length,
      applications: formattedApplications,
    });
  } catch (err: any) {
    console.error("Error fetching applications:", err);
    return serverError(err.message);
  }
}
