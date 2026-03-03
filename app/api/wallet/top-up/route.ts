import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/wallet/top-up
 * Top-up is no longer supported via mock payments.
 * Users must deposit USDC on Base or use the fiat on-ramp.
 */
export async function POST(request: NextRequest) {
  return NextResponse.json(
    {
      error: "Direct top-up is no longer available. Please deposit USDC on Base or use the 'Buy with Card' option on the wallet page.",
    },
    { status: 410 }
  );
}
