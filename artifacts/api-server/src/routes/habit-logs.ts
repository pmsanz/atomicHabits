import { Router, type IRouter } from "express";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { db, habitLogsTable, habitsTable } from "@workspace/db";
import {
  CreateHabitLogBody,
  UpdateHabitLogBody,
  UpdateHabitLogParams,
  DeleteHabitLogParams,
  ListHabitLogsQueryParams,
} from "@workspace/api-zod";
import { requireAuth, type AuthRequest } from "../lib/auth";

const router: IRouter = Router();

router.get("/habit-logs", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const params = ListHabitLogsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  let query = db
    .select({
      id: habitLogsTable.id,
      userId: habitLogsTable.userId,
      habitId: habitLogsTable.habitId,
      habitName: habitsTable.name,
      date: habitLogsTable.date,
      value: habitLogsTable.value,
      completed: habitLogsTable.completed,
      note: habitLogsTable.note,
      createdAt: habitLogsTable.createdAt,
      updatedAt: habitLogsTable.updatedAt,
    })
    .from(habitLogsTable)
    .leftJoin(habitsTable, eq(habitLogsTable.habitId, habitsTable.id))
    .where(eq(habitLogsTable.userId, req.userId!))
    .$dynamic();

  const conditions = [eq(habitLogsTable.userId, req.userId!)];
  if (params.data.from) conditions.push(gte(habitLogsTable.date, params.data.from));
  if (params.data.to) conditions.push(lte(habitLogsTable.date, params.data.to));
  if (params.data.habitId) conditions.push(eq(habitLogsTable.habitId, params.data.habitId));

  const logs = await db
    .select({
      id: habitLogsTable.id,
      userId: habitLogsTable.userId,
      habitId: habitLogsTable.habitId,
      habitName: habitsTable.name,
      date: habitLogsTable.date,
      value: habitLogsTable.value,
      completed: habitLogsTable.completed,
      note: habitLogsTable.note,
      createdAt: habitLogsTable.createdAt,
      updatedAt: habitLogsTable.updatedAt,
    })
    .from(habitLogsTable)
    .leftJoin(habitsTable, eq(habitLogsTable.habitId, habitsTable.id))
    .where(and(...conditions))
    .orderBy(desc(habitLogsTable.date));

  res.json(logs);
});

router.post("/habit-logs", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const parsed = CreateHabitLogBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Verify habit belongs to user
  const [habit] = await db.select().from(habitsTable)
    .where(and(eq(habitsTable.id, parsed.data.habitId), eq(habitsTable.userId, req.userId!)));
  if (!habit) {
    res.status(404).json({ error: "Habit not found" });
    return;
  }

  // Upsert — if log for this date already exists, update it
  const [existing] = await db.select().from(habitLogsTable)
    .where(and(
      eq(habitLogsTable.habitId, parsed.data.habitId),
      eq(habitLogsTable.userId, req.userId!),
      eq(habitLogsTable.date, parsed.data.date),
    ));

  let log: typeof habitLogsTable.$inferSelect;
  if (existing) {
    const [updated] = await db.update(habitLogsTable)
      .set({
        completed: parsed.data.completed ?? existing.completed,
        value: parsed.data.value ?? existing.value,
        note: parsed.data.note ?? existing.note,
      })
      .where(eq(habitLogsTable.id, existing.id))
      .returning();
    log = updated;
  } else {
    const [created] = await db.insert(habitLogsTable).values({
      userId: req.userId!,
      habitId: parsed.data.habitId,
      date: parsed.data.date,
      value: parsed.data.value ?? null,
      completed: parsed.data.completed ?? false,
      note: parsed.data.note ?? null,
    }).returning();
    log = created;
  }

  res.status(201).json({ ...log, habitName: habit.name });
});

router.patch("/habit-logs/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const params = UpdateHabitLogParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateHabitLogBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db.select().from(habitLogsTable)
    .where(and(eq(habitLogsTable.id, params.data.id), eq(habitLogsTable.userId, req.userId!)));
  if (!existing) {
    res.status(404).json({ error: "Log not found" });
    return;
  }

  const updateData: Partial<typeof habitLogsTable.$inferInsert> = {};
  if (parsed.data.value !== undefined) updateData.value = parsed.data.value;
  if (parsed.data.completed !== undefined) updateData.completed = parsed.data.completed;
  if (parsed.data.note !== undefined) updateData.note = parsed.data.note;

  const [updated] = await db.update(habitLogsTable).set(updateData)
    .where(eq(habitLogsTable.id, params.data.id))
    .returning();

  res.json({ ...updated, habitName: null });
});

router.delete("/habit-logs/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const params = DeleteHabitLogParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  await db.delete(habitLogsTable)
    .where(and(eq(habitLogsTable.id, params.data.id), eq(habitLogsTable.userId, req.userId!)));

  res.sendStatus(204);
});

export default router;
