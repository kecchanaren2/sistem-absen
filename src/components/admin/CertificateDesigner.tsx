"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Upload,
  RotateCcw,
  Save,
  Download,
  Check,
  Sliders,
  Type,
  Image as ImageIcon,
  Palette,
  Eye,
  Loader2,
  Sparkles,
} from "lucide-react";
import {
  CertificateDesignConfig,
  DEFAULT_CERTIFICATE_CONFIG,
  getLocalCertificateConfig,
  saveLocalCertificateConfig,
  renderAndDownloadCanvas,
} from "@/lib/certificate";
import { supabase } from "@/lib/supabase";

const BUILT_IN_TEMPLATES = [
  { label: "Peserta Acara (Umum)", url: "/Peserta_Acara.png" },
  { label: "Peserta Acara (Dosen/Tendik)", url: "/Peserta_Acara_Dosen.png" },
  { label: "Panitia Acara (Mahasiswa)", url: "/Panitia_Acara.png" },
  { label: "Panitia Acara (Dosen)", url: "/Panitia_Acara_Dosen.png" },
  { label: "Peserta Pengabdian", url: "/Peserta_Pengabdian.png" },
  { label: "Relawan Pengabdian", url: "/Relawan_Pengabdian.png" },
];

const FONT_OPTIONS = [
  { label: "Times New Roman (Formal)", value: '"Times New Roman", Times, serif' },
  { label: "Georgia (Elegan)", value: 'Georgia, serif' },
  { label: "Arial (Modern Clean)", value: 'Arial, sans-serif' },
  { label: "Helvetica (Minimalis)", value: 'Helvetica, Arial, sans-serif' },
  { label: "Courier New (Monospace)", value: '"Courier New", Courier, monospace' },
];

