"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import Link from "next/link";

export default function EarningsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [earnings, setEarnings] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [showWithdrawForm, setShowWithdrawForm] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchEarnings();
    }
  }, [session]);

  const fetchEarnings = async () => {
    try {
      const res = await fetch("/api/earnings");
      const data = await res.json();
      setEarnings(data.earnings);
      setTransactions(data.transactions || []);
    } catch (error) {
      console.error("Error fetching earnings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount <= 0) {
      alert("Please enter a valid amount");
      return;
    }

    if (amount > earnings.available) {
      alert("Insufficient balance");
      return;
    }

    if (!confirm(`Withdraw $${amount.toFixed(2)}?`)) return;

    setWithdrawing(true);
    try {
      const res = await fetch("/api/wallet/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          method: "bank_transfer",
        }),
      });

      if (res.ok) {
        alert("Withdrawal successful! (Mock)");
        setWithdrawAmount("");
        setShowWithdrawForm(false);
        fetchEarnings();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to withdraw");
      }
    } catch (error) {
      console.error("Error withdrawing:", error);
      alert("An error occurred");
    } finally {
      setWithdrawing(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (!session || !earnings) {
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
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Earnings</h1>
          <p className="text-gray-600">Track your income and withdraw funds</p>
        </div>

        <div className="grid gap-6 md:grid-cols-3 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Total Earned</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-green-600">
                ${earnings.total_earned.toFixed(2)}
              </p>
              <p className="text-sm text-gray-600 mt-2">All-time earnings</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pending in Escrow</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-yellow-600">
                ${earnings.pending_escrow.toFixed(2)}
              </p>
              <p className="text-sm text-gray-600 mt-2">Awaiting task approval</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Available</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-blue-600">
                ${earnings.available.toFixed(2)}
              </p>
              <Button
                className="mt-4 w-full"
                size="sm"
                onClick={() => setShowWithdrawForm(!showWithdrawForm)}
                disabled={earnings.available <= 0}
              >
                Withdraw
              </Button>
            </CardContent>
          </Card>
        </div>

        {showWithdrawForm && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Withdraw Funds</CardTitle>
              <CardDescription>
                Transfer available balance to your bank account (Mock for MVP)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Withdrawal Amount
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="1"
                  max={earnings.available}
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="0.00"
                />
                <p className="text-sm text-gray-600 mt-1">
                  Available: ${earnings.available.toFixed(2)}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payment Method
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  defaultValue="bank_transfer"
                >
                  <option value="bank_transfer">Bank Transfer (Mock)</option>
                  <option value="paypal">PayPal (Mock)</option>
                </select>
              </div>

              <div className="flex gap-4">
                <Button onClick={handleWithdraw} disabled={withdrawing} className="flex-1">
                  {withdrawing ? "Processing..." : "Withdraw"}
                </Button>
                <Button variant="outline" onClick={() => setShowWithdrawForm(false)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Transaction History</CardTitle>
            <CardDescription>Your earnings and withdrawals</CardDescription>
          </CardHeader>
          <CardContent>
            {transactions.length === 0 ? (
              <p className="text-center text-gray-600 py-8">No transactions yet</p>
            ) : (
              <div className="space-y-3">
                {transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex justify-between items-center border-b pb-3 last:border-0"
                  >
                    <div>
                      <p className="font-medium text-gray-900">
                        {tx.type === "escrow_release" ? "Payment Received" : "Withdrawal"}
                      </p>
                      <p className="text-sm text-gray-600">{tx.description}</p>
                      <p className="text-sm text-gray-500">
                        {new Date(tx.created_at).toLocaleString()}
                      </p>
                    </div>
                    <p
                      className={`text-lg font-bold ${
                        tx.type === "escrow_release" ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {tx.type === "escrow_release" ? "+" : "-"}$
                      {tx.amount.toFixed(2)}
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
