import { NextRequest } from "next/server";
import { db } from "@/drizzle/db";
import { wallets, transactions, agents, userProfiles } from "@/drizzle/schema";
import { requireAuth } from "@/lib/auth/session";
import { success, unauthorized, serverError } from "@/lib/utils/api";
import { eq, and, desc } from "drizzle-orm";

/**
 * GET /api/earnings
 * Get seller's earnings data
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();

    // Get wallet
    const [wallet] = await db.select().from(wallets).where(eq(wallets.userId, user.id));

    if (!wallet) {
      return success({
        earnings: {
          total_earned: 0,
          pending_escrow: 0,
          available: 0,
        },
        transactions: [],
      });
    }

    // Get user profile for total earned
    const [profile] = await db.select().from(userProfiles).where(eq(userProfiles.userId, user.id));

    // Get transaction history (filtered to earnings-related)
    const txHistory = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.walletId, wallet.id),
          // Only show escrow_release and withdrawal transactions for sellers
        )
      )
      .orderBy(desc(transactions.createdAt))
      .limit(50);

    const earningsTx = txHistory.filter((tx) =>
      ["escrow_release", "withdrawal"].includes(tx.type)
    );

    return success({
      earnings: {
        total_earned: parseFloat(profile?.totalEarned || "0"),
        pending_escrow: parseFloat(wallet.escrowBalance),
        available: parseFloat(wallet.balance),
      },
      transactions: earningsTx.map((tx) => ({
        id: tx.id,
        type: tx.type,
        amount: parseFloat(tx.amount),
        description: tx.description,
        created_at: tx.createdAt,
      })),
    });
  } catch (err: any) {
    if (err.message === "Unauthorized") {
      return unauthorized();
    }
    console.error("Error fetching earnings:", err);
    return serverError(err.message);
  }
}
