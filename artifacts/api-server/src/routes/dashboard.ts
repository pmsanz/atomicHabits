import { Router, type IRouter } from "express";
import { eq, and, sql, count, desc, gte, lte } from "drizzle-orm";
import { db, habitsTable, habitLogsTable, identitiesTable, journalEntriesTable } from "@workspace/db";
import { GetDashboardHeatmapQueryParams } from "@workspace/api-zod";
import { requireAuth, type AuthRequest } from "../lib/auth";
import { buildHabitResponse } from "./habits";

const router: IRouter = Router();

router.get("/dashboard/today", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const userId = req.userId!;
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  // Get active habits with today's status
  const habits = await db.select().from(habitsTable)
    .where(and(eq(habitsTable.userId, userId), eq(habitsTable.isActive, true)))
    .orderBy(habitsTable.createdAt);

  const habitsWithStatus = await Promise.all(habits.map((h) => buildHabitResponse(h, userId)));

  const totalHabits = habitsWithStatus.length;
  const completedHabits = habitsWithStatus.filter((h) => h.todayCompleted).length;
  const completionRate = totalHabits > 0 ? completedHabits / totalHabits : 0;

  // Identity evidence for today
  const completedToday = habitsWithStatus.filter((h) => h.todayCompleted && h.identityId);
  const evidenceMap = new Map<number, { identityId: number; identityName: string; colorKey: string | null; count: number }>();

  for (const h of completedToday) {
    if (!h.identityId) continue;
    const key = h.identityId;
    if (!evidenceMap.has(key)) {
      evidenceMap.set(key, {
        identityId: h.identityId,
        identityName: h.identityName ?? "",
        colorKey: h.identityColorKey ?? null,
        count: 0,
      });
    }
    evidenceMap.get(key)!.count++;
  }
  const identityEvidence = Array.from(evidenceMap.values());

  // Never Miss Twice: habits missed yesterday and not yet done today
  const yesterdayLogs = await db.select({ habitId: habitLogsTable.habitId, completed: habitLogsTable.completed })
    .from(habitLogsTable)
    .where(and(eq(habitLogsTable.userId, userId), eq(habitLogsTable.date, yesterday)));

  const completedYesterdayIds = new Set(yesterdayLogs.filter((l) => l.completed).map((l) => l.habitId));
  const missedYesterdayIds = new Set(
    habits.filter((h) => !completedYesterdayIds.has(h.id)).map((h) => h.id)
  );

  const neverMissTwice = habitsWithStatus
    .filter((h) => missedYesterdayIds.has(h.id) && !h.todayCompleted)
    .map((h) => ({
      habitId: h.id,
      habitName: h.name,
      minimumVersion: h.minimumVersion ?? null,
      identityName: h.identityName ?? null,
    }));

  // Recent journal entry
  const [recentJournal] = await db.select().from(journalEntriesTable)
    .where(eq(journalEntriesTable.userId, userId))
    .orderBy(desc(journalEntriesTable.date))
    .limit(1);

  res.json({
    date: today,
    totalHabits,
    completedHabits,
    completionRate,
    habits: habitsWithStatus,
    identityEvidence,
    neverMissTwice,
    recentJournal: recentJournal ?? null,
  });
});

router.get("/dashboard/heatmap", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const params = GetDashboardHeatmapQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const year = params.data.year ?? new Date().getFullYear();
  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;

  // Get all logs for the year aggregated by date
  const logs = await db
    .select({
      date: habitLogsTable.date,
      completed: habitLogsTable.completed,
    })
    .from(habitLogsTable)
    .where(and(
      eq(habitLogsTable.userId, req.userId!),
      gte(habitLogsTable.date, startDate),
      lte(habitLogsTable.date, endDate),
    ));

  // Count total active habits (at time period — simplified: use current count)
  const totalHabits = await db.select({ count: count() }).from(habitsTable)
    .where(and(eq(habitsTable.userId, req.userId!), eq(habitsTable.isActive, true)));
  const total = Number(totalHabits[0]?.count ?? 0);

  // Aggregate by date
  const byDate = new Map<string, { count: number; total: number }>();
  for (const log of logs) {
    if (!byDate.has(log.date)) byDate.set(log.date, { count: 0, total });
    if (log.completed) byDate.get(log.date)!.count++;
  }

  // Generate all days in year
  const result = [];
  const start = new Date(`${year}-01-01`);
  const end = new Date(`${year}-12-31`);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().slice(0, 10);
    const entry = byDate.get(dateStr);
    const cnt = entry?.count ?? 0;
    const tot = total > 0 ? total : 1;
    result.push({
      date: dateStr,
      count: cnt,
      total,
      rate: cnt / tot,
    });
  }

  res.json(result);
});

