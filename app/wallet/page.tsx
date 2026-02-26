"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default function WalletPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [wallet, setWallet] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [topUpAmount, setTopUpAmount] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchWallet();
    }
  }, [session]);

  const fetchWallet = async () => {
    try {
      const res = await fetch("/api/wallet");
      const data = await res.json();
      setWallet(data.wallet);
    } catch (error) {
      console.error("Error fetching wallet:", error);
    }
  };

  const handleTopUp = async (amount: number) => {
    setLoading(true);
    try {
      const res = await fetch("/api/wallet/top-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });

      if (res.ok) {
        await fetchWallet();
        setTopUpAmount("");
        alert(`Successfully added $${amount} to your wallet!`);
      }
    } catch (error) {
      console.error("Error topping up:", error);
      alert("Failed to top up wallet");
    } finally {
      setLoading(false);
    }
  };

  if (status === "loading") {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/dashboard">
            <h1 className="text-2xl font-bold text-gray-900">Agent Marketplace</h1>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost">Dashboard</Button>
            </Link>
            <span className="text-sm text-gray-600">{session.user.name}</span>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Wallet</h1>

        <div className="grid gap-6 md:grid-cols-2 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Available Balance</CardTitle>
              <CardDescription>Ready to use for tasks</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-blue-600">
                ${wallet?.balance?.toFixed(2) || "0.00"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Escrow Balance</CardTitle>
              <CardDescription>Locked in active tasks</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-gray-900">
                ${wallet?.escrow_balance?.toFixed(2) || "0.00"}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Top Up Balance</CardTitle>
            <CardDescription>Add funds to your wallet (mock payment)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => handleTopUp(50)}
                  disabled={loading}
                >
                  $50
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleTopUp(100)}
                  disabled={loading}
                >
                  $100
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleTopUp(250)}
                  disabled={loading}
                >
                  $250
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleTopUp(500)}
                  disabled={loading}
                >
                  $500
                </Button>
              </div>

              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Custom amount"
                  value={topUpAmount}
                  onChange={(e) => setTopUpAmount(e.target.value)}
                  className="flex-1"
                />
                <Button
                  onClick={() => {
                    const amount = parseFloat(topUpAmount);
                    if (amount > 0) {
                      handleTopUp(amount);
                    }
                  }}
                  disabled={loading || !topUpAmount || parseFloat(topUpAmount) <= 0}
                >
                  {loading ? "Processing..." : "Add Funds"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Transaction History</CardTitle>
          </CardHeader>
          <CardContent>
            {transactions.length === 0 ? (
              <p className="text-gray-600 text-center py-8">No transactions yet</p>
            ) : (
              <div className="space-y-2">
                {transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex justify-between items-center py-2 border-b border-gray-100"
                  >
                    <div>
                      <p className="font-medium">{tx.type}</p>
                      <p className="text-sm text-gray-600">{tx.description}</p>
                    </div>
                    <p className="font-bold text-gray-900">${tx.amount}</p>
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
