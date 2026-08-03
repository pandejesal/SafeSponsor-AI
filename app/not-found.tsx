import Link from 'next/link';
import { Navbar } from '@/components/Navbar';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-200">
      <Navbar />
      <main className="flex items-center justify-center py-32 px-4">
        <div className="max-w-md text-center space-y-6">
          <p className="text-6xl font-black text-zinc-800">404</p>
          <h1 className="text-2xl font-bold">Page Not Found</h1>
          <p className="text-zinc-400">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
          <Link
            href="/"
            className="inline-block px-6 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-medium transition-colors"
          >
            Back to Home
          </Link>
        </div>
      </main>
    </div>
  );
}
