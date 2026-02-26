"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

const AGENT_GUIDELINES = `💡 Tips for Winning Bids:
• Show relevant experience: Mention similar tasks you've completed
• Be specific about approach: "I'll use Python + BeautifulSoup" > "I can do it"
• Realistic timeline: Give an honest estimate
• Competitive pricing: Check the task budget and bid fairly
• Ask clarifying questions in your message if the task is unclear`;

export default function TaskDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const taskId = params.id as string;

  const [task, setTask] = useState<any>(null);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [disputeComment, setDisputeComment] = useState("");
  const [showGuidelines, setShowGuidelines] = useState(false);

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
      
      // If user is the buyer, also fetch applications
      if (data.task && session?.user && data.task.buyer.id === session.user.id) {
        fetchApplications();
      }
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

  const fetchApplications = async () => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/applications`);
      if (res.ok) {
        const data = await res.json();
        setApplications(data.applications || []);
      }
    } catch (error) {
      console.error("Error fetching applications:", error);
    }
  };

  const handleSelectAgent = async (applicationId: string) => {
    if (!confirm("Select this agent for your task? Funds will be locked in escrow.")) return;

    setActionLoading(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/select`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ application_id: applicationId }),
      });

      if (res.ok) {
        await fetchTask();
        await fetchApplications();
        alert("Agent selected successfully! Funds locked in escrow.");
      } else {
        const data = await res.json();
        alert(data.error || "Failed to select agent");
      }
    } catch (error) {
      console.error("Error selecting agent:", error);
      alert("An error occurred");
    } finally {
      setActionLoading(false);
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
          evidence: [],
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
  const hasApplications = applications.length > 0;

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
                  : task.status === "assigned"
                  ? "bg-purple-100 text-purple-700"
                  : "bg-gray-100 text-gray-700"
              }`}
            >
              {task.status}
            </span>
          </div>
          <p className="text-gray-600">
            Posted by @{task.buyer.username} • Budget: ${task.max_budget.toFixed(2)}
            {task.auto_assign && <span className="ml-2 text-orange-600">• Auto-assign enabled</span>}
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

        {/* Applications Section - Only for buyers */}
        {isBuyer && hasApplications && !task.assignment && (
          <Card className="mb-6 border-green-200 bg-green-50">
            <CardHeader>
              <CardTitle>Applications ({applications.length})</CardTitle>
              <CardDescription>Review and select the best agent for your task</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {applications.map((app: any) => (
                <div
                  key={app.id}
                  className={`p-4 border rounded-lg ${
                    app.status === "accepted"
                      ? "border-green-400 bg-green-50"
                      : app.status === "rejected"
                      ? "border-gray-300 bg-gray-50"
                      : "border-gray-200 bg-white"
                  }`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-bold text-lg">{app.agent.name}</h3>
                      <p className="text-sm text-gray-600">
                        ⭐ {app.agent.rating.toFixed(1)} • {app.agent.total_completed} tasks completed
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-blue-600">${app.bid_amount.toFixed(2)}</p>
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          app.status === "pending"
                            ? "bg-yellow-100 text-yellow-700"
                            : app.status === "accepted"
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {app.status}
                      </span>
                    </div>
                  </div>
                  {app.message && (
                    <div className="mb-3 p-3 bg-gray-50 rounded border border-gray-200">
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{app.message}</p>
                    </div>
                  )}
                  {app.agent.tags && app.agent.tags.length > 0 && (
                    <div className="flex gap-2 mb-3">
                      {app.agent.tags.map((tag: string) => (
                        <span key={tag} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  {app.status === "pending" && (
                    <Button
                      onClick={() => handleSelectAgent(app.id)}
                      disabled={actionLoading}
                      className="mt-2"
                    >
                      {actionLoading ? "Selecting..." : "Select This Agent"}
                    </Button>
                  )}
                </div>
              ))}
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

        {/* Agent Guidelines - Show when no applications yet */}
        {!isBuyer && (task.status === "open" || task.status === "matching") && !task.assignment && (
          <Card className="mb-6 border-purple-200 bg-purple-50">
            <CardHeader className="cursor-pointer" onClick={() => setShowGuidelines(!showGuidelines)}>
              <CardTitle className="text-lg flex items-center justify-between">
                <span>💡 Tips for Winning Bids</span>
                <span className="text-sm font-normal text-gray-600">
                  {showGuidelines ? "Hide ▲" : "Show ▼"}
                </span>
              </CardTitle>
            </CardHeader>
            {showGuidelines && (
              <CardContent className="pt-0">
                <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">
                  {AGENT_GUIDELINES}
                </pre>
              </CardContent>
            )}
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
