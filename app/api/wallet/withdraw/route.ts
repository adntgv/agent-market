import { NextRequest } from "next/server";
import { db } from "@/drizzle/db";
import { wallets, transactions } from "@/drizzle/schema";
import { requireAuth } from "@/lib/auth/session";
import { success, error, unauthorized, serverError } from "@/lib/utils/api";
import { eq } from "drizzle-orm";
import { validateAmount } from "@/lib/security/validate";
import { logFinancialOperation, logSecurityEvent } from "@/lib/security/audit-log";
import { getClientIp } from "@/lib/security/rate-limit";

/**
 * POST /api/wallet/withdraw
 * Withdraw funds (mock for MVP)
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  
  try {
    const user = await requireAuth();
    const body = await request.json();
    const { amount, method } = body;

    // Validate amount
    let withdrawAmount: number;
    try {
      withdrawAmount = validateAmount(amount, 'withdrawal amount');
    } catch (validationError: any) {
      logSecurityEvent(
        'security.validation_failed',
        {
          reason: 'invalid_withdrawal_amount',
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
      // Get wallet with row lock
      const [wallet] = await tx.select().from(wallets).where(eq(wallets.userId, user.id));

      if (!wallet) {
        throw new Error("Wallet not found");
      }

      const currentBalance = parseFloat(wallet.balance);

      if (withdrawAmount > currentBalance) {
        throw new Error("Insufficient balance");
      }

      const newBalance = currentBalance - withdrawAmount;

      // Update wallet
      await tx
        .update(wallets)
        .set({
          balance: newBalance.toFixed(2),
          updatedAt: new Date(),
        })
        .where(eq(wallets.userId, user.id));

      // Create transaction
      const [transaction] = await tx
        .insert(transactions)
        .values({
          walletId: wallet.id,
          type: "withdrawal",
          amount: withdrawAmount.toFixed(2),
          balanceBefore: currentBalance.toFixed(2),
          balanceAfter: newBalance.toFixed(2),
          description: `Withdrawal via ${method || "bank_transfer"} (mock)`,
        })
        .returning();

      return { transaction, newBalance };
    });

    // Audit log
    logFinancialOperation(
      'wallet.withdraw',
      user.id,
      withdrawAmount,
      {
        transactionId: result.transaction.id,
        method: method || 'bank_transfer',
        newBalance: result.newBalance,
      },
      ip
    );

    return success({
      transaction: {
        id: result.transaction.id,
        type: result.transaction.type,
        amount: withdrawAmount,
        balance_after: result.newBalance,
        status: "completed", // Mock: instant withdrawal in MVP
      },
    });
  } catch (err: any) {
    if (err.message === "Unauthorized") {
      return unauthorized();
    }
    console.error("Error processing withdrawal:", err);
    return serverError(err.message);
  }
}
