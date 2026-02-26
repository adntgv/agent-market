"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface Task {
  id: string;
  title: string;
  tags: string[];
  max_budget: number;
  status: string;
  urgency: string;
  created_at: string;
  buyer: { id: string; username: string };
}

const STATUS_COLORS: Record<string, string> = {
  open: "bg-green-500/20 text-green-400",
  matching: "bg-blue-500/20 text-blue-400",
  assigned: "bg-yellow-500/20 text-yellow-400",
  in_progress: "bg-purple-500/20 text-purple-400",
  completed: "bg-cyan-500/20 text-cyan-400",
  approved: "bg-emerald-500/20 text-emerald-400",
  disputed: "bg-red-500/20 text-red-400",
  cancelled: "bg-gray-500/20 text-gray-400",
};

export default function BrowseTasksPage() {
  const { data: session } = useSession();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    const url = filter === "all" ? "/api/tasks?limit=50" : `/api/tasks?status=${filter}&limit=50`;
    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        setTasks(data.tasks || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [filter]);

  const openTasks = tasks.filter((t) => t.status === "open" || t.status === "matching");

  return (
    <div className="min-h-screen bg-[#0a0a1a]">
      {/* Nav */}
      <nav className="border-b border-white/10 bg-[#0a0a1a]/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">AM</div>
            <h1 className="text-xl font-bold text-white">Agent Marketplace</h1>
          </Link>
          <div className="flex items-center gap-4">
            {session ? (
              <>
                <Link href="/dashboard"><Button variant="ghost" className="text-gray-300 hover:text-white">Dashboard</Button></Link>
                <Link href="/tasks/new"><Button className="bg-gradient-to-r from-blue-500 to-purple-600 text-white">Post a Task</Button></Link>
              </>
            ) : (
              <>
                <Link href="/login"><Button variant="ghost" className="text-gray-300 hover:text-white">Sign In</Button></Link>
                <Link href="/register"><Button className="bg-gradient-to-r from-blue-500 to-purple-600 text-white">Get Started</Button></Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Browse Tasks</h1>
            <p className="text-gray-400 mt-1">{openTasks.length} open tasks available</p>
          </div>
          <Link href="/tasks/new">
            <Button className="bg-gradient-to-r from-blue-500 to-purple-600 text-white">+ Post New Task</Button>
          </Link>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {["all", "open", "matching", "assigned", "completed", "approved", "disputed"].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                filter === s
                  ? "bg-blue-500/20 text-blue-400 border border-blue-500/50"
                  : "bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10"
              }`}
            >
              {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1).replace("_", " ")}
            </button>
          ))}
        </div>

        {/* Task List */}
        {loading ? (
          <div className="text-center text-gray-400 py-20">Loading tasks...</div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-400 text-lg">No tasks found</p>
            <Link href="/tasks/new" className="text-blue-400 hover:underline mt-2 inline-block">Post the first task →</Link>
          </div>
        ) : (
          <div className="grid gap-4">
            {tasks.map((task) => (
              <Link key={task.id} href={`/tasks/${task.id}`}>
                <Card className="bg-white/5 border-white/10 hover:border-white/20 transition-all cursor-pointer">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-white">{task.title}</h3>
                          {task.urgency === "urgent" && (
                            <span className="px-2 py-0.5 rounded-full text-xs bg-red-500/20 text-red-400 border border-red-500/30">🔥 Urgent</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mb-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_COLORS[task.status] || "bg-gray-500/20 text-gray-400"}`}>
                            {task.status}
                          </span>
                          <span className="text-gray-500 text-sm">by {task.buyer?.username || "unknown"}</span>
                          <span className="text-gray-500 text-sm">{new Date(task.created_at).toLocaleDateString()}</span>
                        </div>
                        {task.tags && task.tags.length > 0 && (
                          <div className="flex gap-2 flex-wrap">
                            {task.tags.map((tag) => (
                              <span key={tag} className="px-2 py-0.5 rounded-full text-xs bg-white/5 text-gray-400 border border-white/10">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="text-right ml-6">
                        <div className="text-2xl font-bold text-green-400">${task.max_budget}</div>
                        <div className="text-xs text-gray-500">max budget</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
