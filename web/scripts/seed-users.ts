/**
 * Seed users into the database.
 *
 * Usage:
 *   npx tsx scripts/seed-users.ts                         # uses default sample users
 *   npx tsx scripts/seed-users.ts users.json              # reads from JSON file
 *   npx tsx scripts/seed-users.ts "Alice,alice@co.com"    # inline name,email pair(s)
 *
 * JSON file format: [{ "name": "Alice", "email": "alice@example.com" }, ...]
 */

import { randomBytes } from "crypto";
import { hashSync } from "bcryptjs";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";

interface SeedUser {
  name: string;
  email: string;
}

const DB_DIR = path.join(process.cwd(), ".data");
fs.mkdirSync(DB_DIR, { recursive: true });
const DB_PATH = path.join(DB_DIR, "tasks.db");

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    must_change_password INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

function generatePassword(length = 12): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$";
  const bytes = randomBytes(length);
  return Array.from(bytes)
    .map((b) => chars[b % chars.length])
    .join("");
}

function parseArgs(): SeedUser[] {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    return [
      { name: "Admin", email: "admin@superagent.local" },
    ];
  }

  const firstArg = args[0];

  // JSON file
  if (firstArg.endsWith(".json")) {
    const filePath = path.resolve(firstArg);
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as SeedUser[];
  }

  // Inline "name,email" pairs
  return args.map((arg) => {
    const [name, email] = arg.split(",").map((s) => s.trim());
    if (!name || !email) {
      console.error(`Invalid format: "${arg}". Expected "Name,email@example.com"`);
      process.exit(1);
    }
    return { name, email };
  });
}

const users = parseArgs();
const results: { name: string; email: string; password: string; status: string }[] = [];

const insertStmt = db.prepare(
  `INSERT INTO users (id, name, email, password_hash, must_change_password) VALUES (?, ?, ?, ?, 1)`,
);

for (const user of users) {
  const existing = db.prepare(`SELECT id FROM users WHERE email = ?`).get(user.email);
  if (existing) {
    results.push({ name: user.name, email: user.email, password: "-", status: "SKIPPED (exists)" });
    continue;
  }

  const password = generatePassword();
  const hash = hashSync(password, 12);
  const id = randomUUID();

  insertStmt.run(id, user.name, user.email, hash);
  results.push({ name: user.name, email: user.email, password, status: "CREATED" });
}

// Print results as a table
console.log("\n  Seed Users Results\n");
console.log("  " + "-".repeat(80));
console.log(
  `  ${"Name".padEnd(20)} ${"Email".padEnd(30)} ${"Password".padEnd(16)} ${"Status"}`,
);
console.log("  " + "-".repeat(80));
for (const r of results) {
  console.log(
    `  ${r.name.padEnd(20)} ${r.email.padEnd(30)} ${r.password.padEnd(16)} ${r.status}`,
  );
}
console.log("  " + "-".repeat(80));
console.log(`\n  Total: ${results.length} user(s)\n`);
