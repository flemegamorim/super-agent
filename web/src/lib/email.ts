import fs from "fs";
import path from "path";
import JSZip from "jszip";
import { Task } from "./db";
import { listOutputFiles } from "./files";

const BRAIN_GATEWAY_URL =
  "https://brain-gateway.bessemer.io/brain-v2/api/v2/notification/email/send-email-brain";

interface EmailAttachment {
  filename: string;
  content_type: string;
  data: string;
}

interface SendEmailOptions {
  recipient: string;
  subject: string;
  body: string;
  attachment?: EmailAttachment;
}

const MIME_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".xlsm": "application/vnd.ms-excel.sheet.macroEnabled.12",
  ".xlsx":
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".xls": "application/vnd.ms-excel",
  ".csv": "text/csv",
  ".json": "application/json",
  ".txt": "text/plain",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".zip": "application/zip",
};

function inferContentType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  return MIME_TYPES[ext] ?? "application/octet-stream";
}

async function buildAttachment(
  taskId: string,
  taskTitle: string,
): Promise<EmailAttachment | undefined> {
  const filePaths = listOutputFiles(taskId);
  if (filePaths.length === 0) return undefined;

  if (filePaths.length === 1) {
    const filePath = filePaths[0];
    const filename = path.basename(filePath);
    const data = fs.readFileSync(filePath).toString("base64");
    return {
      filename,
      content_type: inferContentType(filename),
      data,
    };
  }

  const zip = new JSZip();
  for (const filePath of filePaths) {
    const content = fs.readFileSync(filePath);
    zip.file(path.basename(filePath), content);
  }
  const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
  const safeTitle = taskTitle.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 50);
  return {
    filename: `${safeTitle}_output.zip`,
    content_type: "application/zip",
    data: zipBuffer.toString("base64"),
  };
}

export async function sendEmail(options: SendEmailOptions): Promise<void> {
  const apiKey = process.env.BRAIN_GATEWAY_API_KEY;
  if (!apiKey) {
    console.error("BRAIN_GATEWAY_API_KEY is not configured, skipping email");
    return;
  }

  console.log(
    `Sending email to ${options.recipient} | subject: ${options.subject} | attachment: ${options.attachment?.filename ?? "none"}`,
  );

  const response = await fetch(BRAIN_GATEWAY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify(options),
  });

  const responseText = await response.text().catch(() => "");

  if (!response.ok) {
    throw new Error(
      `Email send failed (${response.status}): ${responseText}`,
    );
  }

  console.log(`Brain Gateway response (${response.status}): ${responseText}`);
}

function buildEmailBody(task: Task): string {
  const statusColor =
    task.status === "completed" ? "#22c55e" : "#ef4444";
  const statusLabel =
    task.status === "completed" ? "Completed" : "Failed";
  const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19);

  const errorBlock = task.error
    ? `
        <div style="margin-top: 16px; padding: 12px; background: #fef2f2; border-left: 4px solid #ef4444; border-radius: 4px;">
          <p style="margin: 0; font-size: 13px; font-weight: 600; color: #991b1b;">Error Details</p>
          <pre style="margin: 8px 0 0; font-size: 12px; color: #7f1d1d; white-space: pre-wrap; word-break: break-word;">${escapeHtml(task.error)}</pre>
        </div>`
    : "";

  const outputFiles = listOutputFiles(task.id);
  const attachmentNote =
    outputFiles.length > 0
      ? `<p style="margin: 12px 0 0; font-size: 13px; color: #6b7280;">Attached: ${outputFiles.length} output file${outputFiles.length > 1 ? "s" : ""}${outputFiles.length > 1 ? " (zip archive)" : ` (${path.basename(outputFiles[0])})`}</p>`
      : "";

  return `
    <html>
    <body style="font-family: Arial, sans-serif; background: #f9fafb; padding: 24px;">
      <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #e5e7eb; overflow: hidden;">
        <div style="padding: 24px 24px 0;">
          <h1 style="margin: 0 0 4px; font-size: 20px; color: #1e3a5f;">Super Agent - Task ${statusLabel}</h1>
          <p style="margin: 0; font-size: 13px; color: #9ca3af;">${timestamp}</p>
        </div>
        <div style="padding: 20px 24px 24px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; font-size: 13px; color: #6b7280; width: 80px;">Task</td>
              <td style="padding: 8px 0; font-size: 14px; font-weight: 600; color: #111827;">${escapeHtml(task.title)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-size: 13px; color: #6b7280;">Status</td>
              <td style="padding: 8px 0;">
                <span style="display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; color: #fff; background: ${statusColor};">${statusLabel}</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-size: 13px; color: #6b7280;">ID</td>
              <td style="padding: 8px 0; font-size: 12px; font-family: monospace; color: #6b7280;">${task.id}</td>
            </tr>
          </table>
          ${errorBlock}
          ${attachmentNote}
        </div>
      </div>
    </body>
    </html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendTaskNotificationEmail(task: Task): Promise<void> {
  if (!task.notification_email) return;

  const shouldNotify =
    (task.status === "completed" && task.notify_on_success) ||
    (task.status === "failed" && task.notify_on_error);

  if (!shouldNotify) return;

  const statusLabel =
    task.status === "completed" ? "Completed" : "Failed";
  const subject = `[Super Agent] Task "${task.title}" - ${statusLabel}`;

  try {
    const attachment = await buildAttachment(task.id, task.title);
    await sendEmail({
      recipient: task.notification_email,
      subject,
      body: buildEmailBody(task),
      attachment,
    });
    console.log(
      `Notification email sent to ${task.notification_email} for task ${task.id}`,
    );
  } catch (err) {
    console.error(
      `Failed to send notification email for task ${task.id}:`,
      err,
    );
  }
}
