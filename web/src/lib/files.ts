import fs from "fs";
import path from "path";

const PROJECT_ROOT = path.resolve(process.cwd(), "..");
const INPUT_DIR = path.join(PROJECT_ROOT, "input");
const OUTPUT_DIR = path.join(PROJECT_ROOT, "output");

// #region agent log
const _dbgInit = {cwd:process.cwd(),projectRoot:PROJECT_ROOT,outputDir:OUTPUT_DIR,outputDirExists:fs.existsSync(OUTPUT_DIR)};
console.log('[DEBUG-a29ae6] files.ts path resolution',JSON.stringify(_dbgInit));
fetch('http://127.0.0.1:7605/ingest/94306406-d42f-4c45-af23-eb2caa34f2c1',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'a29ae6'},body:JSON.stringify({sessionId:'a29ae6',runId:'run1',hypothesisId:'H-B',location:'files.ts:init',message:'Path resolution at module load',data:_dbgInit,timestamp:Date.now()})}).catch(()=>{});
// #endregion

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
  const exists = fs.existsSync(dir);

  // #region agent log
  const _dbgList = {taskId,dir,dirExists:exists,parentContents:fs.existsSync(OUTPUT_DIR)?fs.readdirSync(OUTPUT_DIR):['OUTPUT_DIR_MISSING']};
  console.log('[DEBUG-a29ae6] listOutputFiles',JSON.stringify(_dbgList));
  fetch('http://127.0.0.1:7605/ingest/94306406-d42f-4c45-af23-eb2caa34f2c1',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'a29ae6'},body:JSON.stringify({sessionId:'a29ae6',runId:'run1',hypothesisId:'H-C,H-D',location:'files.ts:listOutputFiles',message:'Listing output files',data:_dbgList,timestamp:Date.now()})}).catch(()=>{});
  // #endregion

  if (!exists) return [];
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
