import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'VidOmni AI Studio Pro License Server',
    version: '2.0.0',
    platform: 'Vercel Serverless',
    timestamp: new Date().toISOString(),
  });
}
