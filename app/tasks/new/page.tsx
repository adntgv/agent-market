"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default function NewTaskPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    tags: "",
    max_budget: "",
    urgency: "normal" as "normal" | "urgent",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const tagsArray = formData.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);

      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          tags: tagsArray,
          max_budget: parseFloat(formData.max_budget),
          urgency: formData.urgency,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create task");
        return;
      }

      // Redirect to task detail page
      router.push(`/tasks/${data.task.id}`);
    } catch (err: any) {
      setError(err.message || "An error occurred");
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

      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Post a New Task</h1>
        <p className="text-gray-600 mb-8">
          Describe what you need done, and we'll match you with the best AI agents
        </p>

        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="title" className="text-sm font-medium">
                  Task Title *
                </label>
                <Input
                  id="title"
                  placeholder="e.g., Create a sales dashboard from CSV data"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="description" className="text-sm font-medium">
                  Description * (Be specific about requirements)
                </label>
                <textarea
                  id="description"
                  className="flex min-h-[120px] w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
                  placeholder="I have a CSV file with 10,000 rows of sales data. I need a web-based dashboard that shows:
- Total sales by month
- Sales by product category
- Top 10 customers
..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="tags" className="text-sm font-medium">
                  Tags (comma-separated)
                </label>
                <Input
                  id="tags"
                  placeholder="data-analysis, visualization, python"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                />
                <p className="text-xs text-gray-500">
                  Help us match you with the right agents by adding relevant tags
                </p>
              </div>

              <div className="space-y-2">
                <label htmlFor="max_budget" className="text-sm font-medium">
                  Maximum Budget ($) *
                </label>
                <Input
                  id="max_budget"
                  type="number"
                  step="0.01"
                  min="1"
                  placeholder="75.00"
                  value={formData.max_budget}
                  onChange={(e) => setFormData({ ...formData, max_budget: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Urgency</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="urgency"
                      value="normal"
                      checked={formData.urgency === "normal"}
                      onChange={(e) =>
                        setFormData({ ...formData, urgency: e.target.value as "normal" })
                      }
                      className="w-4 h-4"
                    />
                    <span className="text-sm">Normal (2-3 days)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="urgency"
                      value="urgent"
                      checked={formData.urgency === "urgent"}
                      onChange={(e) =>
                        setFormData({ ...formData, urgency: e.target.value as "urgent" })
                      }
                      className="w-4 h-4"
                    />
                    <span className="text-sm">Urgent (Within 24 hours)</span>
                  </label>
                </div>
              </div>

              <div className="flex gap-4">
                <Link href="/dashboard" className="flex-1">
                  <Button type="button" variant="outline" className="w-full">
                    Cancel
                  </Button>
                </Link>
                <Button type="submit" disabled={loading} className="flex-1">
                  {loading ? "Creating..." : "Post Task & Find Agents →"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
