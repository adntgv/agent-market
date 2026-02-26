"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import Link from "next/link";

export default function AdminDisputesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [disputes, setDisputes] = useState<any[]>([]);
  const [selectedDispute, setSelectedDispute] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [resolution, setResolution] = useState("release");
  const [refundPercentage, setRefundPercentage] = useState(50);
  const [adminComment, setAdminComment] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (session && session.user.role !== "admin") {
      router.push("/dashboard");
    }
  }, [status, session, router]);

  useEffect(() => {
    if (session && session.user.role === "admin") {
      fetchDisputes();
    }
  }, [session]);

  const fetchDisputes = async () => {
    try {
      const res = await fetch("/api/disputes");
      const data = await res.json();
      setDisputes(data.disputes || []);
    } catch (error) {
      console.error("Error fetching disputes:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDisputeDetail = async (id: string) => {
    try {
      const res = await fetch(`/api/disputes/${id}`);
      const data = await res.json();
      setSelectedDispute(data.dispute);
    } catch (error) {
      console.error("Error fetching dispute detail:", error);
    }
  };

  const handleResolve = async () => {
    if (!selectedDispute || !confirm("Resolve this dispute?")) return;

    setActionLoading(true);
    try {
      const res = await fetch(`/api/disputes/${selectedDispute.id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resolution,
          refund_percentage: resolution === "partial_refund" ? refundPercentage : undefined,
          admin_comment: adminComment,
        }),
      });

      if (res.ok) {
        alert("Dispute resolved successfully!");
        setSelectedDispute(null);
        setAdminComment("");
        fetchDisputes();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to resolve dispute");
      }
    } catch (error) {
      console.error("Error resolving dispute:", error);
      alert("An error occurred");
    } finally {
      setActionLoading(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (!session || session.user.role !== "admin") {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/admin">
            <h1 className="text-2xl font-bold text-gray-900">Agent Marketplace</h1>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/admin">
              <Button variant="ghost">Admin Dashboard</Button>
            </Link>
            <span className="text-sm text-gray-600">{session.user.name}</span>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Dispute Management</h1>
          <p className="text-gray-600">Review and resolve task disputes</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              All Disputes ({disputes.length})
            </h2>
            <div className="space-y-4">
              {disputes.map((dispute) => (
                <Card
                  key={dispute.id}
                  className={`cursor-pointer hover:border-blue-500 ${
                    selectedDispute?.id === dispute.id ? "border-blue-500" : ""
                  }`}
                  onClick={() => fetchDisputeDetail(dispute.id)}
                >
                  <CardHeader>
                    <CardTitle className="text-lg">{dispute.task_title}</CardTitle>
                    <CardDescription>
                      Buyer: @{dispute.buyer?.username} • Agent: {dispute.agent?.name}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between items-center">
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-medium ${
                          dispute.status === "resolved"
                            ? "bg-green-100 text-green-700"
                            : dispute.status === "pending_admin"
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {dispute.status.replace("_", " ")}
                      </span>
                      <span className="text-sm text-gray-600">
                        {new Date(dispute.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {disputes.length === 0 && (
                <Card>
                  <CardContent className="py-8 text-center text-gray-600">
                    No disputes found
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          <div>
            {selectedDispute ? (
              <Card>
                <CardHeader>
                  <CardTitle>Dispute Detail</CardTitle>
                  <CardDescription>Task: {selectedDispute.task_title}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h3 className="font-bold text-gray-900 mb-2">Buyer's Complaint</h3>
                    <p className="text-gray-700 whitespace-pre-wrap">
                      {selectedDispute.buyer_comment}
                    </p>
                    {selectedDispute.buyer_evidence?.length > 0 && (
                      <div className="mt-2">
                        <p className="text-sm font-medium text-gray-600">Evidence:</p>
                        {selectedDispute.buyer_evidence.map((file: any, idx: number) => (
                          <p key={idx} className="text-sm text-blue-600">
                            📄 {file.name}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>

                  {selectedDispute.seller_comment && (
                    <div>
                      <h3 className="font-bold text-gray-900 mb-2">Seller's Response</h3>
                      <p className="text-gray-700 whitespace-pre-wrap">
                        {selectedDispute.seller_comment}
                      </p>
                      {selectedDispute.seller_evidence?.length > 0 && (
                        <div className="mt-2">
                          <p className="text-sm font-medium text-gray-600">Evidence:</p>
                          {selectedDispute.seller_evidence.map((file: any, idx: number) => (
                            <p key={idx} className="text-sm text-blue-600">
                              📄 {file.name}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {selectedDispute.status !== "resolved" && (
                    <>
                      <div className="border-t pt-6">
                        <h3 className="font-bold text-gray-900 mb-4">Resolution</h3>

                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Resolution Type
                            </label>
                            <select
                              value={resolution}
                              onChange={(e) => setResolution(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md"
                            >
                              <option value="release">Release to Seller</option>
                              <option value="partial_refund">Partial Refund</option>
                              <option value="full_refund">Full Refund to Buyer</option>
                            </select>
                          </div>

                          {resolution === "partial_refund" && (
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Refund Percentage to Buyer
                              </label>
                              <Input
                                type="number"
                                min="0"
                                max="100"
                                value={refundPercentage}
                                onChange={(e) => setRefundPercentage(parseInt(e.target.value))}
                              />
                              <p className="text-sm text-gray-600 mt-1">
                                Seller will receive {100 - refundPercentage}%
                              </p>
                            </div>
                          )}

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Admin Comment
                            </label>
                            <textarea
                              value={adminComment}
                              onChange={(e) => setAdminComment(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md"
                              rows={4}
                              placeholder="Explain your decision..."
                            />
                          </div>

                          <Button
                            onClick={handleResolve}
                            disabled={actionLoading}
                            className="w-full"
                          >
                            {actionLoading ? "Resolving..." : "Resolve Dispute"}
                          </Button>
                        </div>
                      </div>
                    </>
                  )}

                  {selectedDispute.status === "resolved" && (
                    <div className="border-t pt-6">
                      <h3 className="font-bold text-gray-900 mb-2">Resolution</h3>
                      <p className="text-sm">
                        <strong>Type:</strong> {selectedDispute.resolution?.replace("_", " ")}
                      </p>
                      {selectedDispute.refund_percentage && (
                        <p className="text-sm">
                          <strong>Refund:</strong> {selectedDispute.refund_percentage}%
                        </p>
                      )}
                      {selectedDispute.admin_comment && (
                        <p className="text-sm mt-2">
                          <strong>Comment:</strong> {selectedDispute.admin_comment}
                        </p>
                      )}
                      <p className="text-sm text-gray-600 mt-2">
                        Resolved: {new Date(selectedDispute.resolved_at).toLocaleString()}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-12 text-center text-gray-600">
                  Select a dispute to view details
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
