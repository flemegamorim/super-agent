import fs from "fs";
import path from "path";

const PROJECT_ROOT = path.resolve(process.cwd(), "..");
const INPUT_DIR = path.join(PROJECT_ROOT, "input");
const OUTPUT_DIR = path.join(PROJECT_ROOT, "output");

export function getInputDir(taskId: string): string {
  const dir = path.join(INPUT_DIR, taskId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function getOutputDir(taskId: string): string {
  const dir = path.join(OUTPUT_DIR, taskId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function listOutputFiles(taskId: string): string[] {
  const dir = path.join(OUTPUT_DIR, taskId);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).map((f) => path.join(dir, f));
}

export function getOutputFilePath(taskId: string, filename: string): string | null {
  const filePath = path.join(OUTPUT_DIR, taskId, filename);
  if (!fs.existsSync(filePath)) return null;
  return filePath;
}

export async function saveUploadedFile(
  taskId: string,
  filename: string,
  buffer: Buffer,
): Promise<string> {
  const dir = getInputDir(taskId);
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, buffer);
  return filePath;
}
