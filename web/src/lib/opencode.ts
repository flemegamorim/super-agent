import { createOpencodeClient } from "@opencode-ai/sdk";

const OPENCODE_URL = process.env.OPENCODE_URL || "http://127.0.0.1:4096";
const PROMPT_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

export function getClient() {
  return createOpencodeClient({
    baseUrl: OPENCODE_URL,
    throwOnError: true,
    fetch: (req: Request) => {
      return fetch(req, {
        signal: AbortSignal.timeout(PROMPT_TIMEOUT_MS),
      });
    },
  });
}

export async function createSession(title: string) {
  const client = getClient();
  const session = await client.session.create({
    body: { title },
  });
  return session.data;
}

export async function sendPrompt(sessionId: string, text: string) {
  const maxRetries = 2;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const client = getClient();
      const result = await client.session.prompt({
        path: { id: sessionId },
        body: {
          parts: [{ type: "text", text }],
        },
      });
      return result.data;
    } catch (err) {
      lastError = err;
      const isFetchError =
        err instanceof TypeError && (err.message === "fetch failed" || err.message === "terminated");
      if (!isFetchError || attempt === maxRetries) throw err;
      const delay = 2000 * (attempt + 1);
      console.warn(`sendPrompt attempt ${attempt + 1} failed (fetch error), retrying in ${delay}ms...`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw lastError;
}

export async function abortSession(sessionId: string) {
  const client = getClient();
  await client.session.abort({ path: { id: sessionId } });
}

export async function getSessionMessages(sessionId: string) {
  const client = getClient();
  const messages = await client.session.messages({
    path: { id: sessionId },
  });
  return messages.data;
}

export async function listAgents() {
  const client = getClient();
  const agents = await client.app.agents();
  return agents.data;
}

export async function getSessionStatus() {
  const client = getClient();
  const statuses = await client.session.status();
  return statuses.data;
}

export async function subscribeToEvents() {
  const client = getClient();
  return client.event.subscribe();
}
