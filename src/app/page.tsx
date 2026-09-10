import AttendanceForm from './components/AttendanceForm';

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black font-sans">
      <main className="flex flex-col items-center justify-center min-h-screen p-4 sm:p-8">
        <div className="w-full max-w-5xl mx-auto flex flex-col lg:flex-row items-center gap-12">

          <div className="flex-1 text-center lg:text-left space-y-6">
            <h1 className="text-5xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
              Sistem Absensi <span className="text-blue-600 dark:text-blue-500">Digital</span>
            </h1>
            <p className="text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto lg:mx-0">
              Absensi mudah, aman, dan tanpa repot. Sistem ini dilengkapi dengan keamanan geofencing dan verifikasi perangkat untuk mencegah kecurangan. Dapatkan E-Certificate secara otomatis setelah menyelesaikan absensi hari ke-2.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 text-sm text-zinc-500 dark:text-zinc-400">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                Build a ring farm
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                Device Binding
              </div>
            </div>
          </div>

          <div className="flex-1 w-full max-w-md lg:max-w-none">
            <AttendanceForm />
          </div>

        </div>
      </main>
    </div>
  );
}
