import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

export type StoredWaiverPdf = {
  id: string;
  filename: string;
  bytes: Uint8Array;
  createdAt: string;
};

type MemoryStore = Map<string, StoredWaiverPdf>;

declare global {
  // eslint-disable-next-line no-var
  var __pcwWaiverStore: MemoryStore | undefined;
}

function memoryStore(): MemoryStore {
  if (!globalThis.__pcwWaiverStore) {
    globalThis.__pcwWaiverStore = new Map();
  }
  return globalThis.__pcwWaiverStore;
}

function tmpDir() {
  return path.join("/tmp", "pcw-waivers");
}

async function writeTmp(record: StoredWaiverPdf) {
  try {
    await mkdir(tmpDir(), { recursive: true });
    await writeFile(
      path.join(tmpDir(), `${record.id}.pdf`),
      Buffer.from(record.bytes),
    );
    await writeFile(
      path.join(tmpDir(), `${record.id}.json`),
      JSON.stringify({
        id: record.id,
        filename: record.filename,
        createdAt: record.createdAt,
      }),
    );
  } catch (err) {
    console.warn("Waiver tmp write failed", err);
  }
}

async function readTmp(id: string): Promise<StoredWaiverPdf | null> {
  try {
    const metaRaw = await readFile(path.join(tmpDir(), `${id}.json`), "utf8");
    const meta = JSON.parse(metaRaw) as {
      id: string;
      filename: string;
      createdAt: string;
    };
    const bytes = await readFile(path.join(tmpDir(), `${id}.pdf`));
    return {
      id: meta.id,
      filename: meta.filename,
      createdAt: meta.createdAt,
      bytes: new Uint8Array(bytes),
    };
  } catch {
    return null;
  }
}

async function writeBlob(record: StoredWaiverPdf) {
  try {
    const { getStore } = await import("@netlify/blobs");
    const store = getStore("waivers");
    const payload = record.bytes.buffer.slice(
      record.bytes.byteOffset,
      record.bytes.byteOffset + record.bytes.byteLength,
    ) as ArrayBuffer;
    await store.set(record.id, payload, {
      metadata: {
        filename: record.filename,
        createdAt: record.createdAt,
      },
    });
  } catch {
    /* Blobs unavailable outside Netlify — ignore */
  }
}

async function readBlob(id: string): Promise<StoredWaiverPdf | null> {
  try {
    const { getStore } = await import("@netlify/blobs");
    const store = getStore("waivers");
    const result = await store.getWithMetadata(id, { type: "arrayBuffer" });
    if (!result) return null;
    const filename =
      (result.metadata?.filename as string | undefined) ||
      `prestige-waiver-${id}.pdf`;
    const createdAt =
      (result.metadata?.createdAt as string | undefined) ||
      new Date().toISOString();
    return {
      id,
      filename,
      createdAt,
      bytes: new Uint8Array(result.data as ArrayBuffer),
    };
  } catch {
    return null;
  }
}

export async function storeWaiverPdf(
  bytes: Uint8Array,
  filename?: string,
): Promise<{ id: string; filename: string; url: string }> {
  const id = randomUUID().replace(/-/g, "").slice(0, 24);
  const safeName =
    filename?.replace(/[^a-zA-Z0-9._-]/g, "-") ||
    `prestige-waiver-${id}.pdf`;
  const record: StoredWaiverPdf = {
    id,
    filename: safeName,
    bytes,
    createdAt: new Date().toISOString(),
  };
  memoryStore().set(id, record);
  await Promise.all([writeTmp(record), writeBlob(record)]);
  // Path-style URL (no query params — some mail clients strip them).
  // Absolute form is preferred for FormSubmit emails; callers may also
  // resolve relative paths against window.location.origin.
  return {
    id,
    filename: safeName,
    url: `/api/waiver-pdf/${id}`,
  };
}

export async function getWaiverPdf(id: string): Promise<StoredWaiverPdf | null> {
  const safe = id.replace(/[^a-zA-Z0-9_-]/g, "");
  if (!safe || safe !== id) return null;
  const fromMem = memoryStore().get(id);
  if (fromMem) return fromMem;
  const fromTmp = await readTmp(id);
  if (fromTmp) {
    memoryStore().set(id, fromTmp);
    return fromTmp;
  }
  const fromBlob = await readBlob(id);
  if (fromBlob) {
    memoryStore().set(id, fromBlob);
    return fromBlob;
  }
  return null;
}
