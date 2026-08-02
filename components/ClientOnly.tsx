'use client';
import { useEffect, useState } from 'react';

export default function ClientOnly({ children }: { children: React.ReactNode }) {
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  if (!hasMounted) {
    return <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">Loading...</div>;
  }

  return <>{children}</>;
}
