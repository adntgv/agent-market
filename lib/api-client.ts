/**
 * Client for the Go crypto backend API.
 * All wallet/payment operations go through here.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export interface WalletInfo {
  user_id: string;
  balance: number;
  escrow_held: number;
  wallet_address: string;
  deposit_address: string; // platform address to send USDC to
  deposit_source: string;  // user's registered source address
  currency: string;
  chain: string;
  created_at: string;
  updated_at: string;
}

export interface WalletTransaction {
  id: string;
  user_id: string;
  type: string;
  amount: number;
  balance: number;
  ref_id: string;
  description: string;
  created_at: string;
}

export interface OnrampInfo {
  coinbase_onramp_url: string;
  transak_url: string;
  amount: number;
  currency: string;
  chain: string;
  note: string;
}

export interface WithdrawalResult {
  withdrawal: {
    id: string;
    user_id: string;
    amount: number;
    wallet_address: string;
    status: string;
    created_at: string;
  };
  message: string;
  chain: string;
}

export async function getWallet(userId: string): Promise<WalletInfo> {
  const res = await fetch(`${API_URL}/api/wallet?user_id=${encodeURIComponent(userId)}`);
  if (!res.ok) throw new Error(`Failed to fetch wallet: ${res.statusText}`);
  return res.json();
}

export async function getTransactions(userId: string): Promise<WalletTransaction[]> {
  const res = await fetch(`${API_URL}/api/wallet/transactions?user_id=${encodeURIComponent(userId)}`);
  if (!res.ok) throw new Error(`Failed to fetch transactions: ${res.statusText}`);
  return res.json();
}

export async function requestWithdrawal(userId: string, amount: number, walletAddress: string): Promise<WithdrawalResult> {
  const res = await fetch(`${API_URL}/api/wallet/withdraw`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId, amount, wallet_address: walletAddress }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Withdrawal failed: ${res.statusText}`);
  }
  return res.json();
}

export async function getOnrampUrls(userId: string, amount?: number): Promise<OnrampInfo> {
  const params = new URLSearchParams({ user_id: userId });
  if (amount) params.set("amount", amount.toString());
  const res = await fetch(`${API_URL}/api/wallet/onramp?${params}`);
  if (!res.ok) throw new Error(`Failed to get on-ramp URLs: ${res.statusText}`);
  return res.json();
}

export async function registerDepositAddress(userId: string, address: string) {
  const res = await fetch(`${API_URL}/api/wallet/deposit-address`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId, address }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to register deposit address: ${res.statusText}`);
  }
  return res.json();
}
