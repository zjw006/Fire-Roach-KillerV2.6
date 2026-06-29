import { useState } from "react";
import { trpc } from "@/providers/trpc";
import {
  Users,
  Swords,
  Skull,
  Calendar,
  Trophy,
  ChevronLeft,
  ChevronRight,
  Clock,
  Map,
  Zap,
  RefreshCw,
  BarChart3,
} from "lucide-react";

export default function AdminPage() {
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const pageSize = 20;

  const statsQuery = trpc.admin.stats.useQuery();
  const playersQuery = trpc.admin.listPlayers.useQuery();
  const sessionsQuery = trpc.admin.recentSessions.useQuery();
  const detailQuery = trpc.admin.getPlayerDetail.useQuery(
    { playerId: selectedPlayerId! },
    { enabled: !!selectedPlayerId }
  );

  const stats = statsQuery.data;
  const allPlayers = playersQuery.data || [];
  const totalPages = Math.ceil(allPlayers.length / pageSize);
  const paginatedPlayers = allPlayers.slice(page * pageSize, (page + 1) * pageSize);

  if (selectedPlayerId && detailQuery.data) {
    const { player, sessions } = detailQuery.data;
    return (
      <div className="min-h-screen bg-stone-950 text-white">
        <div className="max-w-6xl mx-auto px-4 py-6">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => setSelectedPlayerId(null)}
              className="flex items-center gap-1 text-stone-400 hover:text-white transition-colors"
            >
              <ChevronLeft size={18} />
              <span className="text-sm">返回列表</span>
            </button>
            <h1 className="text-xl font-bold">玩家详情</h1>
          </div>

          {/* Player info cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <StatCard icon={<Users size={18} />} label="玩家ID" value={player.playerId.slice(0, 16) + "..."} />
            <StatCard icon={<Trophy size={18} />} label="最高波次" value={String(player.highestWave)} />
            <StatCard icon={<Skull size={18} />} label="总击杀" value={String(player.totalKills)} />
            <StatCard icon={<Zap size={18} />} label="天赋点" value={String(player.talentPoints)} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
            <StatCard icon={<Map size={18} />} label="通关场景" value={String(player.scenesCompleted)} />
            <StatCard icon={<Swords size={18} />} label="解锁武器" value={String(player.weaponsUnlocked)} />
            <StatCard icon={<BarChart3 size={18} />} label="无尽最高波" value={String(player.highestEndlessWave)} />
          </div>

          {/* Full progress */}
          {player.fullProgress && (
            <div className="bg-stone-900 rounded-xl border border-stone-700 p-4 mb-6">
              <h3 className="text-sm font-bold text-stone-300 mb-3">完整进度数据</h3>
              <pre className="text-xs text-stone-400 overflow-x-auto max-h-96 overflow-y-auto">
                {JSON.stringify(player.fullProgress, null, 2)}
              </pre>
            </div>
          )}

          {/* Session history */}
          <div className="bg-stone-900 rounded-xl border border-stone-700 p-4">
            <h3 className="text-sm font-bold text-stone-300 mb-3">
              最近游戏记录 ({sessions.length})
            </h3>
            {sessions.length === 0 ? (
              <p className="text-stone-500 text-sm">暂无记录</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {sessions.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between bg-stone-800/50 rounded-lg px-3 py-2 text-sm"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-2 h-2 rounded-full ${
                        s.result === "victory" ? "bg-green-500" :
                        s.result === "defeat" ? "bg-red-500" : "bg-yellow-500"
                      }`} />
                      <span className="text-stone-300">{s.scene || "-"}</span>
                      <span className="text-stone-500 text-xs">{s.mode || "-"}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-stone-400">
                      <span>波次: {s.waveReached}</span>
                      <span>击杀: {s.kills}</span>
                      <span>{s.createdAt ? new Date(s.createdAt).toLocaleString() : "-"}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-950 text-white">
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 size={24} className="text-orange-400" />
            游戏管理后台
          </h1>
          <button
            onClick={() => {
              statsQuery.refetch();
              playersQuery.refetch();
              sessionsQuery.refetch();
            }}
            className="flex items-center gap-1 text-sm text-stone-400 hover:text-white transition-colors"
          >
            <RefreshCw size={14} />
            刷新
          </button>
        </div>

        {/* Stats cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <StatCard icon={<Users size={20} />} label="总玩家数" value={String(stats.totalPlayers)} accent />
            <StatCard icon={<Calendar size={20} />} label="今日活跃" value={String(stats.todayPlayers)} accent />
            <StatCard icon={<Clock size={20} />} label="总场次" value={String(stats.totalSessions)} accent />
            <StatCard icon={<Skull size={20} />} label="总击杀数" value={String(stats.totalKills)} accent />
          </div>
        )}

        {/* Top players */}
        {stats && stats.topPlayers.length > 0 && (
          <div className="bg-stone-900 rounded-xl border border-stone-700 p-4 mb-6">
            <h2 className="text-sm font-bold text-stone-300 mb-3 flex items-center gap-1">
              <Trophy size={14} className="text-yellow-400" />
              击杀排行榜 TOP 10
            </h2>
            <div className="space-y-1">
              {stats.topPlayers.map((p, idx) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between bg-stone-800/30 rounded-lg px-3 py-2 text-sm cursor-pointer hover:bg-stone-800/60 transition-colors"
                  onClick={() => setSelectedPlayerId(p.playerId)}
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-6 text-center font-bold ${
                      idx === 0 ? "text-yellow-400" :
                      idx === 1 ? "text-stone-300" :
                      idx === 2 ? "text-orange-400" : "text-stone-500"
                    }`}>
                      {idx + 1}
                    </span>
                    <span className="text-stone-300 font-mono text-xs">{p.playerId.slice(0, 20)}...</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-stone-400">
                    <span>击杀: {p.totalKills}</span>
                    <span>最高波: {p.highestWave}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Player list */}
        <div className="bg-stone-900 rounded-xl border border-stone-700 p-4 mb-6">
          <h2 className="text-sm font-bold text-stone-300 mb-3 flex items-center gap-1">
            <Users size={14} />
            玩家列表 ({allPlayers.length})
          </h2>
          {paginatedPlayers.length === 0 ? (
            <p className="text-stone-500 text-sm">暂无玩家数据</p>
          ) : (
            <>
              <div className="space-y-1">
                {paginatedPlayers.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between bg-stone-800/30 rounded-lg px-3 py-2 text-sm cursor-pointer hover:bg-stone-800/60 transition-colors"
                    onClick={() => setSelectedPlayerId(p.playerId)}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-stone-300 font-mono text-xs">{p.playerId}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-stone-400">
                      <span>击杀: {p.totalKills}</span>
                      <span>波次: {p.highestWave}</span>
                      <span>天赋: {p.talentPoints}</span>
                      <span className="text-stone-600">
                        {p.lastPlayedAt ? new Date(p.lastPlayedAt).toLocaleDateString() : "-"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-4">
                  <button
                    onClick={() => setPage(Math.max(0, page - 1))}
                    disabled={page === 0}
                    className="p-1 rounded hover:bg-stone-700 disabled:opacity-30 transition-colors"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="text-xs text-stone-400">
                    {page + 1} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                    disabled={page >= totalPages - 1}
                    className="p-1 rounded hover:bg-stone-700 disabled:opacity-30 transition-colors"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Recent sessions */}
        {sessionsQuery.data && sessionsQuery.data.length > 0 && (
          <div className="bg-stone-900 rounded-xl border border-stone-700 p-4">
            <h2 className="text-sm font-bold text-stone-300 mb-3 flex items-center gap-1">
              <Clock size={14} />
              最近游戏记录 ({sessionsQuery.data.length})
            </h2>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {sessionsQuery.data.slice(0, 20).map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between bg-stone-800/30 rounded-lg px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-2 h-2 rounded-full ${
                      s.result === "victory" ? "bg-green-500" :
                      s.result === "defeat" ? "bg-red-500" : "bg-yellow-500"
                    }`} />
                    <span className="text-stone-300 font-mono text-xs">{s.playerId.slice(0, 16)}...</span>
                    <span className="text-stone-500">{s.scene || "-"}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-stone-400">
                    <span>{s.mode}</span>
                    <span>波{s.waveReached}</span>
                    <span>击杀{s.kills}</span>
                    <span>{s.createdAt ? new Date(s.createdAt).toLocaleString() : "-"}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-3 ${
      accent ? "bg-stone-900 border-stone-700" : "bg-stone-800/30 border-stone-800"
    }`}>
      <div className="flex items-center gap-2 mb-1 text-stone-500">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <div className={`text-2xl font-bold ${accent ? "text-orange-400" : "text-white"}`}>
        {value}
      </div>
    </div>
  );
}
