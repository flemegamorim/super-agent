/**
 * Delete users from the database by email.
 *
 * Usage:
 *   npx tsx scripts/delete-users.ts admin@superagent.local
 *   npx tsx scripts/delete-users.ts alice@co.com bob@co.com
 *   npx tsx scripts/delete-users.ts --all                      # deletes every user
 */

import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_DIR = path.join(process.cwd(), ".data");
const DB_PATH = path.join(DB_DIR, "tasks.db");

if (!fs.existsSync(DB_PATH)) {
  console.error(`Database not found at ${DB_PATH}`);
  process.exit(1);
}

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

const args = process.argv.slice(2);

if (args.length === 0) {
  console.error("Usage: npx tsx scripts/delete-users.ts <email ...> | --all");
  process.exit(1);
}

interface UserRow {
  id: string;
  name: string;
  email: string;
}

const results: { name: string; email: string; status: string }[] = [];

if (args.includes("--all")) {
  const users = db.prepare("SELECT id, name, email FROM users").all() as UserRow[];
  if (users.length === 0) {
    console.log("\n  No users in the database.\n");
    process.exit(0);
  }
  db.prepare("DELETE FROM users").run();
  for (const u of users) {
    results.push({ name: u.name, email: u.email, status: "DELETED" });
  }
} else {
  const deleteStmt = db.prepare("DELETE FROM users WHERE email = ?");
  const selectStmt = db.prepare("SELECT id, name, email FROM users WHERE email = ?");

  for (const email of args) {
    const user = selectStmt.get(email) as UserRow | undefined;
    if (!user) {
      results.push({ name: "-", email, status: "NOT FOUND" });
      continue;
    }
    deleteStmt.run(email);
    results.push({ name: user.name, email: user.email, status: "DELETED" });
  }
}

console.log("\n  Delete Users Results\n");
console.log("  " + "-".repeat(70));
console.log(
  `  ${"Name".padEnd(20)} ${"Email".padEnd(30)} ${"Status"}`,
);
console.log("  " + "-".repeat(70));
for (const r of results) {
  console.log(
    `  ${r.name.padEnd(20)} ${r.email.padEnd(30)} ${r.status}`,
  );
}
console.log("  " + "-".repeat(70));
console.log(`\n  Total: ${results.length} user(s)\n`);
