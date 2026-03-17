"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { v4 as uuidv4 } from "uuid";

interface Prompt {
  id: string;
  name: string;
  body: string;
}

interface FileProgress {
  name: string;
  size: number;
  loaded: number;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
}

export default function NewTaskPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadPhase, setUploadPhase] = useState<
    "idle" | "uploading" | "creating"
  >("idle");
  const [fileProgress, setFileProgress] = useState<FileProgress[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [selectedPromptId, setSelectedPromptId] = useState("");
  const [notificationEmail, setNotificationEmail] = useState("");
  const [notifyOnSuccess, setNotifyOnSuccess] = useState(true);
  const [notifyOnError, setNotifyOnError] = useState(true);
  const [showNotifications, setShowNotifications] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    fetch("/api/settings/notifications")
      .then((r) => r.json())
      .then((prefs) => {
        if (prefs.default_notification_email) {
          setNotificationEmail(prefs.default_notification_email);
          setShowNotifications(true);
        } else if (session?.user?.email) {
          setNotificationEmail(session.user.email);
        }
        setNotifyOnSuccess(prefs.default_notify_on_success ?? true);
        setNotifyOnError(prefs.default_notify_on_error ?? true);
      })
      .catch(() => {
        if (session?.user?.email) {
          setNotificationEmail(session.user.email);
        }
      });
  }, [session?.user?.email]);

  useEffect(() => {
    fetch("/api/prompts")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setPrompts(data);
      })
      .catch(() => {});
  }, []);

  function handlePromptSelect(promptId: string) {
    setSelectedPromptId(promptId);
    if (!promptId) return;
    const prompt = prompts.find((p) => p.id === promptId);
    if (prompt) setInstructions(prompt.body);
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = Array.from(e.dataTransfer.files);
    setFiles((prev) => [...prev, ...dropped]);
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
      }
    },
    [],
  );

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  function uploadFileWithProgress(
    url: string,
    file: File,
    index: number,
    signal: AbortSignal,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", url);

      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          setFileProgress((prev) =>
            prev.map((fp, i) =>
              i === index ? { ...fp, loaded: e.loaded, status: "uploading" } : fp,
            ),
          );
        }
      });

      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          setFileProgress((prev) =>
            prev.map((fp, i) =>
              i === index ? { ...fp, loaded: file.size, status: "done" } : fp,
            ),
          );
          resolve();
        } else {
          const err = `Upload failed (${xhr.status})`;
          setFileProgress((prev) =>
            prev.map((fp, i) =>
              i === index ? { ...fp, status: "error", error: err } : fp,
            ),
          );
          reject(new Error(err));
        }
      });

      xhr.addEventListener("error", () => {
        const err = "Network error during upload";
        setFileProgress((prev) =>
          prev.map((fp, i) =>
            i === index ? { ...fp, status: "error", error: err } : fp,
          ),
        );
        reject(new Error(err));
      });

      signal.addEventListener("abort", () => xhr.abort());

      xhr.send(file);
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || files.length === 0) return;

    setSubmitting(true);
    setError(null);
    setUploadPhase("uploading");

    const taskId = uuidv4();
    const abort = new AbortController();
    abortRef.current = abort;

    const initialProgress: FileProgress[] = files.map((f) => ({
      name: f.name,
      size: f.size,
      loaded: 0,
      status: "pending",
    }));
    setFileProgress(initialProgress);

    try {
      const presignRes = await fetch("/api/upload/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId,
          files: files.map((f) => ({ name: f.name })),
        }),
        signal: abort.signal,
      });

      if (!presignRes.ok) {
        throw new Error("Failed to get upload URLs");
      }

      const { files: presigned } = (await presignRes.json()) as {
        files: { name: string; key: string; uploadUrl: string }[];
      };

      await Promise.all(
        presigned.map((p, i) =>
          uploadFileWithProgress(p.uploadUrl, files[i], i, abort.signal),
        ),
      );

      setUploadPhase("creating");

      const taskRes = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          instructions: instructions.trim() || undefined,
          s3Keys: presigned.map((p) => p.key),
          notification_email:
            showNotifications && notificationEmail.trim()
              ? notificationEmail.trim()
              : undefined,
          notify_on_success:
            showNotifications && notificationEmail.trim()
              ? notifyOnSuccess
              : undefined,
          notify_on_error:
            showNotifications && notificationEmail.trim()
              ? notifyOnError
              : undefined,
        }),
        signal: abort.signal,
      });

      if (!taskRes.ok) {
        const data = await taskRes.json().catch(() => null);
        throw new Error(data?.error || `Server error (${taskRes.status})`);
      }

      const task = await taskRes.json();
      router.push(`/tasks/${task.id}`);
    } catch (err: unknown) {
      if ((err as Error).name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Unknown error");
      setSubmitting(false);
      setUploadPhase("idle");
    }
  }

  const totalBytes = fileProgress.reduce((s, f) => s + f.size, 0);
  const loadedBytes = fileProgress.reduce((s, f) => s + f.loaded, 0);
  const overallPercent =
    totalBytes > 0 ? Math.round((loadedBytes / totalBytes) * 100) : 0;

  const ACCEPTED_TYPES = ".pdf,.xlsx,.xls,.xlsm,.png,.jpg,.jpeg,.gif,.webp,.csv,.json,.txt";

  return (
    <div className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-bold">New Task</h1>
      <p className="mt-1 text-sm text-zinc-400">
        Upload files and configure a processing task
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
        <div>
          <label htmlFor="title" className="block text-sm font-medium">
            Task Title
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Process Q4 Sales Reports"
            className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none transition-colors focus:border-indigo-500"
            required
          />
        </div>

        <div>
          <label htmlFor="instructions" className="block text-sm font-medium">
            Instructions (optional)
          </label>
          {prompts.length > 0 && (
            <select
              value={selectedPromptId}
              onChange={(e) => handlePromptSelect(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-indigo-500"
            >
              <option value="">-- Select a saved prompt --</option>
              {prompts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
          <textarea
            id="instructions"
            value={instructions}
            onChange={(e) => {
              setInstructions(e.target.value);
              setSelectedPromptId("");
            }}
            placeholder="e.g., Extract all financial data, generate a summary PDF with charts"
            rows={3}
            className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none transition-colors focus:border-indigo-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Files</label>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`mt-1.5 flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
              dragOver
                ? "border-indigo-500 bg-indigo-500/10"
                : "border-zinc-700 hover:border-zinc-600"
            }`}
          >
            <UploadIcon className="mb-3 h-10 w-10 text-zinc-500" />
            <p className="text-sm text-zinc-400">
              Drag & drop files here, or{" "}
              <label className="cursor-pointer text-indigo-400 hover:text-indigo-300">
                browse
                <input
                  type="file"
                  multiple
                  accept={ACCEPTED_TYPES}
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </label>
            </p>
            <p className="mt-1 text-xs text-zinc-600">
              PDF, XLSX, PNG, JPG, and more
            </p>
          </div>

          {files.length > 0 && (
            <ul className="mt-3 space-y-1">
              {files.map((file, i) => {
                const fp = fileProgress[i];
                const pct =
                  fp && fp.size > 0
                    ? Math.round((fp.loaded / fp.size) * 100)
                    : 0;

                return (
                  <li
                    key={`${file.name}-${i}`}
                    className="relative overflow-hidden rounded-lg bg-zinc-800 px-3 py-2 text-sm"
                  >
                    {fp && fp.status === "uploading" && (
                      <div
                        className="absolute inset-y-0 left-0 bg-indigo-500/15 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    )}
                    <div className="relative flex items-center justify-between">
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <FileIcon className="h-4 w-4 shrink-0 text-zinc-400" />
                        <span className="truncate">{file.name}</span>
                        <span className="shrink-0 text-xs text-zinc-500">
                          ({formatSize(file.size)})
                        </span>
                        {fp?.status === "uploading" && (
                          <span className="shrink-0 text-xs text-indigo-400">
                            {pct}%
                          </span>
                        )}
                        {fp?.status === "done" && (
                          <CheckIcon className="h-4 w-4 shrink-0 text-green-400" />
                        )}
                        {fp?.status === "error" && (
                          <span className="shrink-0 text-xs text-red-400">
                            {fp.error}
                          </span>
                        )}
                      </div>
                      {!submitting && (
                        <button
                          type="button"
                          onClick={() => removeFile(i)}
                          className="text-zinc-500 hover:text-red-400"
                        >
                          <XIcon className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div>
          <button
            type="button"
            onClick={() => setShowNotifications((v) => !v)}
            className="flex items-center gap-2 text-sm font-medium text-zinc-400 transition-colors hover:text-white"
          >
            <MailIcon className="h-4 w-4" />
            Email Notifications
            <ChevronIcon className={`h-4 w-4 transition-transform ${showNotifications ? "rotate-180" : ""}`} />
          </button>

          {showNotifications && (
            <div className="mt-3 space-y-4 rounded-lg border border-zinc-700 bg-zinc-800/50 p-4">
              <div>
                <label htmlFor="notification_email" className="block text-sm font-medium text-zinc-300">
                  Recipient Email
                </label>
                <input
                  id="notification_email"
                  type="email"
                  value={notificationEmail}
                  onChange={(e) => setNotificationEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none transition-colors focus:border-indigo-500"
                />
              </div>
              <div className="flex gap-6">
                <label className="flex items-center gap-2 text-sm text-zinc-300">
                  <input
                    type="checkbox"
                    checked={notifyOnSuccess}
                    onChange={(e) => setNotifyOnSuccess(e.target.checked)}
                    className="h-4 w-4 rounded border-zinc-600 bg-zinc-700 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-0"
                  />
                  On success
                </label>
                <label className="flex items-center gap-2 text-sm text-zinc-300">
                  <input
                    type="checkbox"
                    checked={notifyOnError}
                    onChange={(e) => setNotifyOnError(e.target.checked)}
                    className="h-4 w-4 rounded border-zinc-600 bg-zinc-700 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-0"
                  />
                  On error
                </label>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {uploadPhase === "uploading" && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span>Uploading files...</span>
              <span>{overallPercent}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-zinc-700">
              <div
                className="h-full rounded-full bg-indigo-500 transition-all"
                style={{ width: `${overallPercent}%` }}
              />
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={!title.trim() || files.length === 0 || submitting}
          className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {uploadPhase === "uploading"
            ? `Uploading... ${overallPercent}%`
            : uploadPhase === "creating"
              ? "Creating task..."
              : "Create Task"}
        </button>
      </form>
    </div>
  );
}

function UploadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
    </svg>
  );
}

function FileIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  );
}

function MailIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
    </svg>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
    </svg>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
