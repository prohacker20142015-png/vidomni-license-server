import { NextRequest, NextResponse } from 'next/server';
import { getLicense, saveLicense } from '@/lib/db';
import { signLicenseToken } from '@/lib/crypto';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { license_key, machine_id } = body;

    if (!license_key || !machine_id) {
      return NextResponse.json(
        { success: false, message: 'Missing license_key or machine_id' },
        { status: 400 }
      );
    }

    const normalizedKey = license_key.trim().toUpperCase();
    const normalizedMid = machine_id.trim().toUpperCase();

    const record = await getLicense(normalizedKey);
    if (!record) {
      return NextResponse.json(
        { success: false, message: 'Mã bản quyền không tồn tại trên hệ thống.' },
        { status: 404 }
      );
    }

    if (record.status === 'revoked') {
      return NextResponse.json(
        { success: false, message: 'Mã bản quyền này đã bị thu hồi hoặc khóa bởi Admin.' },
        { status: 403 }
      );
    }

    const nowEpoch = Math.floor(Date.now() / 1000);

    // If key is already bound to a machine, ensure it matches
    if (record.bound_machine_id && record.bound_machine_id !== normalizedMid) {
      return NextResponse.json(
        {
          success: false,
          message: `Mã bản quyền đã được kích hoạt trên máy khác (${record.bound_machine_id}). Vui lòng liên hệ Admin để đổi máy.`,
        },
        { status: 403 }
      );
    }

    // Determine expiration
    let expiryEpoch: number;
    let expiresAtIso: string;

    if (record.status === 'active' && record.expires_at) {
      expiryEpoch = Math.floor(new Date(record.expires_at).getTime() / 1000);
      expiresAtIso = record.expires_at;

      // Check if already expired
      if (nowEpoch > expiryEpoch) {
        record.status = 'expired';
        await saveLicense(record);
        return NextResponse.json(
          { success: false, message: 'Mã bản quyền này đã hết hạn sử dụng.' },
          { status: 403 }
        );
      }
    } else {
      // First time activation
      expiryEpoch = nowEpoch + record.duration_days * 86400;
      expiresAtIso = new Date(expiryEpoch * 1000).toISOString().replace('.000Z', 'Z');
      record.bound_machine_id = normalizedMid;
      record.activated_at = new Date(nowEpoch * 1000).toISOString().replace('.000Z', 'Z');
      record.expires_at = expiresAtIso;
      record.status = 'active';
    }

    record.last_heartbeat = new Date(nowEpoch * 1000).toISOString().replace('.000Z', 'Z');
    await saveLicense(record);

    // Cryptographically sign token using Ed25519
    const issuedIso = new Date(nowEpoch * 1000).toISOString().replace('.000Z', 'Z');
    const token = signLicenseToken({
      license_id: record.key,
      license_key: record.key,
      machine_id: normalizedMid,
      tier: record.tier,
      issued_at: issuedIso,
      expires_at: expiresAtIso,
      expiry_epoch: expiryEpoch,
      max_accounts: record.max_accounts,
      max_concurrent_jobs: record.max_concurrent_jobs,
    });

    return NextResponse.json({
      success: true,
      token,
      status: 'ACTIVE',
      tier: record.tier,
      machine_id: normalizedMid,
      license_key: record.key,
      expires_at: expiresAtIso,
      expiry_epoch: expiryEpoch,
      days_remaining: Math.max(0, Math.floor((expiryEpoch - nowEpoch) / 86400)),
      max_accounts: record.max_accounts,
      max_concurrent_jobs: record.max_concurrent_jobs,
      message: 'Kích hoạt bản quyền thành công!',
    });
  } catch (err: any) {
    console.error('[API Activate] Error:', err);
    return NextResponse.json(
      { success: false, message: `Lỗi máy chủ: ${err?.message || err}` },
      { status: 500 }
    );
  }
}
