import { NextRequest } from "next/server";
import { db } from "@/drizzle/db";
import { tasks, agents, taskSuggestions } from "@/drizzle/schema";
import { requireAuth, requireRole } from "@/lib/auth/session";
import { success, error, unauthorized, serverError } from "@/lib/utils/api";
import { findTopMatches } from "@/lib/utils/matching";
import { eq, desc, and, arrayContains } from "drizzle-orm";
import { sanitizeTaskTitle, sanitizeTaskDescription, sanitizeTags } from "@/lib/security/sanitize";
import { validateAmount } from "@/lib/security/validate";
import { logTaskOperation, logSecurityEvent } from "@/lib/security/audit-log";
import { getClientIp } from "@/lib/security/rate-limit";

/**
 * POST /api/tasks
 * Create a new task
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  
  try {
    const user = await requireAuth();

    const body = await request.json();
    const { title, description, tags, max_budget, urgency, auto_assign, sandbox } = body;

    // Validation
    if (!title || !description || !max_budget) {
      return error("Missing required fields: title, description, max_budget");
    }

    // Sanitize and validate inputs
    let sanitizedTitle: string;
    let sanitizedDescription: string;
    let sanitizedTags: string[];
    let validatedBudget: number;
    
    try {
      sanitizedTitle = sanitizeTaskTitle(title);
      sanitizedDescription = sanitizeTaskDescription(description);
      sanitizedTags = tags ? sanitizeTags(tags) : [];
      validatedBudget = validateAmount(max_budget, 'max_budget');
    } catch (validationError: any) {
      logSecurityEvent(
        'security.validation_failed',
        {
          reason: 'task_creation_validation_failed',
          error: validationError.message,
          title: title?.substring(0, 100),
        },
        user.id,
        ip
      );
      return error(validationError.message);
    }

    // Create task
    const [task] = await db
      .insert(tasks)
      .values({
        buyerId: user.id,
        title: sanitizedTitle,
        description: sanitizedDescription,
        tags: sanitizedTags,
        maxBudget: validatedBudget.toFixed(2),
        urgency: urgency || "normal",
        autoAssign: auto_assign || false,
        sandbox: sandbox || false,
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

    // Audit log
    logTaskOperation(
      'task.created',
      user.id,
      task.id,
      {
        title: sanitizedTitle,
        maxBudget: validatedBudget,
        tags: sanitizedTags,
        matchCount: matches.length,
      },
      ip
    );

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
    const my = searchParams.get("my");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");

    let whereConditions: any[] = [];

    // Filter by current user's tasks
    if (my === "true") {
      try {
        const user = await requireAuth();
        whereConditions.push(eq(tasks.buyerId, user.id));
      } catch {
        return unauthorized();
      }
    }

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
        sandbox: task.sandbox ?? false,
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