router.get("/dashboard/insights", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const userId = req.userId!;
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86400000).toISOString().slice(0, 10);

  // Helper to compute rate for a period
  const computeRate = async (days: number) => {
    const since = new Date(today.getTime() - days * 86400000).toISOString().slice(0, 10);
    const logs = await db.select({ completed: habitLogsTable.completed })
      .from(habitLogsTable)
      .where(and(eq(habitLogsTable.userId, userId), gte(habitLogsTable.date, since)));
    if (logs.length === 0) return 0;
    const done = logs.filter((l) => l.completed).length;
    return Math.round((done / logs.length) * 100);
  };

  const [last7Days, last30Days] = await Promise.all([computeRate(7), computeRate(30)]);

  // Best/weakest habit by completion rate in last 30 days
  const since30 = new Date(today.getTime() - 30 * 86400000).toISOString().slice(0, 10);
  const habits = await db.select().from(habitsTable)
    .where(and(eq(habitsTable.userId, userId), eq(habitsTable.isActive, true)));

  const habitStats = await Promise.all(habits.map(async (h) => {
    const logs = await db.select({ completed: habitLogsTable.completed })
      .from(habitLogsTable)
      .where(and(
        eq(habitLogsTable.habitId, h.id),
        eq(habitLogsTable.userId, userId),
        gte(habitLogsTable.date, since30),
      ));
    const done = logs.filter((l) => l.completed).length;
    const rate = logs.length > 0 ? done / logs.length : 0;

    // streak
    let streak = 0;
    const recentLogs = await db.select({ date: habitLogsTable.date, completed: habitLogsTable.completed })
      .from(habitLogsTable)
      .where(and(eq(habitLogsTable.habitId, h.id), eq(habitLogsTable.userId, userId), eq(habitLogsTable.completed, true)))
      .orderBy(desc(habitLogsTable.date));
    const check = new Date();
    for (const log of recentLogs) {
      const expected = check.toISOString().slice(0, 10);
      if (log.date === expected) { streak++; check.setDate(check.getDate() - 1); }
      else break;
    }

    return { id: h.id, name: h.name, streak, rate, totalLogs: logs.length };
  }));

  const withLogs = habitStats.filter((h) => h.totalLogs > 0);
  const bestHabit = withLogs.length > 0 ? withLogs.reduce((a, b) => a.rate > b.rate ? a : b) : null;
  const weakestHabit = withLogs.length > 0 ? withLogs.reduce((a, b) => a.rate < b.rate ? a : b) : null;

  // Strongest identity
  const identities = await db.select().from(identitiesTable).where(eq(identitiesTable.userId, userId));
  const identityStats = await Promise.all(identities.map(async (i) => {
    const evidence = await db.select({ count: count() })
      .from(habitLogsTable)
      .where(and(
        eq(habitLogsTable.userId, userId),
        eq(habitLogsTable.completed, true),
        gte(habitLogsTable.date, since30),
        sql`EXISTS (SELECT 1 FROM habits WHERE habits.id = ${habitLogsTable.habitId} AND habits.identity_id = ${i.id})`,
      ));
    const evidenceCount = Number(evidence[0]?.count ?? 0);
    const consistencyScore = Math.min(100, Math.round((evidenceCount / 30) * 100));
    return { id: i.id, name: i.name, evidenceCount, consistencyScore };
  }));

  const strongestIdentity = identityStats.length > 0
    ? identityStats.reduce((a, b) => a.evidenceCount > b.evidenceCount ? a : b)
    : null;

  // Missed yesterday
  const yesterdayLogs = await db.select({ habitId: habitLogsTable.habitId, completed: habitLogsTable.completed })
    .from(habitLogsTable)
    .where(and(eq(habitLogsTable.userId, userId), eq(habitLogsTable.date, yesterday)));

  const completedYesterdayIds = new Set(yesterdayLogs.filter((l) => l.completed).map((l) => l.habitId));
  const missedYesterday = habits
    .filter((h) => !completedYesterdayIds.has(h.id))
    .map((h) => ({ id: h.id, name: h.name, minimumVersion: h.minimumVersion }));

  // Top journal tags
  const journalEntries = await db.select({ tags: journalEntriesTable.tags })
    .from(journalEntriesTable)
    .where(and(eq(journalEntriesTable.userId, userId), gte(journalEntriesTable.date, since30)));

  const tagCounts = new Map<string, number>();
  for (const entry of journalEntries) {
    for (const tag of entry.tags ?? []) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }
  const topJournalTags = Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tag, count]) => ({ tag, count }));

  res.json({
    last7Days,
    last30Days,
    bestHabit: bestHabit ? { id: bestHabit.id, name: bestHabit.name, streak: bestHabit.streak, rate: bestHabit.rate } : null,
    weakestHabit: weakestHabit ? { id: weakestHabit.id, name: weakestHabit.name, streak: weakestHabit.streak, rate: weakestHabit.rate } : null,
    strongestIdentity: strongestIdentity?.evidenceCount ?? 0 > 0 ? strongestIdentity : null,
    missedYesterday,
    topJournalTags,
  });
});

export default router;
