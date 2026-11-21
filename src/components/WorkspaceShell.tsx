import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Award,
  Bell,
  BookOpen,
  Briefcase,
  Building2,
  Calendar,
  CalendarRange,
  CheckCheck,
  ChevronDown,
  ClipboardCheck,
  CreditCard,
  Database,
  FileCheck2,
  GraduationCap,
  HardDriveDownload,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  Moon,
  QrCode,
  Search,
  Settings,
  Shield,
  Sun,
  User,
  Users,
  X,
} from 'lucide-react';
import { AppRole, useAuth } from '../context/AuthContext';
import { formatIST } from '../lib/utils';
import { DashboardView } from './views/DashboardView';
import { StudentsView } from './views/StudentsView';
import { AcademicAdminView } from './views/AcademicAdminView';
import { TimetableExamsView } from './views/TimetableExamsView';
import { AttendanceConsoleView } from './views/AttendanceConsoleView';
import { StudentAttendanceView } from './views/StudentAttendanceView';
import { FinanceView } from './views/FinanceView';
import { CommunicationView } from './views/CommunicationView';
import { GovernanceView } from './views/GovernanceView';
import { CampusLifecycleView } from './views/CampusLifecycleView';
import { PWAInstallButton } from './PWAInstallButton';

interface NavItem {
  id: string;
  label: string;
  section: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_BY_ROLE: Record<AppRole, NavItem[]> = {
  super_admin: [
    { id: 'dashboard', label: 'Admin Dashboard', section: 'Overview', icon: LayoutDashboard },
    { id: 'students', label: 'Students & 360° Record', section: 'Core Directory', icon: GraduationCap },
    { id: 'faculty', label: 'Faculty Management', section: 'Core Directory', icon: Users },
    { id: 'departments', label: 'Departments & Rooms', section: 'Academics', icon: Building2 },
    { id: 'courses', label: 'Courses & Subjects', section: 'Academics', icon: BookOpen },
    { id: 'years', label: 'Academic Years', section: 'Academics', icon: CalendarRange },
    { id: 'attendance', label: 'Attendance Management', section: 'Operations', icon: QrCode },
    { id: 'timetable', label: 'Timetable Management', section: 'Operations', icon: Calendar },
    { id: 'exams', label: 'Exams, SGPA & Reval', section: 'Operations', icon: Award },
    { id: 'lifecycle', label: 'Campus Lifecycle', section: 'Student Services', icon: Briefcase },
    { id: 'finance', label: 'Fee Management', section: 'Finance', icon: CreditCard },
    { id: 'announcements', label: 'Announcements & Alerts', section: 'Communication', icon: Megaphone },
    { id: 'users', label: 'Users & Provisioning', section: 'Governance', icon: Shield },
    { id: 'audit', label: 'System Audit Logs', section: 'Governance', icon: FileCheck2 },
    { id: 'settings', label: 'System Settings', section: 'Governance', icon: Settings },
    { id: 'backup', label: 'Backup & Restore Verify', section: 'Architecture', icon: HardDriveDownload },
    { id: 'er-schema', label: '60-Table ER & RLS', section: 'Architecture', icon: Database },
    { id: 'tests', label: '20-Workflow Tests', section: 'Architecture', icon: Activity },
  ],
  faculty: [
    { id: 'dashboard', label: 'Faculty Dashboard', section: 'Overview', icon: LayoutDashboard },
    { id: 'attendance', label: 'Take & AI Attendance', section: 'Teaching', icon: QrCode },
    { id: 'timetable', label: 'My Classes & Timetable', section: 'Teaching', icon: Calendar },
    { id: 'courses', label: 'My Subjects & Materials', section: 'Teaching', icon: BookOpen },
    { id: 'students', label: 'Student 360° Records', section: 'Students', icon: GraduationCap },
    { id: 'exams', label: 'Marks, SGPA & Reval', section: 'Students', icon: Award },
    { id: 'lifecycle', label: 'Leaves & Career', section: 'Students', icon: Briefcase },
    { id: 'announcements', label: 'Announcements', section: 'Communication', icon: Megaphone },
    { id: 'notifications', label: 'My Alerts', section: 'Communication', icon: Bell },
    { id: 'er-schema', label: '60-Table ER Schema', section: 'Architecture', icon: Database },
  ],
  student: [
    { id: 'dashboard', label: 'Student Dashboard', section: 'Overview', icon: LayoutDashboard },
    { id: 'students', label: 'My 360° Profile', section: 'Academic Record', icon: GraduationCap },
    { id: 'my-attendance', label: 'My Attendance & QR', section: 'Academic Record', icon: ClipboardCheck },
    { id: 'timetable', label: 'My Timetable', section: 'Classes', icon: Calendar },
    { id: 'courses', label: 'Subjects & Materials', section: 'Classes', icon: BookOpen },
    { id: 'exams', label: 'Results, SGPA & Reval', section: 'Classes', icon: Award },
    { id: 'lifecycle', label: 'Leaves, Career & Campus', section: 'Campus Services', icon: Briefcase },
    { id: 'finance', label: 'Fee History & Receipts', section: 'Finance', icon: CreditCard },
    { id: 'notifications', label: 'Notifications', section: 'Communication', icon: Bell },
    { id: 'announcements', label: 'Campus Circulars', section: 'Communication', icon: Megaphone },
    { id: 'er-schema', label: '60-Table ER Schema', section: 'Architecture', icon: Database },
  ],
  parent: [
    { id: 'dashboard', label: 'Parent Dashboard', section: 'Overview', icon: LayoutDashboard },
    { id: 'students', label: 'Ward 360° Profile', section: 'Ward Record', icon: GraduationCap },
    { id: 'parent-attendance', label: 'Ward Attendance', section: 'Ward Record', icon: ClipboardCheck },
    { id: 'exams', label: 'Grades & SGPA History', section: 'Ward Record', icon: Award },
    { id: 'timetable', label: 'Ward Timetable', section: 'Ward Record', icon: Calendar },
    { id: 'lifecycle', label: 'Ward Leaves & Career', section: 'Ward Record', icon: Briefcase },
    { id: 'finance', label: 'Fee Information', section: 'Finance', icon: CreditCard },
    { id: 'announcements', label: 'Announcements', section: 'Communication', icon: Megaphone },
    { id: 'notifications', label: 'Attendance Alerts', section: 'Communication', icon: Bell },
  ],
};

const MOBILE_TABS_BY_ROLE: Record<AppRole, { id: string; label: string; icon: React.ComponentType<{ className?: string }> }[]> = {
  super_admin: [
    { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
    { id: 'students', label: 'Students', icon: GraduationCap },
    { id: 'attendance', label: 'Attendance', icon: QrCode },
    { id: 'exams', label: 'Exams', icon: Award },
  ],
  faculty: [
    { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
    { id: 'attendance', label: 'Attendance', icon: QrCode },
    { id: 'timetable', label: 'Timetable', icon: Calendar },
    { id: 'students', label: 'Students', icon: GraduationCap },
  ],
  student: [
    { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
    { id: 'my-attendance', label: 'QR / Att', icon: QrCode },
    { id: 'timetable', label: 'Timetable', icon: Calendar },
    { id: 'lifecycle', label: 'Services', icon: Briefcase },
  ],
  parent: [
    { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
    { id: 'parent-attendance', label: 'Attendance', icon: ClipboardCheck },
    { id: 'exams', label: 'Grades', icon: Award },
    { id: 'students', label: 'Profile', icon: GraduationCap },
  ],
};

const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: 'Super Admin',
  faculty: 'Faculty',
  student: 'Student',
  parent: 'Parent (Read-Only)',
};

interface SearchHit {
  type: string;
  id: number;
  title: string;
  subtitle: string;
  tab: string;
}

interface NotificationItem {
  id: number;
  category: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export const WorkspaceShell: React.FC = () => {
  const {
    effectiveProfile,
    actorProfile,
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
    signOut,
    refreshSession,
    apiFetch,
  } = useAuth();

  const role: AppRole = effectiveProfile?.role || 'student';
  const navItems = useMemo(() => NAV_BY_ROLE[role], [role]);
  const mobileQuickTabs = useMemo(() => MOBILE_TABS_BY_ROLE[role], [role]);

  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Global Search State
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<SearchHit[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);

  // Popover States
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifItems, setNotifItems] = useState<NotificationItem[]>([]);
  const [profileOpen, setProfileOpen] = useState(false);

  const searchRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!navItems.some((item) => item.id === activeTab)) {
      setActiveTab('dashboard');
    }
  }, [activeTab, navItems]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (searchRef.current && !searchRef.current.contains(target)) setSearchOpen(false);
      if (notifRef.current && !notifRef.current.contains(target)) setNotifOpen(false);
      if (profileRef.current && !profileRef.current.contains(target)) setProfileOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  useEffect(() => {
    const q = searchTerm.trim();
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await apiFetch<{ results: SearchHit[] }>(`/api/search?q=${encodeURIComponent(q)}`);
        setSearchResults(res.results);
        setSearchOpen(true);
      } catch {
        setSearchResults([]);
      }
    }, 220);
    return () => clearTimeout(timer);
  }, [apiFetch, searchTerm]);

  const openNotificationCenter = async () => {
    const next = !notifOpen;
    setNotifOpen(next);
    setProfileOpen(false);
    if (next) {
      try {
        const res = await apiFetch<{ notifications: NotificationItem[] }>('/api/system/notifications');
        setNotifItems(res.notifications.slice(0, 8));
      } catch {
        // Ignore silent load error
      }
    }
  };

  const handleMarkNotifRead = async (id: number) => {
    try {
      await apiFetch(`/api/system/notifications/${id}/read`, { method: 'PATCH' });
      setNotifItems((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
      await refreshSession();
    } catch {
      // Ignore
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await apiFetch('/api/system/notifications/read-all', { method: 'POST' });
      setNotifItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
      await refreshSession();
    } catch {
      // Ignore
    }
  };

  const handleNavigate = (tabId: string) => {
    setActiveTab(tabId);
    setMobileMenuOpen(false);
    setSearchOpen(false);
  };

  const activeNav = navItems.find((i) => i.id === activeTab) || navItems[0];
  const logoInitials = settings.institution_logo_initials || 'IC';
  const brandTitle = settings.institution_name || institution?.shortName || 'IMPACT CAMPUS';

  const groupedNav = useMemo(() => {
    const groups: { section: string; items: NavItem[] }[] = [];
    for (const item of navItems) {
      const existing = groups.find((g) => g.section === item.section);
      if (existing) existing.items.push(item);
      else groups.push({ section: item.section, items: [item] });
    }
    return groups;
  }, [navItems]);

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardView onNavigate={handleNavigate} />;
      case 'students':
        return <StudentsView />;
      case 'departments':
        return <AcademicAdminView initialTab="departments" />;
      case 'courses':
        return <AcademicAdminView initialTab="subjects" />;
      case 'faculty':
        return <AcademicAdminView initialTab="faculty" />;
      case 'years':
        return <AcademicAdminView initialTab="years" />;
      case 'attendance':
        return <AttendanceConsoleView />;
      case 'my-attendance':
      case 'parent-attendance':
        return <StudentAttendanceView />;
      case 'timetable':
        return <TimetableExamsView initialTab="timetable" />;
      case 'exams':
        return <TimetableExamsView initialTab="exams" />;
      case 'lifecycle':
        return <CampusLifecycleView />;
      case 'finance':
        return <FinanceView />;
      case 'announcements':
        return <CommunicationView initialTab="announcements" />;
      case 'notifications':
        return <CommunicationView initialTab="notifications" />;
      case 'er-schema':
        return <GovernanceView initialTab="er-schema" />;
      case 'users':
        return <GovernanceView initialTab="users" />;
      case 'audit':
        return <GovernanceView initialTab="audit" />;
      case 'settings':
        return <GovernanceView initialTab="settings" />;
      case 'backup':
        return <GovernanceView initialTab="backup" />;
      case 'tests':
        return <GovernanceView initialTab="tests" />;
      default:
        return <DashboardView onNavigate={handleNavigate} />;
    }
  };

  const SidebarBody = () => (
    <div className="flex flex-col h-full bg-[#291115] dark:bg-[#160B0D] text-[#F7F3EE] select-none">
      {/* Wine-Red Gradient Institution Header */}
      <div className="p-3.5 shrink-0 border-b border-[#422026]">
        <div className="wine-gradient rounded-2xl p-3 flex items-center justify-between gap-3 shadow-sm border border-white/10">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-white/15 backdrop-blur-xs text-[#D4AF37] font-bold text-xs flex items-center justify-center shrink-0 font-mono border border-white/25">
              {logoInitials}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold tracking-tight text-white truncate font-display">
                IMPACT CAMPUS
              </p>
              <p className="text-[11px] text-[#F7F3EE]/90 truncate">
                {ROLE_LABELS[role]} Portal
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden p-1 text-white/80 hover:text-white cursor-pointer"
            aria-label="Close navigation"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Role-Scoped Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {groupedNav.map((group) => (
          <div key={group.section}>
            <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#B69B9E]">
              {group.section}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNavigate(item.id)}
                    className={`w-full flex items-center justify-between gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                      active
                        ? 'wine-gradient text-white font-semibold shadow-sm'
                        : 'text-[#E7D8DA] hover:bg-[#3A1B20] hover:text-white'
                    }`}
                  >
                    <span className="flex items-center gap-2.5 truncate">
                      <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-[#D4AF37]' : ''}`} />
                      <span className="truncate">{item.label}</span>
                    </span>
                    {item.id === 'notifications' && unreadNotifications > 0 && (
                      <span className="font-mono text-[11px] font-semibold text-[#D4AF37]">
                        {unreadNotifications}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Signed-in Identity Summary */}
      <div className="p-4 border-t border-[#422026] text-xs shrink-0 space-y-1">
        <div className="min-w-0">
          <p className="font-medium text-white truncate">{effectiveProfile?.fullName}</p>
          <p className="text-[11px] text-[#C8B2B5] truncate font-mono">
            {effectiveProfile?.email}
          </p>
        </div>
        <p className="text-[11px] text-[#A48B8E] truncate">{brandTitle} · Bengaluru</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FCFAF8] dark:bg-[#120B0D] text-[#1F2937] dark:text-[#FAF6F5] flex">
      {/* Desktop Fixed 260px Sidebar */}
      <aside className="hidden lg:block w-[260px] shrink-0 border-r border-[#422026] sticky top-0 h-screen">
        <SidebarBody />
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-[#160B0D]/65 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative z-10 w-[268px] max-w-[82vw] h-full shadow-2xl">
            <SidebarBody />
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Utility Glassmorphic Header */}
        <header className="h-12 lg:h-16 bg-white/85 dark:bg-[#1B1214]/85 backdrop-blur-md border-b border-[#E5E7EB] dark:border-[#332326] px-4 lg:px-6 flex items-center justify-between gap-3 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-1.5 rounded-xl border border-[#E5E7EB] dark:border-[#3D292D] text-[#1F2937] dark:text-[#FAF6F5] hover:bg-[#F7F3EE] cursor-pointer"
              aria-label="Open navigation"
            >
              <Menu className="w-4 h-4" />
            </button>

            <div className="hidden xl:flex items-center gap-2 text-xs text-[#6B7280] dark:text-[#B5A5A8] truncate">
              <span className="font-medium text-[#722F37] dark:text-[#D48A94]">
                {ROLE_LABELS[role]}
              </span>
              <span>/</span>
              <span className="font-semibold text-[#1F2937] dark:text-[#FAF6F5] truncate">
                {activeNav?.label}
              </span>
            </div>

            {/* Global Search Bar */}
            <div ref={searchRef} className="relative w-40 sm:w-64 md:w-72">
              <Search className="w-3.5 h-3.5 text-[#6B7280] absolute left-3 top-2.5" />
              <input
                type="search"
                aria-label="Global workspace search"
                placeholder="Search USN, subjects, faculty..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onFocus={() => searchResults.length > 0 && setSearchOpen(true)}
                className="w-full h-8 pl-8 pr-2.5 rounded-xl border border-[#E5E7EB] dark:border-[#3D292D] bg-[#FCFAF8] dark:bg-[#150E10] text-xs text-[#1F2937] dark:text-[#FAF6F5] placeholder:text-[#6B7280] focus:outline-none focus:ring-2 focus:ring-[#722F37]/35 focus:border-[#722F37]"
              />
              {searchOpen && searchResults.length > 0 && (
                <div className="absolute left-0 right-0 mt-1.5 bg-white dark:bg-[#1B1214] border border-[#E5E7EB] dark:border-[#332326] rounded-2xl shadow-xl max-h-80 overflow-y-auto z-50 divide-y divide-[#F7F3EE] dark:divide-[#2D1E21]">
                  {searchResults.map((hit) => (
                    <button
                      key={`${hit.type}-${hit.id}`}
                      type="button"
                      onClick={() => {
                        handleNavigate(hit.tab);
                        setSearchTerm('');
                      }}
                      className="w-full text-left px-3.5 py-2.5 hover:bg-[#F7F3EE] dark:hover:bg-[#26191B] flex items-center justify-between gap-2 text-xs cursor-pointer"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-[#1F2937] dark:text-[#FAF6F5] truncate">
                          {hit.title}
                        </p>
                        <p className="text-[11px] text-[#6B7280] dark:text-[#B5A5A8] truncate">{hit.subtitle}</p>
                      </div>
                      <span className="font-mono text-[10px] uppercase font-semibold text-[#722F37] dark:text-[#D48A94] shrink-0">
                        {hit.type}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Academic Year Context Switcher */}
            {academicYears.length > 0 && (
              <select
                aria-label="Academic Year"
                value={selectedAcademicYearId ?? ''}
                onChange={(e) => setSelectedAcademicYearId(Number(e.target.value))}
                className="hidden sm:block h-8 rounded-xl border border-[#E5E7EB] dark:border-[#3D292D] bg-white dark:bg-[#150E10] px-2.5 text-xs font-mono text-[#1F2937] dark:text-[#FAF6F5] focus:outline-none focus:ring-2 focus:ring-[#722F37]/35 cursor-pointer"
              >
                {academicYears.map((y) => (
                  <option key={y.id} value={y.id}>
                    AY {y.code} {y.isCurrent ? '(Active)' : ''}
                  </option>
                ))}
              </select>
            )}

            {/* Demo Role / Live Account Switcher */}
            <select
              aria-label="Switch Portal Role"
              value={demoRole || 'live'}
              onChange={(e) => {
                const val = e.target.value;
                setDemoRole(val === 'live' ? null : (val as AppRole));
                setActiveTab('dashboard');
              }}
              className="h-8 rounded-xl border border-[#8B3A44]/35 bg-[#F7F3EE] dark:bg-[#2E1A1E] px-2.5 text-xs font-medium text-[#5A242B] dark:text-[#E5B8BE] focus:outline-none focus:ring-2 focus:ring-[#722F37]/35 cursor-pointer"
            >
              <option value="super_admin">Demo: Super Admin</option>
              <option value="faculty">Demo: Faculty</option>
              <option value="student">Demo: Student</option>
              <option value="parent">Demo: Parent</option>
              <option value="live">Live Google Account</option>
            </select>

            {/* Interactive Notification Centre Popover */}
            <div ref={notifRef} className="relative">
              <button
                type="button"
                onClick={openNotificationCenter}
                className="relative h-8 px-2.5 rounded-xl border border-[#E5E7EB] dark:border-[#3D292D] hover:bg-[#F7F3EE] dark:hover:bg-[#26191B] flex items-center gap-1.5 text-xs text-[#1F2937] dark:text-[#FAF6F5] cursor-pointer"
                aria-label="Notifications"
              >
                <Bell className="w-3.5 h-3.5" />
                {unreadNotifications > 0 && (
                  <span className="font-mono text-[11px] font-semibold text-[#722F37] dark:text-[#D4AF37]">
                    {unreadNotifications}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-[#1B1214] border border-[#E5E7EB] dark:border-[#332326] rounded-[20px] shadow-xl z-50 overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-[#E5E7EB] dark:border-[#332326] flex items-center justify-between bg-[#F7F3EE]/80 dark:bg-[#221618]">
                    <span className="text-xs font-semibold">Notifications</span>
                    <button
                      type="button"
                      onClick={handleMarkAllRead}
                      className="text-[11px] text-[#722F37] dark:text-[#D48A94] hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      <CheckCheck className="w-3 h-3" /> Mark all read
                    </button>
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y divide-[#F7F3EE] dark:divide-[#2D1E21] text-xs">
                    {notifItems.length === 0 ? (
                      <p className="p-4 text-center text-[#6B7280]">No notifications</p>
                    ) : (
                      notifItems.map((n) => (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => handleMarkNotifRead(n.id)}
                          className={`w-full text-left px-4 py-2.5 hover:bg-[#FCFAF8] dark:hover:bg-[#26191B] cursor-pointer ${
                            !n.isRead ? 'bg-[#F7F3EE]/70 dark:bg-[#2E1A1E]/50' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-[#1F2937] dark:text-[#FAF6F5] truncate">
                              {n.title}
                            </span>
                            {!n.isRead && <span className="w-2 h-2 rounded-full bg-[#722F37] shrink-0" />}
                          </div>
                          <p className="text-[#6B7280] dark:text-[#B5A5A8] mt-0.5 line-clamp-2">
                            {n.message}
                          </p>
                          <p className="text-[10px] font-mono text-[#6B7280] mt-1">
                            {formatIST(n.createdAt)}
                          </p>
                        </button>
                      ))
                    )}
                  </div>
                  <div className="px-4 py-2 border-t border-[#E5E7EB] dark:border-[#332326] text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setNotifOpen(false);
                        handleNavigate('notifications');
                      }}
                      className="text-xs font-medium text-[#722F37] dark:text-[#D48A94] hover:underline cursor-pointer"
                    >
                      Open Notification Inbox
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Light/Dark Mode Toggle */}
            <button
              type="button"
              onClick={toggleDarkMode}
              className="h-8 w-8 rounded-xl border border-[#E5E7EB] dark:border-[#3D292D] hover:bg-[#F7F3EE] dark:hover:bg-[#26191B] flex items-center justify-center text-[#1F2937] dark:text-[#FAF6F5] cursor-pointer"
              aria-label="Toggle theme"
            >
              {darkMode ? <Sun className="w-3.5 h-3.5 text-[#D4AF37]" /> : <Moon className="w-3.5 h-3.5" />}
            </button>

            <div className="hidden md:block">
              <PWAInstallButton compact />
            </div>

            {/* Profile Popover Menu */}
            <div ref={profileRef} className="relative">
              <button
                type="button"
                onClick={() => {
                  setProfileOpen(!profileOpen);
                  setNotifOpen(false);
                }}
                className="h-8 px-2.5 rounded-xl border border-[#E5E7EB] dark:border-[#3D292D] hover:bg-[#F7F3EE] dark:hover:bg-[#26191B] flex items-center gap-1.5 text-xs font-medium text-[#1F2937] dark:text-[#FAF6F5] cursor-pointer"
              >
                <User className="w-3.5 h-3.5 text-[#722F37] dark:text-[#D48A94]" />
                <span className="hidden md:inline max-w-[110px] truncate">
                  {effectiveProfile?.fullName}
                </span>
                <ChevronDown className="w-3 h-3 text-[#6B7280]" />
              </button>

              {profileOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-[#1B1214] border border-[#E5E7EB] dark:border-[#332326] rounded-[20px] shadow-xl z-50 p-4 space-y-3 text-xs">
                  <div className="pb-2 border-b border-[#E5E7EB] dark:border-[#332326]">
                    <p className="font-semibold text-[#1F2937] dark:text-[#FAF6F5]">
                      {effectiveProfile?.fullName}
                    </p>
                    <p className="font-mono text-[11px] text-[#6B7280] truncate">
                      {effectiveProfile?.email}
                    </p>
                    <p className="text-[11px] text-[#722F37] dark:text-[#D48A94] mt-1 font-medium">
                      Active Portal: {ROLE_LABELS[role]}
                    </p>
                    {actorProfile && demoRole && (
                      <p className="text-[10px] text-[#6B7280] mt-0.5">
                        Signed-in Google Account: {actorProfile.email}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1">
                    {role === 'student' && (
                      <button
                        type="button"
                        onClick={() => {
                          setProfileOpen(false);
                          handleNavigate('students');
                        }}
                        className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-[#F7F3EE] dark:hover:bg-[#26191B] cursor-pointer"
                      >
                        View My 360° Profile
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={signOut}
                      className="w-full text-left px-2.5 py-1.5 rounded-xl text-[#B91C1C] hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center gap-2 cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main Workspace Container */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-20 lg:pb-8 max-w-[1440px] w-full mx-auto">
          {renderContent()}
        </main>

        {/* Mobile-First Bottom Thumb Navigation (Strictly <=56px height) */}
        <nav
          aria-label="Mobile quick navigation"
          className="lg:hidden fixed bottom-0 inset-x-0 h-14 z-40 bg-white/95 dark:bg-[#1B1214]/95 backdrop-blur-md border-t border-[#E5E7EB] dark:border-[#332326] px-2 flex items-center justify-around no-print"
        >
          {mobileQuickTabs.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavigate(item.id)}
                className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1 rounded-xl text-[11px] font-medium transition-colors cursor-pointer ${
                  active
                    ? 'text-[#722F37] dark:text-[#D4AF37] font-semibold'
                    : 'text-[#6B7280] dark:text-[#B5A5A8]'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="flex flex-col items-center justify-center gap-0.5 px-3 py-1 rounded-xl text-[11px] font-medium text-[#6B7280] dark:text-[#B5A5A8] cursor-pointer"
          >
            <Menu className="w-4 h-4" />
            <span>Menu</span>
          </button>
        </nav>
      </div>
    </div>
  );
};
