import {
  mysqlTable,
  serial,
  varchar,
  text,
  timestamp,
  int,
  json,
} from "drizzle-orm/mysql-core";

// Player save data - stores all game progress
export const players = mysqlTable("players", {
  id: serial("id").primaryKey(),
  playerId: varchar("player_id", { length: 64 }).notNull().unique(),
  nickname: varchar("nickname", { length: 100 }),
  highestWave: int("highest_wave").notNull().default(0),
  highestEndlessWave: int("highest_endless_wave").notNull().default(0),
  totalKills: int("total_kills").notNull().default(0),
  talentPoints: int("talent_points").notNull().default(0),
  scenesCompleted: int("scenes_completed").notNull().default(0),
  weaponsUnlocked: int("weapons_unlocked").notNull().default(1),
  // Full progress JSON for detailed view
  fullProgress: json("full_progress"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  lastPlayedAt: timestamp("last_played_at").notNull().defaultNow(),
});

// Player activity log - tracks game sessions
export const playerSessions = mysqlTable("player_sessions", {
  id: serial("id").primaryKey(),
  playerId: varchar("player_id", { length: 64 }).notNull(),
  scene: varchar("scene", { length: 50 }),
  mode: varchar("mode", { length: 20 }),
  difficulty: varchar("difficulty", { length: 10 }),
  waveReached: int("wave_reached").notNull().default(0),
  kills: int("kills").notNull().default(0),
  result: varchar("result", { length: 20 }), // victory / defeat / quit
  duration: int("duration"), // seconds
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
