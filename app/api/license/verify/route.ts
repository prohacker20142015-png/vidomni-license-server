import { NextRequest, NextResponse } from 'next/server';
import { getLicense, saveLicense } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { license_key, machine_id } = body;

    if (!license_key || !machine_id) {
      return NextResponse.json(
        { success: false, status: 'INVALID', message: 'Missing parameters' },
        { status: 400 }
      );
    }

    const normalizedKey = license_key.trim().toUpperCase();
    const normalizedMid = machine_id.trim().toUpperCase();

    const record = await getLicense(normalizedKey);
    if (!record) {
      return NextResponse.json(
        { success: false, status: 'NOT_FOUND', message: 'Mã không tồn tại' },
        { status: 404 }
      );
    }

    if (record.status === 'revoked') {
      return NextResponse.json({
        success: false,
        status: 'REVOKED',
        message: 'Bản quyền đã bị khóa bởi Admin',
      });
    }

    if (record.bound_machine_id && record.bound_machine_id !== normalizedMid) {
      return NextResponse.json({
        success: false,
        status: 'MACHINE_MISMATCH',
        message: 'Mã máy không khớp',
      });
    }

    const nowEpoch = Math.floor(Date.now() / 1000);
    if (record.expires_at) {
      const expiryEpoch = Math.floor(new Date(record.expires_at).getTime() / 1000);
      if (nowEpoch > expiryEpoch) {
        record.status = 'expired';
        await saveLicense(record);
        return NextResponse.json({
          success: false,
          status: 'EXPIRED',
          message: 'Bản quyền đã hết hạn',
        });
      }
    }

    record.last_heartbeat = new Date(nowEpoch * 1000).toISOString().replace('.000Z', 'Z');
    await saveLicense(record);

    return NextResponse.json({
      success: true,
      status: 'ACTIVE',
      tier: record.tier,
      expires_at: record.expires_at,
      max_accounts: record.max_accounts,
      max_concurrent_jobs: record.max_concurrent_jobs,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, status: 'ERROR', message: err?.message || 'Server error' },
      { status: 500 }
    );
  }
}
