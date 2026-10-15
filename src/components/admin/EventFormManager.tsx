"use client";

import React, { useState, useEffect } from "react";
import {
  LayoutTemplate,
  Users,
  Plus,
  Trash2,
  Save,
  RotateCcw,
  Check,
  Sliders,
  CheckSquare,
  Square,
  Edit2,
  FileText,
  Loader2,
  Info,
} from "lucide-react";
import {
  EventFormConfig,
  DynamicRole,
  DEFAULT_EVENT_CONFIG,
  DEFAULT_FORM_FIELDS,
  getLocalEventConfig,
  fetchEventConfig,
  saveEventConfig,
} from "@/lib/event-config";

export function EventFormManager() {
  const [config, setConfig] = useState<EventFormConfig>(() => getLocalEventConfig());
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Modal / form tambah peran baru
  const [showAddRoleModal, setShowAddRoleModal] = useState(false);
  const [newRoleLabel, setNewRoleLabel] = useState("");
  const [newRoleCategory, setNewRoleCategory] = useState<"Peserta" | "Panitia" | "Lainnya">("Peserta");

  useEffect(() => {
    async function loadConfig() {
      const remoteConfig = await fetchEventConfig();
      setConfig(remoteConfig);
      if (remoteConfig.roles && remoteConfig.roles.length > 0) {
        setSelectedRoleId(remoteConfig.roles[0].id);
      }
    }
    loadConfig();
  }, []);

  const showToast = (type: "success" | "error", text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 4000);
  };

  const selectedRole = config.roles.find((r) => r.id === selectedRoleId) || config.roles[0];

  const handleAddRole = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleLabel.trim()) return;

    // Generate unique slug-like ID
    const rawId = newRoleLabel.toLowerCase().replace(/[^a-z0-9]/g, "_");
    const uniqueId = config.roles.some((r) => r.id === rawId)
      ? `${rawId}_${Date.now().toString().slice(-4)}`
      : rawId;

    const newRole: DynamicRole = {
      id: uniqueId,
      label: newRoleLabel.trim(),
      category: newRoleCategory,
      fields: JSON.parse(JSON.stringify(DEFAULT_FORM_FIELDS)),
    };

    const updatedRoles = [...config.roles, newRole];
    setConfig((prev) => ({ ...prev, roles: updatedRoles }));
    setSelectedRoleId(uniqueId);
    setNewRoleLabel("");
    setShowAddRoleModal(false);
    showToast("success", `Peran "${newRole.label}" berhasil ditambahkan!`);
  };

  const handleDeleteRole = (id: string, label: string) => {
    if (config.roles.length <= 1) {
      showToast("error", "Harus ada minimal satu peran aktif di sistem.");
      return;
    }
    if (confirm(`Yakin ingin menghapus peran "${label}"?`)) {
      const updatedRoles = config.roles.filter((r) => r.id !== id);
      setConfig((prev) => ({ ...prev, roles: updatedRoles }));
      if (selectedRoleId === id) {
        setSelectedRoleId(updatedRoles[0].id);
      }
      showToast("success", `Peran "${label}" dihapus.`);
    }
  };

  const handleToggleFieldEnabled = (fieldId: string) => {
    if (!selectedRole) return;
    const updatedRoles = config.roles.map((r) => {
      if (r.id !== selectedRole.id) return r;
      return {
        ...r,
        fields: r.fields.map((f) => {
          if (f.id !== fieldId) return f;
          const nextEnabled = !f.enabled;
          return {
            ...f,
            enabled: nextEnabled,
            // Jika disabled, matikan juga required-nya
            required: nextEnabled ? f.required : false,
          };
        }),
      };
    });
    setConfig((prev) => ({ ...prev, roles: updatedRoles }));
  };

  const handleToggleFieldRequired = (fieldId: string) => {
    if (!selectedRole) return;
    const updatedRoles = config.roles.map((r) => {
      if (r.id !== selectedRole.id) return r;
      return {
        ...r,
        fields: r.fields.map((f) => {
          if (f.id !== fieldId) return f;
          return { ...f, required: !f.required };
        }),
      };
    });
    setConfig((prev) => ({ ...prev, roles: updatedRoles }));
  };

  const handleUpdateFieldLabel = (fieldId: string, customLabel: string) => {
    if (!selectedRole) return;
    const updatedRoles = config.roles.map((r) => {
      if (r.id !== selectedRole.id) return r;
      return {
        ...r,
        fields: r.fields.map((f) => {
          if (f.id !== fieldId) return f;
          return { ...f, label: customLabel };
        }),
      };
    });
    setConfig((prev) => ({ ...prev, roles: updatedRoles }));
  };

  const handleSave = async () => {
    setSaving(true);
    const res = await saveEventConfig(config);
    setSaving(false);
    showToast(res.success ? "success" : "error", res.message);
  };

  const handleReset = () => {
    if (confirm("Kembalikan seluruh teks acara dan daftar peran ke konfigurasi bawaan workshop?")) {
      setConfig(DEFAULT_EVENT_CONFIG);
      if (DEFAULT_EVENT_CONFIG.roles.length > 0) {
        setSelectedRoleId(DEFAULT_EVENT_CONFIG.roles[0].id);
      }
      saveEventConfig(DEFAULT_EVENT_CONFIG);
      showToast("success", "Pengaturan dikembalikan ke default.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toast && (
        <div
          className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium shadow-md border animate-in fade-in slide-in-from-top-2 duration-200 ${
            toast.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          {toast.type === "success" ? <Check className="w-4 h-4" /> : "✕"}
          <span>{toast.text}</span>
        </div>
      )}

      {/* Header Info */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-indigo-600 tracking-wider uppercase">Event & Form Builder</span>
            <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-bold">Dinamis</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Pengaturan Acara & Formulir</h2>
          <p className="text-sm text-slate-500">
            Sesuaikan identitas acara, kelola peran peserta, dan tentukan kolom isian formulir yang diperlukan.
          </p>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto">
          <button
            onClick={handleReset}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-semibold transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reset Default</span>
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-md shadow-indigo-500/20 transition-all cursor-pointer disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>Simpan Pengaturan</span>
          </button>
        </div>
      </div>

      {/* Grid: 2 Kolom (Kiri: Identitas Acara & List Peran, Kanan: Form Field Builder) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Kolom Kiri: Info Acara & Roles (5 Kolom) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Card 1: Identitas Acara */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <LayoutTemplate className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-800">Identitas & Tampilan Acara</h3>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Judul Banner Portal:</label>
              <input
                type="text"
                value={config.portal_title}
                onChange={(e) => setConfig({ ...config, portal_title: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                placeholder="PORTAL ABSENSI"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Nama Acara / Kegiatan:</label>
              <input
                type="text"
                value={config.event_name}
                onChange={(e) => setConfig({ ...config, event_name: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                placeholder="Workshop Penyusunan Standar Pelayanan"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Teks Footer:</label>
              <input
                type="text"
                value={config.footer_text}
                onChange={(e) => setConfig({ ...config, footer_text: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 font-mono"
                placeholder="Ac 2026 Workshop Penyusunan Standar Pelayanan. All rights reserved."
              />
            </div>
          </div>

          {/* Card 2: Manajemen Peran */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-800">Daftar Peran Peserta</h3>
              </div>
              <button
                onClick={() => setShowAddRoleModal(true)}
                className="flex items-center gap-1 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Peran</span>
              </button>
            </div>

            <div className="space-y-2">
              {config.roles.map((r) => {
                const isSelected = selectedRole?.id === r.id;
                return (
                  <div
                    key={r.id}
                    onClick={() => setSelectedRoleId(r.id)}
                    className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                      isSelected
                        ? "bg-indigo-50/60 border-indigo-400 ring-2 ring-indigo-500/20 text-indigo-900"
                        : "bg-white border-slate-200 hover:border-slate-300 text-slate-700"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-2 h-2 rounded-full ${isSelected ? "bg-indigo-600" : "bg-slate-300"}`}
                      />
                      <div>
                        <p className="text-sm font-bold">{r.label}</p>
                        <span className="text-[10px] uppercase font-bold text-slate-400">{r.category}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleDeleteRole(r.id, r.label)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        title="Hapus Peran"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Kolom Kanan: Field Builder per Peran (7 Kolom) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-3 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-indigo-600" />
                  <h3 className="text-base font-bold text-slate-900">
                    Form Builder: <span className="text-indigo-600">{selectedRole?.label || "Peran"}</span>
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tentukan kolom input apa saja yang harus diisi ketika peserta memilih peran ini.
                </p>
              </div>
              <span className="text-xs px-2.5 py-1 bg-slate-100 text-slate-600 font-semibold rounded-md">
                {selectedRole?.fields.filter((f) => f.enabled).length} Field Aktif
              </span>
            </div>

            {/* List Field */}
            <div className="space-y-3.5">
              {selectedRole?.fields.map((field) => (
                <div
                  key={field.id}
                  className={`p-4 rounded-xl border transition-all ${
                    field.enabled
                      ? "bg-white border-slate-200 shadow-xs"
                      : "bg-slate-50/70 border-dashed border-slate-200 opacity-60"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3 mb-2.5">
                    {/* Toggle Aktif */}
                    <div
                      onClick={() => handleToggleFieldEnabled(field.id)}
                      className="flex items-center gap-2.5 cursor-pointer select-none"
                    >
                      {field.enabled ? (
                        <CheckSquare className="w-5 h-5 text-indigo-600" />
                      ) : (
                        <Square className="w-5 h-5 text-slate-300" />
                      )}
                      <div>
                        <span className="text-sm font-bold text-slate-800">{field.label}</span>
                        <span className="text-[11px] font-mono text-slate-400 ml-2">({field.id})</span>
                      </div>
                    </div>

                    {/* Toggle Wajib (Required) */}
                    {field.enabled && (
                      <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 cursor-pointer select-none bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200">
                        <input
                          type="checkbox"
                          checked={field.required}
                          onChange={() => handleToggleFieldRequired(field.id)}
                          className="rounded text-indigo-600 focus:ring-0 cursor-pointer"
                        />
                        <span>Wajib Diisi</span>
                      </label>
                    )}
                  </div>

                  {/* Pengaturan Label & Placeholder jika aktif */}
                  {field.enabled && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                          Label Teks di Form:
                        </label>
                        <input
                          type="text"
                          value={field.label}
                          onChange={(e) => handleUpdateFieldLabel(field.id, e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                          Placeholder:
                        </label>
                        <input
                          type="text"
                          value={field.placeholder || ""}
                          disabled
                          className="w-full px-2.5 py-1.5 bg-slate-100/60 border border-slate-200 rounded-lg text-xs text-slate-400 cursor-not-allowed"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Modal Tambah Peran Baru */}
      {showAddRoleModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="font-bold text-base text-slate-900 mb-4 pb-2 border-b border-slate-100">
              Tambah Peran Baru
            </h3>
            <form onSubmit={handleAddRole} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Nama Peran / Label:
                </label>
                <input
                  type="text"
                  required
                  placeholder="Misal: Tamu Undangan, Peserta Mahasiswa"
                  value={newRoleLabel}
                  onChange={(e) => setNewRoleLabel(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Kategori Peran:
                </label>
                <select
                  value={newRoleCategory}
                  onChange={(e) => setNewRoleCategory(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 bg-white"
                >
                  <option value="Peserta">Peserta</option>
                  <option value="Panitia">Panitia</option>
                  <option value="Lainnya">Lainnya</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddRoleModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  Tambah Peran
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
