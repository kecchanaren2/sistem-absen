import AttendanceForm from './components/AttendanceForm';

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black font-sans">
      <main className="flex flex-col items-center justify-center min-h-screen p-3 sm:p-6 md:p-8">
        <AttendanceForm />
      </main>
    </div>
  );
}
