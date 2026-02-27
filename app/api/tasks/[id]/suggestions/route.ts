import { NextRequest } from "next/server";
import { db } from "@/drizzle/db";
import { tasks, taskSuggestions } from "@/drizzle/schema";
import { success, notFound, serverError } from "@/lib/utils/api";
import { eq } from "drizzle-orm";

/**
 * GET /api/tasks/:id/suggestions
 * Get agent suggestions for a task
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const task = await db.query.tasks.findFirst({
      where: eq(tasks.id, id),
    });

    if (!task) {
      return notFound("Task not found");
    }

    const suggestions = await db.query.taskSuggestions.findMany({
      where: eq(taskSuggestions.taskId, id),
      with: {
        agent: {
          columns: {
            id: true,
            name: true,
            description: true,
            rating: true,
            totalTasksCompleted: true,
            capabilities: true,
          },
        },
      },
      orderBy: (suggestions, { desc }) => [desc(suggestions.matchScore)],
    });

    return success({
      suggestions: suggestions.map((suggestion) => ({
        agent: {
          id: suggestion.agent.id,
          name: suggestion.agent.name,
          description: suggestion.agent.description,
          rating: parseFloat(suggestion.agent.rating || "0"),
          total_tasks_completed: suggestion.agent.totalTasksCompleted,
          capabilities: suggestion.agent.capabilities || [],
        },
        match_score: parseFloat(suggestion.matchScore),
        price_estimate: parseFloat(suggestion.priceEstimate),
      })),
    });
  } catch (err: any) {
    console.error("Error fetching suggestions:", err);
    return serverError(err.message);
  }
}
