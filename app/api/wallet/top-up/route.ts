import { NextRequest } from "next/server";
import { db } from "@/drizzle/db";
import { wallets, transactions } from "@/drizzle/schema";
import { requireAuth } from "@/lib/auth/session";
import { success, error, unauthorized, serverError } from "@/lib/utils/api";
import { eq, sql } from "drizzle-orm";
import { validateAmount } from "@/lib/security/validate";
import { logFinancialOperation, logSecurityEvent } from "@/lib/security/audit-log";
import { getClientIp } from "@/lib/security/rate-limit";

/**
 * POST /api/wallet/top-up
 * Top up wallet balance (mock payment for MVP)
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  
  try {
    const user = await requireAuth();
    const body = await request.json();
    const { amount } = body;

    // Validate amount (must be positive, max 10000, max 2 decimals)
    let topUpAmount: number;
    try {
      topUpAmount = validateAmount(amount, 'top-up amount');
    } catch (validationError: any) {
      logSecurityEvent(
        'security.validation_failed',
        {
          reason: 'invalid_top_up_amount',
          providedAmount: amount,
          error: validationError.message,
        },
        user.id,
        ip
      );
      return error(validationError.message);
    }

    // Use database transaction for atomic operation
    const result = await db.transaction(async (tx) => {
      // Get or create wallet with row lock
      let wallet = await tx.query.wallets.findFirst({
        where: eq(wallets.userId, user.id),
      });

      if (!wallet) {
        const [newWallet] = await tx
          .insert(wallets)
          .values({
            userId: user.id,
            balance: "0.00",
            escrowBalance: "0.00",
          })
          .returning();
        wallet = newWallet;
      }

      const currentBalance = parseFloat(wallet.balance);
      const newBalance = currentBalance + topUpAmount;

      // Update wallet balance
      await tx
        .update(wallets)
        .set({
          balance: newBalance.toFixed(2),
        })
        .where(eq(wallets.id, wallet.id));

      // Record transaction
      const [transaction] = await tx
        .insert(transactions)
        .values({
          walletId: wallet.id,
          type: "top_up",
          amount: topUpAmount.toFixed(2),
          balanceBefore: currentBalance.toFixed(2),
          balanceAfter: newBalance.toFixed(2),
          description: "Mock payment top-up",
        })
        .returning();

      return { transaction, newBalance };
    });

    // Audit log
    logFinancialOperation(
      'wallet.top_up',
      user.id,
      topUpAmount,
      {
        transactionId: result.transaction.id,
        newBalance: result.newBalance,
      },
      ip
    );

    return success({
      transaction: {
        id: result.transaction.id,
        type: result.transaction.type,
        amount: topUpAmount,
        balance_after: result.newBalance,
      },
    });
  } catch (err: any) {
    if (err.message === "Unauthorized") {
      return unauthorized();
    }
    console.error("Error topping up wallet:", err);
    return serverError(err.message);
  }
}
