"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import Link from "next/link";

export default function AgentDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const agentId = params.id as string;

  const [agent, setAgent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    tags: "",
    base_price: "",
    status: "inactive",
  });

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (agentId) {
      fetchAgent();
    }
  }, [agentId]);

  const fetchAgent = async () => {
    try {
      const res = await fetch(`/api/agents/${agentId}`);
      const data = await res.json();
      setAgent(data.agent);
      setFormData({
        name: data.agent.name,
        description: data.agent.description || "",
        tags: data.agent.tags.join(", "),
        base_price: data.agent.base_price.toString(),
        status: data.agent.status,
      });
    } catch (error) {
      console.error("Error fetching agent:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const tags = formData.tags
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      const res = await fetch(`/api/agents/${agentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          tags,
          base_price: parseFloat(formData.base_price),
          status: formData.status,
        }),
      });

      if (res.ok) {
        await fetchAgent();
        setEditing(false);
        alert("Agent updated successfully!");
      } else {
        const data = await res.json();
        alert(data.error || "Failed to update agent");
      }
    } catch (error) {
      console.error("Error updating agent:", error);
      alert("An error occurred");
    } finally {
      setSaving(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (!session || !agent) {
    return null;
  }

  const isOwner = agent.seller.id === session.user.id;

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
        <div className="mb-6 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{agent.name}</h1>
            <p className="text-gray-600">
              by @{agent.seller.username} • Member since{" "}
              {new Date(agent.seller.created_at).toLocaleDateString()}
            </p>
          </div>
          {isOwner && !editing && (
            <Button onClick={() => setEditing(true)}>Edit Agent</Button>
          )}
        </div>

        {editing && isOwner ? (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Edit Agent</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Agent Name
                </label>
                <Input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  rows={4}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tags (comma-separated)
                </label>
                <Input
                  type="text"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Base Price (USD)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="1"
                  value={formData.base_price}
                  onChange={(e) => setFormData({ ...formData, base_price: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="active">Active (accepting tasks)</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div className="flex gap-4">
                <Button onClick={handleSave} disabled={saving} className="flex-1">
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditing(false);
                    setFormData({
                      name: agent.name,
                      description: agent.description || "",
                      tags: agent.tags.join(", "),
                      base_price: agent.base_price.toString(),
                      status: agent.status,
                    });
                  }}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-6 md:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle>Rating</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-gray-900">
                    ⭐ {agent.rating.toFixed(1)}
                  </p>
                  <p className="text-sm text-gray-600 mt-2">
                    {agent.recent_reviews?.length || 0} reviews
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Tasks Completed</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-gray-900">
                    {agent.total_tasks_completed}
                  </p>
                  <p className="text-sm text-gray-600 mt-2">Successful completions</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Base Price</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-blue-600">
                    ${agent.base_price.toFixed(2)}
                  </p>
                  <p className="text-sm text-gray-600 mt-2">
                    Status:{" "}
                    <span
                      className={
                        agent.status === "active" ? "text-green-600" : "text-gray-600"
                      }
                    >
                      {agent.status}
                    </span>
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>About</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700 mb-4">{agent.description}</p>
                <div className="flex gap-2 flex-wrap">
                  {agent.tags.map((tag: string) => (
                    <span
                      key={tag}
                      className="px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>

            {agent.recent_reviews && agent.recent_reviews.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Recent Reviews</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {agent.recent_reviews.map((review: any, idx: number) => (
                    <div key={idx} className="border-b pb-4 last:border-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-yellow-500">{"⭐".repeat(review.rating)}</span>
                        <span className="text-sm text-gray-600">by @{review.reviewer}</span>
                      </div>
                      {review.comment && <p className="text-gray-700">{review.comment}</p>}
                      <p className="text-sm text-gray-500 mt-1">
                        {new Date(review.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {agent.task_history && agent.task_history.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Task History</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {agent.task_history.map((task: any) => (
                      <div key={task.id} className="flex justify-between items-center">
                        <div>
                          <Link
                            href={`/tasks/${task.id}`}
                            className="text-blue-600 hover:underline"
                          >
                            {task.title}
                          </Link>
                          <p className="text-sm text-gray-600">
                            ${task.agreed_price.toFixed(2)} • {task.status}
                          </p>
                        </div>
                        {task.completed_at && (
                          <span className="text-sm text-gray-500">
                            {new Date(task.completed_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
