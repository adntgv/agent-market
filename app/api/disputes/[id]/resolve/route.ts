import { NextRequest } from "next/server";
import { db } from "@/drizzle/db";
import { disputes, tasks, wallets, transactions, taskAssignments } from "@/drizzle/schema";
import { requireRole } from "@/lib/auth/session";
import { success, error, forbidden, notFound, serverError, calculatePlatformFee } from "@/lib/utils/api";
import { eq } from "drizzle-orm";

/**
 * POST /api/disputes/:id/resolve
 * Admin resolves dispute (handles escrow release/refund)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await requireRole("admin");
    const body = await request.json();
    const { resolution, refund_percentage, admin_comment } = body;

    if (!resolution || !["full_refund", "partial_refund", "release"].includes(resolution)) {
      return error("Invalid resolution type");
    }

    if (resolution === "partial_refund" && (!refund_percentage || refund_percentage < 0 || refund_percentage > 100)) {
      return error("refund_percentage must be between 0 and 100 for partial refunds");
    }

    const dispute = await db.query.disputes.findFirst({
      where: eq(disputes.id, id),
      with: {
        task: {
          with: {
            buyer: true,
            assignment: {
              with: {
                agent: {
                  with: {
                    seller: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!dispute) {
      return notFound("Dispute not found");
    }

    if (dispute.resolvedAt) {
      return error("Dispute already resolved");
    }

    const task = dispute.task;
    const assignment = task.assignment;
    if (!assignment) {
      return error("No assignment found for this task");
    }

    const agreedPrice = parseFloat(assignment.agreedPrice);
    const buyerId = task.buyer.id;
    const sellerId = assignment.agent.seller.id;

    // Get wallets
    const [buyerWallet] = await db.select().from(wallets).where(eq(wallets.userId, buyerId));
    const [sellerWallet] = await db.select().from(wallets).where(eq(wallets.userId, sellerId));

    if (!buyerWallet || !sellerWallet) {
      return error("Wallets not found");
    }

    let buyerRefund = 0;
    let sellerReceived = 0;
    let platformFee = 0;

    // Calculate amounts based on resolution
    if (resolution === "full_refund") {
      buyerRefund = agreedPrice;
      sellerReceived = 0;
      platformFee = 0;
    } else if (resolution === "partial_refund") {
      const refundPct = refund_percentage / 100;
      buyerRefund = agreedPrice * refundPct;
      const sellerAmount = agreedPrice * (1 - refundPct);
      platformFee = calculatePlatformFee(sellerAmount);
      sellerReceived = sellerAmount - platformFee;
    } else if (resolution === "release") {
      buyerRefund = 0;
      platformFee = calculatePlatformFee(agreedPrice);
      sellerReceived = agreedPrice - platformFee;
    }

    // Execute transactions
    const buyerEscrowBalance = parseFloat(buyerWallet.escrowBalance);
    const buyerBalance = parseFloat(buyerWallet.balance);
    const sellerBalance = parseFloat(sellerWallet.balance);

    // Refund to buyer
    if (buyerRefund > 0) {
      await db
        .update(wallets)
        .set({
          balance: (buyerBalance + buyerRefund).toFixed(2),
          escrowBalance: (buyerEscrowBalance - buyerRefund).toFixed(2),
        })
        .where(eq(wallets.userId, buyerId));

      await db.insert(transactions).values({
        walletId: buyerWallet.id,
        type: "refund",
        amount: buyerRefund.toFixed(2),
        balanceBefore: buyerBalance.toFixed(2),
        balanceAfter: (buyerBalance + buyerRefund).toFixed(2),
        referenceType: "dispute",
        referenceId: dispute.id,
        description: `Refund from dispute resolution: ${task.title}`,
      });
    }

    // Release escrow (remaining amount)
    if (buyerRefund < agreedPrice) {
      await db
        .update(wallets)
        .set({
          escrowBalance: (buyerEscrowBalance - (agreedPrice - buyerRefund)).toFixed(2),
        })
        .where(eq(wallets.userId, buyerId));
    }

    // Pay seller
    if (sellerReceived > 0) {
      await db
        .update(wallets)
        .set({
          balance: (sellerBalance + sellerReceived).toFixed(2),
        })
        .where(eq(wallets.userId, sellerId));

      await db.insert(transactions).values({
        walletId: sellerWallet.id,
        type: "escrow_release",
        amount: sellerReceived.toFixed(2),
        balanceBefore: sellerBalance.toFixed(2),
        balanceAfter: (sellerBalance + sellerReceived).toFixed(2),
        referenceType: "dispute",
        referenceId: dispute.id,
        description: `Payment from dispute resolution: ${task.title}`,
      });
    }

    // Platform fee transaction (if any)
    if (platformFee > 0) {
      await db.insert(transactions).values({
        walletId: buyerWallet.id,
        type: "platform_fee",
        amount: platformFee.toFixed(2),
        balanceBefore: buyerEscrowBalance.toFixed(2),
        balanceAfter: (buyerEscrowBalance - platformFee).toFixed(2),
        referenceType: "dispute",
        referenceId: dispute.id,
        description: `Platform fee for task: ${task.title}`,
      });
    }

    // Update dispute
    const [updatedDispute] = await db
      .update(disputes)
      .set({
        resolution,
        refundPercentage: refund_percentage || null,
        adminComment: admin_comment,
        resolvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(disputes.id, id))
      .returning();

    // Update task status
    await db
      .update(tasks)
      .set({
        status: resolution === "full_refund" ? "refunded" : "approved",
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, task.id));

    return success({
      dispute: {
        id: updatedDispute.id,
        resolution: updatedDispute.resolution,
        resolved_at: updatedDispute.resolvedAt,
      },
      refund: {
        buyer_refund: buyerRefund,
        seller_received: sellerReceived,
        platform_fee: platformFee,
      },
    });
  } catch (err: any) {
    if (err.message === "Forbidden") {
      return forbidden();
    }
    console.error("Error resolving dispute:", err);
    return serverError(err.message);
  }
}
