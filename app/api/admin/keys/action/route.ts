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
    const { key, action, days } = await req.json();

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
