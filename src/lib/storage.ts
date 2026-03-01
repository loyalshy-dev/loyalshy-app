import "server-only"

import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3"
import crypto from "crypto"

// ─── Lazy S3Client ──────────────────────────────────────────
// Same Proxy pattern as db.ts — avoids build-time env var errors

const globalForS3 = globalThis as unknown as { s3?: S3Client }

function getS3Client(): S3Client {
  if (!globalForS3.s3) {
    globalForS3.s3 = new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    })
  }
  return globalForS3.s3
}

const s3: S3Client = new Proxy({} as S3Client, {
  get(_target, prop: string | symbol) {
    const client = getS3Client()
    const value = Reflect.get(client, prop, client)
    if (typeof value === "function") {
      return value.bind(client)
    }
    return value
  },
})

// ─── Config ─────────────────────────────────────────────────

function getBucket(): string {
  return process.env.R2_BUCKET_NAME ?? "loyalshy"
}

function getPublicUrl(): string {
  return (process.env.R2_PUBLIC_URL ?? "").replace(/\/$/, "")
}

// ─── Upload ─────────────────────────────────────────────────

/**
 * Upload a file to R2 and return the public URL.
 * Appends a random suffix to the key for uniqueness.
 * Falls back to a data URI in local dev without R2 credentials.
 */
export async function uploadFile(
  buffer: Buffer,
  key: string,
  contentType: string,
): Promise<string> {
  try {
    // Append random suffix before extension for uniqueness
    const dotIdx = key.lastIndexOf(".")
    const suffix = crypto.randomBytes(8).toString("hex")
    const uniqueKey =
      dotIdx > 0
        ? `${key.slice(0, dotIdx)}-${suffix}${key.slice(dotIdx)}`
        : `${key}-${suffix}`

    await s3.send(
      new PutObjectCommand({
        Bucket: getBucket(),
        Key: uniqueKey,
        Body: buffer,
        ContentType: contentType,
      }),
    )

    return `${getPublicUrl()}/${uniqueKey}`
  } catch {
    // R2 credentials not configured — data URI fallback for local dev
    return `data:${contentType};base64,${buffer.toString("base64")}`
  }
}

// ─── Delete ─────────────────────────────────────────────────

/**
 * Delete a single file from R2 by its public URL.
 * Extracts the key from the URL. No-ops for null/data URIs.
 */
export async function deleteFile(url: string | null | undefined): Promise<void> {
  if (!url || url.startsWith("data:")) return

  try {
    const publicBase = getPublicUrl()
    if (!publicBase || !url.startsWith(publicBase)) return

    const key = url.slice(publicBase.length + 1) // strip base + leading slash

    await s3.send(
      new DeleteObjectCommand({
        Bucket: getBucket(),
        Key: key,
      }),
    )
  } catch {
    // File may not exist — ignore
  }
}

/**
 * Delete multiple files from R2. Filters out null/undefined/data URIs.
 */
export async function deleteFiles(
  urls: (string | null | undefined)[],
): Promise<void> {
  const valid = urls.filter(
    (u): u is string => typeof u === "string" && !u.startsWith("data:"),
  )
  if (valid.length === 0) return

  await Promise.all(valid.map((url) => deleteFile(url)))
}
