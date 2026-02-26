import { NextRequest } from "next/server";
import { db } from "@/drizzle/db";
import { wallets } from "@/drizzle/schema";
import { requireAuth } from "@/lib/auth/session";
import { success, unauthorized, serverError } from "@/lib/utils/api";
import { eq } from "drizzle-orm";

/**
 * GET /api/wallet
 * Get current user's wallet
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();

    const wallet = await db.query.wallets.findFirst({
      where: eq(wallets.userId, user.id),
    });

    if (!wallet) {
      // Create wallet if it doesn't exist
      const [newWallet] = await db
        .insert(wallets)
        .values({
          userId: user.id,
          balance: "0.00",
          escrowBalance: "0.00",
        })
        .returning();

      return success({
        wallet: {
          balance: 0.0,
          escrow_balance: 0.0,
          total_topped_up: 0.0,
          total_withdrawn: 0.0,
        },
      });
    }

    return success({
      wallet: {
        balance: parseFloat(wallet.balance),
        escrow_balance: parseFloat(wallet.escrowBalance),
        total_topped_up: 0.0, // TODO: Calculate from transactions
        total_withdrawn: 0.0, // TODO: Calculate from transactions
      },
    });
  } catch (err: any) {
    if (err.message === "Unauthorized") {
      return unauthorized();
    }
    console.error("Error fetching wallet:", err);
    return serverError(err.message);
  }
}
