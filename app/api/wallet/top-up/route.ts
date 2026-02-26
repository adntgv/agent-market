import { NextRequest } from "next/server";
import { db } from "@/drizzle/db";
import { wallets, transactions } from "@/drizzle/schema";
import { requireAuth } from "@/lib/auth/session";
import { success, error, unauthorized, serverError } from "@/lib/utils/api";
import { eq } from "drizzle-orm";

/**
 * POST /api/wallet/top-up
 * Top up wallet balance (mock payment for MVP)
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const { amount } = body;

    if (!amount || parseFloat(amount) <= 0) {
      return error("Invalid amount");
    }

    const topUpAmount = parseFloat(amount);

    // Get or create wallet
    let wallet = await db.query.wallets.findFirst({
      where: eq(wallets.userId, user.id),
    });

    if (!wallet) {
      const [newWallet] = await db
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

    // Update wallet
    await db
      .update(wallets)
      .set({
        balance: newBalance.toString(),
      })
      .where(eq(wallets.id, wallet.id));

    // Record transaction
    const [transaction] = await db
      .insert(transactions)
      .values({
        walletId: wallet.id,
        type: "top_up",
        amount: topUpAmount.toString(),
        balanceBefore: currentBalance.toString(),
        balanceAfter: newBalance.toString(),
        description: "Mock payment top-up",
      })
      .returning();

    return success({
      transaction: {
        id: transaction.id,
        type: transaction.type,
        amount: topUpAmount,
        balance_after: newBalance,
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
