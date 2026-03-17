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
// S3_PUBLIC_URL is the browser-accessible base URL for presigned uploads.
// When nginx proxies /s3/ → minio:9000, set this to e.g. https://yourdomain.com/s3
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

export function s3Key(taskId: string, filename: string): string {
  return `input/${taskId}/${filename}`;
}

export async function generatePresignedUploadUrl(key: string): Promise<string> {
  // Generate with internal client (signed against S3_ENDPOINT), then rewrite
  // the host+path prefix to S3_PUBLIC_URL so the browser can reach it.
  const command = new PutObjectCommand({ Bucket: S3_BUCKET, Key: key });
  const internalUrl = await getSignedUrl(getInternalClient(), command, {
    expiresIn: PRESIGN_EXPIRES_IN,
  });

  if (S3_PUBLIC_URL === S3_ENDPOINT) return internalUrl;

  // Replace the internal origin+bucket prefix with the public URL.
  // Internal: http://minio:9000/super-agent/<key>?X-Amz-...
  // Public:   http://host/s3/super-agent/<key>?X-Amz-...
  const internal = new URL(internalUrl);
  const publicBase = new URL(S3_PUBLIC_URL);
  internal.protocol = publicBase.protocol;
  internal.host = publicBase.host;
  internal.port = publicBase.port;
  // Prepend the public base path (e.g. /s3) before the bucket path
  const bucketPath = internal.pathname; // e.g. /super-agent/input/...
  internal.pathname = publicBase.pathname.replace(/\/$/, "") + bucketPath;
  return internal.toString();
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
