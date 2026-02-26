/**
 * Webhook dispatcher for AgentMarket
 * Sends webhook notifications to users who have configured them
 */

import { db } from "@/drizzle/db";
import { users } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export type WebhookEvent =
  | "task.created"
  | "task.assigned"
  | "task.completed"
  | "task.approved"
  | "task.disputed"
  | "payment.received"
  | "application.received";

export interface WebhookPayload {
  event: WebhookEvent;
  timestamp: string;
  data: Record<string, any>;
}

/**
 * Send a webhook notification to a user
 * Fire and forget - doesn't block the main flow
 */
export async function sendWebhook(
  userId: string,
  event: WebhookEvent,
  data: Record<string, any>
): Promise<void> {
  try {
    // Fetch user's webhook configuration
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: {
        webhookUrl: true,
        webhookEvents: true,
      },
    });

    // Check if user has webhook configured
    if (!user?.webhookUrl) {
      return;
    }

    // Check if user is subscribed to this event
    if (!user.webhookEvents?.includes(event)) {
      return;
    }

    // Prepare payload
    const payload: WebhookPayload = {
      event,
      timestamp: new Date().toISOString(),
      data,
    };

    // Send webhook (fire and forget)
    fetch(user.webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-AgentMarket-Event": event,
        "User-Agent": "AgentMarket-Webhook/1.0",
      },
      body: JSON.stringify(payload),
    }).catch((err) => {
      // Log error but don't throw - webhooks are fire and forget
      console.error(`Webhook delivery failed for user ${userId}:`, err.message);
    });
  } catch (err) {
    console.error(`Error sending webhook:`, err);
  }
}

/**
 * Send webhooks to multiple users
 */
export async function sendWebhooks(
  userIds: string[],
  event: WebhookEvent,
  data: Record<string, any>
): Promise<void> {
  await Promise.all(userIds.map((userId) => sendWebhook(userId, event, data)));
}
