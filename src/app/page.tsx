import AttendanceForm from './components/AttendanceForm';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-100 via-slate-50 to-zinc-200 dark:from-zinc-950 dark:via-zinc-900 dark:to-black font-sans text-zinc-900 dark:text-zinc-100 flex flex-col justify-between selection:bg-blue-500 selection:text-white">
      {/* Background Subtle Ambient Glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-blue-500/10 dark:bg-blue-600/15 rounded-full blur-[120px]" />
      </div>

      <main className="relative z-10 flex-1 flex flex-col items-center justify-center p-3 sm:p-6 md:p-10 w-full">
        <AttendanceForm />
      </main>

      <footer className="relative z-10 py-4 text-center text-xs text-zinc-400 dark:text-zinc-500">
        © {new Date().getFullYear()} Presensi Online. All rights reserved.
      </footer>
    </div>
  );
}

