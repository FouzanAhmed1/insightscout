"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import {
  Users, Activity, Bell, BarChart3, Database, Wifi,
  RefreshCw, Lightbulb, AlertTriangle, TrendingUp, Zap,
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { format } from "date-fns";

function AnimatedNumber({ value, duration = 600 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (value === 0) {
      setDisplay(0);
      return;
    }
    const start = performance.now();
    const startValue = 0;

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(startValue + (value - startValue) * eased));
      if (progress < 1) {
        requestAnimationFrame(tick);
      }
    }
    requestAnimationFrame(tick);
  }, [value, duration]);

  return <>{display}</>;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-dark-800 border border-dark-700 rounded-lg p-3 shadow-lg">
      <p className="text-sm font-medium text-dark-50 mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="text-xs text-dark-300">
          <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ backgroundColor: entry.color }} />
          {entry.name}: <span className="font-medium text-dark-50">{entry.value}</span>
        </p>
      ))}
    </div>
  );
}

const insightTypeIcons: Record<string, typeof Lightbulb> = {
  opportunity: Lightbulb,
  threat: AlertTriangle,
  trend: TrendingUp,
  anomaly: Zap,
};

export default function Dashboard() {
  const [stats, setStats] = useState<any>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [sentimentData, setSentimentData] = useState<any[]>([]);
  const [insights, setInsights] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [s, a, sd, ins] = await Promise.allSettled([
        api.getDashboardStats(),
        api.getActivities({ limit: 10 }),
        api.getSentimentTrends(30),
        api.getInsights(),
      ]);
      if (s.status === "fulfilled") setStats(s.value);
      if (a.status === "fulfilled") setActivities(a.value);
      if (sd.status === "fulfilled") setSentimentData(sd.value);
      if (ins.status === "fulfilled") setInsights(ins.value);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    async function load() {
      try {
        await loadData();
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  if (loading) return <LoadingSkeleton />;

  const statCards = [
    { label: "Tracked Competitors", value: stats?.total_competitors ?? 0, icon: Users, color: "text-blue-400" },
    { label: "Activities Detected", value: stats?.total_activities ?? 0, icon: Activity, color: "text-green-400" },
    { label: "Active Alerts", value: stats?.active_alerts ?? 0, icon: Bell, color: "text-yellow-400" },
    { label: "Avg Sentiment", value: stats?.avg_sentiment ?? 0, icon: BarChart3, color: "text-purple-400", suffix: "%" },
    { label: "Records Today", value: stats?.records_today ?? 0, icon: Database, color: "text-cyan-400" },
    { label: "Active Sources", value: stats?.sources_active ?? 0, icon: Wifi, color: "text-orange-400" },
  ];

  // Group sentiment data by date with competitor names as keys
  const competitorNames = [...new Set(sentimentData.map((p: any) => p.name))];
  const chartData = sentimentData.reduce((acc: any[], point: any) => {
    const date = format(new Date(point.date), "MMM dd");
    let existing = acc.find((d: any) => d.date === date);
    if (!existing) {
      existing = { date };
      acc.push(existing);
    }
    existing[point.name] = point.score;
    return acc;
  }, []);

  const CHART_COLORS = [
    "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
    "#06b6d4", "#ec4899", "#f97316", "#14b8a6", "#a855f7",
    "#6366f1", "#84cc16", "#e11d48", "#0ea5e9", "#d946ef",
    "#22d3ee", "#fb923c", "#4ade80", "#f43f5e", "#818cf8",
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-dark-400 mt-1">Real-time competitive intelligence overview</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 stagger-children">
        {statCards.map(({ label, value, icon: Icon, color, suffix }) => (
          <div key={label} className="bg-dark-900 border border-dark-800 rounded-xl p-4 card-hover">
            <div className="flex items-center justify-between mb-2">
              <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <p className="text-2xl font-bold">
              {typeof value === "number" ? (
                <>
                  <AnimatedNumber value={value} />
                  {suffix || ""}
                </>
              ) : (
                value
              )}
            </p>
            <p className="text-xs text-dark-400 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Charts + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sentiment Chart */}
        <div className="lg:col-span-2 bg-dark-900 border border-dark-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Sentiment Trends (30 days)</h2>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 rounded-lg hover:bg-dark-800 text-dark-400 hover:text-dark-50 transition disabled:opacity-50"
              title="Refresh data"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            </button>
          </div>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} domain={[0, 100]} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                {competitorNames.map((name, i) => (
                  <Line
                    key={name}
                    type="monotone"
                    dataKey={name}
                    stroke={CHART_COLORS[i % CHART_COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 6, stroke: CHART_COLORS[i % CHART_COLORS.length], strokeWidth: 2 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-dark-500">
              No sentiment data yet. Add competitors and trigger ingestion to start.
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="bg-dark-900 border border-dark-800 rounded-xl p-6">
          <h2 className="font-semibold mb-4">Recent Activity</h2>
          {activities.length > 0 ? (
            <div className="space-y-3">
              {activities.map((a) => {
                const content = (
                  <div
                    key={a.id}
                    className={`flex items-start gap-3 p-3 rounded-lg bg-dark-800/50 hover:bg-dark-800 transition ${
                      a.source_url ? "cursor-pointer" : ""
                    }`}
                  >
                    <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                      a.importance === "critical" ? "bg-red-400" :
                      a.importance === "high" ? "bg-yellow-400" : "bg-blue-400"
                    }`} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{a.title}</p>
                      <p className="text-xs text-dark-400 mt-0.5">{a.type} &middot; {format(new Date(a.created_at), "MMM dd HH:mm")}</p>
                    </div>
                  </div>
                );

                return a.source_url ? (
                  <a key={a.id} href={a.source_url} target="_blank" rel="noopener noreferrer" className="block">
                    {content}
                  </a>
                ) : (
                  <div key={a.id}>{content}</div>
                );
              })}
            </div>
          ) : (
            <p className="text-dark-500 text-sm">No activities yet</p>
          )}
        </div>
      </div>

      {/* AI Insights */}
      <div className="bg-dark-900 border border-dark-800 rounded-xl p-6">
        <h2 className="font-semibold mb-4">AI-Generated Insights</h2>
        {insights.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {insights.slice(0, 6).map((insight) => {
              const TypeIcon = insightTypeIcons[insight.type] || Zap;
              return (
                <div key={insight.id} className="p-4 rounded-lg bg-dark-800/50 border border-dark-700 card-hover">
                  <div className="flex items-center gap-2 mb-2">
                    <TypeIcon className={`w-4 h-4 ${
                      insight.type === "opportunity" ? "text-green-400" :
                      insight.type === "threat" ? "text-red-400" :
                      insight.type === "trend" ? "text-blue-400" :
                      "text-yellow-400"
                    }`} />
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      insight.type === "opportunity" ? "bg-green-500/20 text-green-400" :
                      insight.type === "threat" ? "bg-red-500/20 text-red-400" :
                      insight.type === "trend" ? "bg-blue-500/20 text-blue-400" :
                      "bg-yellow-500/20 text-yellow-400"
                    }`}>
                      {insight.type}
                    </span>
                    <span className="text-xs text-dark-400">{Math.round(insight.confidence * 100)}% confidence</span>
                  </div>
                  <h3 className="text-sm font-medium mb-1">{insight.title}</h3>
                  <p className="text-xs text-dark-400 line-clamp-2">{insight.description}</p>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-dark-500 text-sm">No insights generated yet. Click &quot;Generate Insights&quot; to run the AI pipeline.</p>
        )}
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <div className="h-8 w-48 rounded skeleton" />
        <div className="h-4 w-72 rounded skeleton mt-2" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-dark-900 border border-dark-800 rounded-xl p-4">
            <div className="h-5 w-5 rounded skeleton mb-2" />
            <div className="h-8 w-16 rounded skeleton mb-1" />
            <div className="h-3 w-24 rounded skeleton" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-dark-900 border border-dark-800 rounded-xl p-6">
          <div className="h-5 w-48 rounded skeleton mb-4" />
          <div className="h-[300px] rounded skeleton" />
        </div>
        <div className="bg-dark-900 border border-dark-800 rounded-xl p-6">
          <div className="h-5 w-32 rounded skeleton mb-4" />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-14 rounded-lg skeleton" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
