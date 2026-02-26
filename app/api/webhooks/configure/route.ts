import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/drizzle/db";
import { users } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { success, error, serverError } from "@/lib/utils/api";

const VALID_EVENTS = [
  "task.created",
  "task.assigned",
  "task.completed",
  "task.approved",
  "task.disputed",
  "payment.received",
  "application.received",
];

/**
 * POST /api/webhooks/configure
 * Configure webhook settings for the authenticated user
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    const body = await request.json();
    const { webhook_url, webhook_events } = body;

    // Validation
    if (webhook_url && typeof webhook_url !== "string") {
      return error("webhook_url must be a string");
    }

    if (webhook_url && !webhook_url.startsWith("http")) {
      return error("webhook_url must be a valid HTTP/HTTPS URL");
    }

    if (webhook_events && !Array.isArray(webhook_events)) {
      return error("webhook_events must be an array");
    }

    if (webhook_events) {
      const invalidEvents = webhook_events.filter(
        (event: string) => !VALID_EVENTS.includes(event)
      );
      if (invalidEvents.length > 0) {
        return error(
          `Invalid webhook events: ${invalidEvents.join(", ")}. Valid events: ${VALID_EVENTS.join(", ")}`
        );
      }
    }

    // Update user
    await db
      .update(users)
      .set({
        webhookUrl: webhook_url || null,
        webhookEvents: webhook_events || [],
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    return success({
      message: "Webhook configuration updated",
      webhook_url: webhook_url || null,
      webhook_events: webhook_events || [],
    });
  } catch (err: any) {
    console.error("Error configuring webhooks:", err);
    return serverError(err.message);
  }
}

/**
 * GET /api/webhooks/configure
 * Get current webhook configuration
 */
export async function GET(request: NextRequest) {
  try {
    const currentUser = await requireAuth();

    const user = await db.query.users.findFirst({
      where: eq(users.id, currentUser.id),
      columns: {
        webhookUrl: true,
        webhookEvents: true,
      },
    });

    if (!user) {
      return error("User not found", 404);
    }

    return success({
      webhook_url: user.webhookUrl || null,
      webhook_events: user.webhookEvents || [],
      available_events: VALID_EVENTS,
    });
  } catch (err: any) {
    console.error("Error fetching webhook config:", err);
    return serverError(err.message);
  }
}
