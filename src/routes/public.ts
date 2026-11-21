import { Router } from 'express';
import { count, eq, isNull } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { ensureSeedData } from '../db/seed.ts';
import {
  academicYears,
  departments,
  institutions,
  programs,
  systemSettings,
} from '../db/schema.ts';
import { getBiometricProviderStatus } from '../services/biometric.ts';

export const publicRouter = Router();

publicRouter.get('/overview', async (_req, res) => {
  try {
    await ensureSeedData();
    const [inst] = await db.select().from(institutions).limit(1);
    const depts = await db
      .select({
        id: departments.id,
        code: departments.code,
        name: departments.name,
        building: departments.building,
      })
      .from(departments)
      .where(isNull(departments.deletedAt));

    const [{ totalPrograms }] = await db
      .select({ totalPrograms: count() })
      .from(programs)
      .where(isNull(programs.deletedAt));

    const years = await db
      .select({
        id: academicYears.id,
        code: academicYears.code,
        label: academicYears.label,
        isCurrent: academicYears.isCurrent,
        status: academicYears.status,
      })
      .from(academicYears);

    const publicSettings = await db
      .select({
        key: systemSettings.settingKey,
        value: systemSettings.settingValue,
      })
      .from(systemSettings)
      .where(eq(systemSettings.isPublic, true));

    res.json({
      institution: inst,
      departments: depts,
      totalPrograms,
      academicYears: years,
      settings: Object.fromEntries(publicSettings.map((s) => [s.key, s.value])),
      biometricProvider: getBiometricProviderStatus(),
    });
  } catch (error) {
    console.error('Public overview error:', error);
    res.status(500).json({ error: 'Failed to load institutional overview' });
  }
});
