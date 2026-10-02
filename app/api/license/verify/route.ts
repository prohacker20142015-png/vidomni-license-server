import { NextRequest, NextResponse } from 'next/server';
import { getLicense, saveLicense } from '@/lib/db';
import { verifyCryptographicKey } from '@/lib/crypto';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawKey = body.license_key || body.key || '';
    const rawMid = body.machine_id || body.hardware_id || '';

    if (!rawKey || !rawMid) {
      return NextResponse.json(
        { success: false, valid: false, status: 'INVALID', message: 'Missing license_key or machine_id' },
        { status: 400 }
      );
    }

    const normalizedKey = rawKey.trim().toUpperCase();
    const normalizedMid = rawMid.trim().toUpperCase();

    let record = await getLicense(normalizedKey);
    if (!record) {
      return NextResponse.json(
        {
          success: false,
          valid: false,
          status: 'NOT_FOUND',
          message: 'Mã bản quyền không tồn tại hoặc đã bị xóa bởi Quản Trị Viên!',
        },
        { status: 404 }
      );
    }

    if (record.status === 'revoked') {
      return NextResponse.json({
        success: false,
        valid: false,
        status: 'REVOKED',
        message: 'Bản quyền đã bị khóa bởi Admin',
      });
    }

    // Ensure machine matches if key is already bound to a hardware ID
    if (record.bound_machine_id && record.bound_machine_id !== normalizedMid) {
      return NextResponse.json({
        success: false,
        valid: false,
        status: 'MACHINE_MISMATCH',
        message: `Mã máy tính không khớp với thiết bị đã đăng ký! Bản quyền này chỉ dùng được trên máy: ${record.bound_machine_id.substring(0, 12)}...`,
      });
    }

    const rawEmail = (body.customer_email || body.email || '').trim();
    const rawPhone = (body.customer_phone || body.phone || body.sdt || '').trim();

    const isFirstActivation = record.status === 'unused' || !record.bound_machine_id || Boolean(body.is_activating);

    // Khi kích hoạt (lần đầu hoặc khi người dùng nhập form kích hoạt), bắt buộc phải có SĐT và Email
    if (isFirstActivation) {
      if (!rawPhone || !rawEmail) {
        return NextResponse.json(
          {
            success: false,
            valid: false,
            status: 'MISSING_CONTACT',
            message: 'Bắt buộc phải nhập đầy đủ Số điện thoại và Email để kích hoạt bản quyền!',
          },
          { status: 400 }
        );
      }

      const phoneDigits = rawPhone.replace(/\D/g, '');
      if (phoneDigits.length < 9 || phoneDigits.length > 15) {
        return NextResponse.json(
          {
            success: false,
            valid: false,
            status: 'INVALID_CONTACT',
            message: 'Số điện thoại không hợp lệ (cần từ 9 - 15 chữ số)!',
          },
          { status: 400 }
        );
      }

      if (!rawEmail.includes('@') || !rawEmail.includes('.')) {
        return NextResponse.json(
          {
            success: false,
            valid: false,
            status: 'INVALID_CONTACT',
            message: 'Email không hợp lệ (ví dụ: customer@gmail.com)!',
          },
          { status: 400 }
        );
      }
    }

    const nowEpoch = Math.floor(Date.now() / 1000);
    let needsSave = false;

    if (rawPhone && record.customer_phone !== rawPhone) {
      record.customer_phone = rawPhone;
      needsSave = true;
    }
    if (rawEmail && record.customer_email !== rawEmail) {
      record.customer_email = rawEmail;
      needsSave = true;
    }

    // If not yet bound or not yet activated
    if (!record.bound_machine_id) {
      record.bound_machine_id = normalizedMid;
      needsSave = true;
    }
    if (record.status === 'unused' || !record.activated_at || !record.expires_at) {
      const expiryEpoch = nowEpoch + (record.duration_days || 30) * 86400;
      record.activated_at = new Date(nowEpoch * 1000).toISOString().replace('.000Z', 'Z');
      record.expires_at = new Date(expiryEpoch * 1000).toISOString().replace('.000Z', 'Z');
      record.status = 'active';
      needsSave = true;
    }

    if (record.expires_at) {
      const expiryEpoch = Math.floor(new Date(record.expires_at).getTime() / 1000);
      if (nowEpoch > expiryEpoch) {
        record.status = 'expired';
        await saveLicense(record);
        return NextResponse.json({
          success: false,
          valid: false,
          status: 'EXPIRED',
          message: 'Bản quyền đã hết hạn',
        });
      }
    }

    if (needsSave) {
      await saveLicense(record);
    }

    return NextResponse.json({
      success: true,
      valid: true,
      status: 'ACTIVE',
      tier: record.tier,
      plan_type: record.tier,
      plan_name: (record.tier || 'pro').toUpperCase() + ' Edition',
      customer_name: record.notes || 'Quý khách',
      customer_email: record.customer_email || null,
      customer_phone: record.customer_phone || null,
      quota_remaining: (record.max_accounts || 10) * 50,
      credits_remaining: (record.max_accounts || 10) * 50,
      credits_total: (record.max_accounts || 10) * 50,
      credits_used: 0,
      license_key: record.key,
      machine_id: record.bound_machine_id,
      hardware_id: record.bound_machine_id,
      expires_at: record.expires_at ? Math.floor(new Date(record.expires_at).getTime() / 1000) : 0,
      max_accounts: record.max_accounts,
      max_concurrent_jobs: record.max_concurrent_jobs,
      message: 'Kích hoạt bản quyền thành công!',
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, valid: false, status: 'ERROR', message: err?.message || 'Server error' },
      { status: 500 }
    );
  }
}
