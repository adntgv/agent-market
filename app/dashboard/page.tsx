"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [wallet, setWallet] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      // Fetch wallet
      fetch("/api/wallet")
        .then((res) => res.json())
        .then((data) => setWallet(data.wallet))
        .catch(console.error);

      // Fetch tasks
      fetch("/api/tasks?limit=5")
        .then((res) => res.json())
        .then((data) => setTasks(data.tasks || []))
        .catch(console.error);
    }
  }, [session]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const isBuyer = session.user.role === "buyer";

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/">
            <h1 className="text-2xl font-bold text-gray-900">Agent Marketplace</h1>
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              {session.user.name} ({session.user.role})
            </span>
            <Button variant="ghost" onClick={() => router.push("/api/auth/signout")}>
              Sign Out
            </Button>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
          <p className="text-gray-600">
            {isBuyer
              ? "Manage your tasks and find AI agents"
              : "Manage your agents and complete tasks"}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Wallet Balance</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-blue-600">
                ${wallet?.balance?.toFixed(2) || "0.00"}
              </p>
              <p className="text-sm text-gray-600 mt-2">
                Escrow: ${wallet?.escrow_balance?.toFixed(2) || "0.00"}
              </p>
              <Link href="/wallet">
                <Button className="mt-4 w-full" size="sm">
                  Manage Wallet
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{isBuyer ? "Active Tasks" : "Active Agents"}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-gray-900">0</p>
              <p className="text-sm text-gray-600 mt-2">
                {isBuyer ? "Tasks in progress" : "Agents online"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Total Completed</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-gray-900">0</p>
              <p className="text-sm text-gray-600 mt-2">
                {isBuyer ? "Tasks completed" : "Tasks earned from"}
              </p>
            </CardContent>
          </Card>
        </div>

        {isBuyer ? (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-900">Your Tasks</h2>
              <Link href="/tasks/new">
                <Button>Post New Task</Button>
              </Link>
            </div>

            {tasks.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-gray-600 mb-4">You haven't posted any tasks yet</p>
                  <Link href="/tasks/new">
                    <Button>Post Your First Task</Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {tasks.map((task) => (
                  <Card key={task.id}>
                    <CardHeader>
                      <CardTitle>{task.title}</CardTitle>
                      <CardDescription>
                        Budget: ${parseFloat(task.max_budget).toFixed(2)} • Status: {task.status}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Link href={`/tasks/${task.id}`}>
                        <Button variant="outline">View Details</Button>
                      </Link>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-900">Your Agents</h2>
              <Link href="/agents/new">
                <Button>Create New Agent</Button>
              </Link>
            </div>

            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-gray-600 mb-4">You haven't created any agents yet</p>
                <Link href="/agents/new">
                  <Button>Create Your First Agent</Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
