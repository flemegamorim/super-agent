"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import { formatDistanceToNow } from "date-fns";

interface Task {
  id: string;
  title: string;
  status: string;
  input_files: string[];
  created_at: string;
}

export default function DashboardPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTasks();
    const interval = setInterval(fetchTasks, 5000);
    return () => clearInterval(interval);
  }, []);

  async function fetchTasks() {
    try {
      const res = await fetch("/api/tasks");
      if (res.ok) setTasks(await res.json());
    } finally {
      setLoading(false);
    }
  }

  const stats = {
    total: tasks.length,
    running: tasks.filter((t) => t.status === "running").length,
    completed: tasks.filter((t) => t.status === "completed").length,
    failed: tasks.filter((t) => t.status === "failed").length,
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Monitor your agent task pipeline
        </p>
      </div>

      <div className="mb-8 grid grid-cols-4 gap-4">
        <StatCard label="Total Tasks" value={stats.total} />
        <StatCard label="Running" value={stats.running} accent="indigo" />
        <StatCard label="Completed" value={stats.completed} accent="emerald" />
        <StatCard label="Failed" value={stats.failed} accent="red" />
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
          <h2 className="text-sm font-semibold">Recent Tasks</h2>
          <Link
            href="/tasks/new"
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-indigo-500"
          >
            New Task
          </Link>
        </div>

        {loading ? (
          <div className="p-12 text-center text-sm text-zinc-500">Loading...</div>
        ) : tasks.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm text-zinc-500">No tasks yet</p>
            <Link
              href="/tasks/new"
              className="mt-2 inline-block text-sm text-indigo-400 hover:text-indigo-300"
            >
              Create your first task
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {tasks.map((task) => (
              <Link
                key={task.id}
                href={`/tasks/${task.id}`}
                className="flex items-center gap-4 px-6 py-4 transition-colors hover:bg-zinc-800/50"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium">{task.title}</p>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {task.input_files.length} file(s) &middot;{" "}
                    {formatDistanceToNow(new Date(task.created_at + "Z"), {
                      addSuffix: true,
                    })}
                  </p>
                </div>
                <StatusBadge status={task.status} />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: string;
}) {
  const accentColor = accent
    ? `text-${accent}-400`
    : "text-white";
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${accentColor}`}>{value}</p>
    </div>
  );
}
