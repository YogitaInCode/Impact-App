import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Copy,
  Database,
  Download,
  HardDriveDownload,
  Play,
  Plus,
  Settings,
  ShieldCheck,
  UserPlus,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth, AppRole } from '../../context/AuthContext';
import { formatIST } from '../../lib/utils';
import { Button, FieldLabel, Input, Select, StatusText, Surface, TabBar } from '../ui/primitives';

interface ErTable {
  name: string;
  domain: string;
  summary: string;
  keyColumns: string[];
  foreignKeys: string[];
  rlsPolicy: string;
}

interface ProvisionRow {
  id: number;
  email: string;
  role: AppRole;
  fullName: string;
  referenceCode: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
}

export const GovernanceView: React.FC<{
  initialTab?: 'er-schema' | 'users' | 'audit' | 'settings' | 'backup' | 'tests';
}> = ({ initialTab = 'er-schema' }) => {
  const { effectiveProfile, refreshSession, apiFetch } = useAuth();
  const isAdmin = effectiveProfile?.role === 'super_admin';

  const [tab, setTab] = useState<'er-schema' | 'users' | 'audit' | 'settings' | 'backup' | 'tests'>(initialTab);
  const [erTables, setErTables] = useState<ErTable[]>([]);
  const [rlsSql, setRlsSql] = useState('');
  const [domainFilter, setDomainFilter] = useState('All');

  const [users, setUsers] = useState<
    { id: number; uid: string; email: string; fullName: string; role: AppRole; isDemoAccount: boolean; accountStatus: string }[]
  >([]);
  const [provisions, setProvisions] = useState<ProvisionRow[]>([]);
  const [provForm, setProvForm] = useState({
    email: '',
    fullName: '',
    role: 'faculty' as AppRole,
    referenceCode: '',
    notes: '',
  });

  const [permissions, setPermissions] = useState<
    { id: number; role: string; resource: string; canCreate: boolean; canRead: boolean; canUpdate: boolean; canDelete: boolean; description: string | null }[]
  >([]);
  const [auditLogs, setAuditLogs] = useState<
    { id: number; actorRole: string; actorName: string | null; action: string; entityType: string; entityId: string; reason: string | null; createdAt: string }[]
  >([]);
  const [settingsList, setSettingsList] = useState<
    { id: number; settingKey: string; settingValue: string; category: string; description: string | null }[]
  >([]);

  const [backupSnapshot, setBackupSnapshot] = useState<{
    schemaVersion: string;
    exportedAt: string;
    checksum: string;
    counts: Record<string, number>;
    tables: Record<string, unknown[]>;
  } | null>(null);
  const [restoreResult, setRestoreResult] = useState<{
    verified: boolean;
    checksumValid: boolean;
    computedChecksum: string;
    detail: string;
    liveCounts: { liveStudents: number; liveEnrollments: number; liveAssessmentMarks: number };
  } | null>(null);
  const [backupBusy, setBackupBusy] = useState(false);

  const [testRunning, setTestRunning] = useState(false);
  const [testResults, setTestResults] = useState<{
    passedCount: number;
    totalCount: number;
    results: { id: number; name: string; passed: boolean; detail: string }[];
  } | null>(null);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const load = useCallback(async () => {
    try {
      const erRes = await apiFetch<{ tables: ErTable[]; rlsSql: string }>('/api/er-schema');
      setErTables(erRes.tables);
      setRlsSql(erRes.rlsSql);

      const setRes = await apiFetch<{ settings: typeof settingsList }>('/api/system/settings');
      setSettingsList(setRes.settings);

      if (isAdmin) {
        const [uRes, aRes, pRes] = await Promise.all([
          apiFetch<{ users: typeof users; permissions: typeof permissions }>('/api/system/users'),
          apiFetch<{ logs: typeof auditLogs }>('/api/system/audit-logs'),
          apiFetch<{ provisions: ProvisionRow[] }>('/api/system/provisions'),
        ]);
        setUsers(uRes.users);
        setPermissions(uRes.permissions);
        setAuditLogs(aRes.logs);
        setProvisions(pRes.provisions);
      }
    } catch (err) {
      console.error('Governance load error:', err);
    }
  }, [apiFetch, isAdmin]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRoleUpdate = async (userId: number, role: string) => {
    try {
      await apiFetch(`/api/system/users/${userId}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      });
      toast.success('User role updated');
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Role update failed');
    }
  };

  const handleCreateProvision = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/system/provisions', {
        method: 'POST',
        body: JSON.stringify(provForm),
      });
      toast.success(`Provisioned invite for ${provForm.email}`);
      setProvForm({ email: '', fullName: '', role: 'faculty', referenceCode: '', notes: '' });
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create invite');
    }
  };

  const handleToggleProvision = async (id: number, status: 'invited' | 'revoked') => {
    try {
      await apiFetch(`/api/system/provisions/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      toast.success(`Provision status set to ${status}`);
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update provision');
    }
  };

  const handleSettingSave = async (settingKey: string, settingValue: string) => {
    try {
      await apiFetch('/api/system/settings', {
        method: 'PATCH',
        body: JSON.stringify({ settingKey, settingValue }),
      });
      toast.success(`Updated ${settingKey}`);
      await refreshSession();
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update setting');
    }
  };

  const handleGenerateBackup = async () => {
    setBackupBusy(true);
    try {
      const snap = await apiFetch<NonNullable<typeof backupSnapshot>>('/api/system/backup');
      setBackupSnapshot(snap);
      setRestoreResult(null);
      toast.success(`Snapshot generated (${snap.schemaVersion})`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Backup export failed');
    } finally {
      setBackupBusy(false);
    }
  };

  const handleDownloadBackupJson = () => {
    if (!backupSnapshot) return;
    const blob = new Blob([JSON.stringify(backupSnapshot, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `impact_campus_backup_${backupSnapshot.exportedAt.slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleVerifyRestore = async () => {
    if (!backupSnapshot) return;
    setBackupBusy(true);
    try {
      const res = await apiFetch<NonNullable<typeof restoreResult>>('/api/system/restore-verify', {
        method: 'POST',
        body: JSON.stringify({
          tables: backupSnapshot.tables,
          checksum: backupSnapshot.checksum,
        }),
      });
      setRestoreResult(res);
      toast.success(res.verified ? 'Restore Integrity Verified (SHA-256 Match)' : 'Integrity Check Failed');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Restore verification failed');
    } finally {
      setBackupBusy(false);
    }
  };

  const handleRunTests = async () => {
    setTestRunning(true);
    try {
      const res = await apiFetch<NonNullable<typeof testResults>>(
        '/api/system/run-verification-suite',
        { method: 'POST' }
      );
      setTestResults(res);
      toast.success(`Verification Suite: ${res.passedCount}/${res.totalCount} workflows passed`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Verification suite failed');
    } finally {
      setTestRunning(false);
    }
  };

  const domains = [
    'All',
    'Institutional',
    'User & Identity',
    'Academic',
    'Examinations & Results',
    'Attendance',
    'Finance',
    'Student Lifecycle',
    'Communication',
    'System',
  ];
  const filteredTables =
    domainFilter === 'All'
      ? erTables
      : erTables.filter((t) => t.domain === domainFilter);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#1F2937] dark:text-[#FAF6F5]">
            Database Architecture, Security &amp; Governance
          </h1>
          <p className="text-xs text-[#6B7280] dark:text-[#B5A5A8] mt-0.5">
            {erTables.length || 60}-table PostgreSQL ER Explorer, RLS Policies, Account Provisioning, Backup Integrity &amp; 20-Workflow Tests
          </p>
        </div>

        <TabBar
          tabs={[
            { id: 'er-schema', label: `${erTables.length || 60}-Table ER & RLS` },
            ...(isAdmin
              ? [
                  { id: 'users', label: 'Users & Provisioning' },
                  { id: 'audit', label: 'Audit Logs' },
                  { id: 'settings', label: 'Settings' },
                  { id: 'backup', label: 'Backup & Verify' },
                  { id: 'tests', label: '20-Case Tests' },
                ]
              : []),
          ]}
          activeTab={tab}
          onChange={(id) => setTab(id as typeof tab)}
        />
      </div>

      {tab === 'er-schema' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5">
              {domains.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDomainFilter(d)}
                  className={`px-3 py-1.5 text-xs rounded-xl border transition-all cursor-pointer ${
                    domainFilter === d
                      ? 'wine-gradient text-white border-[#722F37] font-semibold shadow-sm'
                      : 'bg-white dark:bg-[#1B1214] text-[#4B3F42] dark:text-[#D8CCD0] border-[#E5E7EB] dark:border-[#332326] hover:bg-[#F7F3EE] dark:hover:bg-[#26191B]'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
            <span className="text-xs font-mono text-[#6B7280] dark:text-[#B5A5A8]">
              Showing {filteredTables.length} of {erTables.length} PostgreSQL tables
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTables.map((t) => (
              <Surface key={t.name} className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-[#722F37] dark:text-[#D48A94] flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5" />
                    {t.name}
                  </span>
                  <span className="text-[11px] text-[#6B7280] dark:text-[#B5A5A8]">{t.domain}</span>
                </div>
                <p className="text-xs text-[#4B3F42] dark:text-[#D8CCD0] leading-relaxed">
                  {t.summary}
                </p>
                <div className="pt-2 border-t border-[#E5E7EB] dark:border-[#332326] text-[11px] font-mono text-[#6B7280] dark:text-[#B5A5A8] space-y-1">
                  <p>Keys: {t.keyColumns.join(', ')}</p>
                  {t.foreignKeys.length > 0 && <p>FK → {t.foreignKeys.join(', ')}</p>}
                  <p className="font-sans text-[#4B3F42] dark:text-[#B5A5A8]">
                    Policy: {t.rlsPolicy}
                  </p>
                </div>
              </Surface>
            ))}
          </div>

          <Surface className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-semibold text-[#1F2937] dark:text-[#FAF6F5]">
                  PostgreSQL Row Level Security (RLS) Migration Script
                </h2>
                <p className="text-xs text-[#6B7280] dark:text-[#B5A5A8]">
                  Enforced both via server-side RBAC middleware and PostgreSQL policy DDL
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(rlsSql);
                  toast.success('Copied RLS SQL migration');
                }}
              >
                <Copy className="w-3.5 h-3.5" />
                Copy SQL
              </Button>
            </div>
            <pre className="p-4 rounded-xl bg-[#291115] text-[#FCFAF8] border border-[#422026] font-mono text-[11px] overflow-x-auto leading-relaxed">
              {rlsSql}
            </pre>
          </Surface>
        </div>
      )}

      {tab === 'users' && isAdmin && (
        <div className="space-y-6">
          {/* Controlled Account Provisioning Allowlist */}
          <Surface className="p-5 space-y-4">
            <div>
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-[#722F37] dark:text-[#D48A94]" />
                Institution-Controlled Account Provisioning ({provisions.length})
              </h2>
              <p className="text-xs text-[#6B7280] dark:text-[#B5A5A8] mt-0.5">
                Pre-authorized institutional emails bound to exact RBAC roles on Google SSO sign-in. External unprovisioned accounts remain pending approval.
              </p>
            </div>

            <form onSubmit={handleCreateProvision} className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
              <div>
                <FieldLabel required>Institutional Email</FieldLabel>
                <Input type="email" value={provForm.email} onChange={(e) => setProvForm({ ...provForm, email: e.target.value })} placeholder="name@impactcampus.edu.in" required />
              </div>
              <div>
                <FieldLabel required>Full Name</FieldLabel>
                <Input value={provForm.fullName} onChange={(e) => setProvForm({ ...provForm, fullName: e.target.value })} placeholder="Prof. Kavitha Rao" required />
              </div>
              <div>
                <FieldLabel required>Assigned Role</FieldLabel>
                <Select value={provForm.role} onChange={(e) => setProvForm({ ...provForm, role: e.target.value as AppRole })}>
                  <option value="super_admin">super_admin</option>
                  <option value="faculty">faculty</option>
                  <option value="student">student</option>
                  <option value="parent">parent</option>
                </Select>
              </div>
              <div>
                <FieldLabel>USN / Emp Code</FieldLabel>
                <Input value={provForm.referenceCode} onChange={(e) => setProvForm({ ...provForm, referenceCode: e.target.value })} placeholder="FAC-CSE-09" />
              </div>
              <Button type="submit" size="md">
                <Plus className="w-3.5 h-3.5" /> Provision Invite
              </Button>
            </form>

            <div className="border border-[#E5E7EB] dark:border-[#332326] rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#E5E7EB] dark:border-[#332326] bg-[#F7F3EE] dark:bg-[#221618] text-[#6B7280] dark:text-[#B5A5A8]">
                    <th className="py-2 px-4">Email</th>
                    <th className="py-2 px-4">Name</th>
                    <th className="py-2 px-4">Role</th>
                    <th className="py-2 px-4">Ref Code</th>
                    <th className="py-2 px-4">Status</th>
                    <th className="py-2 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E7EB] dark:divide-[#332326]">
                  {provisions.map((p) => (
                    <tr key={p.id} className="hover:bg-[#FCFAF8] dark:hover:bg-[#241719] transition-colors">
                      <td className="py-2 px-4 font-mono">{p.email}</td>
                      <td className="py-2 px-4 font-medium">{p.fullName}</td>
                      <td className="py-2 px-4 font-mono">{p.role}</td>
                      <td className="py-2 px-4 font-mono">{p.referenceCode || '—'}</td>
                      <td className="py-2 px-4">
                        <StatusText tone={p.status === 'claimed' ? 'success' : p.status === 'revoked' ? 'danger' : 'info'}>
                          {p.status.toUpperCase()}
                        </StatusText>
                      </td>
                      <td className="py-2 px-4 text-right">
                        {p.status === 'invited' && (
                          <Button size="sm" variant="outline" onClick={() => handleToggleProvision(p.id, 'revoked')}>
                            Revoke
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Surface>

          <Surface className="overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#E5E7EB] dark:border-[#332326]">
              <h2 className="text-sm font-semibold">User Accounts &amp; Roles ({users.length})</h2>
            </div>
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E5E7EB] dark:border-[#332326] bg-[#F7F3EE] dark:bg-[#221618] text-[#6B7280] dark:text-[#B5A5A8]">
                  <th className="py-2.5 px-4">Full Name</th>
                  <th className="py-2.5 px-4">Email</th>
                  <th className="py-2.5 px-4">Status / Type</th>
                  <th className="py-2.5 px-4">Role</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB] dark:divide-[#332326]">
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="py-2.5 px-4 font-medium">{u.fullName}</td>
                    <td className="py-2.5 px-4 font-mono">{u.email}</td>
                    <td className="py-2.5 px-4">
                      {u.isDemoAccount ? 'Demo Record' : 'Google SSO'} · <span className="font-mono">{u.accountStatus}</span>
                    </td>
                    <td className="py-2.5 px-4 w-48">
                      <Select
                        value={u.role}
                        onChange={(e) => handleRoleUpdate(u.id, e.target.value)}
                      >
                        <option value="super_admin">super_admin</option>
                        <option value="faculty">faculty</option>
                        <option value="student">student</option>
                        <option value="parent">parent</option>
                      </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Surface>

          <Surface className="overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#E5E7EB] dark:border-[#332326]">
              <h2 className="text-sm font-semibold">Role Permissions Matrix</h2>
            </div>
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E5E7EB] dark:border-[#332326] bg-[#F7F3EE] dark:bg-[#221618] text-[#6B7280] dark:text-[#B5A5A8]">
                  <th className="py-2.5 px-4">Role</th>
                  <th className="py-2.5 px-4">Resource</th>
                  <th className="py-2.5 px-4">Create</th>
                  <th className="py-2.5 px-4">Read</th>
                  <th className="py-2.5 px-4">Update</th>
                  <th className="py-2.5 px-4">Delete</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB] dark:divide-[#332326] font-mono">
                {permissions.map((p) => (
                  <tr key={p.id} className="hover:bg-[#FCFAF8] dark:hover:bg-[#241719] transition-colors">
                    <td className="py-2.5 px-4 font-semibold">{p.role}</td>
                    <td className="py-2.5 px-4">{p.resource}</td>
                    <td className="py-2.5 px-4">{p.canCreate ? 'YES' : 'NO'}</td>
                    <td className="py-2.5 px-4">{p.canRead ? 'YES' : 'NO'}</td>
                    <td className="py-2.5 px-4">{p.canUpdate ? 'YES' : 'NO'}</td>
                    <td className="py-2.5 px-4">{p.canDelete ? 'YES' : 'NO'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Surface>
        </div>
      )}

      {tab === 'audit' && isAdmin && (
        <Surface className="overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#E5E7EB] dark:border-[#332326]">
            <h2 className="text-sm font-semibold">System Audit Trail ({auditLogs.length})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E5E7EB] dark:border-[#332326] bg-[#F7F3EE] dark:bg-[#221618] text-[#6B7280] dark:text-[#B5A5A8]">
                  <th className="py-2.5 px-4">Timestamp (IST)</th>
                  <th className="py-2.5 px-4">Actor</th>
                  <th className="py-2.5 px-4">Action</th>
                  <th className="py-2.5 px-4">Entity</th>
                  <th className="py-2.5 px-4">Reason / Context</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB] dark:divide-[#332326]">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#FCFAF8] dark:hover:bg-[#241719] transition-colors">
                    <td className="py-2.5 px-4 font-mono tabular-nums text-[#6B7280] dark:text-[#B5A5A8]">
                      {formatIST(log.createdAt)}
                    </td>
                    <td className="py-2.5 px-4">
                      {log.actorName || 'System'} ({log.actorRole})
                    </td>
                    <td className="py-2.5 px-4 font-mono font-semibold text-[#722F37] dark:text-[#D48A94]">
                      {log.action}
                    </td>
                    <td className="py-2.5 px-4 font-mono">
                      {log.entityType}#{log.entityId}
                    </td>
                    <td className="py-2.5 px-4 text-[#4B3F42] dark:text-[#D8CCD0]">
                      {log.reason || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Surface>
      )}

      {tab === 'settings' && isAdmin && (
        <Surface className="p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-[#722F37] dark:text-[#D48A94]" />
            <h2 className="text-sm font-semibold">Institutional Configuration</h2>
          </div>
          <div className="divide-y divide-[#E5E7EB] dark:divide-[#332326]">
            {settingsList.map((s) => (
              <SettingRow key={s.id} item={s} onSave={handleSettingSave} />
            ))}
          </div>
        </Surface>
      )}

      {tab === 'backup' && isAdmin && (
        <Surface className="p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-[#1F2937] dark:text-[#FAF6F5] flex items-center gap-2">
                <HardDriveDownload className="w-4 h-4 text-[#722F37] dark:text-[#D48A94]" />
                Database Backup Snapshot &amp; SHA-256 Restore Integrity Verification
              </h2>
              <p className="text-xs text-[#6B7280] dark:text-[#B5A5A8] mt-1">
                Exports core institutional tables with a deterministic SHA-256 checksum and validates restore schema compatibility without altering production data.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={handleGenerateBackup} disabled={backupBusy}>
                <Database className="w-4 h-4" />
                {backupBusy ? 'Generating...' : 'Generate Snapshot'}
              </Button>
              {backupSnapshot && (
                <>
                  <Button variant="outline" onClick={handleDownloadBackupJson}>
                    <Download className="w-4 h-4" />
                    Export JSON
                  </Button>
                  <Button variant="teal" onClick={handleVerifyRestore} disabled={backupBusy}>
                    <ShieldCheck className="w-4 h-4" />
                    Verify Restore Integrity
                  </Button>
                </>
              )}
            </div>
          </div>

          {backupSnapshot && (
            <div className="p-4 rounded-xl border border-[#E5E7EB] dark:border-[#332326] space-y-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono font-bold text-[#722F37] dark:text-[#D48A94]">{backupSnapshot.schemaVersion}</span>
                <span className="font-mono text-[#6B7280] dark:text-[#B5A5A8]">SHA-256: {backupSnapshot.checksum}</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-[#E5E7EB] dark:border-[#332326] font-mono">
                {Object.entries(backupSnapshot.counts).map(([tableName, rowCount]) => (
                  <div key={tableName} className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[#FCFAF8] dark:bg-[#170F11]">
                    <span className="truncate mr-2 text-[#4B3F42] dark:text-[#B5A5A8]">{tableName}</span>
                    <strong>{rowCount}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}

          {restoreResult && (
            <div className="p-4 rounded-xl border border-[#E5E7EB] dark:border-[#332326] bg-[#FCFAF8]/80 dark:bg-[#170F11] text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold">Non-Mutating Restore Dry-Run Result</span>
                <StatusText tone={restoreResult.verified ? 'success' : 'danger'}>
                  {restoreResult.verified ? 'VERIFIED · CHECKSUM MATCH' : 'FAILED'}
                </StatusText>
              </div>
              <p className="text-[#4B3F42] dark:text-[#D8CCD0]">{restoreResult.detail}</p>
              <p className="font-mono text-[#6B7280] dark:text-[#B5A5A8]">
                Live DB Verified: {restoreResult.liveCounts.liveStudents} students · {restoreResult.liveCounts.liveEnrollments} enrollments · {restoreResult.liveCounts.liveAssessmentMarks} component marks
              </p>
            </div>
          )}
        </Surface>
      )}

      {tab === 'tests' && isAdmin && (
        <Surface className="p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-[#1F2937] dark:text-[#FAF6F5] flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#722F37] dark:text-[#D48A94]" />
                Live Database &amp; Security Verification Suite (20 Critical Workflows)
              </h2>
              <p className="text-xs text-[#6B7280] dark:text-[#B5A5A8] mt-1">
                Executes live transactional tests against Cloud SQL PostgreSQL (student lifecycle, year isolation, QR verification, AI policy, RBAC, CIE/SEE marks, SGPA/CGPA, backlogs, revaluation, account provisioning, and backup checksum) and cleans up synthetic rows.
              </p>
            </div>
            <Button onClick={handleRunTests} disabled={testRunning}>
              <Play className="w-4 h-4" />
              {testRunning ? 'Running 20 Workflows...' : 'Run All 20 Tests'}
            </Button>
          </div>

          {testResults && (
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-[#FCFAF8] dark:bg-[#170F11] border border-[#E5E7EB] dark:border-[#332326] flex items-center justify-between text-sm">
                <span className="font-medium">Execution Summary</span>
                <span className="font-mono font-bold text-[#15803D] dark:text-[#4ADE80]">
                  {testResults.passedCount} / {testResults.totalCount} Passed
                </span>
              </div>
              <div className="divide-y divide-[#E5E7EB] dark:divide-[#332326] border border-[#E5E7EB] dark:border-[#332326] rounded-xl">
                {testResults.results.map((r) => (
                  <div key={r.id} className="px-4 py-3 flex items-start justify-between gap-4 text-xs">
                    <div>
                      <p className="font-medium text-[#1F2937] dark:text-[#FAF6F5]">
                        {String(r.id).padStart(2, '0')}. {r.name}
                      </p>
                      <p className="text-[#6B7280] dark:text-[#B5A5A8] font-mono mt-0.5">{r.detail}</p>
                    </div>
                    {r.passed ? (
                      <StatusText tone="success">
                        <CheckCircle2 className="w-4 h-4" /> PASS
                      </StatusText>
                    ) : (
                      <StatusText tone="danger">
                        <XCircle className="w-4 h-4" /> FAIL
                      </StatusText>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </Surface>
      )}
    </div>
  );
};

const SettingRow: React.FC<{
  item: { settingKey: string; settingValue: string; description: string | null };
  onSave: (k: string, v: string) => void;
}> = ({ item, onSave }) => {
  const [val, setVal] = useState(item.settingValue);
  return (
    <div className="py-3.5 flex flex-wrap items-center justify-between gap-4">
      <div className="max-w-md">
        <p className="font-mono text-xs font-semibold text-[#1F2937] dark:text-[#FAF6F5]">
          {item.settingKey}
        </p>
        <p className="text-xs text-[#6B7280] dark:text-[#B5A5A8] mt-0.5">{item.description}</p>
      </div>
      <div className="flex items-center gap-2 min-w-[260px]">
        <Input value={val} onChange={(e) => setVal(e.target.value)} />
        <Button size="sm" variant="outline" onClick={() => onSave(item.settingKey, val)}>
          Save
        </Button>
      </div>
    </div>
  );
};
