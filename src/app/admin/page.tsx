"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { ParticipantTable } from "@/components/admin/ParticipantTable";
import { CertificateDesigner } from "@/components/admin/CertificateDesigner";
import { EventFormManager } from "@/components/admin/EventFormManager";
import {
  BarChart2,
  Users,
  Settings,
  LogOut,
  FileBadge,
  ClipboardList,
  TrendingUp,
  Clock,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Mail,
  ShieldCheck,
  Palette,
  ArrowLeft,
  Sliders,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import {
  getLocalEventConfig,
  fetchEventConfig,
  toggleAttendanceStatus,
  EventFormConfig,
} from "@/lib/event-config";

type Stats = {
  total: number;
  peserta: number;
  panitia: number;
};

// ─── Dashboard Overview Tab ──────────────────────────────────────────────────
function DashboardOverview({
  eventConfig,
  onToggleAttendance,
  isToggling,
}: {
  eventConfig: EventFormConfig;
  onToggleAttendance: () => void;
  isToggling: boolean;
}) {
  const [stats, setStats] = useState<Stats>({ total: 0, peserta: 0, panitia: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      const { data, error } = await supabase.from("attendance").select("peran");
      if (!error && data) {
        setStats({
          total: data.length,
          peserta: data.filter((d) => d.peran?.toLowerCase().includes("peserta")).length,
          panitia: data.filter((d) => d.peran?.toLowerCase().includes("panitia")).length,
        });
      }
      setLoading(false);
    };
    fetchStats();
  }, []);

  const cards = [
    {
      label: "Total Absensi",
      value: loading ? "..." : stats.total.toString(),
      sub: "Total kehadiran tercatat",
      icon: Users,
      color: "bg-indigo-600",
      ring: "ring-indigo-100",
    },
    {
      label: "Peserta",
      value: loading ? "..." : stats.peserta.toString(),
      sub: "Dosen, Tendik & Mahasiswa",
      icon: ClipboardList,
      color: "bg-amber-500",
      ring: "ring-amber-100",
    },
    {
      label: "Panitia",
      value: loading ? "..." : stats.panitia.toString(),
      sub: "Panitia Workshop",
      icon: FileBadge,
      color: "bg-emerald-500",
      ring: "ring-emerald-100",
    },
  ];

  const isOpen = eventConfig.is_attendance_open !== false;

  return (
    <div className="max-w-[1200px] mx-auto space-y-8 animate-in fade-in duration-200">
      {/* Page Header */}
      <div>
        <p className="text-xs font-bold text-indigo-600 tracking-widest uppercase mb-1">Ringkasan Sistem</p>
        <h2 className="text-3xl font-bold tracking-tight text-slate-900 mb-1">Dashboard Admin</h2>
        <p className="text-sm text-slate-500">Statistik dan kontrol data absensi workshop secara langsung.</p>
      </div>

      {/* Attendance Gate Status Card */}
      <div
        className={`p-6 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all shadow-sm ${
          isOpen
            ? "bg-emerald-50/70 border-emerald-200 text-emerald-950"
            : "bg-rose-50/70 border-rose-200 text-rose-950"
        }`}
      >
        <div className="flex items-center gap-4">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
              isOpen ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"
            }`}
          >
            {isOpen ? <Unlock className="w-6 h-6" /> : <Lock className="w-6 h-6" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base tracking-tight">
                Status Gerbang Absensi: {isOpen ? "DIBUKA" : "DITUTUP"}
              </span>
              <span
                className={`inline-block w-2.5 h-2.5 rounded-full ${
                  isOpen ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
                }`}
              />
            </div>
            <p className="text-xs text-slate-600 mt-1 max-w-xl">
              {isOpen
                ? "Gerbang aktif. Peserta dapat mengisi absensi secara langsung melalui portal utama."
                : `Gerbang dikunci. Peserta melihat pesan penutupan: "${
                    eventConfig.closed_message || "Absensi telah ditutup oleh Administrator."
                  }"`}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onToggleAttendance}
          disabled={isToggling}
          className={`shrink-0 px-4 py-2.5 rounded-xl text-xs font-bold transition-all border shadow-xs cursor-pointer flex items-center gap-2 ${
            isOpen
              ? "bg-rose-600 hover:bg-rose-700 text-white border-rose-600"
              : "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600"
          }`}
        >
          {isOpen ? (
            <>
              <Lock className="w-4 h-4" />
              <span>Tutup Absensi Sekarang</span>
            </>
          ) : (
            <>
              <Unlock className="w-4 h-4" />
              <span>Buka Kembali Absensi</span>
            </>
          )}
        </button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="bg-white p-6 rounded-2xl border border-slate-200 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] flex justify-between items-end hover:border-slate-300 transition-colors"
            >
              <div className="space-y-4">
                <div className={`w-11 h-11 rounded-xl ${card.color} text-white flex items-center justify-center shadow-sm ring-4 ${card.ring}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 mb-1">{card.label}</p>
                  <p className="text-3xl font-extrabold text-slate-900 tracking-tight">{card.value}</p>
                </div>
              </div>
              <div className="text-[11px] font-medium text-slate-400 pb-1">{card.sub}</div>
            </div>
          );
        })}
      </div>

      {/* Quick Info & Tips */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] p-6 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
            <TrendingUp className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <p className="font-semibold text-sm text-slate-900 mb-1">Manajemen Data Absensi</p>
            <p className="text-xs text-slate-500 leading-relaxed">
              Buka tab <span className="font-semibold text-indigo-600">Data Absensi</span> untuk meninjau seluruh data kehadiran peserta, mengubah atau menghapus data, serta mencetak e-sertifikat perorangan.
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] p-6 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
            <Palette className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <p className="font-semibold text-sm text-slate-900 mb-1">Editor Desain Sertifikat</p>
            <p className="text-xs text-slate-500 leading-relaxed">
              Buka tab <span className="font-semibold text-amber-600">Desain Sertifikat</span> untuk mengganti template gambar, mengatur koordinat posisi nama peserta, dan menyesuaikan warna teks secara visual.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Settings Tab ────────────────────────────────────────────────────────────
function SettingsTab({ user }: { user: User }) {
  return (
    <div className="max-w-[800px] mx-auto space-y-6 animate-in fade-in duration-200">
      <div>
        <p className="text-xs font-bold text-slate-400 tracking-widest uppercase mb-1">Profil & Pengaturan</p>
        <h2 className="text-3xl font-bold tracking-tight text-slate-900 mb-1">Pengaturan Akun</h2>
        <p className="text-sm text-slate-500">Kelola akun administrator sistem absensi.</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-4 pb-4 border-b border-slate-100">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-bold text-xl shadow-md">
            {(user.email || "A").substring(0, 2).toUpperCase()}
          </div>
          <div>
            <h3 className="font-bold text-base text-slate-900">{user.email}</h3>
            <p className="text-xs text-slate-500">Administrator Terverifikasi (Supabase Auth)</p>
            <div className="mt-1 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Sesi Aktif
            </div>
          </div>
        </div>

        <div className="space-y-3 pt-2 text-xs text-slate-600">
          <div className="flex justify-between py-2 border-b border-slate-100">
            <span className="font-medium text-slate-500">User ID</span>
            <span className="font-mono text-slate-800">{user.id}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-slate-100">
            <span className="font-medium text-slate-500">Login Terakhir</span>
            <span className="font-medium text-slate-800">
              {user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString("id-ID") : "-"}
            </span>
          </div>
          <div className="flex justify-between py-2">
            <span className="font-medium text-slate-500">Provider Autentikasi</span>
            <span className="font-medium text-indigo-600">Supabase Auth (Email & Password)</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Direct Login Fallback Page ───────────────────────────────────────────────
function AdminLoginPage({ onLogin }: { onLogin: (user: User) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (authError || !data.user) {
      setError(authError?.message || "Email atau password admin salah. Silakan coba lagi.");
      setLoading(false);
      return;
    }

    onLogin(data.user);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center p-4 font-sans antialiased relative">
      <div
        className="fixed inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(#ffffff 1px, transparent 1px), linear-gradient(90deg, #ffffff 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
      <div className="fixed top-1/4 left-1/3 w-96 h-96 bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-sm">
        {/* Back Link */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors mb-6 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Kembali ke Portal Absensi</span>
        </Link>

        {/* Logo */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-bold text-xl tracking-wider shadow-2xl shadow-indigo-500/30 mb-3">
            D64
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Admin Console</h1>
          <p className="text-xs text-slate-400 mt-0.5">Sistem Absensi & Sertifikat</p>
        </div>

        {/* Card */}
        <div className="bg-[#1a1c23] border border-[#2a2d36] rounded-2xl p-7 shadow-2xl">
          <div className="flex items-center gap-2 mb-5">
            <ShieldCheck className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Masuk sebagai Administrator
            </span>
          </div>

          {error && (
            <div className="mb-4 px-3.5 py-2.5 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400 flex items-center gap-2">
              <span className="shrink-0 font-bold">✕</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Email Admin</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="email"
                  required
                  placeholder="admin@example.com"
                  className="w-full pl-9 pr-4 py-2.5 bg-[#0f1117] border border-[#2a2d36] rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-all"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type={showPw ? "text" : "password"}
                  required
                  placeholder="••••••••"
                  className="w-full pl-9 pr-11 py-2.5 bg-[#0f1117] border border-[#2a2d36] rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-all"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-3 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-semibold text-sm rounded-xl transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? "Memproses..." : "Masuk ke Dashboard"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ─── Main Admin Shell ─────────────────────────────────────────────────────────
const navItems = [
  { id: "dashboard", label: "Dashboard", icon: BarChart2 },
  { id: "attendance", label: "Data Absensi", icon: Users },
  { id: "event_form", label: "Pengaturan Acara & Form", icon: Sliders },
  { id: "designer", label: "Desain Sertifikat", icon: Palette },
  { id: "settings", label: "Pengaturan", icon: Settings },
];

export default function AdminPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("attendance");
  const [eventConfig, setEventConfig] = useState<EventFormConfig>(() => getLocalEventConfig());
  const [isTogglingAttendance, setIsTogglingAttendance] = useState(false);
  const [toggleToast, setToggleToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setAuthLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    fetchEventConfig().then((cfg) => setEventConfig(cfg));
    const handleUpdate = () => {
      setEventConfig(getLocalEventConfig());
    };
    window.addEventListener("event_config_updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);

    return () => {
      listener.subscription.unsubscribe();
      window.removeEventListener("event_config_updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  const handleToggleAttendance = async () => {
    if (isTogglingAttendance) return;
    setIsTogglingAttendance(true);
    const currentOpen = eventConfig.is_attendance_open !== false;
    const nextOpen = !currentOpen;
    try {
      const res = await toggleAttendanceStatus(nextOpen);
      setEventConfig(res.config);
      setToggleToast({
        message: nextOpen ? "Gerbang absensi berhasil DIBUKA!" : "Gerbang absensi berhasil DITUTUP!",
        type: "success",
      });
      setTimeout(() => setToggleToast(null), 3500);
    } catch {
      setToggleToast({ message: "Gagal mengubah status absensi.", type: "error" });
      setTimeout(() => setToggleToast(null), 3500);
    } finally {
      setIsTogglingAttendance(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0f1117] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-bold text-sm animate-pulse">
            D64
          </div>
          <p className="text-slate-400 text-sm">Memeriksa session admin...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AdminLoginPage onLogin={setUser} />;
  }

  const userEmail = user.email || "admin";
  const userInitials = userEmail.substring(0, 2).toUpperCase();

  const breadcrumb: Record<string, string> = {
    dashboard: "Dashboard",
    attendance: "Data Absensi",
    event_form: "Pengaturan Acara & Form",
    designer: "Desain Sertifikat",
    settings: "Pengaturan",
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] text-slate-900 flex font-sans antialiased">
      {/* Sidebar Navigation */}
      <aside className="w-[260px] bg-[#1a1c23] border-r border-[#2a2d36] flex flex-col justify-between shrink-0 sticky top-0 h-screen text-slate-300">
        <div className="space-y-6 pt-6">
          {/* Logo / Brand Header */}
          <div className="flex items-center gap-3 px-6 pb-2">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-xs tracking-wider shadow-md">
              D64
            </div>
            <div>
              <h1 className="font-semibold text-sm text-white tracking-tight">Sistem Absensi</h1>
              <p className="text-[11px] text-slate-400">Admin Console</p>
            </div>
          </div>

          {/* Navigation Items */}
          <div className="px-4">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 px-3">
              Workspace
            </p>
            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer ${
                      isActive
                        ? "bg-[#252831] text-white border border-[#313540] shadow-sm"
                        : "text-slate-400 hover:text-slate-200 hover:bg-[#20222a]"
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-indigo-400" : "text-slate-500"}`} />
                    <span>{item.label}</span>
                    {item.id === "attendance" && (
                      <span className="ml-auto text-[10px] bg-indigo-600 text-white px-1.5 py-0.5 rounded-md font-semibold">
                        Live
                      </span>
                    )}
                    {item.id === "event_form" && (
                      <span className="ml-auto text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-1.5 py-0.5 rounded-md font-semibold">
                        Form
                      </span>
                    )}
                    {item.id === "designer" && (
                      <span className="ml-auto text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded-md font-semibold">
                        Visual
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Bottom: Back to Attendance + User Profile / Logout */}
        <div className="p-4 space-y-2">
          <Link
            href="/"
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-[#252831] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Kembali ke Portal Absensi</span>
          </Link>

          <button
            onClick={handleLogout}
            className="w-full p-3 rounded-xl hover:bg-red-500/10 hover:border-red-500/20 border border-transparent transition-colors cursor-pointer flex items-center justify-between group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-xs text-white shrink-0">
                {userInitials}
              </div>
              <div className="min-w-0 text-left">
                <p className="text-xs font-medium text-white truncate">{userEmail}</p>
                <p className="text-[10px] text-slate-400 truncate">Administrator</p>
              </div>
            </div>
            <LogOut className="w-4 h-4 text-slate-500 group-hover:text-red-400 shrink-0 transition-colors" />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Top Header Bar */}
        <header className="h-16 flex justify-between items-center bg-white px-8 border-b border-slate-200 shrink-0 sticky top-0 z-10">
          <div className="flex items-center text-xs font-medium text-slate-400">
            <span>Admin Console</span>
            <span className="mx-2 text-slate-300">›</span>
            <span className="text-slate-700 font-semibold">{breadcrumb[activeTab]}</span>
          </div>

          <div className="flex items-center gap-3 text-xs font-medium text-slate-400">
            {/* Quick Master Switch Buka/Tutup Absen */}
            <button
              type="button"
              onClick={handleToggleAttendance}
              disabled={isTogglingAttendance}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border shadow-xs cursor-pointer select-none ${
                eventConfig.is_attendance_open !== false
                  ? "bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100"
                  : "bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100 animate-pulse"
              }`}
              title={
                eventConfig.is_attendance_open !== false
                  ? "Klik untuk menutup gerbang absensi"
                  : "Klik untuk membuka kembali gerbang absensi"
              }
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  eventConfig.is_attendance_open !== false ? "bg-emerald-500" : "bg-rose-500"
                }`}
              />
              <span>
                {eventConfig.is_attendance_open !== false ? "ABSENSI BUKA" : "ABSENSI TUTUP"}
              </span>
              {eventConfig.is_attendance_open !== false ? (
                <Lock className="w-3.5 h-3.5 opacity-60 hover:opacity-100" />
              ) : (
                <Unlock className="w-3.5 h-3.5 opacity-60 hover:opacity-100" />
              )}
            </button>

            <div className="hidden sm:flex items-center gap-1.5 bg-emerald-50 text-emerald-600 px-2.5 py-1.5 rounded-lg border border-emerald-100">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-medium">Supabase Connected</span>
            </div>
            <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-xs shadow-sm">
              {userInitials}
            </div>
          </div>
        </header>

        {/* Floating Toast Notification */}
        {toggleToast && (
          <div className="fixed top-20 right-8 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
            <div
              className={`px-4 py-2.5 rounded-xl shadow-lg border text-xs font-bold flex items-center gap-2.5 ${
                toggleToast.type === "success"
                  ? "bg-slate-900 text-white border-slate-800"
                  : "bg-rose-600 text-white border-rose-700"
              }`}
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>{toggleToast.message}</span>
            </div>
          </div>
        )}

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-8">
          {activeTab === "dashboard" && (
            <DashboardOverview
              eventConfig={eventConfig}
              onToggleAttendance={handleToggleAttendance}
              isToggling={isTogglingAttendance}
            />
          )}
          {activeTab === "attendance" && (
            <div className="max-w-[1200px] mx-auto space-y-6">
              <div>
                <p className="text-xs font-bold text-indigo-600 tracking-widest uppercase mb-1">Database</p>
                <h2 className="text-3xl font-bold tracking-tight text-slate-900 mb-1">Data Absensi Peserta</h2>
                <p className="text-sm text-slate-500">Kelola dan tinjau seluruh data kehadiran peserta workshop secara langsung.</p>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
                <ParticipantTable />
              </div>
            </div>
          )}
          {activeTab === "event_form" && (
            <div className="max-w-[1200px] mx-auto">
              <EventFormManager />
            </div>
          )}
          {activeTab === "designer" && (
            <div className="max-w-[1200px] mx-auto">
              <CertificateDesigner />
            </div>
          )}
          {activeTab === "settings" && <SettingsTab user={user} />}
        </div>
      </main>
    </div>
  );
}
