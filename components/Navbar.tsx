'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { ShieldAlert, Sun, Moon, ArrowRight, Menu, X, LayoutDashboard, LogOut } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import { useAuth } from '@/components/AuthProvider';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export function Navbar() {
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const handleSignOut = async () => {
    try {
      if (auth) {
        await signOut(auth);
      }
      router.push('/login');
    } catch (err) {
      console.error('Error signing out', err);
    }
  };

  const isDark = theme === 'dark';

  return (
    <header className={`sticky top-0 z-50 transition-colors duration-300 backdrop-blur-xl border-b print:hidden ${
      isDark 
        ? 'bg-zinc-950/80 border-zinc-800/80 text-zinc-100' 
        : 'bg-white/80 border-slate-200 text-slate-900 shadow-md'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        
        {/* LOGO */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105 shadow-md ${
            isDark 
              ? 'bg-gradient-to-br from-cyan-500 to-orange-600 text-black font-extrabold' 
              : 'bg-gradient-to-br from-blue-900 via-cyan-600 to-orange-600 text-white'
          }`}>
            <ShieldAlert className="w-6 h-6 stroke-[2.2]" />
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-lg sm:text-xl tracking-tight leading-none flex items-center gap-1">
              SafeSponsor
              <span className={isDark ? 'text-cyan-400 font-black' : 'text-orange-600 font-black'}>
                AI
              </span>
            </span>
            <span className={`text-[10px] font-semibold tracking-wider uppercase mt-0.5 ${
              isDark ? 'text-zinc-400' : 'text-slate-500'
            }`}>
              Brand Safety Engine
            </span>
          </div>
        </Link>

        {/* DESKTOP NAV LINKS */}
        <nav className="hidden md:flex items-center gap-8">
          <Link 
            href="/#features" 
            className={`text-sm font-medium transition-colors hover:text-orange-500 ${
              isDark ? 'text-zinc-300' : 'text-slate-700'
            }`}
          >
            Features
          </Link>
          <Link 
            href="/#how-it-works" 
            className={`text-sm font-medium transition-colors hover:text-orange-500 ${
              isDark ? 'text-zinc-300' : 'text-slate-700'
            }`}
          >
            How It Works
          </Link>
          <Link 
            href="/#demo" 
            className={`text-sm font-medium transition-colors hover:text-orange-500 ${
              isDark ? 'text-zinc-300' : 'text-slate-700'
            }`}
          >
            Live Sample
          </Link>
          <Link 
            href="/#pricing" 
            className={`text-sm font-medium transition-colors hover:text-orange-500 ${
              isDark ? 'text-zinc-300' : 'text-slate-700'
            }`}
          >
            Pricing
          </Link>
          <Link 
            href="/#faq" 
            className={`text-sm font-medium transition-colors hover:text-orange-500 ${
              isDark ? 'text-zinc-300' : 'text-slate-700'
            }`}
          >
            FAQ
          </Link>
        </nav>

        {/* RIGHT CONTROLS & CTA */}
        <div className="hidden sm:flex items-center gap-4">
          {/* THEME TOGGLE BUTTON */}
          <button
            onClick={toggleTheme}
            aria-label="Toggle Dark and Light Mode"
            className={`p-2.5 rounded-xl border transition-all duration-200 flex items-center justify-center ${
              isDark 
                ? 'bg-zinc-900 border-zinc-800 text-cyan-400 hover:bg-zinc-800 hover:border-cyan-500/50' 
                : 'bg-slate-100 border-slate-300 text-orange-600 hover:bg-slate-200 hover:border-orange-500/50'
            }`}
            title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {isDark ? (
              <Sun className="w-5 h-5 text-amber-400 stroke-[2]" />
            ) : (
              <Moon className="w-5 h-5 text-blue-900 stroke-[2]" />
            )}
          </button>

          {user ? (
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard"
                className={`px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-md hover:scale-[1.02] ${
                  isDark
                    ? 'bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-zinc-950'
                    : 'bg-blue-900 hover:bg-blue-950 text-white'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>Dashboard</span>
              </Link>

              <button
                onClick={handleSignOut}
                aria-label="Sign out"
                className={`p-2.5 rounded-xl border text-sm font-semibold transition-all ${
                  isDark 
                    ? 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800' 
                    : 'bg-slate-100 border-slate-300 text-slate-700 hover:text-slate-900 hover:bg-slate-200'
                }`}
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Link
                href="/login"
                className={`px-4 py-2.5 text-sm font-bold transition-colors ${
                  isDark ? 'text-zinc-300 hover:text-white' : 'text-slate-700 hover:text-blue-900'
                }`}
              >
                Sign In
              </Link>
              <Link
                href="/login"
                className={`px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-md hover:scale-[1.02] ${
                  isDark
                    ? 'bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white shadow-orange-950/50'
                    : 'bg-orange-600 hover:bg-orange-700 text-white shadow-orange-200'
                }`}
              >
                <span>Get Started</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}
        </div>

        {/* MOBILE MENU TOGGLE */}
        <div className="flex sm:hidden items-center gap-2">
          <button
            onClick={toggleTheme}
            aria-label="Toggle Theme"
            className={`p-2 rounded-lg border ${
              isDark ? 'bg-zinc-900 border-zinc-800 text-amber-400' : 'bg-slate-100 border-slate-300 text-blue-900'
            }`}
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileMenuOpen}
            className={`p-2 rounded-lg border ${
              isDark ? 'bg-zinc-900 border-zinc-800 text-zinc-300' : 'bg-slate-100 border-slate-300 text-slate-800'
            }`}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* MOBILE DROPDOWN */}
      {mobileMenuOpen && (
        <div className={`sm:hidden border-b px-6 py-6 space-y-4 ${
          isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-white border-slate-200'
        }`}>
          <div className="flex flex-col space-y-3 font-semibold text-base">
            <Link href="/#features" onClick={() => setMobileMenuOpen(false)}>Features</Link>
            <Link href="/#how-it-works" onClick={() => setMobileMenuOpen(false)}>How It Works</Link>
            <Link href="/#demo" onClick={() => setMobileMenuOpen(false)}>Live Sample</Link>
            <Link href="/#pricing" onClick={() => setMobileMenuOpen(false)}>Pricing</Link>
            <Link href="/#faq" onClick={() => setMobileMenuOpen(false)}>FAQ</Link>
          </div>
          <div className="pt-4 border-t border-zinc-800/20 flex flex-col gap-3">
            {user ? (
              <Link
                href="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full py-3 bg-cyan-500 text-zinc-950 font-bold rounded-xl text-center"
              >
                Go to Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full py-3 bg-orange-600 text-white font-bold rounded-xl text-center"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
