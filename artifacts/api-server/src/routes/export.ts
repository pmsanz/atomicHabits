import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, habitsTable, habitLogsTable, journalEntriesTable, identitiesTable } from "@workspace/db";
import { requireAuth, type AuthRequest } from "../lib/auth";
import { toCsv } from "../lib/csv";

const router: IRouter = Router();

router.get("/export/habits.csv", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const habits = await db.select().from(habitsTable).where(eq(habitsTable.userId, req.userId!));
  const csv = toCsv(habits.map((h) => ({
    id: h.id,
    name: h.name,
    habitType: h.habitType,
    frequency: h.frequency,
    targetValue: h.targetValue,
    targetUnit: h.targetUnit,
    minimumVersion: h.minimumVersion,
    idealVersion: h.idealVersion,
    cueType: h.cueType,
    cueDescription: h.cueDescription,
    isActive: h.isActive,
    createdAt: h.createdAt,
  })));
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="habits.csv"`);
  res.send(csv);
});

router.get("/export/journal.csv", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const entries = await db.select().from(journalEntriesTable).where(eq(journalEntriesTable.userId, req.userId!));
  const csv = toCsv(entries.map((e) => ({
    id: e.id,
    date: e.date,
    content: e.content,
    mood: e.mood,
    tags: (e.tags ?? []).join(";"),
    createdAt: e.createdAt,
  })));
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="journal.csv"`);
  res.send(csv);
});

router.get("/export/all.csv", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const userId = req.userId!;
  const [habits, logs, journal, identities] = await Promise.all([
    db.select().from(habitsTable).where(eq(habitsTable.userId, userId)),
    db.select().from(habitLogsTable).where(eq(habitLogsTable.userId, userId)),
    db.select().from(journalEntriesTable).where(eq(journalEntriesTable.userId, userId)),
    db.select().from(identitiesTable).where(eq(identitiesTable.userId, userId)),
  ]);

  const sections = [
    "=== IDENTITIES ===\n" + toCsv(identities.map((i) => ({ id: i.id, name: i.name, description: i.description }))),
    "=== HABITS ===\n" + toCsv(habits.map((h) => ({ id: h.id, name: h.name, type: h.habitType, frequency: h.frequency }))),
    "=== HABIT LOGS ===\n" + toCsv(logs.map((l) => ({ id: l.id, habitId: l.habitId, date: l.date, completed: l.completed, value: l.value, note: l.note }))),
    "=== JOURNAL ===\n" + toCsv(journal.map((j) => ({ id: j.id, date: j.date, mood: j.mood, tags: (j.tags ?? []).join(";"), content: j.content }))),
  ];

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="atomic-habits-export.csv"`);
  res.send(sections.join("\n\n"));
});

export default router;
