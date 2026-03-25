"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import { ConfirmDialog } from "@/components/confirm-dialog";
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
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [confirmTaskId, setConfirmTaskId] = useState<string | null>(null);

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

  function requestDelete(e: React.MouseEvent, taskId: string) {
    e.preventDefault();
    setConfirmTaskId(taskId);
  }

  async function confirmDelete() {
    if (!confirmTaskId) return;
    const id = confirmTaskId;
    setConfirmTaskId(null);
    setDeletingIds((prev) => new Set(prev).add(id));
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    setTasks((prev) => prev.filter((t) => t.id !== id));
    setDeletingIds((prev) => { const s = new Set(prev); s.delete(id); return s; });
  }

  const stats = {
    total: tasks.length,
    running: tasks.filter((t) => t.status === "running").length,
    completed: tasks.filter((t) => t.status === "completed").length,
    failed: tasks.filter((t) => t.status === "failed").length,
  };

  const confirmTask = tasks.find((t) => t.id === confirmTaskId);

  return (
    <div className="p-8">
      <ConfirmDialog
        open={confirmTaskId !== null}
        title="Delete task?"
        description={`"${confirmTask?.title}" and all its input/output files will be permanently removed. This cannot be undone.`}
        confirmLabel="Delete task"
        onConfirm={confirmDelete}
        onCancel={() => setConfirmTaskId(null)}
      />
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
              <div key={task.id} className="flex items-center gap-4 px-6 py-4 transition-colors hover:bg-zinc-800/50">
                <Link href={`/tasks/${task.id}`} className="flex flex-1 items-center gap-4 min-w-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{task.title}</p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {task.input_files.length} file(s) &middot;{" "}
                      {formatDistanceToNow(new Date(task.created_at + "Z"), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                  <StatusBadge status={task.status} />
                </Link>
                <button
                  onClick={(e) => requestDelete(e, task.id)}
                  disabled={deletingIds.has(task.id)}
                  className="ml-2 shrink-0 rounded-md p-1.5 text-zinc-600 transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
                  title="Delete task"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
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
