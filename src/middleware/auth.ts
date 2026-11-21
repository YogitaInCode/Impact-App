import { NextFunction, Request, Response } from 'express';
import { DecodedIdToken } from 'firebase-admin/auth';
import { and, eq, inArray } from 'drizzle-orm';
import { adminAuth } from '../lib/firebase-admin.ts';
import { db } from '../db/index.ts';
import {
  accountProvisions,
  faculty,
  parents,
  profiles,
  studentParentLinks,
  students,
} from '../db/schema.ts';
import { recordAuditLog } from '../services/audit.ts';

export type AppRole = 'super_admin' | 'faculty' | 'student' | 'parent';

export const DEMO_UID_BY_ROLE: Record<AppRole, string> = {
  super_admin: 'demo-uid-super-admin',
  faculty: 'demo-uid-faculty-rao',
  student: 'demo-uid-student-aarav',
  parent: 'demo-uid-parent-sharma',
};

export interface EffectiveProfile {
  id: number;
  uid: string;
  email: string;
  fullName: string;
  role: AppRole;
  avatarUrl: string | null;
  isDemoAccount: boolean;
  accountStatus: string;
  studentId: number | null;
  facultyId: number | null;
  parentId: number | null;
  linkedStudentIds: number[];
}

export interface AuthRequest extends Request {
  firebaseUser?: DecodedIdToken;
  actorProfile?: typeof profiles.$inferSelect;
  effectiveProfile?: EffectiveProfile;
}

// Simple sliding-window in-memory rate limiter for sensitive endpoints
const rateBuckets = new Map<string, number[]>();

export function rateLimit(maxRequests: number, windowMs: number) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const key = `${req.effectiveProfile?.uid || req.ip || 'anon'}:${req.path}`;
    const now = Date.now();
    const recent = (rateBuckets.get(key) || []).filter((ts) => now - ts < windowMs);
    if (recent.length >= maxRequests) {
      return res.status(429).json({
        error: 'Rate limit exceeded. Please wait before retrying this operation.',
      });
    }
    recent.push(now);
    rateBuckets.set(key, recent);
    next();
  };
}

async function resolveEffectiveContext(
  profileRow: typeof profiles.$inferSelect
): Promise<EffectiveProfile> {
  let studentId: number | null = null;
  let facultyId: number | null = null;
  let parentId: number | null = null;
  let linkedStudentIds: number[] = [];

  if (profileRow.role === 'student') {
    const [s] = await db
      .select({ id: students.id })
      .from(students)
      .where(eq(students.profileId, profileRow.id));
    studentId = s?.id ?? null;
  } else if (profileRow.role === 'faculty') {
    const [f] = await db
      .select({ id: faculty.id })
      .from(faculty)
      .where(eq(faculty.profileId, profileRow.id));
    facultyId = f?.id ?? null;
  } else if (profileRow.role === 'parent') {
    const [p] = await db
      .select({ id: parents.id })
      .from(parents)
      .where(eq(parents.profileId, profileRow.id));
    parentId = p?.id ?? null;
    if (parentId) {
      const links = await db
        .select({ studentId: studentParentLinks.studentId })
        .from(studentParentLinks)
        .where(eq(studentParentLinks.parentId, parentId));
      linkedStudentIds = links.map((l) => l.studentId);
    }
  }

  return {
    id: profileRow.id,
    uid: profileRow.uid,
    email: profileRow.email,
    fullName: profileRow.fullName,
    role: profileRow.role as AppRole,
    avatarUrl: profileRow.avatarUrl,
    isDemoAccount: profileRow.isDemoAccount,
    accountStatus: profileRow.accountStatus,
    studentId,
    facultyId,
    parentId,
    linkedStudentIds,
  };
}

