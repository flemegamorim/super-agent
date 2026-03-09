"use client";

import { useEffect, useState } from "react";

interface Prompt {
  id: string;
  name: string;
  body: string;
  created_at: string;
  updated_at: string;
}

export default function PromptsPage() {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [formName, setFormName] = useState("");
  const [formBody, setFormBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    fetchPrompts();
  }, []);

  async function fetchPrompts() {
    try {
      const res = await fetch("/api/prompts");
      if (res.ok) setPrompts(await res.json());
    } finally {
      setLoading(false);
    }
  }

  function startCreate() {
    setEditingId(null);
    setFormName("");
    setFormBody("");
    setShowCreate(true);
  }

  function startEdit(prompt: Prompt) {
    setShowCreate(false);
    setEditingId(prompt.id);
    setFormName(prompt.name);
    setFormBody(prompt.body);
  }

  function cancelForm() {
    setShowCreate(false);
    setEditingId(null);
    setFormName("");
    setFormBody("");
  }

  async function handleSave() {
    if (!formName.trim() || !formBody.trim()) return;
    setSaving(true);

    try {
      if (editingId) {
        await fetch(`/api/prompts/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: formName, body: formBody }),
        });
      } else {
        await fetch("/api/prompts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: formName, body: formBody }),
        });
      }
      cancelForm();
      await fetchPrompts();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/prompts/${id}`, { method: "DELETE" });
    setDeleteConfirm(null);
    await fetchPrompts();
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Prompts</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Reusable instruction templates for tasks
          </p>
        </div>
        <button
          onClick={startCreate}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
        >
          New Prompt
        </button>
      </div>

      {(showCreate || editingId) && (
        <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <h3 className="mb-4 text-sm font-semibold">
            {editingId ? "Edit Prompt" : "Create Prompt"}
          </h3>
          <div className="space-y-4">
            <div>
              <label htmlFor="prompt-name" className="block text-sm font-medium text-zinc-300">
                Name
              </label>
              <input
                id="prompt-name"
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g., Financial Report Analysis"
                className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none transition-colors focus:border-indigo-500"
              />
            </div>
            <div>
              <label htmlFor="prompt-body" className="block text-sm font-medium text-zinc-300">
                Instructions
              </label>
              <textarea
                id="prompt-body"
                value={formBody}
                onChange={(e) => setFormBody(e.target.value)}
                placeholder="e.g., Extract all financial data from the input files. Identify revenue trends, expense categories, and profit margins. Generate a summary PDF with charts and an XLSX with the raw data."
                rows={5}
                className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none transition-colors focus:border-indigo-500"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={!formName.trim() || !formBody.trim() || saving}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Saving..." : editingId ? "Update" : "Create"}
              </button>
              <button
                onClick={cancelForm}
                className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-sm text-zinc-500">Loading...</div>
      ) : prompts.length === 0 && !showCreate ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 py-12 text-center">
          <p className="text-sm text-zinc-500">No prompts yet</p>
          <button
            onClick={startCreate}
            className="mt-2 text-sm text-indigo-400 hover:text-indigo-300"
          >
            Create your first prompt
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {prompts.map((prompt) => (
            <div
              key={prompt.id}
              className="rounded-xl border border-zinc-800 bg-zinc-900 p-5"
            >
              <div className="flex items-start justify-between">
                <h3 className="text-sm font-semibold">{prompt.name}</h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => startEdit(prompt)}
                    className="text-xs text-zinc-400 hover:text-white"
                  >
                    Edit
                  </button>
                  {deleteConfirm === prompt.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDelete(prompt.id)}
                        className="text-xs text-red-400 hover:text-red-300"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        className="text-xs text-zinc-500 hover:text-zinc-300"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirm(prompt.id)}
                      className="text-xs text-zinc-500 hover:text-red-400"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-400">
                {prompt.body}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
