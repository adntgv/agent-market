import { NextRequest } from "next/server";
import { db } from "@/drizzle/db";
import { tasks, taskAssignments, wallets, transactions, agents, userProfiles } from "@/drizzle/schema";
import { requireAuth } from "@/lib/auth/session";
import { success, error, notFound, unauthorized, serverError, calculatePlatformFee } from "@/lib/utils/api";
import { eq, sql } from "drizzle-orm";
import { validateUUID } from "@/lib/security/validate";
import { requireTaskOwnership } from "@/lib/security/access-control";
import { logFinancialOperation, logTaskOperation } from "@/lib/security/audit-log";
import { getClientIp } from "@/lib/security/rate-limit";

/**
 * POST /api/tasks/:id/approve
 * Approve task completion and release escrow
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ip = getClientIp(request);
  
  try {
    const { id } = await params;
    const user = await requireAuth();

    // Validate UUID
    try {
      validateUUID(id, 'task ID');
    } catch (validationError: any) {
      return error(validationError.message);
    }

    // Verify task ownership
    await requireTaskOwnership(id, user.id, request);

    // Use database transaction for atomic operation
    const result = await db.transaction(async (tx) => {
      // Get task with assignment with FOR UPDATE lock
      const task = await tx.query.tasks.findFirst({
        where: eq(tasks.id, id),
        with: {
          assignment: {
            with: {
              agent: true,
            },
          },
        },
      });

      if (!task) {
        throw new Error("Task not found");
      }

      if (task.status !== "completed") {
        throw new Error("Task must be completed before approval");
      }

      if (!task.assignment) {
        throw new Error("No assignment found for this task");
      }

      const agreedPrice = parseFloat(task.assignment.agreedPrice);
      const platformFee = calculatePlatformFee(agreedPrice);
      const sellerAmount = agreedPrice - platformFee;

      // Get buyer and seller wallets with FOR UPDATE lock
      const buyerWallet = await tx.query.wallets.findFirst({
        where: eq(wallets.userId, user.id),
      });

      const sellerWallet = await tx.query.wallets.findFirst({
        where: eq(wallets.userId, task.assignment.agent.sellerId),
      });

      if (!buyerWallet || !sellerWallet) {
        throw new Error("Wallet not found");
      }

      // SECURITY: Verify escrow has sufficient funds
      const buyerEscrowBalance = parseFloat(buyerWallet.escrowBalance);
      if (buyerEscrowBalance < agreedPrice) {
        throw new Error("Insufficient escrow balance. Cannot release funds.");
      }

      // Release escrow
      const buyerNewEscrow = buyerEscrowBalance - agreedPrice;
      const sellerCurrentBalance = parseFloat(sellerWallet.balance);
      const sellerNewBalance = sellerCurrentBalance + sellerAmount;

      // 1. Update buyer wallet (remove from escrow)
      await tx
        .update(wallets)
        .set({
          escrowBalance: buyerNewEscrow.toFixed(2),
        })
        .where(eq(wallets.id, buyerWallet.id));

      // 2. Update seller wallet (add to balance)
      await tx
        .update(wallets)
        .set({
          balance: sellerNewBalance.toFixed(2),
        })
        .where(eq(wallets.id, sellerWallet.id));

      // 3. Record transactions
      await tx.insert(transactions).values([
        {
          walletId: buyerWallet.id,
          type: "escrow_release",
          amount: agreedPrice.toFixed(2),
          balanceBefore: buyerWallet.balance,
          balanceAfter: buyerWallet.balance,
          referenceType: "task",
          referenceId: task.id,
          description: `Escrow released for task: ${task.title}`,
        },
        {
          walletId: sellerWallet.id,
          type: "escrow_release",
          amount: sellerAmount.toFixed(2),
          balanceBefore: sellerCurrentBalance.toFixed(2),
          balanceAfter: sellerNewBalance.toFixed(2),
          referenceType: "task",
          referenceId: task.id,
          description: `Payment received for task: ${task.title}`,
        },
        {
          walletId: buyerWallet.id,
          type: "platform_fee",
          amount: platformFee.toFixed(2),
          balanceBefore: buyerWallet.balance,
          balanceAfter: buyerWallet.balance,
          referenceType: "task",
          referenceId: task.id,
          description: `Platform fee for task: ${task.title}`,
        },
      ]);

      // 4. Update task status
      await tx
        .update(tasks)
        .set({
          status: "approved",
          approvedAt: new Date(),
        })
        .where(eq(tasks.id, task.id));

      // 5. Update assignment status
      await tx
        .update(taskAssignments)
        .set({
          status: "approved",
        })
        .where(eq(taskAssignments.id, task.assignment.id));

      // 6. Update agent stats
      await tx
        .update(agents)
        .set({
          totalTasksCompleted: (task.assignment.agent.totalTasksCompleted ?? 0) + 1,
        })
        .where(eq(agents.id, task.assignment.agentId));

      // 7. Update seller profile stats
      const sellerProfile = await tx.query.userProfiles.findFirst({
        where: eq(userProfiles.userId, task.assignment.agent.sellerId),
      });

      if (sellerProfile) {
        await tx
          .update(userProfiles)
          .set({
            totalTasksCompleted: (sellerProfile.totalTasksCompleted ?? 0) + 1,
            totalEarned: (parseFloat(sellerProfile.totalEarned ?? "0") + sellerAmount).toFixed(2),
          })
          .where(eq(userProfiles.userId, task.assignment.agent.sellerId));
      }

      return {
        task,
        agreedPrice,
        platformFee,
        sellerAmount,
      };
    });

    // Audit logs
    logFinancialOperation(
      'escrow.release',
      user.id,
      result.agreedPrice,
      {
        taskId: result.task.id,
        platformFee: result.platformFee,
        sellerAmount: result.sellerAmount,
        sellerId: result.task.assignment!.agent.sellerId,
      },
      ip
    );

    logTaskOperation(
      'task.approved',
      user.id,
      result.task.id,
      {
        agreedPrice: result.agreedPrice,
        platformFee: result.platformFee,
      },
      ip
    );

    return success({
      task: { id: result.task.id, status: "approved" },
      escrow_released: result.agreedPrice,
      platform_fee: result.platformFee,
      seller_received: result.sellerAmount,
    });
  } catch (err: any) {
    if (err.message === "Unauthorized") {
      return unauthorized();
    }
    console.error("Error approving task:", err);
    return serverError(err.message);
  }
}
