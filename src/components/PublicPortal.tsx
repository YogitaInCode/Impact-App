import React, { useEffect, useState } from 'react';
import { ArrowRight, Building2, CheckCircle2, Database, KeyRound, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { Button, Input, FieldLabel, Surface } from './ui/primitives';
import { PWAInstallButton } from './PWAInstallButton';

interface PublicOverview {
  institution?: {
    name: string;
    shortName: string;
    address: string;
    city: string;
    state: string;
    affiliation: string;
  };
  departments: { id: number; code: string; name: string; building: string | null }[];
  totalPrograms: number;
  academicYears: { id: number; code: string; label: string; isCurrent: boolean }[];
  biometricProvider: { configured: boolean; providerName: string };
}

export const PublicPortal: React.FC = () => {
  const { signInWithGoogle } = useAuth();
  const [page, setPage] = useState<'login' | 'forgot' | 'about'>('login');
  const [overview, setOverview] = useState<PublicOverview | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoverySubmitted, setRecoverySubmitted] = useState(false);

  useEffect(() => {
    fetch('/api/public/overview')
      .then((r) => r.json())
      .then((d) => setOverview(d))
      .catch(() => {});
  }, []);

  const handleGoogleSignIn = async () => {
    setSigningIn(true);
    try {
      await signInWithGoogle();
      toast.success('Authenticated with Google Sign-In');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Google Sign-In cancelled or blocked');
    } finally {
      setSigningIn(false);
    }
  };

  const handleRecoverySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryEmail.trim()) return;
    setRecoverySubmitted(true);
    toast.success('Access recovery guidance generated for your institutional email.');
  };

  return (
    <div className="min-h-screen bg-[#FCFAF8] text-[#1F2937] flex flex-col">
      {/* 3-Zone Glassmorphic Top Bar */}
      <header className="border-b border-[#E5E7EB] bg-white/85 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-[1320px] mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <button
            type="button"
            onClick={() => setPage('login')}
            className="flex items-center gap-2.5 text-lg font-bold tracking-tight text-[#1F2937] whitespace-nowrap shrink-0 font-display cursor-pointer"
          >
            <span className="w-8 h-8 rounded-xl wine-gradient text-[#D4AF37] font-mono text-xs flex items-center justify-center shadow-xs">
              IC
            </span>
            <span>IMPACT CAMPUS</span>
          </button>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-[#6B7280]">
            <button
              type="button"
              onClick={() => setPage('login')}
              className={`whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                page === 'login'
                  ? 'text-[#722F37] font-semibold underline underline-offset-8 decoration-[#722F37] decoration-2'
                  : 'hover:text-[#1F2937]'
              }`}
            >
              Portal Sign In
            </button>
            <button
              type="button"
              onClick={() => setPage('forgot')}
              className={`whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                page === 'forgot'
                  ? 'text-[#722F37] font-semibold underline underline-offset-8 decoration-[#722F37] decoration-2'
                  : 'hover:text-[#1F2937]'
              }`}
            >
              Access Recovery
            </button>
            <button
              type="button"
              onClick={() => setPage('about')}
              className={`whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                page === 'about'
                  ? 'text-[#722F37] font-semibold underline underline-offset-8 decoration-[#722F37] decoration-2'
                  : 'hover:text-[#1F2937]'
              }`}
            >
              About Platform
            </button>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <Button onClick={handleGoogleSignIn} disabled={signingIn} size="sm">
              {signingIn ? 'Signing in...' : 'Sign In with Google'}
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {page === 'login' && (
          <section className="max-w-[1320px] mx-auto px-6 py-10 lg:py-14">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
              {/* Left Sign-In & Value Panel */}
              <div className="lg:col-span-5 flex flex-col justify-between space-y-8">
                <div>
                  <p className="text-xs font-semibold text-[#722F37] tracking-wide">
                    Impact College of Engineering and Applied Sciences · Bengaluru, Karnataka
                  </p>
                  <h1 className="mt-3 text-3xl lg:text-4xl font-bold tracking-tight text-[#1F2937] leading-[1.15] [text-wrap:balance]">
                    One College. One Connected Digital Ecosystem.
                  </h1>
                  <p className="mt-4 text-[15px] leading-relaxed text-[#6B7280] max-w-lg">
                    Centralized academic ERP and smart attendance platform engineered on a
                    60-table PostgreSQL relational database covering admissions, CIE/SEE marks,
                    SGPA/CGPA, placements, and role-isolated portals.
                  </p>
                </div>

                <Surface className="p-6 bg-white/95 border-[#E5E7EB]">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold text-[#1F2937]">
                      Institutional Single Sign-On
                    </h2>
                    <span className="text-[11px] font-mono font-semibold text-[#8A6D0B]">
                      Firebase SSO
                    </span>
                  </div>
                  <p className="text-xs text-[#6B7280] mt-1.5 leading-relaxed">
                    Sign in with your Google account to verify your identity with Firebase
                    Authentication. Inside the workspace, evaluators can test all four role portals
                    using seeded demonstration records.
                  </p>

                  <div className="mt-5 space-y-3">
                    <Button
                      onClick={handleGoogleSignIn}
                      disabled={signingIn}
                      className="w-full justify-center py-2.5"
                    >
                      <span>{signingIn ? 'Connecting Google SSO...' : 'Continue with Google Sign-In'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                    <div className="flex items-center justify-between pt-1 text-xs text-[#6B7280]">
                      <button
                        type="button"
                        onClick={() => setPage('forgot')}
                        className="hover:text-[#722F37] underline underline-offset-4 cursor-pointer"
                      >
                        Forgot institutional password?
                      </button>
                      <button
                        type="button"
                        onClick={() => setPage('about')}
                        className="hover:text-[#722F37] underline underline-offset-4 cursor-pointer"
                      >
                        Explore 60-table architecture
                      </button>
                    </div>
                  </div>
                </Surface>

                <div className="pt-2 border-t border-[#E5E7EB] flex flex-wrap items-center justify-between gap-4 text-xs text-[#6B7280]">
                  <span>VTU Belagavi Affiliated · Sahakaranagar, Bengaluru</span>
                  <PWAInstallButton />
                </div>
              </div>

              {/* Right Campus Photograph */}
              <div className="lg:col-span-7">
                <div className="h-full min-h-[380px] rounded-[24px] overflow-hidden border border-[#E5E7EB] bg-[#291115] relative shadow-[0_20px_50px_-15px_rgba(114,47,55,0.24)]">
                  {!imgFailed ? (
                    <img
                      src="/src/assets/images/campus_bangalore_hero_1795168316879.jpg"
                      alt="Impact College of Engineering and Applied Sciences Bengaluru Academic Courtyard"
                      referrerPolicy="no-referrer"
                      onError={() => setImgFailed(true)}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center p-10 wine-rose-gradient text-white">
                      <Building2 className="w-10 h-10 text-[#D4AF37] mb-3" />
                      <p className="text-base font-semibold">
                        Impact College of Engineering &amp; Applied Sciences
                      </p>
                      <p className="text-xs text-[#F7F3EE] mt-1">Bengaluru, Karnataka, India</p>
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#291115]/95 via-[#291115]/55 to-transparent p-6 text-white">
                    <p className="text-xs font-mono text-[#D4AF37] font-semibold">
                      CLOUD SQL POSTGRESQL · 60 TABLES · 4 PORTALS · IST (ASIA/KOLKATA)
                    </p>
                    <p className="text-sm font-medium mt-1">
                      Building a College Management Database from Scratch with AI-Powered Attendance Management
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Full-width 4-column summary bar below hero split */}
            <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Surface className="p-5">
                <p className="text-xs text-[#6B7280]">Database Schema</p>
                <p className="text-2xl font-bold font-mono tabular-nums mt-1 text-[#722F37]">
                  60 Tables
                </p>
                <p className="text-xs text-[#6B7280] mt-1">
                  Normalized FK constraints &amp; unique indexes
                </p>
              </Surface>
              <Surface className="p-5">
                <p className="text-xs text-[#6B7280]">Engineering Departments</p>
                <p className="text-2xl font-bold font-mono tabular-nums mt-1 text-[#1F2937]">
                  {overview?.departments.length ?? 4} Depts
                </p>
                <p className="text-xs text-[#6B7280] mt-1">
                  CSE · ISE · ECE · Mechanical Engineering
                </p>
              </Surface>
              <Surface className="p-5">
                <p className="text-xs text-[#6B7280]">Attendance Modes</p>
                <p className="text-2xl font-bold font-mono tabular-nums mt-1 text-[#15803D]">
                  3 Modes
                </p>
                <p className="text-xs text-[#6B7280] mt-1">
                  Dynamic QR · Manual Audit · AI Biometric Hook
                </p>
              </Surface>
              <Surface className="p-5">
                <p className="text-xs text-[#6B7280]">Academic Continuity</p>
                <p className="text-2xl font-bold font-mono tabular-nums mt-1 text-[#8A6D0B]">
                  Multi-Year
                </p>
                <p className="text-xs text-[#6B7280] mt-1">
                  2025–26 · 2026–27 · 2027–28 preserved
                </p>
              </Surface>
            </div>
          </section>
        )}

        {page === 'forgot' && (
          <section className="max-w-xl mx-auto px-6 py-16">
            <Surface className="p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 rounded-xl bg-[#F7F3EE] text-[#722F37]">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-[#1F2937]">
                    Institutional Access Recovery
                  </h1>
                  <p className="text-xs text-[#6B7280]">
                    Impact College of Engineering and Applied Sciences · Identity Desk
                  </p>
                </div>
              </div>

              <p className="text-sm text-[#6B7280] leading-relaxed mb-6">
                IMPACT CAMPUS uses Google Workspace / Firebase Single Sign-On so passwords are
                never stored in the college database. Enter your institutional email or USN below
                for recovery instructions.
              </p>

              <form onSubmit={handleRecoverySubmit} className="space-y-4">
                <div>
                  <FieldLabel required>Institutional Email or USN</FieldLabel>
                  <Input
                    type="text"
                    placeholder="e.g. aarav.sharma@impactcampus.edu.in or 1IC23CS001"
                    value={recoveryEmail}
                    onChange={(e) => setRecoveryEmail(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full">
                  Check Recovery Procedure
                </Button>
              </form>

              {recoverySubmitted && (
                <div className="mt-6 p-4 rounded-2xl border border-[#E5E7EB] bg-[#F7F3EE] text-xs text-[#1F2937] space-y-1.5">
                  <p className="font-semibold text-[#5A242B]">
                    Next Steps for {recoveryEmail}:
                  </p>
                  <p>
                    1. Use Google Account Recovery at accounts.google.com if you forgot your Google
                    credentials.
                  </p>
                  <p>
                    2. Contact the Academic Registrar Office (Block A, Ground Floor) with your
                    College ID Card to re-bind a new Google email to your permanent USN record.
                  </p>
                </div>
              )}

              <div className="mt-6 pt-4 border-t border-[#E5E7EB]">
                <button
                  type="button"
                  onClick={() => setPage('login')}
                  className="text-xs font-medium text-[#722F37] hover:underline cursor-pointer"
                >
                  ← Return to Sign In
                </button>
              </div>
            </Surface>
          </section>
        )}

        {page === 'about' && (
          <section className="max-w-[1100px] mx-auto px-6 py-12 space-y-8">
            <div className="wine-rose-gradient rounded-[24px] p-8 text-white shadow-md">
              <p className="text-xs font-semibold text-[#D4AF37] uppercase tracking-wider">
                Academic Architecture &amp; Security Brief
              </p>
              <h1 className="mt-2 text-2xl sm:text-3xl font-bold [text-wrap:balance]">
                Building a College Management Database from Scratch with AI-Powered Attendance Management
              </h1>
              <p className="mt-3 text-sm text-[#FCFAF8]/90 leading-relaxed max-w-3xl">
                Designed specifically for Impact College of Engineering and Applied Sciences,
                Bengaluru, IMPACT CAMPUS replaces fragmented spreadsheets with a unified,
                normalized PostgreSQL database that preserves student, faculty, attendance, exam,
                and fee histories across academic years without destructive overwrites.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Surface className="p-6 space-y-2">
                <Database className="w-5 h-5 text-[#722F37]" />
                <h2 className="text-sm font-semibold text-[#1F2937]">
                  60-Table Relational Core
                </h2>
                <p className="text-xs text-[#6B7280] leading-relaxed">
                  Covers Institutional (8), User &amp; Identity (7), Academic (7), Examinations &amp; Results (8),
                  Attendance (5), Finance (5), Student Lifecycle (14), Communication (3), and System Governance (3) tables.
                </p>
              </Surface>

              <Surface className="p-6 space-y-2">
                <ShieldCheck className="w-5 h-5 text-[#8A6D0B]" />
                <h2 className="text-sm font-semibold text-[#1F2937]">
                  Server-Enforced RBAC &amp; RLS
                </h2>
                <p className="text-xs text-[#6B7280] leading-relaxed">
                  Every API route verifies Firebase ID tokens server-side and enforces role and
                  ownership predicates so students and parents can never mutate attendance or read
                  other students&apos; records.
                </p>
              </Surface>

              <Surface className="p-6 space-y-2">
                <CheckCircle2 className="w-5 h-5 text-[#15803D]" />
                <h2 className="text-sm font-semibold text-[#1F2937]">
                  Honest Biometric Integration
                </h2>
                <p className="text-xs text-[#6B7280] leading-relaxed">
                  Requires explicit informed consent and external biometric provider keys. When
                  external face/liveness keys are absent, the system reports status transparently
                  without fabricating verification results.
                </p>
              </Surface>
            </div>

            <Surface className="p-6">
              <h2 className="text-sm font-semibold text-[#1F2937] mb-3">
                Active Institutional Departments
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {(overview?.departments || []).map((dept) => (
                  <div
                    key={dept.id}
                    className="p-4 rounded-[20px] border border-[#E5E7EB] bg-[#F7F3EE]"
                  >
                    <p className="text-xs font-mono font-semibold text-[#722F37]">{dept.code}</p>
                    <p className="text-sm font-medium text-[#1F2937] mt-0.5">{dept.name}</p>
                    <p className="text-xs text-[#6B7280] mt-1">{dept.building || 'Main Block'}</p>
                  </div>
                ))}
              </div>
            </Surface>
          </section>
        )}
      </main>

      <footer className="border-t border-[#E5E7EB] bg-white/70 py-5 px-6 text-xs text-[#6B7280]">
        <div className="max-w-[1320px] mx-auto flex flex-wrap items-center justify-between gap-4">
          <span>
            IMPACT CAMPUS · Impact College of Engineering and Applied Sciences, Bengaluru, Karnataka
          </span>
          <span>All timestamps stored in UTC · Displayed in IST (Asia/Kolkata)</span>
        </div>
      </footer>
    </div>
  );
};
