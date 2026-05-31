import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, habitStacksTable, habitsTable } from "@workspace/db";
import {
  CreateHabitStackBody,
  UpdateHabitStackBody,
  UpdateHabitStackParams,
  DeleteHabitStackParams,
} from "@workspace/api-zod";
import { requireAuth, type AuthRequest } from "../lib/auth";

const router: IRouter = Router();

async function buildStackResponse(stack: typeof habitStacksTable.$inferSelect) {
  let anchorHabitName: string | null = null;
  if (stack.anchorHabitId) {
    const [habit] = await db.select().from(habitsTable).where(eq(habitsTable.id, stack.anchorHabitId));
    anchorHabitName = habit?.name ?? null;
  }

  const [newHabit] = await db.select().from(habitsTable).where(eq(habitsTable.id, stack.newHabitId));
  return {
    ...stack,
    anchorHabitName,
    newHabitName: newHabit?.name ?? null,
  };
}

router.get("/habit-stacks", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const stacks = await db.select().from(habitStacksTable)
    .where(eq(habitStacksTable.userId, req.userId!))
    .orderBy(habitStacksTable.createdAt);
  const result = await Promise.all(stacks.map(buildStackResponse));
  res.json(result);
});

router.post("/habit-stacks", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const parsed = CreateHabitStackBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [newHabit] = await db.select().from(habitsTable)
    .where(and(eq(habitsTable.id, parsed.data.newHabitId), eq(habitsTable.userId, req.userId!)));
  if (!newHabit) {
    res.status(404).json({ error: "New habit not found" });
    return;
  }

  const [stack] = await db.insert(habitStacksTable).values({
    userId: req.userId!,
    anchorHabitId: parsed.data.anchorHabitId ?? null,
    anchorDescription: parsed.data.anchorDescription,
    newHabitId: parsed.data.newHabitId,
    stackPhrase: parsed.data.stackPhrase,
  }).returning();

  const result = await buildStackResponse(stack);
  res.status(201).json(result);
});

router.patch("/habit-stacks/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const params = UpdateHabitStackParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateHabitStackBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db.select().from(habitStacksTable)
    .where(and(eq(habitStacksTable.id, params.data.id), eq(habitStacksTable.userId, req.userId!)));
  if (!existing) {
    res.status(404).json({ error: "Habit stack not found" });
    return;
  }

  const updateData: Partial<typeof habitStacksTable.$inferInsert> = {};
  const d = parsed.data;
  if (d.anchorHabitId !== undefined) updateData.anchorHabitId = d.anchorHabitId;
  if (d.anchorDescription !== undefined) updateData.anchorDescription = d.anchorDescription;
  if (d.newHabitId !== undefined) updateData.newHabitId = d.newHabitId;
  if (d.stackPhrase !== undefined) updateData.stackPhrase = d.stackPhrase;

  const [updated] = await db.update(habitStacksTable).set(updateData)
    .where(eq(habitStacksTable.id, params.data.id))
    .returning();

  const result = await buildStackResponse(updated);
  res.json(result);
});

router.delete("/habit-stacks/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const params = DeleteHabitStackParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  await db.delete(habitStacksTable)
    .where(and(eq(habitStacksTable.id, params.data.id), eq(habitStacksTable.userId, req.userId!)));

  res.sendStatus(204);
});

export default router;
