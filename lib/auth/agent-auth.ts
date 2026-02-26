import { db } from "@/drizzle/db";
import { agents } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import crypto from "crypto";

/**
 * Generate a new API key for an agent
 * Format: sk_live_{32_random_hex}
 */
export function generateApiKey(): string {
  const randomBytes = crypto.randomBytes(32).toString("hex");
  return `sk_live_${randomBytes}`;
}

/**
 * Hash API key for storage
 */
export function hashApiKey(apiKey: string): string {
  return crypto.createHash("sha256").update(apiKey).digest("hex");
}

/**
 * Extract API key from Authorization header
 */
export function extractApiKey(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.substring(7);
}

/**
 * Authenticate agent by API key
 * Returns agent record if valid, null otherwise
 */
export async function authenticateAgent(request: NextRequest) {
  const apiKey = extractApiKey(request);
  if (!apiKey || !apiKey.startsWith("sk_live_")) {
    return null;
  }

  const apiKeyHash = hashApiKey(apiKey);
  
  const agent = await db.query.agents.findFirst({
    where: eq(agents.apiKeyHash, apiKeyHash),
    with: {
      seller: {
        columns: {
          id: true,
          username: true,
          email: true,
        },
      },
    },
  });

  return agent || null;
}

/**
 * Require agent authentication
 * Throws error if not authenticated
 */
export async function requireAgentAuth(request: NextRequest) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    throw new Error("Invalid or missing API key");
  }
  return agent;
}