export function CertificateDesigner() {
  const [config, setConfig] = useState<CertificateDesignConfig>(() => getLocalCertificateConfig());
  const [sampleName, setSampleName] = useState("Prof. Dr. I Wayan Sudana, S.T., M.T.");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [testingDownload, setTestingDownload] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load from Supabase on mount
  useEffect(() => {
    async function loadRemoteConfig() {
      try {
        const { data, error } = await supabase
          .from("certificate_settings")
          .select("*")
          .eq("id", "default")
          .maybeSingle();

        if (!error && data) {
          const remoteConfig: CertificateDesignConfig = {
            id: data.id,
            template_url: data.template_url || DEFAULT_CERTIFICATE_CONFIG.template_url,
            font_family: data.font_family || DEFAULT_CERTIFICATE_CONFIG.font_family,
            font_size: data.font_size || DEFAULT_CERTIFICATE_CONFIG.font_size,
            font_color: data.font_color || DEFAULT_CERTIFICATE_CONFIG.font_color,
            x_position: Number(data.x_position ?? DEFAULT_CERTIFICATE_CONFIG.x_position),
            y_position: Number(data.y_position ?? DEFAULT_CERTIFICATE_CONFIG.y_position),
            is_custom_enabled: data.is_custom_enabled ?? true,
          };
          setConfig(remoteConfig);
          saveLocalCertificateConfig(remoteConfig);
        }
      } catch (err) {
        console.warn("certificate_settings remote fetch fallback to local:", err);
      }
    }
    loadRemoteConfig();
  }, []);

  // Live Canvas Rendering
  useEffect(() => {
    let active = true;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      if (!active) return;
      canvas.width = img.width;
      canvas.height = img.height;

      // Draw background
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Draw text
      const x = canvas.width * config.x_position;
      const y = canvas.height * config.y_position;

      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = config.font_color;
      ctx.font = `bold ${config.font_size}px ${config.font_family}`;

      // Draw bounding box / crosshair guides in preview for clarity
      ctx.save();
      ctx.strokeStyle = "rgba(79, 70, 229, 0.4)";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      // horizontal guide
      ctx.beginPath();
      ctx.moveTo(x - 200, y);
      ctx.lineTo(x + 200, y);
      ctx.stroke();
      // center point
      ctx.fillStyle = "#4f46e5";
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Draw name text
      ctx.fillText(sampleName, x, y);
    };

    img.onerror = () => {
      if (!active) return;
      // Fallback empty canvas with placeholder
      canvas.width = 1200;
      canvas.height = 800;
      ctx.fillStyle = "#f1f5f9";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#64748b";
      ctx.font = "24px Arial";
      ctx.textAlign = "center";
      ctx.fillText("Gagal memuat template gambar sertifikat", canvas.width / 2, canvas.height / 2);
    };

    img.src = config.template_url || DEFAULT_CERTIFICATE_CONFIG.template_url;

    return () => {
      active = false;
    };
  }, [config, sampleName]);

  const showToast = (type: "success" | "error", text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 4000);
  };

  const handleCustomImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showToast("error", "File harus berupa gambar (PNG, JPG, WEBP).");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        setConfig((prev) => ({
          ...prev,
          template_url: dataUrl,
          is_custom_enabled: true,
        }));
        showToast("success", "Gambar template berhasil dimuat!");
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveConfig = async () => {
    setSaving(true);
    // 1. Simpan ke local storage
    saveLocalCertificateConfig(config);

    // 2. Simpan ke Supabase certificate_settings
    try {
      const { error } = await supabase.from("certificate_settings").upsert({
        id: "default",
        template_url: config.template_url.startsWith("data:") ? config.template_url.slice(0, 2000) : config.template_url,
        font_family: config.font_family,
        font_size: config.font_size,
        font_color: config.font_color,
        x_position: config.x_position,
        y_position: config.y_position,
        is_custom_enabled: config.is_custom_enabled,
        updated_at: new Date().toISOString(),
      });

      if (error) {
        console.warn("Supabase upsert certificate_settings note:", error.message);
        showToast("success", "Desain disimpan di penyimpanan browser lokal!");
      } else {
        showToast("success", "Desain sertifikat berhasil disimpan secara terpusat di Supabase!");
      }
    } catch {
      showToast("success", "Desain disimpan di penyimpanan browser lokal!");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (confirm("Kembalikan pengaturan desain sertifikat ke default bawaan sistem?")) {
      setConfig(DEFAULT_CERTIFICATE_CONFIG);
      saveLocalCertificateConfig(DEFAULT_CERTIFICATE_CONFIG);
      showToast("success", "Desain dikembalikan ke default.");
    }
  };

  const handleTestDownload = async () => {
    setTestingDownload(true);
    try {
      await renderAndDownloadCanvas(sampleName, config.template_url, {
        fontFamily: config.font_family,
        fontSize: config.font_size,
        fontColor: config.font_color,
        xPosRatio: config.x_position,
        yPosRatio: config.y_position,
        fileNameSuffix: "Contoh",
      });
      showToast("success", "Contoh sertifikat berhasil diunduh!");
    } catch (err) {
      showToast("error", "Gagal mengunduh: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setTestingDownload(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast */}
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
            <span className="text-xs font-bold text-indigo-600 tracking-wider uppercase">Visual Editor</span>
            <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-bold">Live Preview</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Kustomisasi Desain Sertifikat</h2>
          <p className="text-sm text-slate-500">
            Atur template background, posisi nama peserta, ukuran font, dan warna secara visual.
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
            onClick={handleSaveConfig}
            disabled={saving}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-md shadow-indigo-500/20 transition-all cursor-pointer disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>Simpan Desain</span>
          </button>
        </div>
      </div>

      {/* Grid: Preview & Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Canvas Live Preview (7 cols) */}
        <div className="lg:col-span-7 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-indigo-600" />
              <span className="text-sm font-bold text-slate-800">Live Canvas Preview</span>
            </div>
            <button
              onClick={handleTestDownload}
              disabled={testingDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              {testingDownload ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              <span>Unduh Contoh</span>
            </button>
          </div>

          {/* Canvas Wrapper */}
          <div className="relative w-full aspect-[16/10] bg-slate-900/5 rounded-xl overflow-hidden border border-slate-200 flex items-center justify-center">
            <canvas
              ref={canvasRef}
              className="max-w-full max-h-full object-contain shadow-md rounded"
            />
          </div>

          {/* Sample Name Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Contoh Nama Peserta (Untuk Preview):
            </label>
            <input
              type="text"
              value={sampleName}
              onChange={(e) => setSampleName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              placeholder="Masukkan nama contoh..."
            />
          </div>
        </div>

        {/* Right: Controls & Sliders (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Activate Custom Switch */}
          <div className="bg-indigo-50/60 border border-indigo-100 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-indigo-900">Aktifkan Desain Kustom</p>
              <p className="text-[11px] text-indigo-700">Terapkan desain ini pada semua unduhan sertifikat</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={config.is_custom_enabled ?? false}
                onChange={(e) => setConfig((prev) => ({ ...prev, is_custom_enabled: e.target.checked }))}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          {/* Template Selection */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <ImageIcon className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-800">Template Background</h3>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Pilih Template Bawaan:</label>
              <select
                value={config.template_url}
                onChange={(e) => setConfig((prev) => ({ ...prev, template_url: e.target.value }))}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 cursor-pointer"
              >
                {BUILT_IN_TEMPLATES.map((tmpl) => (
                  <option key={tmpl.url} value={tmpl.url}>
                    {tmpl.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="pt-2">
              <p className="text-xs font-semibold text-slate-600 mb-1.5">Atau Upload Gambar Baru:</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleCustomImageUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-dashed border-indigo-200 hover:border-indigo-400 bg-indigo-50/30 hover:bg-indigo-50/60 rounded-xl text-xs font-bold text-indigo-700 transition-colors cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>Upload Template Custom (.PNG / .JPG)</span>
              </button>
            </div>
          </div>

          {/* Typography & Position Controls */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <Sliders className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-800">Posisi & Tipografi Teks</h3>
            </div>

            {/* Slider Posisi Y (Vertikal) */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-slate-600">Posisi Vertikal (Y):</span>
                <span className="font-mono font-bold text-indigo-600">{Math.round(config.y_position * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="0.9"
                step="0.005"
                value={config.y_position}
                onChange={(e) => setConfig((prev) => ({ ...prev, y_position: parseFloat(e.target.value) }))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>Atas</span>
                <span>Bawah</span>
              </div>
            </div>

            {/* Slider Posisi X (Horizontal) */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-slate-600">Posisi Horizontal (X):</span>
                <span className="font-mono font-bold text-indigo-600">{Math.round(config.x_position * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="0.9"
                step="0.005"
                value={config.x_position}
                onChange={(e) => setConfig((prev) => ({ ...prev, x_position: parseFloat(e.target.value) }))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>Kiri</span>
                <span>Tengah (50%)</span>
                <span>Kanan</span>
              </div>
            </div>

            {/* Font Size Slider */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-slate-600">Ukuran Font:</span>
                <span className="font-mono font-bold text-indigo-600">{config.font_size} px</span>
              </div>
              <input
                type="range"
                min="18"
                max="90"
                step="1"
                value={config.font_size}
                onChange={(e) => setConfig((prev) => ({ ...prev, font_size: parseInt(e.target.value, 10) }))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
            </div>

            {/* Font Family */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Jenis Huruf (Font):</label>
              <select
                value={config.font_family}
                onChange={(e) => setConfig((prev) => ({ ...prev, font_family: e.target.value }))}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 cursor-pointer"
              >
                {FONT_OPTIONS.map((font) => (
                  <option key={font.value} value={font.value}>
                    {font.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Font Color */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Warna Teks Nama:</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={config.font_color}
                  onChange={(e) => setConfig((prev) => ({ ...prev, font_color: e.target.value }))}
                  className="w-10 h-10 p-0 border border-slate-200 rounded-lg cursor-pointer bg-white"
                />
                <input
                  type="text"
                  value={config.font_color}
                  onChange={(e) => setConfig((prev) => ({ ...prev, font_color: e.target.value }))}
                  className="w-28 px-3 py-2 font-mono text-sm uppercase bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                  maxLength={7}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
