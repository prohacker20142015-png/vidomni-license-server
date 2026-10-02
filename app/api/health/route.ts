import { NextResponse } from 'next/server';
import { listLicenses } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const hasRedis = Boolean(process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL);
  const hasBlob = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
  const licenses = await listLicenses();

  return NextResponse.json({
    status: 'ok',
    service: 'VidOmni AI Studio Pro License Server',
    version: '2.0.0',
    platform: 'Vercel Serverless',
    storage: {
      hasRedis,
      hasBlob,
      dbLicenseCount: licenses.length,
      dbKeys: licenses.map((l) => l.key),
    },
    timestamp: new Date().toISOString(),
  });
}
