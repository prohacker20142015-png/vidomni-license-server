'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  KeyRound,
  Plus,
  RefreshCw,
  Copy,
  Check,
  Search,
  Lock,
  Unlock,
  RotateCcw,
  CalendarPlus,
  Trash2,
  LogOut,
  Laptop,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  Phone,
  Mail,
} from 'lucide-react';

interface LicenseRecord {
  key: string;
  tier: 'standard' | 'pro' | 'vip';
  status: 'unused' | 'active' | 'revoked' | 'expired';
  duration_days: number;
  max_accounts: number;
  max_concurrent_jobs: number;
  notes: string;
  created_at: string;
  bound_machine_id: string | null;
  activated_at: string | null;
  expires_at: string | null;
  last_heartbeat: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
}

export default function AdminPage() {
  const [token, setToken] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [keys, setKeys] = useState<LicenseRecord[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    unused: 0,
    revoked: 0,
    expired: 0,
  });

  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);

  const generateKeyForMachine = (tier: string = 'pro', machineId: string = '') => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let r1 = '';
    let r2 = '';
    const cleanMid = machineId.trim().toUpperCase();
    if (cleanMid.length >= 8) {
      r1 = cleanMid.substring(0, 4);
      for (let i = 0; i < 4; i++) {
        r2 += chars.charAt(Math.floor(Math.random() * chars.length));
      }
    } else {
      for (let i = 0; i < 4; i++) {
        r1 += chars.charAt(Math.floor(Math.random() * chars.length));
        r2 += chars.charAt(Math.floor(Math.random() * chars.length));
      }
    }
    return `VIDO-${tier.toUpperCase()}-${r1}-${r2}`;
  };

  const openCreateModal = () => {
    const randomKey = generateKeyForMachine('pro', '');
    setCreateForm({
      tier: 'pro',
      duration_days: 30,
      max_accounts: 10,
      max_concurrent_jobs: 3,
      notes: '',
      custom_key: randomKey,
      machine_id: '',
      customer_phone: '',
      customer_email: '',
    });
    setShowModal(true);
  };

  // Create Modal
  const [showModal, setShowModal] = useState<boolean>(false);
  const [createForm, setCreateForm] = useState({
    tier: 'pro',
    duration_days: 30,
    max_accounts: 10,
    max_concurrent_jobs: 3,
    notes: '',
    custom_key: '',
    machine_id: '',
    customer_phone: '',
    customer_email: '',
  });

  useEffect(() => {
    const saved = localStorage.getItem('vidomni_admin_token');
    if (saved) {
      setToken(saved);
      setIsLoggedIn(true);
      fetchKeys(saved);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem('vidomni_admin_token', password);
        setToken(password);
        setIsLoggedIn(true);
        fetchKeys(password);
      } else {
        setErrorMsg(data.message || 'Mật khẩu sai');
      }
    } catch (err: any) {
      setErrorMsg('Không thể kết nối đến máy chủ');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('vidomni_admin_token');
    setToken('');
    setIsLoggedIn(false);
    setKeys([]);
  };

  const getAuthToken = (explicitToken?: string): string => {
    return (
      explicitToken ||
      token ||
      (typeof window !== 'undefined' ? localStorage.getItem('vidomni_admin_token') : null) ||
      'admin123'
    );
  };

  const fetchKeys = async (authToken?: string) => {
    const activeToken = getAuthToken(authToken);
    setLoading(true);
    try {
      const res = await fetch('/api/admin/keys?t=' + Date.now(), {
        headers: {
          Authorization: `Bearer ${activeToken}`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
        },
        cache: 'no-store',
      });
      const data = await res.json();
      if (data.success) {
        setKeys(data.keys);
        setStats(data.stats);
      } else if (res.status === 401) {
        handleLogout();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const activeToken = getAuthToken();
    try {
      const res = await fetch('/api/admin/keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${activeToken}`,
        },
        body: JSON.stringify(createForm),
      });
      const data = await res.json();
      if (data.success) {
        const createdKey = data.license?.key || createForm.custom_key;
        setShowModal(false);
        setNewlyCreatedKey(createdKey);
        try {
          navigator.clipboard.writeText(createdKey);
        } catch {}
        setCreateForm({
          tier: 'pro',
          duration_days: 30,
          max_accounts: 10,
          max_concurrent_jobs: 3,
          notes: '',
          custom_key: '',
          machine_id: '',
          customer_phone: '',
          customer_email: '',
        });
        await fetchKeys(activeToken);
      } else {
        alert(data.message || 'Lỗi khi tạo key');
      }
    } catch (err: any) {
      alert('Lỗi: ' + err.message);
    }
  };

  const handleAction = async (key: string, action: string, days: number = 30) => {
    const activeToken = getAuthToken();
    const upperKey = key.trim().toUpperCase();

    // Optimistic UI updates
    if (action === 'delete') {
      setKeys((prev) => prev.filter((k) => k.key.toUpperCase() !== upperKey));
      setStats((prev) => ({ ...prev, total: Math.max(0, prev.total - 1) }));
    } else if (action === 'revoke') {
      setKeys((prev) =>
        prev.map((k) =>
          k.key.toUpperCase() === upperKey ? { ...k, status: 'revoked' as const } : k
        )
      );
      setStats((prev) => ({
        ...prev,
        active: Math.max(0, prev.active - 1),
        revoked: prev.revoked + 1,
      }));
    } else if (action === 'unban') {
      setKeys((prev) =>
        prev.map((k) =>
          k.key.toUpperCase() === upperKey ? { ...k, status: 'active' as const } : k
        )
      );
      setStats((prev) => ({
        ...prev,
        active: prev.active + 1,
        revoked: Math.max(0, prev.revoked - 1),
      }));
    } else if (action === 'reset_machine') {
      setKeys((prev) =>
        prev.map((k) =>
          k.key.toUpperCase() === upperKey ? { ...k, bound_machine_id: null } : k
        )
      );
    }

    try {
      const res = await fetch('/api/admin/keys/action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${activeToken}`,
        },
        body: JSON.stringify({ key: upperKey, action, days }),
      });
      const data = await res.json();
      if (!data.success) {
        alert(data.message || 'Lỗi thao tác');
      }
    } catch (err: any) {
      alert('Lỗi kết nối: ' + err.message);
    } finally {
      setTimeout(() => {
        fetchKeys(activeToken);
      }, 400);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(text);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Filter keys
  const filteredKeys = keys.filter((k) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      k.key.toLowerCase().includes(q) ||
      (k.bound_machine_id && k.bound_machine_id.toLowerCase().includes(q)) ||
      (k.notes && k.notes.toLowerCase().includes(q)) ||
      (k.customer_phone && k.customer_phone.toLowerCase().includes(q)) ||
      (k.customer_email && k.customer_email.toLowerCase().includes(q));

    if (!matchSearch) return false;

    if (statusFilter === 'all') return true;
    return k.status === statusFilter;
  });

  if (!isLoggedIn) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4 bg-[#0B0F19]">
        <div className="max-w-md w-full p-8 rounded-2xl bg-[#111827] border border-gray-800 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center mx-auto">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-bold text-white">Quản Trị Bản Quyền</h2>
            <p className="text-sm text-gray-400">VidOmni AI Studio Pro v2.0</p>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-gray-400 mb-2">
                Mật khẩu Quản Trị (Admin Password)
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu (mặc định: admin123)..."
                className="w-full px-4 py-3 rounded-xl bg-gray-900 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium transition-all shadow-lg shadow-blue-500/25"
            >
              Đăng Nhập Quản Trị
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0F19] text-gray-100 p-6 md:p-10 space-y-8">
      {/* Top Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              VidOmni License Manager
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400">
                Vercel Serverless
              </span>
            </h1>
            <p className="text-xs text-gray-400">
              Quản lý bản quyền Ed25519 & Khóa phần cứng Machine ID
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchKeys()}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm font-medium border border-gray-700 transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Làm Mới</span>
          </button>

          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-medium text-white shadow-lg shadow-blue-500/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Tạo Key Mới</span>
          </button>

          <button
            onClick={handleLogout}
            className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-red-400 border border-gray-700 transition-all"
            title="Đăng xuất"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Stats Cards */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-[#111827] border border-gray-800">
          <div className="text-xs font-semibold uppercase text-gray-400 mb-1">Tổng Số Key</div>
          <div className="text-3xl font-extrabold text-white">{stats.total}</div>
        </div>

        <div className="p-5 rounded-2xl bg-[#111827] border border-green-900/40 bg-green-950/10">
          <div className="text-xs font-semibold uppercase text-green-400 mb-1">Đang Kích Hoạt</div>
          <div className="text-3xl font-extrabold text-green-400">{stats.active}</div>
        </div>

        <div className="p-5 rounded-2xl bg-[#111827] border border-blue-900/40 bg-blue-950/10">
          <div className="text-xs font-semibold uppercase text-blue-400 mb-1">Chưa Dùng (Kho)</div>
          <div className="text-3xl font-extrabold text-blue-400">{stats.unused}</div>
        </div>

        <div className="p-5 rounded-2xl bg-[#111827] border border-red-900/40 bg-red-950/10">
          <div className="text-xs font-semibold uppercase text-red-400 mb-1">Bị Khóa / Hết Hạn</div>
          <div className="text-3xl font-extrabold text-red-400">{stats.revoked + stats.expired}</div>
        </div>
      </section>

      {/* Filter and Search Bar */}
      <section className="flex flex-col sm:flex-row gap-4 justify-between items-center">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
          <input
            type="text"
            placeholder="Tìm theo Key, Machine ID, Ghi chú..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-gray-900 border border-gray-700 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex gap-2 w-full sm:w-auto overflow-x-auto pb-1">
          {['all', 'active', 'unused', 'revoked', 'expired'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium uppercase transition-all ${
                statusFilter === st
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {st === 'all' ? 'Tất cả' : st}
            </button>
          ))}
        </div>
      </section>

      {/* License Keys Table */}
      <section className="rounded-2xl bg-[#111827] border border-gray-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="bg-gray-900/80 text-xs uppercase text-gray-400 border-b border-gray-800">
              <tr>
                <th className="py-4 px-5">Mã Bản Quyền (License Key)</th>
                <th className="py-4 px-3">Gói</th>
                <th className="py-4 px-3">Trạng Thái</th>
                <th className="py-4 px-4">Khách Hàng (SĐT / Email)</th>
                <th className="py-4 px-3">Mã Máy Đã Khóa</th>
                <th className="py-4 px-3">Hạn Dùng / Hết Hạn</th>
                <th className="py-4 px-3">Ghi Chú</th>
                <th className="py-4 px-5 text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {filteredKeys.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-500">
                    Chưa có mã bản quyền nào phù hợp. Bấm &quot;Tạo Key Mới&quot; để bắt đầu.
                  </td>
                </tr>
              ) : (
                filteredKeys.map((item) => (
                  <tr key={item.key} className="hover:bg-gray-800/30 transition-colors">
                    <td className="py-4 px-5 font-mono text-sm font-semibold text-white">
                      <div className="flex items-center gap-2">
                        <span>{item.key}</span>
                        <button
                          onClick={() => copyToClipboard(item.key)}
                          className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
                          title="Copy Key"
                        >
                          {copiedKey === item.key ? (
                            <Check className="w-3.5 h-3.5 text-green-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </td>

                    <td className="py-4 px-3">
                      <span
                        className={`text-xs px-2.5 py-1 rounded-full font-semibold uppercase ${
                          item.tier === 'vip'
                            ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                            : item.tier === 'pro'
                            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                            : 'bg-gray-700/50 text-gray-300'
                        }`}
                      >
                        {item.tier}
                      </span>
                    </td>

                    <td className="py-4 px-3">
                      {item.status === 'active' && (
                        <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>ACTIVE</span>
                        </span>
                      )}
                      {item.status === 'unused' && (
                        <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>CHƯA DÙNG</span>
                        </span>
                      )}
                      {item.status === 'revoked' && (
                        <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>ĐÃ KHÓA</span>
                        </span>
                      )}
                      {item.status === 'expired' && (
                        <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                          <Clock className="w-3.5 h-3.5" />
                          <span>HẾT HẠN</span>
                        </span>
                      )}
                    </td>

                    <td className="py-4 px-4">
                      {item.customer_phone || item.customer_email ? (
                        <div className="space-y-1">
                          {item.customer_phone && (
                            <div className="flex items-center gap-1.5" title={`SĐT: ${item.customer_phone}`}>
                              <Phone className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                              <a
                                href={`tel:${item.customer_phone}`}
                                className="font-mono text-xs font-bold text-blue-300 hover:underline hover:text-blue-200"
                              >
                                {item.customer_phone}
                              </a>
                              <button
                                onClick={() => copyToClipboard(item.customer_phone!)}
                                className="p-0.5 text-gray-500 hover:text-blue-300"
                                title="Copy Số điện thoại"
                              >
                                {copiedKey === item.customer_phone ? (
                                  <Check className="w-3 h-3 text-green-400" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          )}
                          {item.customer_email && (
                            <div className="flex items-center gap-1.5" title={`Email: ${item.customer_email}`}>
                              <Mail className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              <a
                                href={`mailto:${item.customer_email}`}
                                className="text-xs text-gray-300 hover:underline hover:text-white truncate max-w-[150px]"
                              >
                                {item.customer_email}
                              </a>
                              <button
                                onClick={() => copyToClipboard(item.customer_email!)}
                                className="p-0.5 text-gray-500 hover:text-emerald-300"
                                title="Copy Email"
                              >
                                {copiedKey === item.customer_email ? (
                                  <Check className="w-3 h-3 text-green-400" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-500 italic text-xs">Chưa có thông tin</span>
                      )}
                    </td>

                    <td className="py-4 px-4 font-mono text-xs">
                      {item.bound_machine_id ? (
                        <div className="flex items-center gap-1.5" title={item.bound_machine_id}>
                          <span className="p-1 rounded bg-blue-900/30 text-blue-400 border border-blue-800/40">
                            <Laptop className="w-3.5 h-3.5" />
                          </span>
                          <span className="text-gray-300 truncate max-w-[130px] font-mono text-[11px]">
                            {item.bound_machine_id}
                          </span>
                          <button
                            onClick={() => copyToClipboard(item.bound_machine_id || '')}
                            className="p-1 text-gray-500 hover:text-blue-400 transition-colors cursor-pointer"
                            title="Sao chép Mã Máy (Hardware ID)"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-gray-500 italic text-xs">Chưa khóa máy</span>
                      )}
                    </td>

                    <td className="py-4 px-4 text-xs text-gray-300">
                      <div>
                        {item.expires_at ? (
                          <>
                            <div className="font-medium text-white">
                              {new Date(item.expires_at).toLocaleDateString('vi-VN')}
                            </div>
                            <div className="text-gray-400">{item.duration_days} ngày</div>
                          </>
                        ) : (
                          <span>{item.duration_days} ngày (khi kích hoạt)</span>
                        )}
                      </div>
                    </td>

                    <td className="py-4 px-4 text-xs text-gray-400 max-w-xs truncate">
                      {item.notes || '—'}
                    </td>

                    <td className="py-4 px-6 text-right space-x-1">
                      {item.bound_machine_id && (
                        <button
                          onClick={() => {
                            if (confirm(`Reset mã máy cho key ${item.key}? Khách hàng sẽ có thể kích hoạt trên máy tính mới.`)) {
                              handleAction(item.key, 'reset_machine');
                            }
                          }}
                          className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white"
                          title="Reset Mã Máy (Đổi máy cho khách)"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <button
                        onClick={() => {
                          const days = prompt('Gia hạn thêm bao nhiêu ngày?', '30');
                          if (days && !isNaN(parseInt(days, 10))) {
                            handleAction(item.key, 'extend', parseInt(days, 10));
                          }
                        }}
                        className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white"
                        title="Gia hạn ngày sử dụng (+30 ngày)"
                      >
                        <CalendarPlus className="w-3.5 h-3.5" />
                      </button>

                      {item.status === 'revoked' ? (
                        <button
                          onClick={() => handleAction(item.key, 'unban')}
                          className="p-1.5 rounded-lg bg-gray-800 hover:bg-green-900/40 text-green-400"
                          title="Mở khóa Key"
                        >
                          <Unlock className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            if (confirm(`Bạn chắc chắn muốn KHÓA / THU HỒI quyền sử dụng của key ${item.key}?`)) {
                              handleAction(item.key, 'revoke');
                            }
                          }}
                          className="p-1.5 rounded-lg bg-gray-800 hover:bg-red-900/40 text-gray-400 hover:text-red-400"
                          title="Khóa / Thu hồi bản quyền"
                        >
                          <Lock className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <button
                        onClick={() => {
                          if (confirm(`Xóa vĩnh viễn key ${item.key}?`)) {
                            handleAction(item.key, 'delete');
                          }
                        }}
                        className="p-1.5 rounded-lg bg-gray-800 hover:bg-red-900/40 text-gray-400 hover:text-red-400"
                        title="Xóa Key"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Modal Tạo License Key */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg p-6 rounded-2xl bg-[#111827] border border-gray-800 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-gray-800">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-blue-400" />
                Tạo Mã Bản Quyền Mới
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4 text-sm">
              {/* Machine ID / Hardware ID Field */}
              <div className="p-4 rounded-xl bg-blue-950/30 border border-blue-500/40 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-blue-300 uppercase tracking-wide flex items-center gap-1.5">
                    <Laptop className="w-4 h-4 text-blue-400" />
                    <span>Mã Máy Tính Khách Hàng (Hardware ID / Machine ID)</span>
                  </label>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const clipText = await navigator.clipboard.readText();
                        const clean = clipText.trim();
                        if (clean) {
                          setCreateForm((prev) => ({
                            ...prev,
                            machine_id: clean,
                            custom_key: generateKeyForMachine(prev.tier, clean),
                          }));
                        }
                      } catch {}
                    }}
                    className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 cursor-pointer bg-blue-900/50 hover:bg-blue-800/60 px-2.5 py-1 rounded-lg border border-blue-600/40 transition-all"
                  >
                    📋 Dán Từ Clipboard
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="Dán Hardware ID khách gửi (Ví dụ: DA6FEAE6E42F6611...)"
                  value={createForm.machine_id}
                  onChange={(e) => {
                    const mid = e.target.value;
                    setCreateForm((prev) => ({
                      ...prev,
                      machine_id: mid,
                      custom_key: generateKeyForMachine(prev.tier, mid),
                    }));
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-gray-900 border border-gray-700 text-green-300 font-mono text-xs focus:outline-none focus:border-blue-400"
                />
                <p className="text-[11px] text-gray-400">
                  💡 Khách hàng mở phần mềm bấm <b>[Sao Chép]</b> mã máy rồi gửi cho bạn. Dán vào đây để hệ thống khóa cứng bản quyền cho máy đó (1 Máy - 1 Key).
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1">
                    Gói Bản Quyền (Tier)
                  </label>
                  <select
                    value={createForm.tier}
                    onChange={(e) => {
                      const newTier = e.target.value;
                      setCreateForm({
                        ...createForm,
                        tier: newTier,
                        custom_key: generateKeyForMachine(newTier, createForm.machine_id),
                      });
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-gray-900 border border-gray-700 text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="standard">Standard</option>
                    <option value="pro">Pro</option>
                    <option value="vip">VIP</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1">
                    Thời Hạn Sử Dụng
                  </label>
                  <select
                    value={createForm.duration_days}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, duration_days: parseInt(e.target.value, 10) })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-gray-900 border border-gray-700 text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="3">3 Ngày (Dùng thử Trial)</option>
                    <option value="30">30 Ngày (1 Tháng)</option>
                    <option value="90">90 Ngày (3 Tháng)</option>
                    <option value="365">365 Ngày (1 Năm)</option>
                    <option value="3650">Trọn Đời (Lifetime - 10 Năm)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1">
                    Số Nick Google Tối Đa
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="500"
                    value={createForm.max_accounts}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, max_accounts: parseInt(e.target.value, 10) })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-gray-900 border border-gray-700 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1">
                    Số Luồng Render Song Song
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={createForm.max_concurrent_jobs}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, max_concurrent_jobs: parseInt(e.target.value, 10) })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-gray-900 border border-gray-700 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-gray-400">
                    Mã Bản Quyền Sẽ Tạo (License Key)
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setCreateForm((prev) => ({
                        ...prev,
                        custom_key: generateKeyForMachine(prev.tier, prev.machine_id),
                      }))
                    }
                    className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1 cursor-pointer"
                  >
                    🔄 Đổi mã ngẫu nhiên khác
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="Ví dụ: VIDO-PRO-ABCD-1234"
                  value={createForm.custom_key}
                  onChange={(e) => setCreateForm({ ...createForm, custom_key: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-gray-900 border border-blue-500/60 text-green-400 font-mono font-bold tracking-wider text-base focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  💡 Hệ thống tự động sinh mã này theo mã máy tính của khách. Bạn có thể sửa trực tiếp nếu muốn.
                </p>
              </div>

              {/* Customer Contact Info (Phone & Email) */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1 flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-blue-400" />
                    <span>Số Điện Thoại Khách (Tùy chọn)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Ví dụ: 0987654321"
                    value={createForm.customer_phone}
                    onChange={(e) => setCreateForm({ ...createForm, customer_phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-gray-900 border border-gray-700 text-white font-mono text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1 flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5 text-green-400" />
                    <span>Email Khách (Tùy chọn)</span>
                  </label>
                  <input
                    type="email"
                    placeholder="khachhang@gmail.com"
                    value={createForm.customer_email}
                    onChange={(e) => setCreateForm({ ...createForm, customer_email: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-gray-900 border border-gray-700 text-white text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">
                  Ghi Chú Khách Hàng (Tên, SĐT, Zalo/Facebook, Giao dịch)
                </label>
                <textarea
                  rows={2}
                  placeholder="Ví dụ: Anh Nam MMO - Thanh toán qua VCB ngày 01/10..."
                  value={createForm.notes}
                  onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-gray-900 border border-gray-700 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="pt-3 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium shadow-lg shadow-blue-500/20"
                >
                  Tạo Mã Bản Quyền
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Thông Báo Key Tạo Thành Công */}
      {newlyCreatedKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-md p-6 rounded-2xl bg-[#111827] border-2 border-green-500/50 shadow-2xl shadow-green-500/20 space-y-5 text-center">
            <div className="w-14 h-14 mx-auto rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center text-green-400 text-3xl font-black">
              ✓
            </div>

            <div>
              <h3 className="text-xl font-extrabold text-white">Tạo Mã Bản Quyền Thành Công!</h3>
              <p className="text-xs text-gray-400 mt-1">
                Dưới đây là mã License Key bạn vừa tạo. Hãy sao chép và gửi cho khách hàng:
              </p>
            </div>

            <div className="p-4 rounded-xl bg-gray-900 border border-green-500/40">
              <div className="font-mono text-xl font-black text-green-400 tracking-wider select-all break-all">
                {newlyCreatedKey}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => copyToClipboard(newlyCreatedKey)}
                className="flex-1 py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-green-600/30 transition-all text-sm"
              >
                {copiedKey === newlyCreatedKey ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>✓ Đã Copy Vào Clipboard!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>📋 Sao Chép Mã Key Này</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setNewlyCreatedKey(null)}
                className="px-5 py-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium text-sm transition-all"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
