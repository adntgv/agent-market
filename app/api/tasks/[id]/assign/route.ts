import { NextRequest } from "next/server";
import { db } from "@/drizzle/db";
import { tasks, taskAssignments, wallets, transactions } from "@/drizzle/schema";
import { requireAuth } from "@/lib/auth/session";
import { success, error, notFound, unauthorized, serverError } from "@/lib/utils/api";
import { eq } from "drizzle-orm";

/**
 * POST /api/tasks/:id/assign
 * Assign task to an agent and lock escrow
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const { agent_id } = body;

    if (!agent_id) {
      return error("agent_id is required");
    }

    // Get task
    const task = await db.query.tasks.findFirst({
      where: eq(tasks.id, params.id),
    });

    if (!task) {
      return notFound("Task not found");
    }

    if (task.buyerId !== user.id) {
      return unauthorized("You can only assign your own tasks");
    }

    if (task.status !== "open" && task.status !== "matching") {
      return error("Task is not available for assignment");
    }

    // Get agent
    const agent = await db.query.agents.findFirst({
      where: eq(tasks.id, agent_id),
    });

    if (!agent) {
      return notFound("Agent not found");
    }

    const agreedPrice = parseFloat(agent.basePrice);

    // Get buyer wallet
    const wallet = await db.query.wallets.findFirst({
      where: eq(wallets.userId, user.id),
    });

    if (!wallet) {
      return error("Wallet not found");
    }

    const currentBalance = parseFloat(wallet.balance);

    if (currentBalance < agreedPrice) {
      return error("Insufficient balance. Please top up your wallet.");
    }

    // Start transaction
    // 1. Lock escrow
    const newBalance = currentBalance - agreedPrice;
    const newEscrow = parseFloat(wallet.escrowBalance) + agreedPrice;

    await db
      .update(wallets)
      .set({
        balance: newBalance.toString(),
        escrowBalance: newEscrow.toString(),
      })
      .where(eq(wallets.id, wallet.id));

    // 2. Record transaction
    await db.insert(transactions).values({
      walletId: wallet.id,
      type: "escrow_lock",
      amount: agreedPrice.toString(),
      balanceBefore: currentBalance.toString(),
      balanceAfter: newBalance.toString(),
      referenceType: "task",
      referenceId: task.id,
      description: `Escrow locked for task: ${task.title}`,
    });

    // 3. Create assignment
    const [assignment] = await db
      .insert(taskAssignments)
      .values({
        taskId: task.id,
        agentId: agent_id,
        agreedPrice: agreedPrice.toString(),
        status: "assigned",
      })
      .returning();

    // 4. Update task status
    await db
      .update(tasks)
      .set({
        status: "assigned",
        assignedAt: new Date(),
      })
      .where(eq(tasks.id, task.id));

    return success({
      assignment: {
        id: assignment.id,
        task_id: assignment.taskId,
        agent_id: assignment.agentId,
        agreed_price: agreedPrice,
        status: assignment.status,
      },
      escrow_locked: agreedPrice,
    });
  } catch (err: any) {
    if (err.message === "Unauthorized") {
      return unauthorized();
    }
    console.error("Error assigning task:", err);
    return serverError(err.message);
  }
}
