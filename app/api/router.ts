import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { players, playerSessions } from "@db/schema";
import { eq, desc, sql } from "drizzle-orm";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),

  // ===== Player Save Management =====
  player: createRouter({
    // Upload or update player save
    save: publicQuery
      .input(
        z.object({
          playerId: z.string().min(1).max(64),
          progress: z.object({
            talentTree: z.object({
              points: z.number(),
              talents: z.record(z.number()),
            }),
            achievements: z.array(z.any()),
            highestWave: z.number(),
            highestEndlessWave: z.number(),
            totalKills: z.number(),
            scenesUnlocked: z.array(z.string()),
            scenesCompleted: z.array(z.string()),
            weaponsUnlocked: z.array(z.string()),
            encyclopedia: z.object({
              entries: z.array(z.any()),
            }),
            shopUpgrades: z.array(z.string()),
          }).passthrough(),
        })
      )
      .mutation(async ({ input }) => {
        const db = getDb();
        const { playerId, progress } = input;

        // Calculate derived stats
        const scenesCompleted = progress.scenesCompleted?.length || 0;
        const weaponsUnlocked = progress.weaponsUnlocked?.length || 1;
        const talentPoints = progress.talentTree?.points || 0;

        // Upsert player data
        const existing = await db
          .select()
          .from(players)
          .where(eq(players.playerId, playerId))
          .limit(1);

        if (existing.length > 0) {
          // Update existing player
          await db
            .update(players)
            .set({
              highestWave: progress.highestWave,
              highestEndlessWave: progress.highestEndlessWave,
              totalKills: progress.totalKills,
              talentPoints,
              scenesCompleted,
              weaponsUnlocked,
              fullProgress: progress as any,
              lastPlayedAt: new Date(),
            })
            .where(eq(players.playerId, playerId));
        } else {
          // Create new player
          await db.insert(players).values({
            playerId,
            highestWave: progress.highestWave,
            highestEndlessWave: progress.highestEndlessWave,
            totalKills: progress.totalKills,
            talentPoints,
            scenesCompleted,
            weaponsUnlocked,
            fullProgress: progress as any,
          });
        }

        return { success: true };
      }),

    // Log a game session
    logSession: publicQuery
      .input(
        z.object({
          playerId: z.string().min(1).max(64),
          scene: z.string().optional(),
          mode: z.string().optional(),
          difficulty: z.string().optional(),
          waveReached: z.number().default(0),
          kills: z.number().default(0),
          result: z.enum(["victory", "defeat", "quit"]).optional(),
          duration: z.number().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const db = getDb();
        await db.insert(playerSessions).values({
          playerId: input.playerId,
          scene: input.scene || null,
          mode: input.mode || null,
          difficulty: input.difficulty || null,
          waveReached: input.waveReached,
          kills: input.kills,
          result: input.result || null,
          duration: input.duration || null,
        });
        return { success: true };
      }),
  }),

  // ===== Admin Dashboard =====
  admin: createRouter({
    // Get all players
    listPlayers: publicQuery.query(async () => {
      const db = getDb();
      const allPlayers = await db
        .select()
        .from(players)
        .orderBy(desc(players.updatedAt))
        .limit(500);
      return allPlayers;
    }),

    // Get player detail
    getPlayerDetail: publicQuery
      .input(z.object({ playerId: z.string() }))
      .query(async ({ input }) => {
        const db = getDb();
        const playerRows = await db
          .select()
          .from(players)
          .where(eq(players.playerId, input.playerId))
          .limit(1);
        if (playerRows.length === 0) return null;

        const sessions = await db
          .select()
          .from(playerSessions)
          .where(eq(playerSessions.playerId, input.playerId))
          .orderBy(desc(playerSessions.createdAt))
          .limit(50);

        return { player: playerRows[0], sessions };
      }),

    // Get dashboard stats
    stats: publicQuery.query(async () => {
      const db = getDb();

      const totalPlayers = await db
        .select({ count: sql<number>`count(*)` })
        .from(players);

      const totalSessions = await db
        .select({ count: sql<number>`count(*)` })
        .from(playerSessions);

      const todayPlayers = await db
        .select({ count: sql<number>`count(*)` })
        .from(players)
        .where(
          sql`last_played_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)`
        );

      const totalKillsSum = await db
        .select({ total: sql<number>`COALESCE(SUM(total_kills), 0)` })
        .from(players);

      const topPlayers = await db
        .select()
        .from(players)
        .orderBy(desc(players.totalKills))
        .limit(10);

      return {
        totalPlayers: totalPlayers[0]?.count || 0,
        totalSessions: totalSessions[0]?.count || 0,
        todayPlayers: todayPlayers[0]?.count || 0,
        totalKills: totalKillsSum[0]?.total || 0,
        topPlayers,
      };
    }),

    // Get recent sessions
    recentSessions: publicQuery.query(async () => {
      const db = getDb();
      return db
        .select()
        .from(playerSessions)
        .orderBy(desc(playerSessions.createdAt))
        .limit(100);
    }),
  }),
});

export type AppRouter = typeof appRouter;
