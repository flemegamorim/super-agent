"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

interface Prompt {
  id: string;
  name: string;
  body: string;
}

export default function NewTaskPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [selectedPromptId, setSelectedPromptId] = useState("");
  const [notificationEmail, setNotificationEmail] = useState("");
  const [notifyOnSuccess, setNotifyOnSuccess] = useState(true);
  const [notifyOnError, setNotifyOnError] = useState(true);
  const [showNotifications, setShowNotifications] = useState(false);

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
      .then((data) => { if (Array.isArray(data)) setPrompts(data); })
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

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
    }
  }, []);

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || files.length === 0) return;

    setSubmitting(true);
    setError(null);

    const formData = new FormData();
    formData.append("title", title);
    if (instructions.trim()) formData.append("instructions", instructions);
    files.forEach((f) => formData.append("files", f));
    if (showNotifications && notificationEmail.trim()) {
      formData.append("notification_email", notificationEmail.trim());
      formData.append("notify_on_success", notifyOnSuccess ? "1" : "0");
      formData.append("notify_on_error", notifyOnError ? "1" : "0");
    }

    try {
      const res = await fetch("/api/tasks", { method: "POST", body: formData });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create task");
      }
      const task = await res.json();
      router.push(`/tasks/${task.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setSubmitting(false);
    }
  }

  const ACCEPTED_TYPES = ".pdf,.xlsx,.xls,.png,.jpg,.jpeg,.gif,.webp,.bmp,.tiff,.csv,.json,.txt";

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
              {files.map((file, i) => (
                <li
                  key={`${file.name}-${i}`}
                  className="flex items-center justify-between rounded-lg bg-zinc-800 px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <FileIcon className="h-4 w-4 text-zinc-400" />
                    <span className="truncate">{file.name}</span>
                    <span className="text-xs text-zinc-500">
                      ({(file.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFile(i)}
                    className="text-zinc-500 hover:text-red-400"
                  >
                    <XIcon className="h-4 w-4" />
                  </button>
                </li>
              ))}
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

        <button
          type="submit"
          disabled={!title.trim() || files.length === 0 || submitting}
          className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Creating..." : "Create Task"}
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
