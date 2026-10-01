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

  // Create Modal
  const [showModal, setShowModal] = useState<boolean>(false);
  const [createForm, setCreateForm] = useState({
    tier: 'pro',
    duration_days: 30,
    max_accounts: 10,
    max_concurrent_jobs: 3,
    notes: '',
    custom_key: '',
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

  const fetchKeys = async (authToken: string = token) => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/keys', {
        headers: { Authorization: `Bearer ${authToken}` },
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
    try {
      const res = await fetch('/api/admin/keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(createForm),
      });
      const data = await res.json();
      if (data.success) {
        setShowModal(false);
        setCreateForm({
          tier: 'pro',
          duration_days: 30,
          max_accounts: 10,
          max_concurrent_jobs: 3,
          notes: '',
          custom_key: '',
        });
        fetchKeys();
      } else {
        alert(data.message || 'Lỗi khi tạo key');
      }
    } catch (err: any) {
      alert('Lỗi: ' + err.message);
    }
  };

  const handleAction = async (key: string, action: string, days: number = 30) => {
    try {
      const res = await fetch('/api/admin/keys/action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ key, action, days }),
      });
      const data = await res.json();
      if (data.success) {
        fetchKeys();
      } else {
        alert(data.message);
      }
    } catch (err: any) {
      alert('Lỗi: ' + err.message);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(text);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Filter keys
  const filteredKeys = keys.filter((k) => {
    const matchSearch =
      k.key.toLowerCase().includes(search.toLowerCase()) ||
      (k.bound_machine_id && k.bound_machine_id.toLowerCase().includes(search.toLowerCase())) ||
      (k.notes && k.notes.toLowerCase().includes(search.toLowerCase()));

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
            onClick={() => setShowModal(true)}
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
                <th className="py-4 px-6">Mã Bản Quyền (License Key)</th>
                <th className="py-4 px-4">Gói (Tier)</th>
                <th className="py-4 px-4">Trạng Thái</th>
                <th className="py-4 px-4">Mã Máy Đã Khóa</th>
                <th className="py-4 px-4">Hạn Dùng / Hết Hạn</th>
                <th className="py-4 px-4">Ghi Chú Khách Hàng</th>
                <th className="py-4 px-6 text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {filteredKeys.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-500">
                    Chưa có mã bản quyền nào phù hợp. Bấm &quot;Tạo Key Mới&quot; để bắt đầu.
                  </td>
                </tr>
              ) : (
                filteredKeys.map((item) => (
                  <tr key={item.key} className="hover:bg-gray-800/30 transition-colors">
                    <td className="py-4 px-6 font-mono text-sm font-semibold text-white">
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

                    <td className="py-4 px-4">
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

                    <td className="py-4 px-4">
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

                    <td className="py-4 px-4 font-mono text-xs text-gray-400">
                      {item.bound_machine_id ? (
                        <div className="flex items-center gap-1.5">
                          <Laptop className="w-3.5 h-3.5 text-gray-400" />
                          <span>{item.bound_machine_id}</span>
                        </div>
                      ) : (
                        <span className="text-gray-500 italic">Chưa khóa máy</span>
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1">
                    Gói Bản Quyền (Tier)
                  </label>
                  <select
                    value={createForm.tier}
                    onChange={(e) => setCreateForm({ ...createForm, tier: e.target.value })}
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
                <label className="block text-xs font-semibold text-gray-400 mb-1">
                  Mã Tùy Chọn (Tự Đặt Hoặc Để Trống Tự Sinh)
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: VIDO-VIP-KHACHHANG01"
                  value={createForm.custom_key}
                  onChange={(e) => setCreateForm({ ...createForm, custom_key: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-gray-900 border border-gray-700 text-white focus:outline-none focus:border-blue-500"
                />
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
    </div>
  );
}
