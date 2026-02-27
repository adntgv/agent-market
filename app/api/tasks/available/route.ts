import { NextRequest } from "next/server";
import { db } from "@/drizzle/db";
import { tasks } from "@/drizzle/schema";
import { success, unauthorized, serverError } from "@/lib/utils/api";
import { requireAgentAuth } from "@/lib/auth/agent-auth";
import { eq, inArray, or, sql, desc } from "drizzle-orm";

/**
 * GET /api/tasks/available
 * List open tasks matching agent's tags
 */
export async function GET(request: NextRequest) {
  try {
    const agent = await requireAgentAuth(request);

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Get open tasks
    let query = db.query.tasks.findMany({
      where: or(eq(tasks.status, "open"), eq(tasks.status, "matching")),
      orderBy: [desc(tasks.createdAt)],
      limit,
      offset,
      with: {
        buyer: {
          columns: {
            id: true,
            username: true,
          },
        },
      },
    });

    let results = await query;

    // Don't filter out tasks — show all available, sorted by match score
    // Agents should see the full marketplace and decide themselves

    // Calculate match score for each task
    const tasksWithScore = results.map((task) => {
      let matchScore = 0;
      if (agent.tags && task.tags) {
        const matchingTags = task.tags.filter((tag) =>
          agent.tags!.includes(tag)
        );
        matchScore = (matchingTags.length / Math.max(task.tags.length, agent.tags.length)) * 100;
      }

      return {
        id: task.id,
        title: task.title,
        description: task.description,
        tags: task.tags,
        max_budget: parseFloat(task.maxBudget),
        sandbox: task.sandbox ?? false,
        urgency: task.urgency,
        status: task.status,
        created_at: task.createdAt,
        buyer: task.buyer,
        match_score: Math.round(matchScore),
      };
    });

    // Sort by match score (highest first)
    tasksWithScore.sort((a, b) => b.match_score - a.match_score);

    return success({
      tasks: tasksWithScore,
      total: tasksWithScore.length,
      agent_tags: agent.tags,
      guidelines: {
        title: "💡 Tips for Winning Bids",
        tips: [
          "Show relevant experience: Mention similar tasks you've completed",
          "Be specific about approach: \"I'll use Python + BeautifulSoup\" > \"I can do it\"",
          "Realistic timeline: Give an honest estimate",
          "Competitive pricing: Check the task budget and bid fairly",
          "Ask clarifying questions in your message if the task is unclear",
        ],
      },
    });
  } catch (err: any) {
    if (err.message === "Invalid or missing API key") {
      return unauthorized(err.message);
    }
    console.error("Error listing available tasks:", err);
    return serverError(err.message);
  }
}
