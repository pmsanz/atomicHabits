import { Router, type IRouter } from "express";
import { eq, and, sql, desc, count } from "drizzle-orm";
import { db, habitsTable, habitLogsTable, identitiesTable } from "@workspace/db";
import { CreateHabitBody, UpdateHabitBody, GetHabitParams, UpdateHabitParams, DeleteHabitParams } from "@workspace/api-zod";
import { requireAuth, type AuthRequest } from "../lib/auth";

const router: IRouter = Router();

async function buildHabitResponse(habit: typeof habitsTable.$inferSelect, userId: number) {
  const today = new Date().toISOString().slice(0, 10);

  // Get today's log
  const [todayLog] = await db.select().from(habitLogsTable)
    .where(and(
      eq(habitLogsTable.habitId, habit.id),
      eq(habitLogsTable.userId, userId),
      eq(habitLogsTable.date, today),
    ));

  // Calculate streak
  let streak = 0;
  const logs = await db.select({ date: habitLogsTable.date, completed: habitLogsTable.completed })
    .from(habitLogsTable)
    .where(and(
      eq(habitLogsTable.habitId, habit.id),
      eq(habitLogsTable.userId, userId),
      eq(habitLogsTable.completed, true),
    ))
    .orderBy(desc(habitLogsTable.date));

  if (logs.length > 0) {
    const check = new Date();
    // start from today or yesterday if today not completed
    if (!todayLog?.completed) check.setDate(check.getDate() - 1);
    for (const log of logs) {
      const logDate = log.date;
      const expected = check.toISOString().slice(0, 10);
      if (logDate === expected) {
        streak++;
        check.setDate(check.getDate() - 1);
      } else {
        break;
      }
    }
  }

  // Get identity info
  let identityName: string | null = null;
  let identityColorKey: string | null = null;
  if (habit.identityId) {
    const [identity] = await db.select().from(identitiesTable).where(eq(identitiesTable.id, habit.identityId));
    identityName = identity?.name ?? null;
    identityColorKey = identity?.colorKey ?? null;
  }

  return {
    ...habit,
    identityName,
    identityColorKey,
    streak,
    todayCompleted: todayLog?.completed ?? false,
    todayLogId: todayLog?.id ?? null,
  };
}

router.get("/habits", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const habits = await db.select().from(habitsTable)
    .where(and(eq(habitsTable.userId, req.userId!), eq(habitsTable.isActive, true)))
    .orderBy(habitsTable.createdAt);

  const result = await Promise.all(habits.map((h) => buildHabitResponse(h, req.userId!)));
  res.json(result);
});

router.post("/habits", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const parsed = CreateHabitBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [habit] = await db.insert(habitsTable).values({
    userId: req.userId!,
    name: parsed.data.name,
    identityId: parsed.data.identityId ?? null,
    description: parsed.data.description ?? null,
    habitType: parsed.data.habitType,
    frequency: parsed.data.frequency,
    targetValue: parsed.data.targetValue ?? null,
    targetUnit: parsed.data.targetUnit ?? null,
    minimumVersion: parsed.data.minimumVersion ?? null,
    idealVersion: parsed.data.idealVersion ?? null,
    cueType: parsed.data.cueType ?? null,
    cueDescription: parsed.data.cueDescription ?? null,
    rewardDescription: parsed.data.rewardDescription ?? null,
    frictionNotes: parsed.data.frictionNotes ?? null,
    environmentDesignNotes: parsed.data.environmentDesignNotes ?? null,
  }).returning();

  const result = await buildHabitResponse(habit, req.userId!);
  res.status(201).json(result);
});

router.get("/habits/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const params = GetHabitParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [habit] = await db.select().from(habitsTable)
    .where(and(eq(habitsTable.id, params.data.id), eq(habitsTable.userId, req.userId!)));
  if (!habit) {
    res.status(404).json({ error: "Habit not found" });
    return;
  }

  const result = await buildHabitResponse(habit, req.userId!);
  res.json(result);
});

router.patch("/habits/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const params = UpdateHabitParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateHabitBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db.select().from(habitsTable)
    .where(and(eq(habitsTable.id, params.data.id), eq(habitsTable.userId, req.userId!)));
  if (!existing) {
    res.status(404).json({ error: "Habit not found" });
    return;
  }

  const updateData: Partial<typeof habitsTable.$inferInsert> = {};
  const d = parsed.data;
  if (d.name !== undefined) updateData.name = d.name;
  if (d.identityId !== undefined) updateData.identityId = d.identityId;
  if (d.description !== undefined) updateData.description = d.description;
  if (d.habitType !== undefined) updateData.habitType = d.habitType;
  if (d.frequency !== undefined) updateData.frequency = d.frequency;
  if (d.targetValue !== undefined) updateData.targetValue = d.targetValue;
  if (d.targetUnit !== undefined) updateData.targetUnit = d.targetUnit;
  if (d.minimumVersion !== undefined) updateData.minimumVersion = d.minimumVersion;
  if (d.idealVersion !== undefined) updateData.idealVersion = d.idealVersion;
  if (d.cueType !== undefined) updateData.cueType = d.cueType;
  if (d.cueDescription !== undefined) updateData.cueDescription = d.cueDescription;
  if (d.rewardDescription !== undefined) updateData.rewardDescription = d.rewardDescription;
  if (d.frictionNotes !== undefined) updateData.frictionNotes = d.frictionNotes;
  if (d.environmentDesignNotes !== undefined) updateData.environmentDesignNotes = d.environmentDesignNotes;
  if (d.isActive !== undefined) updateData.isActive = d.isActive;

  const [updated] = await db.update(habitsTable).set(updateData)
    .where(and(eq(habitsTable.id, params.data.id), eq(habitsTable.userId, req.userId!)))
    .returning();

  const result = await buildHabitResponse(updated, req.userId!);
  res.json(result);
});

router.delete("/habits/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const params = DeleteHabitParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [existing] = await db.select().from(habitsTable)
    .where(and(eq(habitsTable.id, params.data.id), eq(habitsTable.userId, req.userId!)));
  if (!existing) {
    res.status(404).json({ error: "Habit not found" });
    return;
  }

  await db.delete(habitsTable)
    .where(and(eq(habitsTable.id, params.data.id), eq(habitsTable.userId, req.userId!)));

  res.sendStatus(204);
});

export default router;
export { buildHabitResponse };
