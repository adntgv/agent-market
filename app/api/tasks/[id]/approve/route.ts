import { NextRequest } from "next/server";
import { db } from "@/drizzle/db";
import { tasks, taskAssignments, wallets, transactions, agents, userProfiles } from "@/drizzle/schema";
import { requireAuth } from "@/lib/auth/session";
import { success, error, notFound, unauthorized, serverError, calculatePlatformFee } from "@/lib/utils/api";
import { eq } from "drizzle-orm";

/**
 * POST /api/tasks/:id/approve
 * Approve task completion and release escrow
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();

    // Get task with assignment
    const task = await db.query.tasks.findFirst({
      where: eq(tasks.id, params.id),
      with: {
        assignment: {
          with: {
            agent: true,
          },
        },
      },
    });

    if (!task) {
      return notFound("Task not found");
    }

    if (task.buyerId !== user.id) {
      return unauthorized("You can only approve your own tasks");
    }

    if (task.status !== "completed") {
      return error("Task must be completed before approval");
    }

    if (!task.assignment) {
      return error("No assignment found for this task");
    }

    const agreedPrice = parseFloat(task.assignment.agreedPrice);
    const platformFee = calculatePlatformFee(agreedPrice);
    const sellerAmount = agreedPrice - platformFee;

    // Get buyer and seller wallets
    const buyerWallet = await db.query.wallets.findFirst({
      where: eq(wallets.userId, user.id),
    });

    const sellerWallet = await db.query.wallets.findFirst({
      where: eq(wallets.userId, task.assignment.agent.sellerId),
    });

    if (!buyerWallet || !sellerWallet) {
      return error("Wallet not found");
    }

    // Release escrow
    const buyerNewEscrow = parseFloat(buyerWallet.escrowBalance) - agreedPrice;
    const sellerNewBalance = parseFloat(sellerWallet.balance) + sellerAmount;

    // 1. Update buyer wallet (remove from escrow)
    await db
      .update(wallets)
      .set({
        escrowBalance: buyerNewEscrow.toString(),
      })
      .where(eq(wallets.id, buyerWallet.id));

    // 2. Update seller wallet (add to balance)
    await db
      .update(wallets)
      .set({
        balance: sellerNewBalance.toString(),
      })
      .where(eq(wallets.id, sellerWallet.id));

    // 3. Record transactions
    await db.insert(transactions).values([
      {
        walletId: buyerWallet.id,
        type: "escrow_release",
        amount: agreedPrice.toString(),
        balanceBefore: buyerWallet.balance,
        balanceAfter: buyerWallet.balance,
        referenceType: "task",
        referenceId: task.id,
        description: `Escrow released for task: ${task.title}`,
      },
      {
        walletId: sellerWallet.id,
        type: "escrow_release",
        amount: sellerAmount.toString(),
        balanceBefore: sellerWallet.balance,
        balanceAfter: sellerNewBalance.toString(),
        referenceType: "task",
        referenceId: task.id,
        description: `Payment received for task: ${task.title}`,
      },
      {
        walletId: buyerWallet.id,
        type: "platform_fee",
        amount: platformFee.toString(),
        balanceBefore: buyerWallet.balance,
        balanceAfter: buyerWallet.balance,
        referenceType: "task",
        referenceId: task.id,
        description: `Platform fee for task: ${task.title}`,
      },
    ]);

    // 4. Update task status
    await db
      .update(tasks)
      .set({
        status: "approved",
        approvedAt: new Date(),
      })
      .where(eq(tasks.id, task.id));

    // 5. Update assignment status
    await db
      .update(taskAssignments)
      .set({
        status: "approved",
      })
      .where(eq(taskAssignments.id, task.assignment.id));

    // 6. Update agent stats
    await db
      .update(agents)
      .set({
        totalTasksCompleted: task.assignment.agent.totalTasksCompleted + 1,
      })
      .where(eq(agents.id, task.assignment.agentId));

    // 7. Update seller profile stats
    const sellerProfile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.userId, task.assignment.agent.sellerId),
    });

    if (sellerProfile) {
      await db
        .update(userProfiles)
        .set({
          totalTasksCompleted: sellerProfile.totalTasksCompleted + 1,
          totalEarned: (parseFloat(sellerProfile.totalEarned) + sellerAmount).toString(),
        })
        .where(eq(userProfiles.userId, task.assignment.agent.sellerId));
    }

    return success({
      task: { id: task.id, status: "approved" },
      escrow_released: agreedPrice,
      platform_fee: platformFee,
      seller_received: sellerAmount,
    });
  } catch (err: any) {
    if (err.message === "Unauthorized") {
      return unauthorized();
    }
    console.error("Error approving task:", err);
    return serverError(err.message);
  }
}
