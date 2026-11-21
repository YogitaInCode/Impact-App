import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase';

export type AppRole = 'super_admin' | 'faculty' | 'student' | 'parent';

export interface EffectiveProfile {
  id: number;
  uid: string;
  email: string;
  fullName: string;
  role: AppRole;
  avatarUrl: string | null;
  isDemoAccount: boolean;
  accountStatus?: string;
  studentId: number | null;
  facultyId: number | null;
  parentId: number | null;
  linkedStudentIds: number[];
}

export interface AcademicYearItem {
  id: number;
  code: string;
  label: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  status: string;
}

export interface InstitutionInfo {
  id: number;
  code: string;
  name: string;
  shortName: string;
  address: string;
  city: string;
  state: string;
  affiliation: string;
  logoUrl?: string | null;
}

interface AuthContextValue {
  firebaseUser: User | null;
  authLoading: boolean;
  sessionLoading: boolean;
  effectiveProfile: EffectiveProfile | null;
  actorProfile: { id: number; email: string; fullName: string; role: AppRole; accountStatus?: string } | null;
  pendingApproval: boolean;
  institution: InstitutionInfo | null;
  academicYears: AcademicYearItem[];
  selectedAcademicYearId: number | null;
  setSelectedAcademicYearId: (id: number) => void;
  unreadNotifications: number;
  settings: Record<string, string>;
  demoRole: AppRole | null;
  setDemoRole: (role: AppRole | null) => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
  apiFetch: <T = unknown>(path: string, init?: RequestInit) => Promise<T>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [sessionLoading, setSessionLoading] = useState(false);

  const [demoRole, setDemoRoleState] = useState<AppRole | null>('super_admin');
  const [effectiveProfile, setEffectiveProfile] = useState<EffectiveProfile | null>(null);
  const [actorProfile, setActorProfile] = useState<{
    id: number;
    email: string;
    fullName: string;
    role: AppRole;
    accountStatus?: string;
  } | null>(null);
  const [pendingApproval, setPendingApproval] = useState(false);
  const [institution, setInstitution] = useState<InstitutionInfo | null>(null);
  const [academicYears, setAcademicYears] = useState<AcademicYearItem[]>([]);
  const [selectedAcademicYearId, setSelectedAcademicYearId] = useState<number | null>(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  const toggleDarkMode = useCallback(() => {
    setDarkMode((prev) => {
      const next = !prev;
      if (next) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      return next;
    });
  }, []);

  const apiFetch = useCallback(
    async <T = unknown>(path: string, init?: RequestInit): Promise<T> => {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('Authentication required');
      }
      const token = await currentUser.getIdToken();
      const headers = new Headers(init?.headers || {});
      headers.set('Authorization', `Bearer ${token}`);
      if (demoRole) {
        headers.set('x-demo-role', demoRole);
      }
      if (init?.body && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }

      const res = await fetch(path, { ...init, headers });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
      }
      return data as T;
    },
    [demoRole]
  );

  const refreshSession = useCallback(async () => {
    if (!auth.currentUser) {
      setEffectiveProfile(null);
      setActorProfile(null);
      setPendingApproval(false);
      return;
    }
    setSessionLoading(true);
    try {
      const data = await apiFetch<{
        actor: { id: number; email: string; fullName: string; role: AppRole; accountStatus?: string };
        effectiveProfile: EffectiveProfile;
        pendingApproval?: boolean;
        institution: InstitutionInfo;
        unreadNotifications: number;
        academicYears: AcademicYearItem[];
        settings: Record<string, string>;
      }>('/api/me');

      setActorProfile(data.actor);
      setEffectiveProfile(data.effectiveProfile);
      setPendingApproval(Boolean(data.pendingApproval));
      setInstitution(data.institution);
      setUnreadNotifications(data.unreadNotifications);
      setAcademicYears(data.academicYears);
      setSettings(data.settings || {});

      setSelectedAcademicYearId((prev) => {
        if (prev && data.academicYears.some((y) => y.id === prev)) return prev;
        const curr = data.academicYears.find((y) => y.isCurrent);
        return curr?.id ?? data.academicYears[0]?.id ?? null;
      });
    } catch (err) {
      console.error('Session refresh failed:', err);
    } finally {
      setSessionLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    if (firebaseUser) {
      refreshSession();
    } else {
      setEffectiveProfile(null);
      setActorProfile(null);
      setPendingApproval(false);
    }
  }, [firebaseUser, demoRole, refreshSession]);

  const setDemoRole = useCallback((role: AppRole | null) => {
    setDemoRoleState(role);
  }, []);

  const signInWithGoogle = useCallback(async () => {
    await signInWithPopup(auth, googleAuthProvider);
  }, []);

  const signOut = useCallback(async () => {
    await firebaseSignOut(auth);
    setEffectiveProfile(null);
    setActorProfile(null);
    setPendingApproval(false);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        authLoading,
        sessionLoading,
        effectiveProfile,
        actorProfile,
        pendingApproval,
        institution,
        academicYears,
        selectedAcademicYearId,
        setSelectedAcademicYearId,
        unreadNotifications,
        settings,
        demoRole,
        setDemoRole,
        darkMode,
        toggleDarkMode,
        signInWithGoogle,
        signOut,
        refreshSession,
        apiFetch,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
