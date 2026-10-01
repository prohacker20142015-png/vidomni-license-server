/**
 * lib/db.ts - Upstash Redis / Vercel KV Storage with Local Fallback
 */

import { Redis } from '@upstash/redis';
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

const redisUrl =
  process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const redisToken =
  process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

if (redisUrl && redisToken) {
  try {
    redisClient = new Redis({
      url: redisUrl,
      token: redisToken,
    });
  } catch (err) {
    console.warn('[DB] Failed to initialize Redis client, falling back to local store:', err);
  }
}

// 2. Local fallback storage for dev / test mode
const LOCAL_STORE_FILE = path.join(process.cwd(), '.data', 'licenses.json');

function readLocalStore(): Record<string, LicenseRecord> {
  try {
    if (fs.existsSync(LOCAL_STORE_FILE)) {
      const data = fs.readFileSync(LOCAL_STORE_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('[DB] Error reading local store:', err);
  }
  return {};
}

function writeLocalStore(store: Record<string, LicenseRecord>) {
  try {
    const dir = path.dirname(LOCAL_STORE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(LOCAL_STORE_FILE, JSON.stringify(store, null, 2), 'utf8');
  } catch (err) {
    console.error('[DB] Error writing local store:', err);
  }
}

// ============================================================================
// Database Operations
// ============================================================================

export async function getLicense(key: string): Promise<LicenseRecord | null> {
  const normalizedKey = key.trim().toUpperCase();
  if (redisClient) {
    try {
      const record = await redisClient.get<LicenseRecord>(`license:${normalizedKey}`);
      return record || null;
    } catch (err) {
      console.error('[DB] Redis get error:', err);
    }
  }
  const store = readLocalStore();
  return store[normalizedKey] || null;
}

export async function saveLicense(record: LicenseRecord): Promise<void> {
  const normalizedKey = record.key.trim().toUpperCase();
  record.key = normalizedKey;
  if (redisClient) {
    try {
      await redisClient.set(`license:${normalizedKey}`, record);
      await redisClient.sadd('licenses:index', normalizedKey);
      return;
    } catch (err) {
      console.error('[DB] Redis save error:', err);
    }
  }
  const store = readLocalStore();
  store[normalizedKey] = record;
  writeLocalStore(store);
}

export async function deleteLicense(key: string): Promise<boolean> {
  const normalizedKey = key.trim().toUpperCase();
  if (redisClient) {
    try {
      await redisClient.del(`license:${normalizedKey}`);
      await redisClient.srem('licenses:index', normalizedKey);
      return true;
    } catch (err) {
      console.error('[DB] Redis delete error:', err);
    }
  }
  const store = readLocalStore();
  if (store[normalizedKey]) {
    delete store[normalizedKey];
    writeLocalStore(store);
    return true;
  }
  return false;
}

export async function listLicenses(): Promise<LicenseRecord[]> {
  if (redisClient) {
    try {
      const keys = await redisClient.smembers('licenses:index');
      if (!keys || keys.length === 0) return [];
      const pipeline = redisClient.pipeline();
      for (const k of keys) {
        pipeline.get(`license:${k}`);
      }
      const records = (await pipeline.exec()) as (LicenseRecord | null)[];
      return records.filter((r): r is LicenseRecord => r !== null);
    } catch (err) {
      console.error('[DB] Redis list error:', err);
    }
  }
  const store = readLocalStore();
  return Object.values(store);
}
