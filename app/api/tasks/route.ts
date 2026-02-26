import { NextRequest } from "next/server";
import { db } from "@/drizzle/db";
import { tasks, agents, taskSuggestions } from "@/drizzle/schema";
import { requireAuth, requireRole } from "@/lib/auth/session";
import { success, error, unauthorized, serverError } from "@/lib/utils/api";
import { findTopMatches } from "@/lib/utils/matching";
import { eq, desc, and, arrayContains } from "drizzle-orm";

/**
 * POST /api/tasks
 * Create a new task
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    const body = await request.json();
    const { title, description, tags, max_budget, urgency } = body;

    // Validation
    if (!title || !description || !max_budget) {
      return error("Missing required fields: title, description, max_budget");
    }

    if (parseFloat(max_budget) <= 0) {
      return error("max_budget must be greater than 0");
    }

    // Create task
    const [task] = await db
      .insert(tasks)
      .values({
        buyerId: user.id,
        title,
        description,
        tags: tags || [],
        maxBudget: max_budget.toString(),
        urgency: urgency || "normal",
        status: "open",
      })
      .returning();

    // Find matching agents
    const allAgents = await db.query.agents.findMany({
      where: eq(agents.status, "active"),
    });

    const matches = findTopMatches(task, allAgents, 3);

    // Store suggestions
    if (matches.length > 0) {
      await db.insert(taskSuggestions).values(
        matches.map((match) => ({
          taskId: task.id,
          agentId: match.agentId,
          matchScore: match.matchScore.toString(),
          priceEstimate: match.priceEstimate.toString(),
        }))
      );

      // Update task status to matching
      await db
        .update(tasks)
        .set({ status: "matching" })
        .where(eq(tasks.id, task.id));
    }

    return success(
      {
        task: {
          id: task.id,
          title: task.title,
          status: matches.length > 0 ? "matching" : "open",
          created_at: task.createdAt,
        },
        suggestions: matches,
      },
      201
    );
  } catch (err: any) {
    if (err.message === "Unauthorized") {
      return unauthorized();
    }
    console.error("Error creating task:", err);
    return serverError(err.message);
  }
}

/**
 * GET /api/tasks
 * List tasks with filters
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const tagsParam = searchParams.get("tags");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");

    let whereConditions: any[] = [];

    if (status) {
      whereConditions.push(eq(tasks.status, status as any));
    }

    // Build query
    const results = await db.query.tasks.findMany({
      where: whereConditions.length > 0 ? and(...whereConditions) : undefined,
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

    // Count total
    const allResults = await db.query.tasks.findMany({
      where: whereConditions.length > 0 ? and(...whereConditions) : undefined,
    });

    return success({
      tasks: results.map((task) => ({
        id: task.id,
        title: task.title,
        tags: task.tags,
        max_budget: parseFloat(task.maxBudget),
        status: task.status,
        urgency: task.urgency,
        created_at: task.createdAt,
        buyer: task.buyer,
      })),
      total: allResults.length,
      limit,
      offset,
    });
  } catch (err: any) {
    console.error("Error listing tasks:", err);
    return serverError(err.message);
  }
}
