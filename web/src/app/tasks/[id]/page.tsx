"use client";

import { useEffect, useState, useRef, use } from "react";
import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import { formatDistanceToNow } from "date-fns";

interface Task {
  id: string;
  title: string;
  instructions: string | null;
  status: string;
  session_id: string | null;
  input_files: string[];
  output_files: string[];
  error: string | null;
  created_at: string;
  updated_at: string;
}

interface OutputFile {
  name: string;
  downloadUrl: string;
}

interface SSEEvent {
  type: string;
  properties?: Record<string, unknown>;
  timestamp?: string;
}

export default function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [task, setTask] = useState<Task | null>(null);
  const [outputs, setOutputs] = useState<OutputFile[]>([]);
  const [events, setEvents] = useState<SSEEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const eventsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchTask();
    fetchOutputs();
    const interval = setInterval(() => {
      fetchTask();
      fetchOutputs();
    }, 3000);
    return () => clearInterval(interval);
  }, [id]);

  useEffect(() => {
    if (!task?.session_id || task.status !== "running") return;

    const eventSource = new EventSource(`/api/tasks/${id}/events`);
    eventSource.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        setEvents((prev) => [...prev.slice(-200), data]);
      } catch {
        // skip
      }
    };
    eventSource.onerror = () => eventSource.close();
    return () => eventSource.close();
  }, [id, task?.session_id, task?.status]);

  useEffect(() => {
    eventsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events]);

  async function fetchTask() {
    try {
      const res = await fetch(`/api/tasks/${id}`);
      if (res.ok) setTask(await res.json());
    } finally {
      setLoading(false);
    }
  }

  async function fetchOutputs() {
    const res = await fetch(`/api/tasks/${id}/output`);
    if (res.ok) setOutputs(await res.json());
  }

  async function handleCancel() {
    await fetch(`/api/tasks/${id}/cancel`, { method: "POST" });
    fetchTask();
  }

  async function handleRerun() {
    setEvents([]);
    await fetch(`/api/tasks/${id}/rerun`, { method: "POST" });
    fetchTask();
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-500">
        Loading...
      </div>
    );
  }

  if (!task) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2">
        <p className="text-sm text-zinc-500">Task not found</p>
        <Link href="/" className="text-sm text-indigo-400 hover:text-indigo-300">
          Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <Link
            href="/"
            className="text-xs text-zinc-500 hover:text-zinc-300"
          >
            &larr; Back to Dashboard
          </Link>
          <h1 className="mt-2 text-2xl font-bold">{task.title}</h1>
          <p className="mt-1 text-xs text-zinc-500">
            Created{" "}
            {formatDistanceToNow(new Date(task.created_at + "Z"), {
              addSuffix: true,
            })}
            {task.session_id && (
              <span className="ml-2 text-zinc-600">
                Session: {task.session_id.slice(0, 8)}...
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={task.status} />
          {task.status === "running" && (
            <button
              onClick={handleCancel}
              className="rounded-lg border border-red-500/30 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/10"
            >
              Cancel
            </button>
          )}
          {(task.status === "completed" ||
            task.status === "failed" ||
            task.status === "cancelled") && (
            <button
              onClick={handleRerun}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-indigo-500"
            >
              Re-run
            </button>
          )}
        </div>
      </div>

      {task.instructions && (
        <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <h3 className="mb-1 text-xs font-medium text-zinc-500">
            Instructions
          </h3>
          <p className="text-sm">{task.instructions}</p>
        </div>
      )}

      {task.error && (
        <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/5 p-4">
          <h3 className="mb-1 text-xs font-medium text-red-400">Error</h3>
          <p className="text-sm text-red-300">{task.error}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900">
          <div className="border-b border-zinc-800 px-4 py-3">
            <h3 className="text-sm font-semibold">Input Files</h3>
          </div>
          <ul className="divide-y divide-zinc-800">
            {task.input_files.map((f, i) => (
              <li key={i} className="px-4 py-2.5 text-sm text-zinc-300">
                {f.split(/[\\/]/).pop()}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900">
          <div className="border-b border-zinc-800 px-4 py-3">
            <h3 className="text-sm font-semibold">Output Files</h3>
          </div>
          {outputs.length === 0 ? (
            <div className="p-4 text-sm text-zinc-500">
              {task.status === "running"
                ? "Generating..."
                : "No output files yet"}
            </div>
          ) : (
            <ul className="divide-y divide-zinc-800">
              {outputs.map((f) => (
                <li
                  key={f.name}
                  className="flex items-center justify-between px-4 py-2.5"
                >
                  <span className="text-sm text-zinc-300">{f.name}</span>
                  <a
                    href={f.downloadUrl}
                    download
                    className="text-xs text-indigo-400 hover:text-indigo-300"
                  >
                    Download
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900">
        <div className="border-b border-zinc-800 px-4 py-3">
          <h3 className="text-sm font-semibold">Activity Log</h3>
        </div>
        <div className="max-h-80 overflow-auto p-4">
          {events.length === 0 ? (
            <p className="text-sm text-zinc-500">
              {task.status === "running"
                ? "Waiting for events..."
                : "No events recorded"}
            </p>
          ) : (
            <div className="space-y-1.5 font-mono text-xs">
              {events.map((event, i) => (
                <div key={i} className="text-zinc-400">
                  <span className="text-zinc-600">
                    [{event.type}]
                  </span>{" "}
                  {event.properties
                    ? JSON.stringify(event.properties).slice(0, 200)
                    : ""}
                </div>
              ))}
              <div ref={eventsEndRef} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
