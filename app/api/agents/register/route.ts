import { NextRequest } from "next/server";
import { db } from "@/drizzle/db";
import { agents, users, userProfiles, wallets } from "@/drizzle/schema";
import { success, error, serverError } from "@/lib/utils/api";
import { generateApiKey, hashApiKey } from "@/lib/auth/agent-auth";
import bcrypt from "bcryptjs";
import { sanitizeAgentName, sanitizeAgentDescription, sanitizeTags, sanitizeString } from "@/lib/security/sanitize";
import { validateAmount, validateEmail, validateUrl, validateStringLength } from "@/lib/security/validate";
import { logAuthEvent, logSecurityEvent } from "@/lib/security/audit-log";
import { getClientIp } from "@/lib/security/rate-limit";

/**
 * POST /api/agents/register
 * Register a new agent programmatically
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  
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
    if (!name || !description || !base_price || !email || !username) {
      return error("Missing required fields: name, description, base_price, email, username");
    }

    // Validate and sanitize inputs
    let sanitizedName: string;
    let sanitizedDescription: string;
    let sanitizedTags: string[];
    let validatedBasePrice: number;
    let validatedEmail: string;
    let sanitizedUsername: string;
    let validatedCallbackUrl: string | null = null;
    
    try {
      sanitizedName = sanitizeAgentName(name);
      sanitizedDescription = sanitizeAgentDescription(description);
      sanitizedTags = sanitizeTags(tags);
      validatedBasePrice = validateAmount(base_price, 'base_price');
      validatedEmail = validateEmail(email);
      sanitizedUsername = validateStringLength(sanitizeString(username), 3, 50, 'username');
      
      if (callback_url) {
        validatedCallbackUrl = validateUrl(callback_url, 'callback_url');
      }
    } catch (validationError: any) {
      logSecurityEvent(
        'security.validation_failed',
        {
          reason: 'agent_registration_validation_failed',
          error: validationError.message,
        },
        undefined,
        ip
      );
      return error(validationError.message);
    }

    // Generate API key
    const apiKey = generateApiKey();
    const apiKeyHash = hashApiKey(apiKey);

    // Use database transaction for atomic operation
    const result = await db.transaction(async (tx) => {
      // Check if user already exists
      const existingUser = await tx.query.users.findFirst({
        where: (users, { or, eq }) =>
          or(eq(users.email, validatedEmail), eq(users.username, sanitizedUsername)),
      });

      if (existingUser) {
        throw new Error("User with this email or username already exists");
      }

      // Generate random password for the agent's user account
      const randomPassword = Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12);
      const passwordHash = await bcrypt.hash(randomPassword, 10);

      // Create user account for the agent
      const [user] = await tx
        .insert(users)
        .values({
          email: validatedEmail,
          username: sanitizedUsername,
          passwordHash,
          role: "agent",
          emailVerified: true,
        })
        .returning();

      // Create user profile
      await tx.insert(userProfiles).values({
        userId: user.id,
        bio: `AI Agent: ${sanitizedDescription.substring(0, 200)}`,
        tags: sanitizedTags,
      });

      // Create wallet
      await tx.insert(wallets).values({
        userId: user.id,
        balance: "0.00",
        escrowBalance: "0.00",
      });

      // Create agent
      const [agent] = await tx
        .insert(agents)
        .values({
          sellerId: user.id,
          name: sanitizedName,
          description: sanitizedDescription,
          tags: sanitizedTags,
          capabilities: Array.isArray(capabilities) ? capabilities : [],
          pricingModel: pricing_model,
          basePrice: validatedBasePrice.toFixed(2),
          status: "active",
          mcpEndpoint: validatedCallbackUrl,
          apiKeyHash,
        })
        .returning();

      return { user, agent };
    });

    // Audit log
    logAuthEvent(
      'agent.api_key_generated',
      {
        agentId: result.agent.id,
        userId: result.user.id,
        agentName: sanitizedName,
        email: validatedEmail,
      },
      true,
      ip,
      result.user.id
    );

    return success(
      {
        agent_id: result.agent.id,
        api_key: apiKey, // Show only once!
        name: result.agent.name,
        status: result.agent.status,
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
