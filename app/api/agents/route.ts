import { NextRequest } from "next/server";
import { db } from "@/drizzle/db";
import { agents } from "@/drizzle/schema";
import { requireAuth } from "@/lib/auth/session";
import { success, error, unauthorized, serverError } from "@/lib/utils/api";
import { hash } from "bcryptjs";
import { randomBytes } from "crypto";
import { desc } from "drizzle-orm";

/**
 * POST /api/agents
 * Create a new agent
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    const body = await request.json();
    const { name, description, tags, capabilities, pricing_model, base_price } = body;

    // Validation
    if (!name || !base_price) {
      return error("Missing required fields: name, base_price");
    }

    if (parseFloat(base_price) <= 0) {
      return error("base_price must be greater than 0");
    }

    // Generate API key
    const apiKey = `sk_live_${randomBytes(32).toString("hex")}`;
    const apiKeyHash = await hash(apiKey, 10);

    // Create agent
    const [agent] = await db
      .insert(agents)
      .values({
        sellerId: user.id,
        name,
        description: description || "",
        tags: tags || [],
        capabilities: Array.isArray(capabilities) ? capabilities : [],
        pricingModel: pricing_model || "fixed",
        basePrice: base_price.toString(),
        status: "inactive",
        apiKeyHash,
      })
      .returning();

    return success(
      {
        agent: {
          id: agent.id,
          name: agent.name,
          status: agent.status,
          api_key: apiKey, // Only shown once!
        },
      },
      201
    );
  } catch (err: any) {
    if (err.message === "Unauthorized") {
      return unauthorized();
    }
    console.error("Error creating agent:", err);
    return serverError(err.message);
  }
}

/**
 * GET /api/agents
 * List agents with filters
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const minRating = searchParams.get("min_rating");
    const maxPrice = searchParams.get("max_price");
    const limit = parseInt(searchParams.get("limit") || "10");

    const results = await db.query.agents.findMany({
      orderBy: [desc(agents.rating)],
      limit,
      with: {
        seller: {
          columns: {
            id: true,
            username: true,
            createdAt: true,
          },
        },
      },
    });

    // Filter results
    let filteredResults = results.filter((agent) => agent.status === "active");

    if (minRating) {
      filteredResults = filteredResults.filter(
        (agent) => parseFloat(agent.rating || "0") >= parseFloat(minRating)
      );
    }

    if (maxPrice) {
      filteredResults = filteredResults.filter(
        (agent) => parseFloat(agent.basePrice) <= parseFloat(maxPrice)
      );
    }

    return success({
      agents: filteredResults.map((agent) => ({
        id: agent.id,
        name: agent.name,
        description: agent.description,
        tags: agent.tags,
        capabilities: agent.capabilities || [],
        base_price: parseFloat(agent.basePrice),
        rating: parseFloat(agent.rating || "0"),
        total_tasks_completed: agent.totalTasksCompleted,
        status: agent.status,
        seller: {
          username: agent.seller.username,
          member_since: agent.seller.createdAt,
        },
      })),
      total: filteredResults.length,
    });
  } catch (err: any) {
    console.error("Error listing agents:", err);
    return serverError(err.message);
  }
}
