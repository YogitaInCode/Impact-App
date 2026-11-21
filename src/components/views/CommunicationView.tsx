import React, { useCallback, useEffect, useState } from 'react';
import { Bell, CheckCheck, Megaphone, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';
import { formatIST } from '../../lib/utils';
import { Button, FieldLabel, Input, Modal, Select, StatusText, Surface, Textarea } from '../ui/primitives';

export const CommunicationView: React.FC<{ initialTab?: 'announcements' | 'notifications' }> = ({
  initialTab = 'announcements',
}) => {
  const { effectiveProfile, refreshSession, apiFetch } = useAuth();
  const isStaff =
    effectiveProfile?.role === 'super_admin' || effectiveProfile?.role === 'faculty';

  const [tab, setTab] = useState<'announcements' | 'notifications'>(initialTab);
  const [announcements, setAnnouncements] = useState<
    {
      id: number;
      title: string;
      body: string;
      targetScope: string;
      departmentCode: string | null;
      priority: string;
      publishedAt: string;
      authorName: string;
      authorRole: string;
    }[]
  >([]);
  const [notifications, setNotifications] = useState<
    {
      id: number;
      category: string;
      title: string;
      message: string;
      isRead: boolean;
      createdAt: string;
    }[]
  >([]);
  const [departments, setDepartments] = useState<{ id: number; code: string; name: string }[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    title: '',
    body: '',
    targetScope: 'college',
    targetDepartmentId: '',
    priority: 'normal',
  });

  const load = useCallback(async () => {
    try {
      const [annRes, notifRes, refRes] = await Promise.all([
        apiFetch<{ announcements: typeof announcements }>('/api/system/announcements'),
        apiFetch<{ notifications: typeof notifications }>('/api/system/notifications'),
        apiFetch<{ departments: typeof departments }>('/api/reference-data'),
      ]);
      setAnnouncements(annRes.announcements);
      setNotifications(notifRes.notifications);
      setDepartments(refRes.departments);
    } catch (err) {
      console.error('Failed loading communication:', err);
    }
  }, [apiFetch]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/system/announcements', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      toast.success('Announcement published & notifications dispatched');
      setCreateOpen(false);
      setForm({ title: '', body: '', targetScope: 'college', targetDepartmentId: '', priority: 'normal' });
      await Promise.all([load(), refreshSession()]);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to publish announcement');
    }
  };

  const handleMarkRead = async (id: number) => {
    try {
      await apiFetch(`/api/system/notifications/${id}/read`, { method: 'PATCH' });
      await Promise.all([load(), refreshSession()]);
    } catch {
      // ignore
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await apiFetch('/api/system/notifications/read-all', { method: 'POST' });
      toast.success('All notifications marked read');
      await Promise.all([load(), refreshSession()]);
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#1F2937] dark:text-[#FAF6F5]">
            Announcements &amp; Notifications
          </h1>
          <p className="text-xs text-[#6B7280] dark:text-[#B5A5A8] mt-0.5">
            Targeted institutional circulars and real-time attendance, exam, and fee alerts
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 p-1 bg-[#F7F3EE] dark:bg-[#221618] rounded-2xl border border-[#E5E7EB] dark:border-[#332326]">
            <button
              type="button"
              onClick={() => setTab('announcements')}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-xl cursor-pointer transition-all ${
                tab === 'announcements'
                  ? 'bg-white dark:bg-[#120B0D] text-[#722F37] dark:text-[#D48A94] shadow-sm font-semibold'
                  : 'text-[#6B7280] dark:text-[#B5A5A8]'
              }`}
            >
              Announcements ({announcements.length})
            </button>
            <button
              type="button"
              onClick={() => setTab('notifications')}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-xl cursor-pointer transition-all ${
                tab === 'notifications'
                  ? 'bg-white dark:bg-[#120B0D] text-[#722F37] dark:text-[#D48A94] shadow-sm font-semibold'
                  : 'text-[#6B7280] dark:text-[#B5A5A8]'
              }`}
            >
              My Alerts ({notifications.filter((n) => !n.isRead).length} unread)
            </button>
          </div>

          {isStaff && tab === 'announcements' && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="w-3.5 h-3.5" />
              Publish Circular
            </Button>
          )}
          {tab === 'notifications' && (
            <Button size="sm" variant="outline" onClick={handleMarkAllRead}>
              <CheckCheck className="w-3.5 h-3.5" />
              Mark All Read
            </Button>
          )}
        </div>
      </div>

      {tab === 'announcements' ? (
        <div className="space-y-4">
          {announcements.map((ann) => (
            <Surface key={ann.id} className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#6B7280] dark:text-[#B5A5A8]">
                <div className="flex items-center gap-2">
                  <Megaphone className="w-3.5 h-3.5 text-[#722F37] dark:text-[#D48A94]" />
                  <span className="capitalize font-medium text-[#1F2937] dark:text-[#E2D6D8]">
                    Scope: {ann.targetScope}
                    {ann.departmentCode ? ` (${ann.departmentCode})` : ''}
                  </span>
                  <span>·</span>
                  <span>{ann.authorName}</span>
                </div>
                <div className="flex items-center gap-2">
                  {ann.priority === 'urgent' && <StatusText tone="danger">Urgent</StatusText>}
                  {ann.priority === 'important' && <StatusText tone="warning">Important</StatusText>}
                  <span className="font-mono">{formatIST(ann.publishedAt)}</span>
                </div>
              </div>
              <h2 className="text-base font-semibold text-[#1F2937] dark:text-[#FAF6F5] mt-2">
                {ann.title}
              </h2>
              <p className="text-sm text-[#6B7280] dark:text-[#B5A5A8] mt-1.5 leading-relaxed">
                {ann.body}
              </p>
            </Surface>
          ))}
        </div>
      ) : (
        <Surface className="divide-y divide-[#E5E7EB] dark:divide-[#332326] overflow-hidden">
          {notifications.length === 0 ? (
            <div className="p-10 text-center text-xs text-[#6B7280] dark:text-[#B5A5A8]">
              No notifications in your inbox yet.
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className={`p-4 flex items-start justify-between gap-4 ${
                  !n.isRead ? 'bg-[#F7F3EE]/80 dark:bg-[#2E1A1E]/45' : ''
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs text-[#6B7280] dark:text-[#B5A5A8]">
                    <Bell className="w-3.5 h-3.5 text-[#722F37] dark:text-[#D48A94]" />
                    <span className="uppercase font-mono">{n.category.replace('_', ' ')}</span>
                    <span>·</span>
                    <span>{formatIST(n.createdAt)}</span>
                  </div>
                  <p className="text-sm font-medium text-[#1F2937] dark:text-[#FAF6F5]">
                    {n.title}
                  </p>
                  <p className="text-xs text-[#6B7280] dark:text-[#B5A5A8]">{n.message}</p>
                </div>
                {!n.isRead && (
                  <Button size="sm" variant="ghost" onClick={() => handleMarkRead(n.id)}>
                    Mark Read
                  </Button>
                )}
              </div>
            ))
          )}
        </Surface>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Publish Announcement">
        <form onSubmit={handlePublish} className="space-y-4">
          <div>
            <FieldLabel required>Title</FieldLabel>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <FieldLabel>Target Scope</FieldLabel>
              <Select
                value={form.targetScope}
                onChange={(e) => setForm({ ...form, targetScope: e.target.value })}
              >
                <option value="college">Entire College</option>
                <option value="department">Specific Department</option>
                <option value="semester">Specific Semester</option>
                <option value="section">Specific Section</option>
              </Select>
            </div>
            <div>
              <FieldLabel>Priority</FieldLabel>
              <Select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
              >
                <option value="normal">Normal</option>
                <option value="important">Important</option>
                <option value="urgent">Urgent</option>
              </Select>
            </div>
          </div>
          {form.targetScope === 'department' && (
            <div>
              <FieldLabel>Department</FieldLabel>
              <Select
                value={form.targetDepartmentId}
                onChange={(e) => setForm({ ...form, targetDepartmentId: e.target.value })}
              >
                <option value="">Select Department</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </div>
          )}
          <div>
            <FieldLabel required>Message</FieldLabel>
            <Textarea
              rows={4}
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              required
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Publish & Notify</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
