import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { listLicenses, saveLicense, LicenseRecord } from '@/lib/db';
import { generateMachineBoundKey } from '@/lib/crypto';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

function checkAuth(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  return token === ADMIN_PASSWORD;
}

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const keys = await listLicenses();

    // Calculate real-time stats
    const nowEpoch = Math.floor(Date.now() / 1000);
    let active = 0;
    let unused = 0;
    let revoked = 0;
    let expired = 0;

    for (const k of keys) {
      if (k.status === 'revoked') {
        revoked++;
      } else if (k.status === 'unused') {
        unused++;
      } else if (k.expires_at && Math.floor(new Date(k.expires_at).getTime() / 1000) < nowEpoch) {
        expired++;
      } else {
        active++;
      }
    }

    // Sort newest first
    keys.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return NextResponse.json({
      success: true,
      stats: {
        total: keys.length,
        active,
        unused,
        revoked,
        expired,
      },
      keys,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err?.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      tier = 'pro',
      duration_days = 30,
      max_accounts = 10,
      max_concurrent_jobs = 3,
      notes = '',
      custom_key,
      machine_id,
      hardware_id,
    } = body;

    const rawMid = (machine_id || hardware_id || '').trim().toUpperCase();
    const bound_machine_id = rawMid.length > 0 ? rawMid : null;

    let key = custom_key ? custom_key.trim().toUpperCase() : null;
    if (!key) {
      key = generateMachineBoundKey(tier, bound_machine_id || '', parseInt(duration_days, 10));
    }

    const nowIso = new Date().toISOString().replace('.000Z', 'Z');
    const record: LicenseRecord = {
      key,
      tier: tier as 'standard' | 'pro' | 'vip',
      status: bound_machine_id ? 'active' : 'unused',
      duration_days: parseInt(duration_days, 10),
      max_accounts: parseInt(max_accounts, 10),
      max_concurrent_jobs: parseInt(max_concurrent_jobs, 10),
      notes: notes || '',
      created_at: nowIso,
      bound_machine_id: bound_machine_id,
      activated_at: bound_machine_id ? nowIso : null,
      expires_at: bound_machine_id
        ? new Date((Math.floor(Date.now() / 1000) + parseInt(duration_days, 10) * 86400) * 1000)
            .toISOString()
            .replace('.000Z', 'Z')
        : null,
      last_heartbeat: null,
    };

    await saveLicense(record);

    return NextResponse.json({
      success: true,
      message: 'Tạo mã bản quyền thành công!',
      license: record,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err?.message }, { status: 500 });
  }
}
