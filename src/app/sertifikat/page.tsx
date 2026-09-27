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
    <div className="min-h-screen bg-[#f5ebe6] dark:bg-[#19110e] font-sans text-[#2c1e18] dark:text-[#f6ede8] flex flex-col justify-between selection:bg-orange-500 selection:text-white transition-colors duration-300 relative overflow-hidden">
      {/* Background Ambient Warm Glows */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-orange-500/15 dark:bg-orange-600/10 rounded-full blur-[140px]" />
        <div className="absolute top-1/3 -left-48 w-[400px] h-[400px] bg-amber-500/10 dark:bg-amber-700/8 rounded-full blur-[120px]" />
        <div className="absolute -bottom-32 right-1/4 w-[500px] h-[450px] bg-red-500/10 dark:bg-red-800/8 rounded-full blur-[130px]" />
      </div>

        <main className="relative z-10 flex-1 flex flex-col items-center justify-center p-3 sm:p-6 md:p-8 lg:p-12 w-full max-w-4xl mx-auto">
        {certificateIsOpen ? (
          <CertificateForm />
        ) : (
          <section className="w-full max-w-xl rounded-3xl bg-[#fcfaf8] dark:bg-[#241713] border border-[#ebdcd2] dark:border-[#3e2a21] p-8 sm:p-12 text-center shadow-2xl">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-orange-100 text-3xl dark:bg-orange-950/60">
              🔒
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#2c1e18] dark:text-[#f5ece7]">
              Portal Sertifikat Belum Dibuka
            </h1>
            <p className="mt-3 text-sm sm:text-base leading-relaxed text-[#7e695d] dark:text-[#b09d92]">
              Portal sertifikat akan dapat diakses mulai:
            </p>
            <p className="mt-2 font-bold text-orange-700 dark:text-orange-300">
              {getCertificateOpeningLabel()} WITA
            </p>
            <Link
              href="/"
              className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#04b077] px-4 py-3.5 text-sm font-bold text-white shadow-md shadow-[#04b077]/20 transition-all hover:bg-[#039967] active:scale-[0.98]"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Kembali ke Portal Absensi</span>
            </Link>
          </section>
        )}
      </main>

      <footer className="relative z-10 py-5 text-center text-xs font-medium text-[#8f7e75] dark:text-[#9e8b81] tracking-wide">
        © 2026 Dies Natalis 64. All rights reserved.
      </footer>
    </div>
  );
}
