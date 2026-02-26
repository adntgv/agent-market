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
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [disputeComment, setDisputeComment] = useState("");

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

  const handleDispute = async () => {
    if (!disputeComment.trim()) {
      alert("Please provide a reason for the dispute");
      return;
    }

    if (!confirm("Create a dispute for this task?")) return;

    setActionLoading(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/dispute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          comment: disputeComment,
          evidence: [], // Can add file uploads later
        }),
      });

      if (res.ok) {
        await fetchTask();
        alert("Dispute created. The seller will be notified.");
        setShowDisputeForm(false);
        setDisputeComment("");
      } else {
        const data = await res.json();
        alert(data.error || "Failed to create dispute");
      }
    } catch (error) {
      console.error("Error creating dispute:", error);
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

        {task.dispute && (
          <Card className="mb-6 border-red-300">
            <CardHeader>
              <CardTitle className="text-red-700">⚠️ Dispute Active</CardTitle>
              <CardDescription>This task is under dispute review</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-bold text-gray-900 mb-2">Buyer's Complaint:</h3>
                <p className="text-gray-700 whitespace-pre-wrap">{task.dispute.buyer_comment}</p>
              </div>
              {task.dispute.seller_comment && (
                <div>
                  <h3 className="font-bold text-gray-900 mb-2">Seller's Response:</h3>
                  <p className="text-gray-700 whitespace-pre-wrap">
                    {task.dispute.seller_comment}
                  </p>
                </div>
              )}
              {task.dispute.admin_comment && (
                <div>
                  <h3 className="font-bold text-gray-900 mb-2">Admin Decision:</h3>
                  <p className="text-gray-700 whitespace-pre-wrap">
                    {task.dispute.admin_comment}
                  </p>
                  <p className="text-sm text-gray-600 mt-2">
                    Resolution: {task.dispute.resolution?.replace("_", " ")}
                  </p>
                </div>
              )}
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
              {canApprove && !showDisputeForm && (
                <div className="mt-6 flex gap-4">
                  <Button onClick={handleApprove} disabled={actionLoading} size="lg">
                    {actionLoading ? "Processing..." : "✓ Approve & Release Payment"}
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={actionLoading}
                    size="lg"
                    onClick={() => setShowDisputeForm(true)}
                  >
                    ⚠ Dispute
                  </Button>
                </div>
              )}

              {showDisputeForm && canApprove && (
                <div className="mt-6 space-y-4 p-4 border border-red-200 bg-red-50 rounded-lg">
                  <h3 className="font-bold text-red-900">Create Dispute</h3>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      What's wrong with the result?
                    </label>
                    <textarea
                      value={disputeComment}
                      onChange={(e) => setDisputeComment(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      rows={4}
                      placeholder="Explain why the result doesn't meet your requirements..."
                    />
                  </div>
                  <div className="flex gap-4">
                    <Button
                      onClick={handleDispute}
                      disabled={actionLoading}
                      variant="destructive"
                    >
                      {actionLoading ? "Creating..." : "Submit Dispute"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowDisputeForm(false);
                        setDisputeComment("");
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
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
