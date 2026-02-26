"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default function TaskDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const taskId = params.id as string;

  const [task, setTask] = useState<any>(null);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (taskId) {
      fetchTask();
      fetchSuggestions();
    }
  }, [taskId]);

  const fetchTask = async () => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`);
      const data = await res.json();
      setTask(data.task);
    } catch (error) {
      console.error("Error fetching task:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSuggestions = async () => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/suggestions`);
      const data = await res.json();
      setSuggestions(data.suggestions || []);
    } catch (error) {
      console.error("Error fetching suggestions:", error);
    }
  };

  const handleAssignAgent = async (agentId: string) => {
    if (!confirm("Assign this agent to your task?")) return;

    setActionLoading(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent_id: agentId }),
      });

      if (res.ok) {
        await fetchTask();
        alert("Agent assigned successfully!");
      } else {
        const data = await res.json();
        alert(data.error || "Failed to assign agent");
      }
    } catch (error) {
      console.error("Error assigning agent:", error);
      alert("An error occurred");
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!confirm("Approve this task and release payment?")) return;

    setActionLoading(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/approve`, {
        method: "POST",
      });

      if (res.ok) {
        await fetchTask();
        alert("Task approved! Payment released to seller.");
        router.push("/dashboard");
      } else {
        const data = await res.json();
        alert(data.error || "Failed to approve task");
      }
    } catch (error) {
      console.error("Error approving task:", error);
      alert("An error occurred");
    } finally {
      setActionLoading(false);
    }
  };

  if (status === "loading" || loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!session || !task) {
    return null;
  }

  const isBuyer = task.buyer.id === session.user.id;
  const canApprove = isBuyer && task.status === "completed";
  const showSuggestions = isBuyer && (task.status === "open" || task.status === "matching");

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
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-3xl font-bold text-gray-900">{task.title}</h1>
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                task.status === "completed"
                  ? "bg-green-100 text-green-700"
                  : task.status === "in_progress"
                  ? "bg-blue-100 text-blue-700"
                  : "bg-gray-100 text-gray-700"
              }`}
            >
              {task.status}
            </span>
          </div>
          <p className="text-gray-600">
            Posted by @{task.buyer.username} • Budget: ${task.max_budget.toFixed(2)}
          </p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Task Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-gray-700">{task.description}</p>
            {task.tags && task.tags.length > 0 && (
              <div className="flex gap-2 mt-4">
                {task.tags.map((tag: string) => (
                  <span
                    key={tag}
                    className="px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {task.assignment && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Assigned Agent</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p>
                  <strong>Agent:</strong> {task.assignment.agent.name}
                </p>
                <p>
                  <strong>Rating:</strong> ⭐ {task.assignment.agent.rating}
                </p>
                <p>
                  <strong>Price:</strong> ${task.assignment.agreed_price.toFixed(2)}
                </p>
                <p>
                  <strong>Status:</strong> {task.assignment.status}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {task.result && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Task Result</CardTitle>
              <CardDescription>Submitted by agent</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-gray-700 mb-4">{task.result.text}</p>
              {task.result.files && task.result.files.length > 0 && (
                <div className="space-y-2">
                  <p className="font-medium">Files:</p>
                  {task.result.files.map((file: any, idx: number) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-blue-600">📄 {file.name}</span>
                    </div>
                  ))}
                </div>
              )}
              {canApprove && (
                <div className="mt-6 flex gap-4">
                  <Button onClick={handleApprove} disabled={actionLoading} size="lg">
                    {actionLoading ? "Processing..." : "✓ Approve & Release Payment"}
                  </Button>
                  <Button variant="destructive" disabled={actionLoading} size="lg">
                    ⚠ Dispute
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {showSuggestions && suggestions.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Suggested Agents</h2>
            <div className="space-y-4">
              {suggestions.map((suggestion: any) => (
                <Card key={suggestion.agent.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle>{suggestion.agent.name}</CardTitle>
                        <CardDescription>
                          ⭐ {suggestion.agent.rating.toFixed(1)} • {suggestion.agent.total_tasks_completed} tasks completed
                        </CardDescription>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-blue-600">
                          ${suggestion.price_estimate.toFixed(2)}
                        </p>
                        <p className="text-sm text-gray-600">
                          {suggestion.match_score.toFixed(0)}% match
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-700 mb-4">{suggestion.agent.description}</p>
                    <Button
                      onClick={() => handleAssignAgent(suggestion.agent.id)}
                      disabled={actionLoading}
                    >
                      {actionLoading ? "Assigning..." : "Select Agent"}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
