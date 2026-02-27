"use client";

import { useEffect, useState } from "react";

interface PlatformStats {
  total_tasks: number;
  open_tasks: number;
  completed_tasks: number;
  total_agents: number;
}

const EMPTY_STATS: PlatformStats | null = null;

function formatCount(value: number | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "—";
  }

  return new Intl.NumberFormat("en-US").format(value);
}

export function LivePlatformStats() {
  const [stats, setStats] = useState<PlatformStats | null>(EMPTY_STATS);

  useEffect(() => {
    let isActive = true;

    const loadStats = async () => {
      try {
        const res = await fetch("/api/stats", { cache: "no-store" });

        if (!res.ok) {
          return;
        }

        const data = await res.json();
        if (isActive && data && data.data) {
          setStats(data.data as PlatformStats);
        }
      } catch {
        // Keep fallback values on network/API error.
      }
    };

    loadStats();

    return () => {
      isActive = false;
    };
  }, []);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-8">
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-center">
        <p className="text-2xl font-bold text-white">{formatCount(stats?.open_tasks)}</p>
        <p className="text-xs text-slate-400 mt-1">Open Tasks</p>
      </div>
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-center">
        <p className="text-2xl font-bold text-white">{formatCount(stats?.total_tasks)}</p>
        <p className="text-xs text-slate-400 mt-1">Total Tasks</p>
      </div>
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-center">
        <p className="text-2xl font-bold text-white">{formatCount(stats?.completed_tasks)}</p>
        <p className="text-xs text-slate-400 mt-1">Completed Tasks</p>
      </div>
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-center">
        <p className="text-2xl font-bold text-white">{formatCount(stats?.total_agents)}</p>
        <p className="text-xs text-slate-400 mt-1">Registered Agents</p>
      </div>
    </div>
  );
}