export async function getOrCreateProfileForFirebaseUser(
  decoded: DecodedIdToken
): Promise<typeof profiles.$inferSelect> {
  const email = (decoded.email || `${decoded.uid}@impactcampus.local`).trim().toLowerCase();
  const fullName =
    (decoded.name as string | undefined) ||
    email.split('@')[0] ||
    'Campus User';
  const avatarUrl = (decoded.picture as string | undefined) || null;

  const existing = await db
    .select()
    .from(profiles)
    .where(eq(profiles.uid, decoded.uid));

  if (existing.length > 0) {
    const current = existing[0];
    // Re-check institutional provision if account is still pending_approval
    if (current.accountStatus === 'pending_approval') {
      const [provision] = await db
        .select()
        .from(accountProvisions)
        .where(
          and(
            eq(accountProvisions.email, email),
            eq(accountProvisions.status, 'invited')
          )
        );
      if (provision) {
        const [activated] = await db.transaction(async (tx) => {
          const [prof] = await tx
            .update(profiles)
            .set({
              role: provision.role,
              fullName: provision.fullName || fullName,
              accountStatus: 'active',
              lastLoginAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(profiles.id, current.id))
            .returning();

          if (provision.linkedStudentId) {
            await tx
              .update(students)
              .set({ profileId: prof.id, updatedAt: new Date() })
              .where(eq(students.id, provision.linkedStudentId));
          } else if (provision.linkedFacultyId) {
            await tx
              .update(faculty)
              .set({ profileId: prof.id, updatedAt: new Date() })
              .where(eq(faculty.id, provision.linkedFacultyId));
          } else if (provision.linkedParentId) {
            await tx
              .update(parents)
              .set({ profileId: prof.id, updatedAt: new Date() })
              .where(eq(parents.id, provision.linkedParentId));
          }

          await tx
            .update(accountProvisions)
            .set({
              status: 'claimed',
              claimedProfileId: prof.id,
              claimedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(accountProvisions.id, provision.id));

          return [prof];
        });

        await recordAuditLog({
          actorProfileId: activated.id,
          actorRole: activated.role,
          action: 'ACCOUNT_PROVISION_CLAIMED',
          entityType: 'account_provisions',
          entityId: provision.id,
          afterState: { email, role: activated.role },
        });
        return activated;
      }
    }

    const [updated] = await db
      .update(profiles)
      .set({
        email,
        lastLoginAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(profiles.id, current.id))
      .returning();
    return updated;
  }

  // 1. Check institution-controlled account_provisions allowlist
  const [provision] = await db
    .select()
    .from(accountProvisions)
    .where(
      and(
        eq(accountProvisions.email, email),
        eq(accountProvisions.status, 'invited')
      )
    );

  if (provision) {
    const created = await db.transaction(async (tx) => {
      const [prof] = await tx
        .insert(profiles)
        .values({
          uid: decoded.uid,
          email,
          fullName: provision.fullName || fullName,
          role: provision.role,
          avatarUrl,
          isDemoAccount: false,
          accountStatus: 'active',
          lastLoginAt: new Date(),
        })
        .returning();

      if (provision.linkedStudentId) {
        await tx
          .update(students)
          .set({ profileId: prof.id, updatedAt: new Date() })
          .where(eq(students.id, provision.linkedStudentId));
      } else if (provision.linkedFacultyId) {
        await tx
          .update(faculty)
          .set({ profileId: prof.id, updatedAt: new Date() })
          .where(eq(faculty.id, provision.linkedFacultyId));
      } else if (provision.linkedParentId) {
        await tx
          .update(parents)
          .set({ profileId: prof.id, updatedAt: new Date() })
          .where(eq(parents.id, provision.linkedParentId));
      }

      await tx
        .update(accountProvisions)
        .set({
          status: 'claimed',
          claimedProfileId: prof.id,
          claimedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(accountProvisions.id, provision.id));

      return prof;
    });

    await recordAuditLog({
      actorProfileId: created.id,
      actorRole: created.role,
      action: 'ACCOUNT_PROVISION_CLAIMED',
      entityType: 'account_provisions',
      entityId: provision.id,
      afterState: { email, role: created.role },
    });
    return created;
  }

  // 2. Controlled Bootstrap: Only allow automatic super_admin if 0 non-demo admins exist
  // AND (INITIAL_ADMIN_EMAIL matches OR 0 non-demo profiles exist yet).
  const realNonDemoProfiles = await db
    .select({ id: profiles.id, role: profiles.role })
    .from(profiles)
    .where(eq(profiles.isDemoAccount, false));

  const configuredBootstrapEmail = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
  const hasRealAdmin = realNonDemoProfiles.some((p) => p.role === 'super_admin');
  const isBootstrapAdmin =
    !hasRealAdmin &&
    (configuredBootstrapEmail
      ? email === configuredBootstrapEmail
      : realNonDemoProfiles.length === 0);

  const assignedRole: AppRole = isBootstrapAdmin ? 'super_admin' : 'student';
  const assignedStatus = isBootstrapAdmin ? 'active' : 'pending_approval';

  const [created] = await db
    .insert(profiles)
    .values({
      uid: decoded.uid,
      email,
      fullName,
      role: assignedRole,
      avatarUrl,
      isDemoAccount: false,
      accountStatus: assignedStatus,
      lastLoginAt: new Date(),
    })
    .onConflictDoUpdate({
      target: profiles.uid,
      set: {
        email,
        lastLoginAt: new Date(),
        updatedAt: new Date(),
      },
    })
    .returning();

  await recordAuditLog({
    actorProfileId: created.id,
    actorRole: created.role,
    action: isBootstrapAdmin ? 'BOOTSTRAP_SUPER_ADMIN_CLAIMED' : 'UNPROVISIONED_SIGNIN_PENDING',
    entityType: 'profiles',
    entityId: created.id,
    afterState: { email, role: assignedRole, accountStatus: assignedStatus },
  });

  return created;
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res
      .status(401)
      .json({ error: 'Unauthorized: Missing Firebase Bearer token' });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.firebaseUser = decodedToken;

    const actorProfile = await getOrCreateProfileForFirebaseUser(decodedToken);
    if (actorProfile.accountStatus === 'suspended') {
      return res.status(403).json({ error: 'Account suspended by institution administrator' });
    }
    req.actorProfile = actorProfile;

    // Controlled Demo Role Switcher: only switches among seeded isDemoAccount=true personas
    const requestedDemoRole = req.headers['x-demo-role'] as string | undefined;
    if (
      process.env.ALLOW_DEMO_ROLE_SWITCHER !== 'false' &&
      requestedDemoRole &&
      requestedDemoRole in DEMO_UID_BY_ROLE
    ) {
      const demoUid = DEMO_UID_BY_ROLE[requestedDemoRole as AppRole];
      const [demoProfile] = await db
        .select()
        .from(profiles)
        .where(eq(profiles.uid, demoUid));
      if (demoProfile && demoProfile.isDemoAccount) {
        req.effectiveProfile = await resolveEffectiveContext(demoProfile);
        return next();
      }
    }

    // Unprovisioned live Google accounts cannot access institutional endpoints until approved
    // (Wait: allow GET /api/me so the frontend can display their Pending Provisioning screen)
    const isSessionEndpoint = req.baseUrl === '/api' && req.path === '/me';
    if (actorProfile.accountStatus === 'pending_approval' && !isSessionEndpoint) {
      return res.status(403).json({
        error:
          'Institutional approval required: Your Google account has not been provisioned by ICEAS Administration yet.',
        pendingApproval: true,
      });
    }

    req.effectiveProfile = await resolveEffectiveContext(actorProfile);
    next();
  } catch (error) {
    console.error('Auth verification failed:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
  }
};

export const requireRole = (...allowedRoles: AppRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const role = req.effectiveProfile?.role;
    if (!role || !allowedRoles.includes(role)) {
      return res.status(403).json({
        error: `Forbidden: Role '${role || 'unknown'}' is not authorized for this resource`,
      });
    }
    next();
  };
};

export async function assertStudentAccess(
  req: AuthRequest,
  studentId: number
): Promise<boolean> {
  const eff = req.effectiveProfile;
  if (!eff) return false;
  if (eff.role === 'super_admin' || eff.role === 'faculty') {
    return true;
  }
  if (eff.role === 'student') {
    return eff.studentId === studentId;
  }
  if (eff.role === 'parent') {
    return eff.linkedStudentIds.includes(studentId);
  }
  return false;
}

export async function getParentLinkedStudentIds(parentId: number): Promise<number[]> {
  const rows = await db
    .select({ studentId: studentParentLinks.studentId })
    .from(studentParentLinks)
    .where(eq(studentParentLinks.parentId, parentId));
  return rows.map((r) => r.studentId);
}

export { inArray };
