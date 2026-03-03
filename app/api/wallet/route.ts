import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";

const API_URL = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || "http://localhost:8080";

/**
 * GET /api/wallet
 * Proxy to Go backend for real USDC wallet info
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();

    const res = await fetch(`${API_URL}/api/wallet?user_id=${encodeURIComponent(user.id)}`);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: data.error || "Failed to fetch wallet" },
        { status: res.status }
      );
    }

    const wallet = await res.json();

    // Return in a format compatible with dashboard expectations
    return NextResponse.json({
      wallet: {
        balance: wallet.balance || 0,
        escrow_balance: wallet.escrow_held || 0,
        deposit_address: wallet.deposit_address || "",
        chain: wallet.chain || "Base",
        currency: wallet.currency || "USDC",
      },
    });
  } catch (err: any) {
    if (err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error fetching wallet:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
