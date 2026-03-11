import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_DIR = path.join(process.cwd(), ".data");
fs.mkdirSync(DB_DIR, { recursive: true });
const DB_PATH = path.join(DB_DIR, "tasks.db");

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        instructions TEXT,
        status TEXT NOT NULL DEFAULT 'queued',
        session_id TEXT,
        input_files TEXT NOT NULL DEFAULT '[]',
        output_files TEXT NOT NULL DEFAULT '[]',
        error TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    _db.exec(`
      CREATE TABLE IF NOT EXISTS prompts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        body TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    const taskColumns = _db.prepare(`PRAGMA table_info(tasks)`).all() as { name: string }[];
    const colNames = new Set(taskColumns.map((c) => c.name));
    if (!colNames.has("notification_email")) {
      _db.exec(`ALTER TABLE tasks ADD COLUMN notification_email TEXT`);
    }
    if (!colNames.has("notify_on_success")) {
      _db.exec(`ALTER TABLE tasks ADD COLUMN notify_on_success INTEGER NOT NULL DEFAULT 0`);
    }
    if (!colNames.has("notify_on_error")) {
      _db.exec(`ALTER TABLE tasks ADD COLUMN notify_on_error INTEGER NOT NULL DEFAULT 0`);
    }

    _db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        must_change_password INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    const userColumns = _db.prepare(`PRAGMA table_info(users)`).all() as { name: string }[];
    const userColNames = new Set(userColumns.map((c) => c.name));
    if (!userColNames.has("default_notification_email")) {
      _db.exec(`ALTER TABLE users ADD COLUMN default_notification_email TEXT`);
    }
    if (!userColNames.has("default_notify_on_success")) {
      _db.exec(`ALTER TABLE users ADD COLUMN default_notify_on_success INTEGER NOT NULL DEFAULT 0`);
    }
    if (!userColNames.has("default_notify_on_error")) {
      _db.exec(`ALTER TABLE users ADD COLUMN default_notify_on_error INTEGER NOT NULL DEFAULT 0`);
    }
  }
  return _db;
}

export interface Task {
  id: string;
  title: string;
  instructions: string | null;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  session_id: string | null;
  input_files: string[];
  output_files: string[];
  error: string | null;
  notification_email: string | null;
  notify_on_success: boolean;
  notify_on_error: boolean;
  created_at: string;
  updated_at: string;
}

interface TaskRow {
  id: string;
  title: string;
  instructions: string | null;
  status: string;
  session_id: string | null;
  input_files: string;
  output_files: string;
  error: string | null;
  notification_email: string | null;
  notify_on_success: number;
  notify_on_error: number;
  created_at: string;
  updated_at: string;
}

function rowToTask(row: TaskRow): Task {
  return {
    ...row,
    status: row.status as Task["status"],
    input_files: JSON.parse(row.input_files),
    output_files: JSON.parse(row.output_files),
    notify_on_success: !!row.notify_on_success,
    notify_on_error: !!row.notify_on_error,
  };
}

export function createTask(task: {
  id: string;
  title: string;
  instructions?: string;
  input_files: string[];
  notification_email?: string;
  notify_on_success?: boolean;
  notify_on_error?: boolean;
}): Task {
  const db = getDb();
  db.prepare(
    `INSERT INTO tasks (id, title, instructions, input_files, notification_email, notify_on_success, notify_on_error) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    task.id,
    task.title,
    task.instructions ?? null,
    JSON.stringify(task.input_files),
    task.notification_email ?? null,
    task.notify_on_success ? 1 : 0,
    task.notify_on_error ? 1 : 0,
  );
  return getTask(task.id)!;
}

export function getTask(id: string): Task | null {
  const db = getDb();
  const row = db.prepare(`SELECT * FROM tasks WHERE id = ?`).get(id) as TaskRow | undefined;
  return row ? rowToTask(row) : null;
}

export function listTasks(): Task[] {
  const db = getDb();
  const rows = db.prepare(`SELECT * FROM tasks ORDER BY created_at DESC`).all() as TaskRow[];
  return rows.map(rowToTask);
}

export function updateTask(
  id: string,
  updates: Partial<Pick<Task, "status" | "session_id" | "output_files" | "error">>,
): Task | null {
  const db = getDb();
  const sets: string[] = [];
  const values: unknown[] = [];

  if (updates.status !== undefined) {
    sets.push("status = ?");
    values.push(updates.status);
  }
  if (updates.session_id !== undefined) {
    sets.push("session_id = ?");
    values.push(updates.session_id);
  }
  if (updates.output_files !== undefined) {
    sets.push("output_files = ?");
    values.push(JSON.stringify(updates.output_files));
  }
  if (updates.error !== undefined) {
    sets.push("error = ?");
    values.push(updates.error);
  }

  sets.push("updated_at = datetime('now')");
  values.push(id);

  db.prepare(`UPDATE tasks SET ${sets.join(", ")} WHERE id = ?`).run(...values);
  return getTask(id);
}

