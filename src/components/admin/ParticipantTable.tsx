"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Search, ChevronDown, Download, ChevronLeft, ChevronRight, Plus, X, Trash2, Edit2, Loader2, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { generateAndDownloadCertificate } from "@/lib/certificate";
import { supabase } from "@/lib/supabase";

export type ParticipantDB = {
  id: string | number;
  name: string;
  email: string;
  peran: string;
  waktu_date: string;
  "NIM/NIP"?: string | null;
  nim_nip?: string | null;
};

function getInitials(name: string) {
  if (!name) return "??";
  return name.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase();
}

const PAGE_SIZE = 30;

export function ParticipantTable() {
  const [participants, setParticipants] = useState<ParticipantDB[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [isGeneratingCert, setIsGeneratingCert] = useState<string | number | null>(null);

  type SortField = "name" | "nim" | "peran" | "waktu_date";
  type SortOrder = "asc" | "desc" | null;
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>(null);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortOrder === "asc") setSortOrder("desc");
      else if (sortOrder === "desc") {
        setSortField(null);
        setSortOrder(null);
      }
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const renderSortHeader = (label: string, field: SortField) => {
    return (
      <th 
        className="px-6 py-4 font-bold cursor-pointer hover:bg-slate-50 transition-colors select-none group" 
        onClick={() => handleSort(field)}
      >
        <div className="flex items-center gap-1.5">
          {label}
          {sortField === field ? (
            sortOrder === "asc" ? (
              <ArrowUp className="w-3 h-3 text-indigo-500" />
            ) : (
              <ArrowDown className="w-3 h-3 text-indigo-500" />
            )
          ) : (
            <ArrowUpDown className="w-3 h-3 text-slate-300 group-hover:text-slate-400" />
          )}
        </div>
      </th>
    );
  };

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [formData, setFormData] = useState<Partial<ParticipantDB>>({});
  const [isSaving, setIsSaving] = useState(false);

  const fetchParticipants = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("attendance")
      .select("*")
      .order("id", { ascending: false });

    if (error) {
      console.error("Error fetching participants:", error);
    } else {
      setParticipants(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchParticipants();

    const channel = supabase
      .channel("attendance-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "attendance" },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const deletedId = payload.old.id;
            if (deletedId === undefined) {
              void fetchParticipants();
              return;
            }

            setParticipants((current) =>
              current.filter((participant) => String(participant.id) !== String(deletedId))
            );
            return;
          }

          const participant = payload.new as ParticipantDB;
          setParticipants((current) => {
            const existingIndex = current.findIndex(
              (item) => String(item.id) === String(participant.id)
            );

            if (existingIndex === -1) return [participant, ...current];

            const updated = [...current];
            updated[existingIndex] = participant;
            return updated;
          });
        }
      )
      .subscribe((status, error) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.error("Attendance realtime subscription failed:", error);
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchParticipants]);

  const handleOpenAdd = () => {
    setEditingId(null);
    setFormData({
      name: "",
      "NIM/NIP": "",
      email: "",
      peran: "Peserta Dosen",
      waktu_date: new Date().toISOString(),
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (p: ParticipantDB) => {
    setEditingId(p.id);
    setFormData({
      ...p,
      "NIM/NIP": p["NIM/NIP"] || p.nim_nip || "",
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    const payload = {
      name: formData.name,
      "NIM/NIP": formData["NIM/NIP"] || null,
      email: formData.email,
      peran: formData.peran,
      waktu_date: formData.waktu_date || new Date().toISOString(),
    };

    if (editingId) {
      // Update
      const { error } = await supabase
        .from("attendance")
        .update(payload)
        .eq("id", editingId);
        
      if (error) console.error("Error updating:", error);
    } else {
      // Insert
      const { error } = await supabase
        .from("attendance")
        .insert([payload]);
        
      if (error) console.error("Error inserting:", error);
    }
    
    setIsSaving(false);
    setIsModalOpen(false);
    fetchParticipants();
  };

  const handleDelete = async (id: string | number) => {
    if (confirm("Apakah Anda yakin ingin menghapus peserta ini?")) {
      const { error } = await supabase.from("attendance").delete().eq("id", id);
      if (error) console.error("Error deleting:", error);
      else fetchParticipants();
    }
  };

  const handleGenerateCertificate = async (participant: ParticipantDB) => {
    try {
      setIsGeneratingCert(participant.id);
      await generateAndDownloadCertificate(participant.name, participant.peran || "peserta_dosen");
    } catch (err) {
      console.error("Error generating certificate:", err);
      alert("Gagal mengunduh sertifikat: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsGeneratingCert(null);
    }
  };

  const filtered = participants.filter((p) => {
    const nimVal = p["NIM/NIP"] || p.nim_nip || "";
    return (
      p.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.email?.toLowerCase().includes(search.toLowerCase()) ||
      nimVal.toLowerCase().includes(search.toLowerCase()) ||
      p.peran?.toLowerCase().includes(search.toLowerCase())
    );
  }).sort((a, b) => {
    if (!sortField || !sortOrder) return 0;
    
    let valA = "";
    let valB = "";
    
    if (sortField === "name") {
      valA = a.name?.toLowerCase() || "";
      valB = b.name?.toLowerCase() || "";
    } else if (sortField === "nim") {
      valA = (a["NIM/NIP"] || a.nim_nip || "").toLowerCase();
      valB = (b["NIM/NIP"] || b.nim_nip || "").toLowerCase();
    } else if (sortField === "peran") {
      valA = a.peran?.toLowerCase() || "";
      valB = b.peran?.toLowerCase() || "";
    } else if (sortField === "waktu_date") {
      valA = a.waktu_date || "";
      valB = b.waktu_date || "";
    }
    
    if (valA < valB) return sortOrder === "asc" ? -1 : 1;
    if (valA > valB) return sortOrder === "asc" ? 1 : -1;
    return 0;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const handleSearchChange = (val: string) => {
    setSearch(val);
    setCurrentPage(1);
  };

  return (
    <div className="w-full relative min-h-[400px]">
      {/* Top Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 p-4 border-b border-slate-100">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Cari nama, NIM/NIP, email, peran..."
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
        </div>

        <button 
          onClick={handleOpenAdd}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Data</span>
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-100 text-[10px] uppercase tracking-wider text-slate-400 font-bold bg-white">
              {renderSortHeader("Nama", "name")}
              {renderSortHeader("NIM / NIP", "nim")}
              {renderSortHeader("Role / Peran", "peran")}
              {renderSortHeader("Waktu Absensi", "waktu_date")}
              <th className="px-6 py-4 font-bold">Status</th>
              <th className="px-6 py-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                  Memuat data dari Supabase...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-400 text-sm">
                  Tidak ada data peserta ditemukan.
                </td>
              </tr>
            ) : (
              paginated.map((p) => {
                const nimDisplay = p["NIM/NIP"] || p.nim_nip || "-";
                const isCurrentCertLoading = isGeneratingCert === p.id;
                return (
                  <tr key={p.id} className="bg-white hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 font-semibold text-xs shrink-0">
                          {getInitials(p.name)}
                        </div>
                        <div>
                          <div className="font-semibold text-sm text-slate-900">{p.name}</div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {p.email} <span className="mx-1">•</span> ID: {p.id}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-xs text-slate-700 bg-slate-100 px-2 py-1 rounded">
                        {nimDisplay}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 font-medium">
                      <span className="px-2.5 py-1 rounded-full text-xs bg-slate-100 text-slate-700 border border-slate-200">
                        {p.peran}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-sm text-slate-900">
                        {p.waktu_date ? new Date(p.waktu_date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "-"}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {p.waktu_date ? new Date(p.waktu_date).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) + " WITA" : "-"}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Tercatat
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleGenerateCertificate(p)}
                          disabled={isCurrentCertLoading}
                          className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-md text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm cursor-pointer disabled:opacity-50"
                          title="Unduh E-Sertifikat"
                        >
                          {isCurrentCertLoading ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                          ) : (
                            <Download className="w-3.5 h-3.5 text-slate-500" />
                          )}
                          <span>Sertifikat</span>
                        </button>
                        
                        {/* Action Menu (Edit / Delete) */}
                        <button 
                          onClick={() => handleOpenEdit(p)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors cursor-pointer"
                          title="Edit Peserta"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDelete(p.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                          title="Hapus Peserta"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-white rounded-b-2xl">
        <span className="text-[11px] font-medium text-slate-400">
          Menampilkan{" "}
          <span className="text-slate-700 font-semibold">
            {filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)}
          </span>
          {" "}dari{" "}
          <span className="text-slate-700 font-semibold">{filtered.length}</span>{" "}peserta
        </span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={safePage <= 1}
            className="p-1.5 border border-slate-200 rounded-md text-slate-400 hover:bg-slate-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Page number pills */}
          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((n) => n === 1 || n === totalPages || Math.abs(n - safePage) <= 1)
              .reduce<(number | "...")[]>((acc, n, idx, arr) => {
                if (idx > 0 && typeof arr[idx - 1] === "number" && (n as number) - (arr[idx - 1] as number) > 1) {
                  acc.push("...");
                }
                acc.push(n);
                return acc;
              }, [])
              .map((item, idx) =>
                item === "..." ? (
                  <span key={`ellipsis-${idx}`} className="px-1 text-[11px] text-slate-400">…</span>
                ) : (
                  <button
                    key={item}
                    onClick={() => setCurrentPage(item as number)}
                    className={`min-w-[28px] h-7 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                      safePage === item
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "border border-slate-200 text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    {item}
                  </button>
                )
              )}
          </div>

          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage >= totalPages}
            className="p-1.5 border border-slate-200 rounded-md text-slate-500 hover:bg-slate-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Modal for Add / Edit */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center mb-5 border-b border-slate-100 pb-3">
              <h3 className="font-semibold text-lg text-slate-900">
                {editingId ? "Edit Data Peserta" : "Tambah Peserta Baru"}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 p-1.5 rounded-full transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Nama Lengkap</label>
                <input
                  type="text" required
                  placeholder="Masukkan nama lengkap beserta gelar"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                  value={formData.name || ""}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">NIM / NIP</label>
                <input
                  type="text" placeholder="contoh: 198501012010121001"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-mono"
                  value={formData["NIM/NIP"] || formData.nim_nip || ""}
                  onChange={(e) => setFormData({ ...formData, "NIM/NIP": e.target.value, nim_nip: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Alamat Email</label>
                <input
                  type="email" required
                  placeholder="peserta@contoh.com"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                  value={formData.email || ""}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Peran / Role</label>
                <div className="relative">
                  <select
                    required
                    className="w-full appearance-none px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none bg-white text-slate-700 cursor-pointer pr-9"
                    value={formData.peran || "Peserta Dosen"}
                    onChange={(e) => setFormData({ ...formData, peran: e.target.value })}
                  >
                    <option value="peserta_dosen">Peserta Dosen</option>
                    <option value="peserta_tendik">Peserta Tendik</option>
                    <option value="peserta_mahasiswa">Peserta Mahasiswa</option>
                    <option value="panitia_dosen">Panitia Dosen</option>
                    <option value="panitia_mahasiswa">Panitia Mahasiswa</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Waktu Absensi</label>
                <input
                  type="text" required placeholder="ISO String (cth: 2026-10-15T08:00:00Z)"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-mono text-xs"
                  value={formData.waktu_date || ""}
                  onChange={(e) => setFormData({ ...formData, waktu_date: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                >
                  {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingId ? "Simpan Perubahan" : "Simpan Peserta"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
