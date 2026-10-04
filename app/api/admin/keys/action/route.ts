import { NextRequest, NextResponse } from 'next/server';
import { getLicense, saveLicense, deleteLicense } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

function checkAuth(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  return token === ADMIN_PASSWORD;
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { key, action, days, new_tier, max_accounts, max_concurrent_jobs } = await req.json();

    if (!key || !action) {
      return NextResponse.json({ success: false, message: 'Missing key or action' }, { status: 400 });
    }

    const normalizedKey = key.trim().toUpperCase();

    if (action === 'delete') {
      await deleteLicense(normalizedKey);
      return NextResponse.json({ success: true, message: 'Đã xóa key thành công' });
    }

    const record = await getLicense(normalizedKey);
    if (!record) {
      return NextResponse.json({ success: false, message: 'Key không tồn tại' }, { status: 404 });
    }

    if (action === 'revoke') {
      record.status = 'revoked';
      await saveLicense(record);
      return NextResponse.json({ success: true, message: `Đã thu hồi / khóa key ${normalizedKey}` });
    }

    if (action === 'unban') {
      record.status = record.bound_machine_id ? 'active' : 'unused';
      await saveLicense(record);
      return NextResponse.json({ success: true, message: `Đã mở khóa key ${normalizedKey}` });
    }

    if (action === 'reset_machine') {
      record.bound_machine_id = null;
      await saveLicense(record);
      return NextResponse.json({
        success: true,
        message: `Đã reset Machine ID cho key ${normalizedKey}. Khách hàng có thể kích hoạt trên máy mới!`,
      });
    }

    if (action === 'change_tier') {
      const targetTier = String(new_tier || '').toLowerCase().trim();
      if (!['standard', 'pro', 'vip'].includes(targetTier)) {
        return NextResponse.json({ success: false, message: 'Gói bản quyền không hợp lệ (standard, pro, vip)' }, { status: 400 });
      }

      record.tier = targetTier as any;

      if (max_accounts !== undefined && max_accounts !== null && !isNaN(parseInt(max_accounts, 10))) {
        record.max_accounts = parseInt(max_accounts, 10);
      } else {
        record.max_accounts = targetTier === 'vip' ? 100 : (targetTier === 'pro' ? 20 : 1);
      }

      if (max_concurrent_jobs !== undefined && max_concurrent_jobs !== null && !isNaN(parseInt(max_concurrent_jobs, 10))) {
        record.max_concurrent_jobs = parseInt(max_concurrent_jobs, 10);
      } else {
        record.max_concurrent_jobs = targetTier === 'vip' ? 50 : (targetTier === 'pro' ? 10 : 5);
      }

      await saveLicense(record);
      return NextResponse.json({
        success: true,
        message: `Đã đổi gói sang [${targetTier.toUpperCase()}] thành công! Tool khách hàng sẽ tự động đồng bộ ngay lập tức.`,
        record,
      });
    }

    if (action === 'extend') {
      const extraDays = parseInt(days, 10) || 30;
      if (record.expires_at) {
        const curExp = new Date(record.expires_at).getTime();
        const newExp = curExp + extraDays * 86400 * 1000;
        record.expires_at = new Date(newExp).toISOString().replace('.000Z', 'Z');
        if (record.status === 'expired') {
          record.status = 'active';
        }
      }
      record.duration_days += extraDays;
      await saveLicense(record);
      return NextResponse.json({
        success: true,
        message: `Đã gia hạn thêm ${extraDays} ngày cho key ${normalizedKey}`,
        expires_at: record.expires_at,
      });
    }

    return NextResponse.json({ success: false, message: 'Action không hợp lệ' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err?.message }, { status: 500 });
  }
}