export function deleteTask(id: string): boolean {
  const db = getDb();
  const result = db.prepare(`DELETE FROM tasks WHERE id = ?`).run(id);
  return result.changes > 0;
}

// --- Prompts ---

export interface Prompt {
  id: string;
  name: string;
  body: string;
  created_at: string;
  updated_at: string;
}

export function createPrompt(prompt: { id: string; name: string; body: string }): Prompt {
  const db = getDb();
  db.prepare(
    `INSERT INTO prompts (id, name, body) VALUES (?, ?, ?)`,
  ).run(prompt.id, prompt.name, prompt.body);
  return getPrompt(prompt.id)!;
}

export function getPrompt(id: string): Prompt | null {
  const db = getDb();
  const row = db.prepare(`SELECT * FROM prompts WHERE id = ?`).get(id) as Prompt | undefined;
  return row ?? null;
}

export function listPrompts(): Prompt[] {
  const db = getDb();
  return db.prepare(`SELECT * FROM prompts ORDER BY name ASC`).all() as Prompt[];
}

export function updatePrompt(
  id: string,
  updates: { name?: string; body?: string },
): Prompt | null {
  const db = getDb();
  const sets: string[] = [];
  const values: unknown[] = [];

  if (updates.name !== undefined) {
    sets.push("name = ?");
    values.push(updates.name);
  }
  if (updates.body !== undefined) {
    sets.push("body = ?");
    values.push(updates.body);
  }

  if (sets.length === 0) return getPrompt(id);

  sets.push("updated_at = datetime('now')");
  values.push(id);

  db.prepare(`UPDATE prompts SET ${sets.join(", ")} WHERE id = ?`).run(...values);
  return getPrompt(id);
}

export function deletePrompt(id: string): boolean {
  const db = getDb();
  const result = db.prepare(`DELETE FROM prompts WHERE id = ?`).run(id);
  return result.changes > 0;
}

// --- Users ---

export interface User {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  must_change_password: number;
  default_notification_email: string | null;
  default_notify_on_success: number;
  default_notify_on_error: number;
  created_at: string;
}

export interface UserNotificationPrefs {
  default_notification_email: string | null;
  default_notify_on_success: boolean;
  default_notify_on_error: boolean;
}

export function createUser(user: {
  id: string;
  name: string;
  email: string;
  password_hash: string;
}): User {
  const db = getDb();
  db.prepare(
    `INSERT INTO users (id, name, email, password_hash) VALUES (?, ?, ?, ?)`,
  ).run(user.id, user.name, user.email, user.password_hash);
  return getUserById(user.id)!;
}

export function getUserByEmail(email: string): User | null {
  const db = getDb();
  const row = db.prepare(`SELECT * FROM users WHERE email = ?`).get(email) as User | undefined;
  return row ?? null;
}

export function getUserById(id: string): User | null {
  const db = getDb();
  const row = db.prepare(`SELECT * FROM users WHERE id = ?`).get(id) as User | undefined;
  return row ?? null;
}

export function updateUserPassword(id: string, passwordHash: string, clearMustChange = true): void {
  const db = getDb();
  db.prepare(
    `UPDATE users SET password_hash = ?, must_change_password = ? WHERE id = ?`,
  ).run(passwordHash, clearMustChange ? 0 : 1, id);
}

export function listUsers(): Omit<User, "password_hash">[] {
  const db = getDb();
  return db.prepare(
    `SELECT id, name, email, must_change_password, created_at FROM users ORDER BY name ASC`,
  ).all() as Omit<User, "password_hash">[];
}

export function getUserNotificationPrefs(userId: string): UserNotificationPrefs | null {
  const db = getDb();
  const row = db.prepare(
    `SELECT default_notification_email, default_notify_on_success, default_notify_on_error FROM users WHERE id = ?`,
  ).get(userId) as { default_notification_email: string | null; default_notify_on_success: number; default_notify_on_error: number } | undefined;
  if (!row) return null;
  return {
    default_notification_email: row.default_notification_email,
    default_notify_on_success: !!row.default_notify_on_success,
    default_notify_on_error: !!row.default_notify_on_error,
  };
}

export function updateUserNotificationPrefs(
  userId: string,
  prefs: UserNotificationPrefs,
): void {
  const db = getDb();
  db.prepare(
    `UPDATE users SET default_notification_email = ?, default_notify_on_success = ?, default_notify_on_error = ? WHERE id = ?`,
  ).run(
    prefs.default_notification_email,
    prefs.default_notify_on_success ? 1 : 0,
    prefs.default_notify_on_error ? 1 : 0,
    userId,
  );
}
