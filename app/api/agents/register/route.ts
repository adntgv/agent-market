import { NextRequest } from "next/server";
import { db } from "@/drizzle/db";
import { agents, users, userProfiles, wallets } from "@/drizzle/schema";
import { success, error, serverError } from "@/lib/utils/api";
import { generateApiKey, hashApiKey } from "@/lib/auth/agent-auth";
import bcrypt from "bcryptjs";

/**
 * POST /api/agents/register
 * Register a new agent programmatically
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      description,
      tags = [],
      capabilities = [],
      base_price,
      pricing_model = "fixed",
      callback_url,
      email,
      username,
    } = body;

    // Validation
    if (!name || !description || !base_price) {
      return error("Missing required fields: name, description, base_price");
    }

    if (parseFloat(base_price) <= 0) {
      return error("base_price must be greater than 0");
    }

    if (!email || !username) {
      return error("Missing required fields: email, username");
    }

    // Generate random password for the agent's user account
    const randomPassword = Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12);
    const passwordHash = await bcrypt.hash(randomPassword, 10);

    // Check if user already exists
    const existingUser = await db.query.users.findFirst({
      where: (users, { or, eq }) =>
        or(eq(users.email, email), eq(users.username, username)),
    });

    if (existingUser) {
      return error("User with this email or username already exists", 409);
    }

    // Create user account for the agent
    const [user] = await db
      .insert(users)
      .values({
        email,
        username,
        passwordHash,
        role: "agent",
        emailVerified: true,
      })
      .returning();

    // Create user profile
    await db.insert(userProfiles).values({
      userId: user.id,
      bio: `AI Agent: ${description}`,
      tags: tags,
    });

    // Create wallet
    await db.insert(wallets).values({
      userId: user.id,
      balance: "0.00",
      escrowBalance: "0.00",
    });

    // Generate API key
    const apiKey = generateApiKey();
    const apiKeyHash = hashApiKey(apiKey);

    // Create agent
    const [agent] = await db
      .insert(agents)
      .values({
        sellerId: user.id,
        name,
        description,
        tags,
        pricingModel: pricing_model,
        basePrice: base_price.toString(),
        status: "active",
        mcpEndpoint: callback_url || null,
        apiKeyHash,
      })
      .returning();

    return success(
      {
        agent_id: agent.id,
        api_key: apiKey, // Show only once!
        name: agent.name,
        status: agent.status,
        message:
          "Agent registered successfully. Store your API key securely - it won't be shown again!",
      },
      201
    );
  } catch (err: any) {
    console.error("Error registering agent:", err);
    return serverError(err.message);
  }
}
