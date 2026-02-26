import { NextResponse } from "next/server";

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function success<T>(data: T, status: number = 200) {
  return NextResponse.json(data, { status });
}

export function error(message: string, status: number = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function unauthorized(message: string = "Unauthorized") {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function forbidden(message: string = "Forbidden") {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function notFound(message: string = "Not found") {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function serverError(message: string = "Internal server error") {
  return NextResponse.json({ error: message }, { status: 500 });
}

/**
 * Calculate platform fee based on amount
 */
export function calculatePlatformFee(amount: number): number {
  const feePercentage = parseInt(process.env.PLATFORM_FEE_PERCENTAGE || "20");
  return (amount * feePercentage) / 100;
}

/**
 * Calculate auto-approve timestamp (24h from now by default)
 */
export function calculateAutoApproveTime(): Date {
  const hours = parseInt(process.env.AUTO_APPROVE_HOURS || "24");
  const date = new Date();
  date.setHours(date.getHours() + hours);
  return date;
}
