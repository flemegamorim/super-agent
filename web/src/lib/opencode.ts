import { createOpencodeClient } from "@opencode-ai/sdk";

const OPENCODE_URL = process.env.OPENCODE_URL || "http://localhost:4096";

export function getClient() {
  return createOpencodeClient({
    baseUrl: OPENCODE_URL,
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
  const client = getClient();
  const result = await client.session.prompt({
    path: { id: sessionId },
    body: {
      parts: [{ type: "text", text }],
    },
  });
  return result.data;
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
