import { Router, type IRouter } from "express";
import { eq, and, sql, count } from "drizzle-orm";
import { db, identitiesTable, habitsTable, habitLogsTable } from "@workspace/db";
import { CreateIdentityBody, UpdateIdentityBody, UpdateIdentityParams, DeleteIdentityParams } from "@workspace/api-zod";
import { requireAuth, type AuthRequest } from "../lib/auth";

const router: IRouter = Router();

async function buildIdentityResponse(identity: typeof identitiesTable.$inferSelect, userId: number) {
  const habitCountResult = await db
    .select({ count: count() })
    .from(habitsTable)
    .where(and(eq(habitsTable.identityId, identity.id), eq(habitsTable.userId, userId)));
  const habitCount = habitCountResult[0]?.count ?? 0;

  const evidenceResult = await db
    .select({ count: count() })
    .from(habitLogsTable)
    .where(and(
      eq(habitLogsTable.userId, userId),
      eq(habitLogsTable.completed, true),
      sql`EXISTS (SELECT 1 FROM habits WHERE habits.id = ${habitLogsTable.habitId} AND habits.identity_id = ${identity.id})`
    ));
  const evidenceCount = evidenceResult[0]?.count ?? 0;

  // Simple consistency: completed days / total days tracked (last 30)
  let consistencyScore: number | null = null;
  if (Number(habitCount) > 0) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dateStr = thirtyDaysAgo.toISOString().slice(0, 10);

    const recentEvidence = await db
      .select({ count: count() })
      .from(habitLogsTable)
      .where(and(
        eq(habitLogsTable.userId, userId),
        eq(habitLogsTable.completed, true),
        sql`${habitLogsTable.date} >= ${dateStr}`,
        sql`EXISTS (SELECT 1 FROM habits WHERE habits.id = ${habitLogsTable.habitId} AND habits.identity_id = ${identity.id})`
      ));
    const recentCount = recentEvidence[0]?.count ?? 0;
    consistencyScore = Math.min(100, Math.round((Number(recentCount) / 30) * 100));
  }

  return {
    ...identity,
    habitCount: Number(habitCount),
    evidenceCount: Number(evidenceCount),
    consistencyScore,
  };
}

router.get("/identities", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const identities = await db
    .select()
    .from(identitiesTable)
    .where(eq(identitiesTable.userId, req.userId!))
    .orderBy(identitiesTable.createdAt);

  const result = await Promise.all(identities.map((i) => buildIdentityResponse(i, req.userId!)));
  res.json(result);
});

router.post("/identities", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const parsed = CreateIdentityBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [identity] = await db.insert(identitiesTable).values({
    userId: req.userId!,
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    colorKey: parsed.data.colorKey ?? null,
  }).returning();

  const result = await buildIdentityResponse(identity, req.userId!);
  res.status(201).json(result);
});

router.patch("/identities/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const params = UpdateIdentityParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateIdentityBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db.select().from(identitiesTable)
    .where(and(eq(identitiesTable.id, params.data.id), eq(identitiesTable.userId, req.userId!)));
  if (!existing) {
    res.status(404).json({ error: "Identity not found" });
    return;
  }

  const updateData: Partial<typeof identitiesTable.$inferInsert> = {};
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
  if (parsed.data.description !== undefined) updateData.description = parsed.data.description;
  if (parsed.data.colorKey !== undefined) updateData.colorKey = parsed.data.colorKey;

  const [updated] = await db.update(identitiesTable)
    .set(updateData)
    .where(and(eq(identitiesTable.id, params.data.id), eq(identitiesTable.userId, req.userId!)))
    .returning();

  const result = await buildIdentityResponse(updated, req.userId!);
  res.json(result);
});

router.delete("/identities/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const params = DeleteIdentityParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [existing] = await db.select().from(identitiesTable)
    .where(and(eq(identitiesTable.id, params.data.id), eq(identitiesTable.userId, req.userId!)));
  if (!existing) {
    res.status(404).json({ error: "Identity not found" });
    return;
  }

  await db.delete(identitiesTable)
    .where(and(eq(identitiesTable.id, params.data.id), eq(identitiesTable.userId, req.userId!)));

  res.sendStatus(204);
});

export default router;
