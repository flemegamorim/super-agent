import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import fs from "fs";
import path from "path";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import { getInputDir } from "./files";

const S3_ENDPOINT = process.env.S3_ENDPOINT || "http://127.0.0.1:9000";
const S3_PUBLIC_URL = process.env.S3_PUBLIC_URL || S3_ENDPOINT;
const S3_BUCKET = process.env.S3_BUCKET || "super-agent";
const S3_REGION = process.env.S3_REGION || "us-east-1";
const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY || "minioadmin";
const S3_SECRET_KEY = process.env.S3_SECRET_KEY || "minioadmin";

const PRESIGN_EXPIRES_IN = 60 * 30; // 30 minutes

function createClient(endpoint: string): S3Client {
  return new S3Client({
    endpoint,
    region: S3_REGION,
    credentials: { accessKeyId: S3_ACCESS_KEY, secretAccessKey: S3_SECRET_KEY },
    forcePathStyle: true,
  });
}

let _internalClient: S3Client | null = null;
function getInternalClient(): S3Client {
  if (!_internalClient) _internalClient = createClient(S3_ENDPOINT);
  return _internalClient;
}

let _publicClient: S3Client | null = null;
function getPublicClient(): S3Client {
  if (S3_PUBLIC_URL === S3_ENDPOINT) return getInternalClient();
  if (!_publicClient) _publicClient = createClient(S3_PUBLIC_URL);
  return _publicClient;
}

export function s3Key(taskId: string, filename: string): string {
  return `input/${taskId}/${filename}`;
}

export async function generatePresignedUploadUrl(key: string): Promise<string> {
  const command = new PutObjectCommand({ Bucket: S3_BUCKET, Key: key });
  return getSignedUrl(getPublicClient(), command, {
    expiresIn: PRESIGN_EXPIRES_IN,
  });
}

export async function downloadToLocal(
  key: string,
  taskId: string,
): Promise<string> {
  const client = getInternalClient();
  const resp = await client.send(
    new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }),
  );

  const filename = path.basename(key);
  const dir = getInputDir(taskId);
  const destPath = path.join(dir, filename);

  const body = resp.Body;
  if (!body) throw new Error(`Empty body for S3 key: ${key}`);

  const readStream =
    body instanceof Readable ? body : Readable.fromWeb(body as any);
  const writeStream = fs.createWriteStream(destPath);
  await pipeline(readStream, writeStream);

  return destPath;
}

export async function deleteObjects(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  const client = getInternalClient();
  await client.send(
    new DeleteObjectsCommand({
      Bucket: S3_BUCKET,
      Delete: { Objects: keys.map((Key) => ({ Key })) },
    }),
  );
}
