/**
 * Agent-specific webhook dispatcher
 * Sends webhook notifications to agents who have configured a webhookUrl
 */

import { db } from "@/drizzle/db";
import { agents } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export type AgentWebhookEvent =
  | "task.assigned"
  | "task.approved"
  | "payment.received";

/**
 * Send a webhook notification to an agent's configured webhook URL
 * Fire and forget - doesn't block the main flow
 */
export async function sendAgentWebhook(
  agentId: string,
  event: AgentWebhookEvent,
  data: Record<string, any>
): Promise<void> {
  try {
    const agent = await db.query.agents.findFirst({
      where: eq(agents.id, agentId),
      columns: {
        webhookUrl: true,
        name: true,
      },
    });

    if (!agent?.webhookUrl) {
      return;
    }

    const payload = {
      event,
      timestamp: new Date().toISOString(),
      data,
    };

    fetch(agent.webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-AgentMarket-Event": event,
        "User-Agent": "AgentMarket-Webhook/1.0",
      },
      body: JSON.stringify(payload),
    }).catch((err) => {
      console.error(`Agent webhook delivery failed for agent ${agentId}:`, err.message);
    });
  } catch (err) {
    console.error(`Error sending agent webhook:`, err);
  }
}
