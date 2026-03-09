"use client";

import { useEffect, useState } from "react";

interface Agent {
  name?: string;
  id?: string;
  description?: string;
  mode?: string;
  model?: string;
  [key: string]: unknown;
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAgents() {
      try {
        const res = await fetch("/api/agents");
        if (!res.ok) throw new Error("Failed to fetch agents");
        const data = await res.json();
        setAgents(Array.isArray(data) ? data : []);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load agents");
      } finally {
        setLoading(false);
      }
    }
    fetchAgents();
  }, []);

  const modeColors: Record<string, string> = {
    primary: "bg-indigo-500/20 text-indigo-400",
    subagent: "bg-cyan-500/20 text-cyan-400",
    all: "bg-zinc-700 text-zinc-300",
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Agents</h1>
      <p className="mt-1 text-sm text-zinc-400">
        Configured OpenCode agents for this project
      </p>

      {loading && (
        <div className="mt-12 text-center text-sm text-zinc-500">
          Loading agents...
        </div>
      )}

      {error && (
        <div className="mt-6 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          <p className="text-sm text-amber-400">{error}</p>
          <p className="mt-1 text-xs text-zinc-500">
            Make sure the OpenCode server is running: <code>opencode serve --port 4096</code>
          </p>
        </div>
      )}

      {!loading && !error && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent, i) => {
            const name = agent.name || agent.id || `Agent ${i + 1}`;
            const mode = (agent.mode as string) || "all";
            return (
              <div
                key={name}
                className="rounded-xl border border-zinc-800 bg-zinc-900 p-5"
              >
                <div className="flex items-start justify-between">
                  <h3 className="text-sm font-semibold">{name}</h3>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      modeColors[mode] || modeColors.all
                    }`}
                  >
                    {mode}
                  </span>
                </div>
                {agent.description && (
                  <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
                    {agent.description}
                  </p>
                )}
                {agent.model && (
                  <p className="mt-3 text-xs text-zinc-600">
                    Model: {agent.model as string}
                  </p>
                )}
              </div>
            );
          })}

          {agents.length === 0 && (
            <div className="col-span-full py-12 text-center text-sm text-zinc-500">
              No agents found. Check your OpenCode configuration.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
