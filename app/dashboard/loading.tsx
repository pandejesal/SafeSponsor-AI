export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-200">
      <div className="flex items-center gap-3">
        <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-zinc-400 text-sm">Loading dashboard...</span>
      </div>
    </div>
  );
}
