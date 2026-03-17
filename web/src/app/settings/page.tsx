"use client";

import { useState, useEffect } from "react";

interface NotificationPrefs {
  default_notification_email: string | null;
  default_notify_on_success: boolean;
  default_notify_on_error: boolean;
}

interface AvailableModel {
  id: string;
  name: string;
}

interface ModelSettings {
  model: string;
  available_models: AvailableModel[];
}

export default function SettingsPage() {
  const [email, setEmail] = useState("");
  const [notifyOnSuccess, setNotifyOnSuccess] = useState(false);
  const [notifyOnError, setNotifyOnError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [model, setModel] = useState("");
  const [availableModels, setAvailableModels] = useState<AvailableModel[]>([]);
  const [savingModel, setSavingModel] = useState(false);
  const [modelSaved, setModelSaved] = useState(false);

  const [systemPrompt, setSystemPrompt] = useState("");
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [promptSaved, setPromptSaved] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/settings/notifications").then((r) => r.json()),
      fetch("/api/settings/model").then((r) => r.json()),
      fetch("/api/settings/system-prompt").then((r) => r.json()),
    ])
      .then(([notifData, modelData, promptData]: [NotificationPrefs, ModelSettings, { system_prompt: string | null }]) => {
        setEmail(notifData.default_notification_email ?? "");
        setNotifyOnSuccess(notifData.default_notify_on_success);
        setNotifyOnError(notifData.default_notify_on_error);
        setModel(modelData.model ?? "");
        setAvailableModels(modelData.available_models ?? []);
        setSystemPrompt(promptData.system_prompt ?? "");
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/settings/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          default_notification_email: email,
          default_notify_on_success: notifyOnSuccess,
          default_notify_on_error: notifyOnError,
        }),
      });
      if (res.ok) setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveModel() {
    setSavingModel(true);
    setModelSaved(false);
    try {
      const res = await fetch("/api/settings/model", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model }),
      });
      if (res.ok) setModelSaved(true);
    } finally {
      setSavingModel(false);
    }
  }

  async function handleSavePrompt() {
    setSavingPrompt(true);
    setPromptSaved(false);
    try {
      const res = await fetch("/api/settings/system-prompt", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ system_prompt: systemPrompt }),
      });
      if (res.ok) setPromptSaved(true);
    } finally {
      setSavingPrompt(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-500">
        Loading...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-bold">Settings</h1>
      <p className="mt-1 text-sm text-zinc-400">
        Configure AI model and notification preferences
      </p>

      <div className="mt-8 space-y-6">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <div className="flex items-center gap-3">
            <BrainIcon className="h-5 w-5 text-indigo-400" />
            <h2 className="text-lg font-semibold">AI Model</h2>
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            Select the Anthropic model used by the AI agent for processing
            tasks.
          </p>

          <div className="mt-6">
            <label
              htmlFor="model_select"
              className="block text-sm font-medium text-zinc-300"
            >
              Model
            </label>
            <select
              id="model_select"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-white outline-none transition-colors focus:border-indigo-500"
            >
              {availableModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-zinc-500">
              {model}
            </p>
          </div>

          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={handleSaveModel}
              disabled={savingModel}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {savingModel ? "Saving..." : "Save Model"}
            </button>
            {modelSaved && (
              <span className="text-sm text-emerald-400">Model saved</span>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <div className="flex items-center gap-3">
            <DocumentIcon className="h-5 w-5 text-indigo-400" />
            <h2 className="text-lg font-semibold">System Prompt</h2>
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            Define a system prompt that will be prepended to every task&apos;s
            instructions. Use this to set consistent output requirements,
            analysis style, or formatting rules.
          </p>

          <div className="mt-6">
            <label
              htmlFor="system_prompt"
              className="block text-sm font-medium text-zinc-300"
            >
              Prompt
            </label>
            <textarea
              id="system_prompt"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="e.g. Perform a comprehensive due diligence analysis as a VC firm. Output only .xlsx and .pdf files..."
              rows={8}
              className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-white placeholder-zinc-500 outline-none transition-colors focus:border-indigo-500 resize-y"
            />
            <p className="mt-1.5 text-xs text-zinc-500">
              This prompt is merged with the user instructions when a task is
              created. Leave empty to use only task-specific instructions.
            </p>
          </div>

          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={handleSavePrompt}
              disabled={savingPrompt}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {savingPrompt ? "Saving..." : "Save Prompt"}
            </button>
            {promptSaved && (
              <span className="text-sm text-emerald-400">Prompt saved</span>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <div className="flex items-center gap-3">
            <MailIcon className="h-5 w-5 text-indigo-400" />
            <h2 className="text-lg font-semibold">Email Notifications</h2>
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            These defaults will be pre-filled when creating new tasks. You can
            still override them per task.
          </p>

          <div className="mt-6 space-y-5">
            <div>
              <label
                htmlFor="default_email"
                className="block text-sm font-medium text-zinc-300"
              >
                Default Recipient Email
              </label>
              <input
                id="default_email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none transition-colors focus:border-indigo-500"
              />
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium text-zinc-300">
                Notify me when a task finishes with:
              </p>
              <label className="flex items-center gap-3 text-sm text-zinc-300">
                <input
                  type="checkbox"
                  checked={notifyOnSuccess}
                  onChange={(e) => setNotifyOnSuccess(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-600 bg-zinc-700 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-0"
                />
                Success
              </label>
              <label className="flex items-center gap-3 text-sm text-zinc-300">
                <input
                  type="checkbox"
                  checked={notifyOnError}
                  onChange={(e) => setNotifyOnError(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-600 bg-zinc-700 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-0"
                />
                Error
              </label>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Settings"}
            </button>
            {saved && (
              <span className="text-sm text-emerald-400">
                Settings saved
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function BrainIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z"
      />
    </svg>
  );
}

function DocumentIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
      />
    </svg>
  );
}

function MailIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75"
      />
    </svg>
  );
}
