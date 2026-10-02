/**
 * lib/db.ts - Multi-tier Persistent Storage:
 * 1. Upstash Redis (if UPSTASH_REDIS_REST_URL configured)
 * 2. Vercel Blob Cloud Storage (if BLOB_READ_WRITE_TOKEN configured)
 * 3. Local filesystem store (.data/licenses.json or /tmp/licenses.json)
 */

import { Redis } from '@upstash/redis';
import { put, list, del } from '@vercel/blob';
import fs from 'fs';
import path from 'path';

export interface LicenseRecord {
  key: string;
  tier: 'standard' | 'pro' | 'vip';
  status: 'unused' | 'active' | 'revoked' | 'expired';
  duration_days: number;
  max_accounts: number;
  max_concurrent_jobs: number;
  notes: string;
  created_at: string;
  bound_machine_id: string | null;
  activated_at: string | null;
  expires_at: string | null;
  last_heartbeat: string | null;
}

// 1. Initialize Upstash Redis if environment variables are provided
let redisClient: Redis | null = null;
const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

if (redisUrl && redisToken) {
  try {
    redisClient = new Redis({
      url: redisUrl,
      token: redisToken,
    });
  } catch (err) {
    console.warn('[DB] Failed to initialize Redis client:', err);
  }
}

// 2. In-memory and local fallback cache
let memoryStore: Record<string, LicenseRecord> = {};
let lastBlobSync = 0;
const BLOB_FILENAME = 'vidomni_licenses.json';

function getStoreFilePath(): string {
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return path.join('/tmp', 'licenses.json');
  }
  try {
    const localDir = path.join(process.cwd(), '.data');
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }
    return path.join(localDir, 'licenses.json');
  } catch {
    return path.join('/tmp', 'licenses.json');
  }
}

function readLocalDiskStore(): Record<string, LicenseRecord> {
  const filePath = getStoreFilePath();
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('[DB] Error reading local store file:', err);
  }
  return {};
}

function writeLocalDiskStore(store: Record<string, LicenseRecord>) {
  const filePath = getStoreFilePath();
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(store, null, 2), 'utf8');
  } catch (err) {
    console.warn('[DB] Warning writing local store file:', err);
  }
}

// Read from Vercel Blob Cloud
async function syncFromBlob(force: boolean = false): Promise<Record<string, LicenseRecord>> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return memoryStore;
  }

  const now = Date.now();
  if (!force && now - lastBlobSync < 3000 && Object.keys(memoryStore).length > 0) {
    return memoryStore;
  }

  try {
    const { blobs } = await list({ prefix: BLOB_FILENAME, token });
    if (blobs && blobs.length > 0) {
      const blobTarget = blobs[0];
      const fetchUrl = `${blobTarget.url}${blobTarget.url.includes('?') ? '&' : '?'}t=${Date.now()}`;
      const res = await fetch(fetchUrl, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      if (res.ok) {
        const data = (await res.json()) as Record<string, LicenseRecord>;
        memoryStore = data;
        lastBlobSync = now;
        writeLocalDiskStore(memoryStore);
        return memoryStore;
      }
    }
  } catch (err) {
    console.error('[DB] Error syncing from Vercel Blob:', err);
  }

  return memoryStore;
}

// Write to Vercel Blob Cloud
async function persistToBlob(store: Record<string, LicenseRecord>): Promise<void> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return;

  try {
    try {
      await put(BLOB_FILENAME, JSON.stringify(store, null, 2), {
        access: 'private',
        addRandomSuffix: false,
        allowOverwrite: true,
        token,
      });
    } catch (privErr: any) {
      if (privErr?.message?.includes('public access')) {
        await put(BLOB_FILENAME, JSON.stringify(store, null, 2), {
          access: 'public',
          addRandomSuffix: false,
          allowOverwrite: true,
          token,
        });
      } else {
        throw privErr;
      }
    }
    lastBlobSync = Date.now();
  } catch (err) {
    console.error('[DB] Error persisting to Vercel Blob:', err);
  }
}

// ============================================================================
// Database Operations
// ============================================================================

