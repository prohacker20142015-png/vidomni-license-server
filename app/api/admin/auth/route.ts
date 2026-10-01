import { NextRequest, NextResponse } from 'next/server';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json();

    if (password === ADMIN_PASSWORD) {
      // In production, can issue JWT or session cookie
      return NextResponse.json({
        success: true,
        message: 'Đăng nhập thành công',
      });
    }

    return NextResponse.json(
      { success: false, message: 'Mật khẩu quản trị không chính xác' },
      { status: 401 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || 'Server error' },
      { status: 500 }
    );
  }
}
