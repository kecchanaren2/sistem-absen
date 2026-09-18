import CertificateForm from '../components/CertificateForm';

export default function CertificatePage() {
  return (
    <div className="min-h-screen bg-[#f5ebe6] dark:bg-[#19110e] font-sans text-[#2c1e18] dark:text-[#f6ede8] flex flex-col justify-between selection:bg-orange-500 selection:text-white transition-colors duration-300 relative overflow-hidden">
      {/* Background Ambient Warm Glows */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-orange-500/15 dark:bg-orange-600/10 rounded-full blur-[140px]" />
        <div className="absolute top-1/3 -left-48 w-[400px] h-[400px] bg-amber-500/10 dark:bg-amber-700/8 rounded-full blur-[120px]" />
        <div className="absolute -bottom-32 right-1/4 w-[500px] h-[450px] bg-red-500/10 dark:bg-red-800/8 rounded-full blur-[130px]" />
      </div>

      <main className="relative z-10 flex-1 flex flex-col items-center justify-center p-3 sm:p-6 md:p-8 w-full max-w-xl mx-auto">
        <CertificateForm />
      </main>

      <footer className="relative z-10 py-5 text-center text-xs font-medium text-[#8f7e75] dark:text-[#9e8b81] tracking-wide">
        © 2026 Dies Natalis 64. All rights reserved.
      </footer>
    </div>
  );
}
