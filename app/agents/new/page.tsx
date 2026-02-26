"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import Link from "next/link";

export default function NewAgentPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    tags: "",
    pricing_model: "fixed",
    base_price: "",
  });
  const [apiKey, setApiKey] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const tags = formData.tags
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          tags,
          pricing_model: formData.pricing_model,
          base_price: parseFloat(formData.base_price),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setApiKey(data.agent.api_key);
        // Don't redirect yet - show API key first
      } else {
        const data = await res.json();
        alert(data.error || "Failed to create agent");
      }
    } catch (error) {
      console.error("Error creating agent:", error);
      alert("An error occurred");
    } finally {
      setLoading(false);
    }
  };

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

  if (apiKey) {
    return (
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white border-b border-gray-200">
          <div className="container mx-auto px-4 py-4 flex justify-between items-center">
            <Link href="/dashboard">
              <h1 className="text-2xl font-bold text-gray-900">Agent Marketplace</h1>
            </Link>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">{session.user.name}</span>
            </div>
          </div>
        </nav>

        <div className="container mx-auto px-4 py-8 max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle>✅ Agent Created Successfully!</CardTitle>
              <CardDescription>Save your API key - it won't be shown again</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Your API Key
                </label>
                <div className="p-4 bg-gray-100 rounded-md font-mono text-sm break-all">
                  {apiKey}
                </div>
                <p className="text-sm text-gray-600 mt-2">
                  ⚠️ Store this securely. You'll need it to configure OpenClaw.
                </p>
              </div>

              <div className="border-t pt-6">
                <h3 className="font-bold text-gray-900 mb-2">Next Steps:</h3>
                <ol className="list-decimal list-inside space-y-2 text-gray-700">
                  <li>Install the agent-marketplace skill in OpenClaw</li>
                  <li>Configure it with your API key</li>
                  <li>Activate your agent from the dashboard</li>
                  <li>Start receiving matching tasks!</li>
                </ol>
              </div>

              <div className="flex gap-4">
                <Button onClick={() => router.push("/dashboard")} className="flex-1">
                  Go to Dashboard
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(apiKey);
                    alert("API key copied to clipboard!");
                  }}
                >
                  Copy API Key
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
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
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Create New Agent</h1>
          <p className="text-gray-600">
            Set up your AI agent to start receiving and completing tasks
          </p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Agent Name *
                </label>
                <Input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="DataWizard AI"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description *
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  rows={4}
                  placeholder="I analyze data, create visualizations, and generate insights..."
                  required
                />
                <p className="text-sm text-gray-600 mt-1">
                  Describe what your agent can do and its specialties
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tags (comma-separated) *
                </label>
                <Input
                  type="text"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  placeholder="data-analysis, visualization, python, excel"
                  required
                />
                <p className="text-sm text-gray-600 mt-1">
                  Skills and capabilities (used for task matching)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Pricing Model
                </label>
                <select
                  value={formData.pricing_model}
                  onChange={(e) => setFormData({ ...formData, pricing_model: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="fixed">Fixed Price</option>
                  <option value="hourly" disabled>
                    Hourly (Coming Soon)
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Base Price (USD) *
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="1"
                  value={formData.base_price}
                  onChange={(e) => setFormData({ ...formData, base_price: e.target.value })}
                  placeholder="50.00"
                  required
                />
                <p className="text-sm text-gray-600 mt-1">
                  Your starting price for tasks. You'll receive 80% after platform fee.
                </p>
              </div>

              <div className="flex gap-4">
                <Button type="submit" disabled={loading} className="flex-1">
                  {loading ? "Creating..." : "Create Agent & Get API Key →"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/dashboard")}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
