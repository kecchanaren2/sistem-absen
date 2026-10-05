import CertificateForm from '../components/CertificateForm';
import {
  getCertificateOpeningLabel,
  isCertificateOpen,
} from '@/lib/certificate-access';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default function CertificatePage() {
  const certificateIsOpen = isCertificateOpen();

  return (
    <div className="min-h-screen bg-[#e6e7f5] dark:bg-[#0d1122] font-sans text-[#18192c] dark:text-[#f1f3fd] flex flex-col justify-between selection:bg-[#0066ff] selection:text-white transition-colors duration-200 relative overflow-hidden">
      {/* Subtle lightweight gradient background without GPU-heavy CSS blurs */}
      <div 
        className="fixed inset-0 pointer-events-none z-0 opacity-40 dark:opacity-20"
        style={{
          backgroundImage: 'radial-gradient(circle at 50% 0%, rgba(76, 149, 230, 0.25) 0%, transparent 70%)'
        }}
      />

      <main className="relative z-10 flex-1 flex flex-col items-center justify-center p-3 sm:p-6 md:p-8 lg:p-12 w-full max-w-4xl mx-auto">
        {certificateIsOpen ? (
          <CertificateForm />
        ) : (
          <section className="w-full max-w-xl rounded-3xl bg-[#f8f8fc] dark:bg-[#14182b] border border-[#d2d4eb] dark:border-[#262d49] p-8 sm:p-12 text-center shadow-xl">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-3xl dark:bg-blue-950/60">
              🔒
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#18192c] dark:text-[#f1f3fd]">
              Portal Sertifikat Belum Dibuka
            </h1>
            <p className="mt-3 text-sm sm:text-base leading-relaxed text-[#5d5f7e] dark:text-[#9aa0c2]">
              Portal sertifikat akan dapat diakses mulai:
            </p>
            <p className="mt-2 font-bold text-[#0467ff] dark:text-[#60a5fa]">
              {getCertificateOpeningLabel()} WITA
            </p>
            <Link
              href="/"
              className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#0066ff] hover:bg-[#0052cc] px-4 py-3.5 text-sm font-bold text-white shadow-md shadow-blue-500/20 transition-all active:scale-[0.98]"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Kembali ke Portal Absensi</span>
            </Link>
          </section>
        )}
      </main>

      <footer className="relative z-10 py-5 text-center text-xs font-medium text-[#75778f] dark:text-[#7f88a3] tracking-wide">
        Ac 2026 Workshop Penyusunan Standar Pelayanan. All rights reserved.
      </footer>
    </div>
  );
}
