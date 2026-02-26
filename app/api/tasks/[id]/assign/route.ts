import { NextRequest } from "next/server";
import { db } from "@/drizzle/db";
import { tasks, taskAssignments, wallets, transactions, agents } from "@/drizzle/schema";
import { requireAuth } from "@/lib/auth/session";
import { success, error, notFound, unauthorized, serverError } from "@/lib/utils/api";
import { eq, sql } from "drizzle-orm";
import { validateUUID } from "@/lib/security/validate";
import { preventSelfDealing, requireTaskOwnership } from "@/lib/security/access-control";
import { logFinancialOperation, logTaskOperation } from "@/lib/security/audit-log";
import { getClientIp } from "@/lib/security/rate-limit";

/**
 * POST /api/tasks/:id/assign
 * Assign task to an agent and lock escrow
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ip = getClientIp(request);
  
  try {
    const { id } = await params;
    const user = await requireAuth();
    const body = await request.json();
    const { agent_id } = body;

    // Validate UUIDs
    try {
      validateUUID(id, 'task ID');
      validateUUID(agent_id, 'agent ID');
    } catch (validationError: any) {
      return error(validationError.message);
    }

    // Verify task ownership
    await requireTaskOwnership(id, user.id, request);

    // SECURITY: Prevent self-dealing
    await preventSelfDealing(id, agent_id, ip);

    // Use database transaction for atomic operation
    const result = await db.transaction(async (tx) => {
      // Get task with FOR UPDATE lock
      const task = await tx.query.tasks.findFirst({
        where: eq(tasks.id, id),
      });

      if (!task) {
        throw new Error("Task not found");
      }

      if (task.status !== "open" && task.status !== "matching") {
        throw new Error("Task is not available for assignment");
      }

      // Get agent (FIX: was incorrectly querying tasks table)
      const agent = await tx.query.agents.findFirst({
        where: eq(agents.id, agent_id),
      });

      if (!agent) {
        throw new Error("Agent not found");
      }

      const agreedPrice = parseFloat(agent.basePrice);

      // Get buyer wallet with FOR UPDATE lock
      const wallet = await tx.query.wallets.findFirst({
        where: eq(wallets.userId, user.id),
      });

      if (!wallet) {
        throw new Error("Wallet not found");
      }

      const currentBalance = parseFloat(wallet.balance);

      if (currentBalance < agreedPrice) {
        throw new Error("Insufficient balance. Please top up your wallet.");
      }

      // Lock escrow
      const newBalance = currentBalance - agreedPrice;
      const newEscrow = parseFloat(wallet.escrowBalance) + agreedPrice;

      await tx
        .update(wallets)
        .set({
          balance: newBalance.toFixed(2),
          escrowBalance: newEscrow.toFixed(2),
        })
        .where(eq(wallets.id, wallet.id));

      // Record transaction
      await tx.insert(transactions).values({
        walletId: wallet.id,
        type: "escrow_lock",
        amount: agreedPrice.toFixed(2),
        balanceBefore: currentBalance.toFixed(2),
        balanceAfter: newBalance.toFixed(2),
        referenceType: "task",
        referenceId: task.id,
        description: `Escrow locked for task: ${task.title}`,
      });

      // Create assignment
      const [assignment] = await tx
        .insert(taskAssignments)
        .values({
          taskId: task.id,
          agentId: agent_id,
          agreedPrice: agreedPrice.toFixed(2),
          status: "assigned",
        })
        .returning();

      // Update task status
      await tx
        .update(tasks)
        .set({
          status: "assigned",
          assignedAt: new Date(),
        })
        .where(eq(tasks.id, task.id));

      return {
        assignment,
        task,
        agreedPrice,
      };
    });

    // Audit logs
    logFinancialOperation(
      'escrow.lock',
      user.id,
      result.agreedPrice,
      {
        taskId: result.task.id,
        agentId: agent_id,
        assignmentId: result.assignment.id,
      },
      ip
    );

    logTaskOperation(
      'task.assigned',
      user.id,
      result.task.id,
      {
        agentId: agent_id,
        agreedPrice: result.agreedPrice,
      },
      ip
    );

    return success({
      assignment: {
        id: result.assignment.id,
        task_id: result.assignment.taskId,
        agent_id: result.assignment.agentId,
        agreed_price: result.agreedPrice,
        status: result.assignment.status,
      },
      escrow_locked: result.agreedPrice,
    });
  } catch (err: any) {
    if (err.message === "Unauthorized") {
      return unauthorized();
    }
    console.error("Error assigning task:", err);
    return serverError(err.message);
  }
}
