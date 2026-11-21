/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Toaster } from 'sonner';
import { AuthProvider, useAuth } from './context/AuthContext';
import { PublicPortal } from './components/PublicPortal';
import { WorkspaceShell } from './components/WorkspaceShell';
import { OfflineIndicator } from './components/OfflineIndicator';

const AppRouter: React.FC = () => {
  const {
    firebaseUser,
    authLoading,
    sessionLoading,
    effectiveProfile,
    actorProfile,
    pendingApproval,
    demoRole,
    setDemoRole,
    refreshSession,
    signOut,
  } = useAuth();

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#FCFAF8] dark:bg-[#120B0D] flex items-center justify-center p-6">
        <div className="glass-surface border border-[#E5E7EB] dark:border-[#332326] rounded-[20px] px-8 py-6 text-center space-y-2">
          <div className="w-10 h-10 rounded-2xl wine-gradient text-white font-bold text-xs flex items-center justify-center mx-auto font-mono shadow-sm">
            IC
          </div>
          <p className="text-sm font-semibold text-[#1F2937] dark:text-[#FAF6F5] font-display">
            IMPACT CAMPUS
          </p>
          <p className="text-xs text-[#6B7280] dark:text-[#B5A5A8]">Verifying institutional session...</p>
        </div>
      </div>
    );
  }

  if (!firebaseUser) {
    return <PublicPortal />;
  }

  if (!effectiveProfile) {
    if (sessionLoading) {
      return (
        <div className="min-h-screen bg-[#FCFAF8] dark:bg-[#120B0D] flex items-center justify-center p-6">
          <div className="glass-surface border border-[#E5E7EB] dark:border-[#332326] rounded-[20px] px-8 py-6 text-center space-y-2">
            <div className="w-10 h-10 rounded-2xl wine-gradient text-white font-bold text-xs flex items-center justify-center mx-auto font-mono shadow-sm">
              IC
            </div>
            <p className="text-sm font-semibold text-[#1F2937] dark:text-[#FAF6F5] font-display">
              IMPACT CAMPUS
            </p>
            <p className="text-xs text-[#6B7280] dark:text-[#B5A5A8]">
              Loading PostgreSQL workspace &amp; role permissions...
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-[#FCFAF8] dark:bg-[#120B0D] flex items-center justify-center p-6">
        <div className="max-w-sm w-full glass-surface border border-[#E5E7EB] dark:border-[#332326] rounded-[20px] p-6 text-center space-y-4">
          <p className="text-sm font-semibold text-[#1F2937] dark:text-[#FAF6F5] font-display">
            Unable to Load Institutional Profile
          </p>
          <p className="text-xs text-[#6B7280] dark:text-[#B5A5A8]">
            Your Google identity is verified, but the workspace profile could not be retrieved.
          </p>
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => refreshSession()}
              className="px-4 py-2 text-xs font-medium rounded-xl wine-gradient text-white hover:brightness-95 cursor-pointer"
            >
              Retry Connection
            </button>
            <button
              type="button"
              onClick={() => signOut()}
              className="px-4 py-2 text-xs font-medium rounded-xl border border-[#E5E7EB] dark:border-[#3D292D] text-[#1F2937] dark:text-[#FAF6F5] hover:bg-[#F7F3EE] dark:hover:bg-[#26191B] cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (pendingApproval && !demoRole) {
    return (
      <div className="min-h-screen bg-[#FCFAF8] dark:bg-[#120B0D] flex items-center justify-center p-6">
        <div className="max-w-md w-full glass-surface border border-[#E5E7EB] dark:border-[#332326] rounded-[20px] p-6 space-y-4">
          <div>
            <p className="text-xs font-mono font-semibold text-[#8A6D0B] dark:text-[#D4AF37]">
              ACCOUNT PROVISIONING REQUIRED
            </p>
            <h1 className="text-lg font-bold text-[#1F2937] dark:text-[#FAF6F5] mt-1 font-display">
              Pending Institutional Approval
            </h1>
            <p className="text-xs text-[#6B7280] dark:text-[#B5A5A8] mt-1 leading-relaxed">
              Signed in as <span className="font-mono font-medium">{actorProfile?.email}</span>.
              For institutional security, external Google accounts require an administrator
              allowlist invite in <span className="font-mono">account_provisions</span> before
              accessing production student or faculty records.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <button
              type="button"
              onClick={() => setDemoRole('super_admin')}
              className="px-4 py-2 text-xs font-medium rounded-xl wine-gradient text-white hover:brightness-95 cursor-pointer"
            >
              Evaluate Demo Portal
            </button>
            <button
              type="button"
              onClick={() => refreshSession()}
              className="px-4 py-2 text-xs font-medium rounded-xl border border-[#E5E7EB] dark:border-[#3D292D] text-[#1F2937] dark:text-[#FAF6F5] hover:bg-[#F7F3EE] dark:hover:bg-[#26191B] cursor-pointer"
            >
              Check Approval
            </button>
            <button
              type="button"
              onClick={() => signOut()}
              className="px-4 py-2 text-xs font-medium rounded-xl border border-[#E5E7EB] dark:border-[#3D292D] text-[#1F2937] dark:text-[#FAF6F5] hover:bg-[#F7F3EE] dark:hover:bg-[#26191B] cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <WorkspaceShell />;
};

export default function App() {
  return (
    <AuthProvider>
      <AppRouter />
      <OfflineIndicator />
      <Toaster position="top-right" richColors />
    </AuthProvider>
  );
}
