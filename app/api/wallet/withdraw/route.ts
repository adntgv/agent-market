import { NextRequest } from "next/server";
import { db } from "@/drizzle/db";
import { wallets, transactions } from "@/drizzle/schema";
import { requireAuth } from "@/lib/auth/session";
import { success, error, unauthorized, serverError } from "@/lib/utils/api";
import { eq } from "drizzle-orm";

/**
 * POST /api/wallet/withdraw
 * Withdraw funds (mock for MVP)
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const { amount, method } = body;

    if (!amount || parseFloat(amount) <= 0) {
      return error("Invalid withdrawal amount");
    }

    const withdrawAmount = parseFloat(amount);

    // Get wallet
    const [wallet] = await db.select().from(wallets).where(eq(wallets.userId, user.id));

    if (!wallet) {
      return error("Wallet not found");
    }

    const currentBalance = parseFloat(wallet.balance);

    if (withdrawAmount > currentBalance) {
      return error("Insufficient balance");
    }

    const newBalance = currentBalance - withdrawAmount;

    // Update wallet
    await db
      .update(wallets)
      .set({
        balance: newBalance.toFixed(2),
        updatedAt: new Date(),
      })
      .where(eq(wallets.userId, user.id));

    // Create transaction
    const [transaction] = await db
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

    return success({
      transaction: {
        id: transaction.id,
        type: transaction.type,
        amount: parseFloat(transaction.amount),
        balance_after: newBalance,
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
