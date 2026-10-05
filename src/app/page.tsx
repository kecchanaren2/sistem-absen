import AttendanceForm from './components/AttendanceForm';

export default function Home() {
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
        <AttendanceForm />
      </main>

      <footer className="relative z-10 py-5 text-center text-xs font-medium text-[#75778f] dark:text-[#7f88a3] tracking-wide">
        Ac 2026 Workshop Penyusunan Standar Pelayanan. All rights reserved.
      </footer>
    </div>
  );
}
