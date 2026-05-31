import { pgTable, text, serial, timestamp, integer, boolean, real, date, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { habitsTable } from "./habits";

export const habitLogsTable = pgTable("habit_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  habitId: integer("habit_id").notNull().references(() => habitsTable.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  value: real("value"),
  completed: boolean("completed").notNull().default(false),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  unique("habit_logs_user_habit_date_unique").on(table.userId, table.habitId, table.date),
]);

export const insertHabitLogSchema = createInsertSchema(habitLogsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertHabitLog = z.infer<typeof insertHabitLogSchema>;
export type HabitLog = typeof habitLogsTable.$inferSelect;
