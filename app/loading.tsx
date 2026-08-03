import { Navbar } from '@/components/Navbar';

export default function Loading() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-200">
      <Navbar />
      <main className="flex items-center justify-center py-32 px-4">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-zinc-400 text-sm">Loading...</span>
        </div>
      </main>
    </div>
  );
}
