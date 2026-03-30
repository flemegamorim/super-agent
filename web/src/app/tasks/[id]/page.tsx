"use client";

import { useEffect, useState, useRef, useMemo, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import { ConfirmDialog } from "@/components/confirm-dialog";
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
  notification_email: string | null;
  notify_on_success: boolean;
  notify_on_error: boolean;
  retry_count: number;
  retry_interval_minutes: number;
  retry_attempt: number;
  next_retry_at: string | null;
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

interface ActivityItem {
  key: string;
  kind: "status" | "message" | "diff" | "info";
  label: string;
  body?: string;
}

function buildActivityItems(events: SSEEvent[]): ActivityItem[] {
  const items: ActivityItem[] = [];
  const partTexts = new Map<string, string>();
  const partItemIdx = new Map<string, number>();
  let lastStatus = "";
  let statusCount = 0;

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    const props = (event.properties ?? {}) as Record<string, unknown>;

    switch (event.type) {
      case "session.status": {
        const status = (props.status as { type?: string })?.type ?? "unknown";
        if (status === lastStatus) {
          statusCount++;
          const prev = items[items.length - 1];
          if (prev?.kind === "status") {
            prev.label =
              status === "busy"
                ? `Agent is working... (${statusCount})`
                : `Agent is idle (${statusCount})`;
          }
          break;
        }
        lastStatus = status;
        statusCount = 1;
        items.push({
          key: `status-${i}`,
          kind: "status",
          label:
            status === "busy"
              ? "Agent is working..."
              : status === "idle"
                ? "Agent is idle"
                : `Status: ${status}`,
        });
        break;
      }

      case "message.part.delta": {
        const partID = props.partID as string;
        const delta = (props.delta as string) ?? "";
        const field = (props.field as string) ?? "text";
        if (!partID || field !== "text") break;

        const accumulated = (partTexts.get(partID) ?? "") + delta;
        partTexts.set(partID, accumulated);

        const existingIdx = partItemIdx.get(partID);
        if (existingIdx !== undefined) {
          items[existingIdx] = {
            ...items[existingIdx],
            body: accumulated,
          };
        } else {
          partItemIdx.set(partID, items.length);
          items.push({
            key: `msg-${partID}`,
            kind: "message",
            label: "Agent",
            body: accumulated,
          });
        }
        break;
      }

      case "session.diff": {
        const diff = props.diff as { path?: string }[] | undefined;
        if (!diff || diff.length === 0) break;
        items.push({
          key: `diff-${i}`,
          kind: "diff",
          label: `Files modified`,
          body: diff.map((d) => d.path ?? "unknown").join(", "),
        });
        break;
      }

      default: {
        items.push({
          key: `evt-${i}`,
          kind: "info",
          label: event.type,
          body: props
            ? JSON.stringify(props, null, 0).slice(0, 200)
            : undefined,
        });
      }
    }
  }

  return items;
}

export default function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [task, setTask] = useState<Task | null>(null);
  const [outputs, setOutputs] = useState<OutputFile[]>([]);
  const [events, setEvents] = useState<SSEEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const eventsEndRef = useRef<HTMLDivElement>(null);
  const activityItems = useMemo(() => buildActivityItems(events), [events]);

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

  async function handleDelete() {
    setDeleting(true);
    setConfirmOpen(false);
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    router.push("/");
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
      <ConfirmDialog
        open={confirmOpen}
        title="Delete task?"
        description={`"${task.title}" and all its input/output files will be permanently removed. This cannot be undone.`}
        confirmLabel="Delete task"
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
      />
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
          <button
            onClick={() => setConfirmOpen(true)}
            disabled={deleting}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:border-red-500/50 hover:text-red-400 disabled:opacity-50"
          >
            {deleting ? "Deleting..." : "Delete"}
          </button>
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

      {task.notification_email && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
          <svg className="h-4 w-4 shrink-0 text-indigo-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
          </svg>
          <div className="text-sm text-zinc-400">
            <span className="text-zinc-300">{task.notification_email}</span>
            <span className="ml-2 text-xs text-zinc-600">
              {[
                task.notify_on_success && "success",
                task.notify_on_error && "error",
              ]
                .filter(Boolean)
                .join(" / ")}
            </span>
          </div>
        </div>
      )}

      {task.error && (
        <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/5 p-4">
          <h3 className="mb-2 text-xs font-medium text-red-400">Error</h3>
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap wrap-break-word rounded-lg bg-red-950/40 p-3 font-mono text-xs leading-relaxed text-red-300">
            {task.error}
          </pre>
        </div>
      )}

      {task.status === "failed" && task.next_retry_at && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
          <svg className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
          <div className="text-sm">
            <span className="font-medium text-amber-300">
              Retry scheduled
            </span>
            <span className="ml-1 text-amber-400/80">
              — attempt {task.retry_attempt + 2} of {task.retry_count + 1}
            </span>
            <span className="ml-1 text-zinc-400">
              will run{" "}
              <span className="text-zinc-200">
                {formatDistanceToNow(new Date(task.next_retry_at), { addSuffix: true })}
              </span>
              {" "}(at {new Date(task.next_retry_at).toLocaleTimeString()})
            </span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900">
          <div className="border-b border-zinc-800 px-4 py-3">
            <h3 className="text-sm font-semibold">Input Files</h3>
          </div>
          <ul className="divide-y divide-zinc-800">
            {task.input_files.map((f, i) => (
              <li key={i} className="truncate px-4 py-2.5 text-sm text-zinc-300" title={f.split(/[\\/]/).pop()}>
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
                  className="flex items-center justify-between gap-3 px-4 py-2.5"
                >
                  <span className="min-w-0 truncate text-sm text-zinc-300" title={f.name}>{f.name}</span>
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
        <div className="max-h-128 overflow-auto p-4">
          {activityItems.length === 0 ? (
            <p className="text-sm text-zinc-500">
              {task.status === "running"
                ? "Waiting for events..."
                : "No events recorded"}
            </p>
          ) : (
            <div className="space-y-3 text-sm">
              {activityItems.map((item) => {
                if (item.kind === "status") {
                  return (
                    <div
                      key={item.key}
                      className="flex items-center gap-2 text-xs text-zinc-500"
                    >
                      <span
                        className={`inline-block h-1.5 w-1.5 rounded-full ${
                          item.label.includes("working")
                            ? "animate-pulse bg-amber-400"
                            : "bg-zinc-600"
                        }`}
                      />
                      {item.label}
                    </div>
                  );
                }

                if (item.kind === "message") {
                  return (
                    <div
                      key={item.key}
                      className="rounded-lg border border-zinc-800 bg-zinc-950 p-3"
                    >
                      <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-indigo-400">
                        {item.label}
                      </p>
                      <div className="whitespace-pre-wrap text-xs leading-relaxed text-zinc-300">
                        {item.body}
                      </div>
                    </div>
                  );
                }

                if (item.kind === "diff") {
                  return (
                    <div
                      key={item.key}
                      className="flex items-start gap-2 text-xs text-emerald-400"
                    >
                      <span className="mt-0.5 shrink-0">&#9998;</span>
                      <span>
                        <span className="font-medium">{item.label}:</span>{" "}
                        <span className="text-zinc-400">{item.body}</span>
                      </span>
                    </div>
                  );
                }

                return (
                  <div key={item.key} className="text-xs text-zinc-500">
                    <span className="text-zinc-600">[{item.label}]</span>{" "}
                    <span className="text-zinc-500">{item.body}</span>
                  </div>
                );
              })}
              <div ref={eventsEndRef} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
