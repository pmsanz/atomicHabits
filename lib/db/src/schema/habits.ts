import { pgTable, text, serial, timestamp, integer, boolean, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { identitiesTable } from "./identities";

export const habitsTable = pgTable("habits", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  identityId: integer("identity_id").references(() => identitiesTable.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  description: text("description"),
  habitType: text("habit_type").notNull().default("BOOLEAN"), // BOOLEAN | QUANTITY | DURATION
  frequency: text("frequency").notNull().default("DAILY"), // DAILY | WEEKLY | CUSTOM
  targetValue: real("target_value"),
  targetUnit: text("target_unit"),
  minimumVersion: text("minimum_version"),
  idealVersion: text("ideal_version"),
  cueType: text("cue_type"), // TIME | LOCATION | EVENT | PERSON | NONE
  cueDescription: text("cue_description"),
  rewardDescription: text("reward_description"),
  frictionNotes: text("friction_notes"),
  environmentDesignNotes: text("environment_design_notes"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertHabitSchema = createInsertSchema(habitsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertHabit = z.infer<typeof insertHabitSchema>;
export type Habit = typeof habitsTable.$inferSelect;
