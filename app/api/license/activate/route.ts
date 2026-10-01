import { NextRequest, NextResponse } from 'next/server';
import { getLicense, saveLicense } from '@/lib/db';
import { signLicenseToken, verifyCryptographicKey } from '@/lib/crypto';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawKey = body.license_key || body.key || '';
    const rawMid = body.machine_id || body.hardware_id || '';

    if (!rawKey || !rawMid) {
      return NextResponse.json(
        { success: false, valid: false, message: 'Missing license_key or machine_id' },
        { status: 400 }
      );
    }

    const normalizedKey = rawKey.trim().toUpperCase();
    const normalizedMid = rawMid.trim().toUpperCase();

    let record = await getLicense(normalizedKey);
    if (!record) {
      // Cryptographic verification fallback (handles lambda cold starts and container isolation)
      const recovered = verifyCryptographicKey(normalizedKey, normalizedMid);
      if (recovered) {
        const nowIso = new Date().toISOString().replace('.000Z', 'Z');
        const expiryEpoch = Math.floor(Date.now() / 1000) + recovered.durationDays * 86400;
        record = {
          key: normalizedKey,
          tier: recovered.tier,
          status: 'active',
          duration_days: recovered.durationDays,
          max_accounts: recovered.tier === 'vip' ? 50 : recovered.tier === 'pro' ? 10 : 3,
          max_concurrent_jobs: recovered.tier === 'vip' ? 10 : recovered.tier === 'pro' ? 3 : 1,
          notes: 'Kích hoạt qua mã máy tính (Hardware ID)',
          created_at: nowIso,
          bound_machine_id: normalizedMid,
          activated_at: nowIso,
          expires_at: new Date(expiryEpoch * 1000).toISOString().replace('.000Z', 'Z'),
          last_heartbeat: nowIso,
        };
        await saveLicense(record);
      } else {
        return NextResponse.json(
          { success: false, message: 'Mã bản quyền không tồn tại trên hệ thống.' },
          { status: 404 }
        );
      }
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
      valid: true,
      token,
      status: 'ACTIVE',
      tier: record.tier,
      plan_type: record.tier,
      plan_name: (record.tier || 'pro').toUpperCase() + ' Edition',
      customer_name: record.notes || 'Quý khách',
      quota_remaining: (record.max_accounts || 10) * 50,
      credits_remaining: (record.max_accounts || 10) * 50,
      credits_total: (record.max_accounts || 10) * 50,
      credits_used: 0,
      machine_id: normalizedMid,
      hardware_id: normalizedMid,
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
