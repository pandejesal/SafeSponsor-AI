'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sun, Moon, ArrowRight, Menu, X, LayoutDashboard, LogOut } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import { useAuth } from '@/components/AuthProvider';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { motion } from 'motion/react';

export function Navbar() {
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleSignOut = async () => {
    try {
      if (auth) await signOut(auth);
      window.location.href = '/login';
    } catch (err) {
      console.error('Error signing out', err);
    }
  };

  const isDark = theme === 'dark';

  return (
    <header
      className={`sticky top-0 z-50 border-b print:hidden transition-all duration-200 ${
        scrolled ? 'shadow-[var(--shadow-md)]' : ''
      }`}
      style={{
        background: isDark ? 'rgba(15,27,46,0.88)' : 'rgba(246,242,239,0.88)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderColor: scrolled ? 'rgba(15,27,46,0.10)' : 'rgba(15,27,46,0.08)',
        color: 'var(--ink)',
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-[72px] flex items-center justify-between">
        {/* LOGO — wordmark serif + monogram (replaces AI-generated mark) */}
        <Link href="/" className="flex items-center gap-3 group">
          <div
            className="w-10 h-10 rounded-[8px] flex items-center justify-center text-[15px] font-normal leading-none select-none"
            style={{
              background: 'var(--ink)',
              color: 'var(--paper)',
              fontFamily: 'var(--font-display)',
              boxShadow: 'var(--shadow-sm)',
            }}
            aria-hidden
          >
            ss
          </div>
          <div className="flex flex-col">
            <span className="flex items-baseline gap-[5px] leading-none">
              <span
                className="text-[20px] tracking-[-0.02em]"
                style={{ fontFamily: 'var(--font-display)', fontWeight: 400, color: 'var(--ink)' }}
              >
                SafeSponsor
              </span>
              <span
                className="text-[11px] font-semibold tracking-[0.08em] uppercase px-1.5 py-0.5 rounded-full"
                style={{ background: 'var(--risk-50)', color: 'var(--risk)', border: '1px solid rgba(224,122,95,0.18)' }}
              >
                Audit
              </span>
            </span>
            <span
              className="text-[11px] font-semibold tracking-[0.08em] uppercase"
              style={{ color: 'var(--ink-600)', fontFamily: 'var(--font-sans)' }}
            >
              Evidence, not promises
            </span>
          </div>
        </Link>

        {/* DESKTOP NAV */}
        <nav className="hidden md:flex items-center gap-7">
          {[
            { href: '/#features', label: 'Method' },
            { href: '/#how-it-works', label: 'How it works' },
            { href: '/#demo', label: 'Example' },
            { href: '/#pricing', label: 'Pricing' },
            { href: '/#faq', label: 'FAQ' },
          ].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-[14px] font-medium transition-colors hover:opacity-80"
              style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink-600)' }}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        {/* RIGHT */}
        <div className="hidden sm:flex items-center gap-3">
          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="w-10 h-10 rounded-[8px] border flex items-center justify-center transition-colors"
            style={{
              background: 'var(--paper)',
              borderColor: 'rgba(15,27,46,0.10)',
              color: 'var(--ink-600)',
            }}
          >
            <motion.div
              animate={{ rotate: isDark ? 180 : 0 }}
              transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
            >
              {isDark ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
            </motion.div>
          </button>

          {user ? (
            <div className="flex items-center gap-2">
              <Link
                href="/dashboard"
                className="h-10 px-4 rounded-[8px] text-[14px] font-semibold inline-flex items-center gap-2 transition-colors"
                style={{ background: 'var(--ink)', color: 'var(--paper)', fontFamily: 'var(--font-sans)' }}
              >
                <LayoutDashboard className="w-4 h-4" />
                Dashboard
              </Link>
              <button
                onClick={handleSignOut}
                aria-label="Sign out"
                className="w-10 h-10 rounded-[8px] border inline-flex items-center justify-center"
                style={{ background: 'var(--paper)', borderColor: 'rgba(15,27,46,0.10)', color: 'var(--ink-600)' }}
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="h-10 px-4 rounded-[8px] text-[14px] font-semibold inline-flex items-center transition-colors"
                style={{ color: 'var(--ink-600)', fontFamily: 'var(--font-sans)' }}
              >
                Sign in
              </Link>
              <Link
                href="/login"
                className="h-10 px-[18px] rounded-[8px] text-[14px] font-semibold inline-flex items-center gap-2 transition-all hover:translate-y-[-1px]"
                style={{
                  background: 'var(--risk)',
                  color: 'white',
                  fontFamily: 'var(--font-sans)',
                  boxShadow: '0 1px 2px rgba(15,27,46,0.06)',
                }}
              >
                Get started
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}
        </div>

        {/* MOBILE */}
        <div className="flex sm:hidden items-center gap-2">
          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="w-9 h-9 rounded-[8px] border grid place-items-center"
            style={{ background: 'var(--paper)', borderColor: 'rgba(15,27,46,0.10)', color: 'var(--ink-600)' }}
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileMenuOpen}
            className="w-9 h-9 rounded-[8px] border grid place-items-center"
            style={{ background: 'var(--paper)', borderColor: 'rgba(15,27,46,0.10)', color: 'var(--ink)' }}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div
          className="sm:hidden border-t px-6 py-6 space-y-5"
          style={{ background: 'var(--paper)', borderColor: 'rgba(15,27,46,0.08)' }}
        >
          <div className="flex flex-col gap-3">
            {[
              { href: '/#features', label: 'Method' },
              { href: '/#how-it-works', label: 'How it works' },
              { href: '/#demo', label: 'Example' },
              { href: '/#pricing', label: 'Pricing' },
              { href: '/#faq', label: 'FAQ' },
            ].map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setMobileMenuOpen(false)}
                className="text-[15px] font-medium"
                style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink)' }}
              >
                {l.label}
              </Link>
            ))}
          </div>
          <div className="pt-4 border-t flex flex-col gap-3" style={{ borderColor: 'rgba(15,27,46,0.08)' }}>
            {user ? (
              <Link
                href="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className="h-11 rounded-[8px] grid place-items-center text-[14px] font-semibold"
                style={{ background: 'var(--ink)', color: 'var(--paper)' }}
              >
                Go to dashboard
              </Link>
            ) : (
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="h-11 rounded-[8px] grid place-items-center text-[14px] font-semibold"
                style={{ background: 'var(--risk)', color: 'white' }}
              >
                Get started
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