export async function getLicense(key: string): Promise<LicenseRecord | null> {
  const normalizedKey = key.trim().toUpperCase();

  // 1. Upstash Redis
  if (redisClient) {
    try {
      const record = await redisClient.get<LicenseRecord>(`license:${normalizedKey}`);
      return record || null;
    } catch (err) {
      console.error('[DB] Redis get error:', err);
    }
  }

  // 2. Vercel Blob
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const store = await syncFromBlob(true);
    for (const k of Object.keys(store)) {
      if (k.trim().toUpperCase() === normalizedKey) {
        return store[k];
      }
    }
    return null;
  }

  // 3. Local disk fallback
  if (memoryStore[normalizedKey]) {
    return memoryStore[normalizedKey];
  }
  const diskStore = readLocalDiskStore();
  memoryStore = { ...memoryStore, ...diskStore };
  return memoryStore[normalizedKey] || null;
}

export async function saveLicense(record: LicenseRecord): Promise<void> {
  const normalizedKey = record.key.trim().toUpperCase();
  record.key = normalizedKey;

  // 1. Upstash Redis
  if (redisClient) {
    try {
      await redisClient.set(`license:${normalizedKey}`, record);
      await redisClient.sadd('licenses:index', normalizedKey);
    } catch (err) {
      console.error('[DB] Redis save error:', err);
    }
  }

  // 2. Vercel Blob Cloud
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const store = await syncFromBlob(true);
    store[normalizedKey] = record;
    memoryStore = store;
    writeLocalDiskStore(memoryStore);
    await persistToBlob(memoryStore);
  }

  // 3. Local memory & disk
  memoryStore[normalizedKey] = record;
  writeLocalDiskStore(memoryStore);
}

export async function deleteLicense(key: string): Promise<boolean> {
  const normalizedKey = key.trim().toUpperCase();

  // 1. Upstash Redis
  if (redisClient) {
    try {
      await redisClient.del(`license:${normalizedKey}`);
      await redisClient.srem('licenses:index', normalizedKey);
    } catch (err) {
      console.error('[DB] Redis delete error:', err);
    }
  }

  // 2. Vercel Blob Cloud
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const store = await syncFromBlob(true);
      for (const k of Object.keys(store)) {
        if (k.trim().toUpperCase() === normalizedKey) {
          delete store[k];
        }
      }
      memoryStore = store;
      writeLocalDiskStore(memoryStore);
      await persistToBlob(memoryStore);
    } catch (err) {
      console.error('[DB] Error deleting from Blob:', err);
    }
  }

  // 3. Local memory & disk
  for (const k of Object.keys(memoryStore)) {
    if (k.trim().toUpperCase() === normalizedKey) {
      delete memoryStore[k];
    }
  }
  const diskStore = readLocalDiskStore();
  for (const k of Object.keys(diskStore)) {
    if (k.trim().toUpperCase() === normalizedKey) {
      delete diskStore[k];
    }
  }
  writeLocalDiskStore(memoryStore);

  return true;
}

export async function listLicenses(): Promise<LicenseRecord[]> {
  // 1. Upstash Redis
  if (redisClient) {
    try {
      const keys = await redisClient.smembers('licenses:index');
      if (keys && keys.length > 0) {
        const pipeline = redisClient.pipeline();
        for (const k of keys) {
          pipeline.get(`license:${k}`);
        }
        const records = (await pipeline.exec()) as (LicenseRecord | null)[];
        return records.filter((r): r is LicenseRecord => r !== null);
      }
      return [];
    } catch (err) {
      console.error('[DB] Redis list error:', err);
    }
  }

  // 2. Vercel Blob Cloud
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const store = await syncFromBlob(true);
    return Object.values(store).filter((r): r is LicenseRecord => Boolean(r && r.key && typeof r.key === 'string'));
  }

  // 3. Local disk fallback
  const diskStore = readLocalDiskStore();
  memoryStore = { ...memoryStore, ...diskStore };
  return Object.values(memoryStore).filter((r): r is LicenseRecord => Boolean(r && r.key && typeof r.key === 'string'));
}
