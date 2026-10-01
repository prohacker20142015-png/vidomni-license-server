import Link from 'next/link';
import { ShieldCheck, Server, KeyRound, ArrowRight } from 'lucide-react';

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-b from-[#0B0F19] to-[#111827]">
      <div className="max-w-2xl w-full text-center space-y-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-medium">
          <ShieldCheck className="w-4 h-4" />
          <span>Vercel Serverless License & API Key Manager</span>
        </div>

        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">
          VidOmni AI Studio Pro
        </h1>

        <p className="text-gray-400 text-lg leading-relaxed">
          Hệ thống máy chủ phân phối bản quyền Ed25519 phần cứng và quản lý API Key tập trung cho phần mềm VidOmni AI Studio Pro v2.0.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left my-8">
          <div className="p-5 rounded-xl bg-gray-900/60 border border-gray-800">
            <div className="w-10 h-10 rounded-lg bg-blue-600/20 flex items-center justify-center text-blue-400 mb-3">
              <KeyRound className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-white mb-1">Khóa Bản Quyền Phần Cứng</h3>
            <p className="text-sm text-gray-400">
              Ràng buộc Machine ID, hỗ trợ ân hạn offline 7 ngày, chống chỉnh lùi thời gian hệ thống.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-gray-900/60 border border-gray-800">
            <div className="w-10 h-10 rounded-lg bg-green-600/20 flex items-center justify-center text-green-400 mb-3">
              <Server className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-white mb-1">Upstash Redis / Vercel KV</h3>
            <p className="text-sm text-gray-400">
              Lưu trữ Serverless độ trễ thấp, quản lý khóa/mở khóa từ xa và reset máy cho khách hàng.
            </p>
          </div>
        </div>

        <div className="pt-4 flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/admin"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium shadow-lg shadow-blue-500/25 transition-all"
          >
            <span>Vào Bảng Quản Trị (Admin Portal)</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <a
            href="/api/health"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium border border-gray-700 transition-all"
          >
            <span>Kiểm Tra Server Status</span>
          </a>
        </div>
      </div>
    </main>
  );
}
