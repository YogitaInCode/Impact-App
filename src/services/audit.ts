import { db } from '../db/index.ts';
import { auditLogs, notifications } from '../db/schema.ts';

export async function recordAuditLog(params: {
  actorProfileId?: number | null;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string | number;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
  reason?: string | null;
  ipAddress?: string | null;
}) {
  try {
    await db.insert(auditLogs).values({
      actorProfileId: params.actorProfileId ?? null,
      actorRole: params.actorRole,
      action: params.action,
      entityType: params.entityType,
      entityId: String(params.entityId),
      beforeStateJson: params.beforeState ?? null,
      afterStateJson: params.afterState ?? null,
      reason: params.reason ?? null,
      ipAddress: params.ipAddress ?? null,
    });
  } catch (err) {
    console.error('Failed to record audit log:', err);
  }
}

export async function dispatchNotification(params: {
  recipientProfileId: number;
  category:
    | 'attendance'
    | 'low_attendance'
    | 'timetable'
    | 'examination'
    | 'fee'
    | 'announcement';
  title: string;
  message: string;
  actionUrl?: string;
}) {
  try {
    await db.insert(notifications).values({
      recipientProfileId: params.recipientProfileId,
      category: params.category,
      title: params.title,
      message: params.message,
      actionUrl: params.actionUrl ?? null,
      isRead: false,
    });
  } catch (err) {
    console.error('Failed to dispatch notification:', err);
  }
}
