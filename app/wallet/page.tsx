"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

interface WalletInfo {
  balance: number;
  escrow_held: number;
  deposit_address: string;
  platform_address: string;
  deposit_source: string;
  unique_deposit_addr: string;
  hd_index: number;
  currency: string;
  chain: string;
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  balance: number;
  description: string;
  created_at: string;
}

export default function WalletPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [withdrawAddress, setWithdrawAddress] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [onrampAmount, setOnrampAmount] = useState("50");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [sourceAddress, setSourceAddress] = useState("");
  const [sourceLoading, setSourceLoading] = useState(false);
  const [sourceSuccess, setSourceSuccess] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchWallet();
      fetchTransactions();
    }
  }, [session]);

  const userId = (session?.user as any)?.id || session?.user?.email || "";

  const fetchWallet = async () => {
    try {
      const res = await fetch(`${API_URL}/api/wallet?user_id=${encodeURIComponent(userId)}`);
      if (res.ok) setWallet(await res.json());
    } catch (err) {
      console.error("Error fetching wallet:", err);
    }
  };

  const fetchTransactions = async () => {
    try {
      const res = await fetch(`${API_URL}/api/wallet/transactions?user_id=${encodeURIComponent(userId)}`);
      if (res.ok) setTransactions(await res.json());
    } catch (err) {
      console.error("Error fetching transactions:", err);
    }
  };

  const handleWithdraw = async () => {
    setError("");
    if (!withdrawAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      setError("Enter a valid Base wallet address (0x...)");
      return;
    }
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount < 5) {
      setError("Minimum withdrawal is 5.00 USDC");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/wallet/withdraw`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, amount, wallet_address: withdrawAddress }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Withdrawal failed");
      alert(data.message || "Withdrawal queued!");
      setWithdrawAmount("");
      setWithdrawAddress("");
      fetchWallet();
      fetchTransactions();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBuyWithCard = async () => {
    setLoading(true);
    try {
      const amount = parseFloat(onrampAmount) || 50;
      const res = await fetch(`${API_URL}/api/wallet/onramp?user_id=${encodeURIComponent(userId)}&amount=${amount}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to get on-ramp URL");
      // Open Coinbase on-ramp in new tab (primary), fallback to Transak
      window.open(data.coinbase_onramp_url || data.transak_url, "_blank");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSource = async () => {
    setError("");
    setSourceSuccess("");
    if (!sourceAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      setError("Enter a valid wallet address (0x...)");
      return;
    }
    setSourceLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/wallet/deposit-address`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, address: sourceAddress }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to register address");
      setSourceSuccess("Source wallet registered! Deposits from this address will be auto-detected.");
      setSourceAddress("");
      fetchWallet();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSourceLoading(false);
    }
  };

  const copyAddress = () => {
    if (wallet?.deposit_address) {
      navigator.clipboard.writeText(wallet.deposit_address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (status === "loading") {
    return <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center text-slate-400">Loading...</div>;
  }
  if (!session) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <nav className="border-b border-slate-800/50 bg-slate-950/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">AM</span>
            </div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">Agent Marketplace</h1>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/dashboard"><Button variant="ghost" className="text-slate-400 hover:text-white">Dashboard</Button></Link>
            <span className="text-sm text-slate-400">{session.user?.name}</span>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="text-3xl font-bold text-white mb-8">Wallet</h1>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl p-4 mb-6">{error}</div>
        )}

        {/* Balance Cards */}
        <div className="grid gap-6 md:grid-cols-2 mb-8">
          <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-slate-300">Available Balance</CardTitle>
              <CardDescription className="text-slate-500">USDC on Base</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                {wallet?.balance?.toFixed(2) || "0.00"} USDC
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-slate-300">In Escrow</CardTitle>
              <CardDescription className="text-slate-500">Locked in active tasks</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-white">
                {wallet?.escrow_held?.toFixed(2) || "0.00"} USDC
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Deposit Section */}
        <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700 mb-8">
          <CardHeader>
            <CardTitle className="text-white">Deposit USDC</CardTitle>
            <CardDescription className="text-slate-400">
              Send USDC on <span className="text-blue-400 font-medium">Base network</span> to the platform address
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {wallet?.deposit_address ? (
              <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                <p className="text-xs text-slate-500 mb-1 uppercase tracking-wide">Your Deposit Address (Base)</p>
                <div className="flex items-center gap-2">
                  <code className="text-sm text-blue-400 font-mono flex-1 break-all">{wallet.deposit_address}</code>
                  <Button size="sm" variant="outline" className="border-slate-600 text-slate-300 shrink-0" onClick={copyAddress}>
                    {copied ? "Copied!" : "Copy"}
                  </Button>
                </div>
                <p className="text-xs text-yellow-500/80 mt-2">⚠️ Only send USDC on Base. Other tokens or chains will be lost.</p>
              </div>
            ) : (
              <p className="text-slate-500">Deposit address not available. Backend may be offline.</p>
            )}

            {/* Register Source Wallet */}
            <div className="border-t border-slate-700 pt-4">
              <p className="text-sm font-medium text-slate-300 mb-2">Register Source Wallet</p>
              <p className="text-xs text-slate-500 mb-3">
                Register the external wallet address you&apos;ll send USDC from. This helps auto-detect your deposits.
              </p>
              {wallet?.deposit_source && (
                <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 mb-3">
                  <p className="text-xs text-slate-500 mb-1">Current registered source:</p>
                  <code className="text-xs text-green-400 font-mono break-all">{wallet.deposit_source}</code>
                </div>
              )}
              {sourceSuccess && (
                <div className="bg-green-500/10 border border-green-500/30 text-green-400 rounded-lg p-3 mb-3 text-sm">
                  {sourceSuccess}
                </div>
              )}
              <div className="flex gap-2 items-center">
                <Input
                  placeholder="Your external wallet (0x...)"
                  value={sourceAddress}
                  onChange={(e) => setSourceAddress(e.target.value)}
                  className="flex-1 bg-slate-800 border-slate-700 text-white font-mono text-sm"
                />
                <Button
                  onClick={handleRegisterSource}
                  disabled={sourceLoading}
                  size="sm"
                  className="bg-green-600 hover:bg-green-500 text-white shrink-0"
                >
                  {sourceLoading ? "Saving..." : "Register"}
                </Button>
              </div>
            </div>

            <div className="border-t border-slate-700 pt-4">
              <p className="text-sm text-slate-400 mb-3">Or buy USDC with a card:</p>
              <div className="flex gap-2 items-center">
                <Input
                  type="number"
                  value={onrampAmount}
                  onChange={(e) => setOnrampAmount(e.target.value)}
                  placeholder="Amount (USD)"
                  className="w-32 bg-slate-800 border-slate-700 text-white"
                />
                <Button onClick={handleBuyWithCard} disabled={loading} className="bg-blue-600 hover:bg-blue-500 text-white">
                  {loading ? "Loading..." : "Buy with Card"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Withdraw Section */}
        <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700 mb-8">
          <CardHeader>
            <CardTitle className="text-white">Withdraw USDC</CardTitle>
            <CardDescription className="text-slate-400">Send USDC to your Base wallet (min 5 USDC)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="Base wallet address (0x...)"
              value={withdrawAddress}
              onChange={(e) => setWithdrawAddress(e.target.value)}
              className="bg-slate-800 border-slate-700 text-white font-mono"
            />
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Amount (USDC)"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                className="flex-1 bg-slate-800 border-slate-700 text-white"
              />
              <Button onClick={handleWithdraw} disabled={loading} className="bg-purple-600 hover:bg-purple-500 text-white">
                {loading ? "Processing..." : "Withdraw"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Chain Info */}
        <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700 mb-8">
          <CardHeader>
            <CardTitle className="text-white text-sm">Network Info</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-slate-500">Network</p>
                <p className="text-white font-medium">{wallet?.chain || "Base"}</p>
              </div>
              <div>
                <p className="text-slate-500">Currency</p>
                <p className="text-white font-medium">{wallet?.currency || "USDC"}</p>
              </div>
              <div className="col-span-2">
                <p className="text-slate-500">USDC Contract (Base)</p>
                <code className="text-xs text-slate-400 font-mono">0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913</code>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Transaction History */}
        <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Transaction History</CardTitle>
          </CardHeader>
          <CardContent>
            {transactions.length === 0 ? (
              <p className="text-slate-500 text-center py-8">No transactions yet</p>
            ) : (
              <div className="space-y-2">
                {transactions.slice().reverse().map((tx) => (
                  <div key={tx.id} className="flex justify-between items-center py-3 border-b border-slate-700/50">
                    <div>
                      <p className="font-medium text-white capitalize">{tx.type.replace(/_/g, " ")}</p>
                      <p className="text-sm text-slate-500">{tx.description}</p>
                      <p className="text-xs text-slate-600">{new Date(tx.created_at).toLocaleString()}</p>
                    </div>
                    <p className={`font-bold ${tx.amount >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {tx.amount >= 0 ? "+" : ""}{tx.amount.toFixed(2)} USDC
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
