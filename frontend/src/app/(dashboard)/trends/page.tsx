"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { format } from "date-fns";
import { TrendingUp, RefreshCw } from "lucide-react";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-dark-950 border border-dark-700 rounded-xl px-4 py-3 shadow-2xl shadow-black/60">
      <p className="text-xs text-dark-400 mb-2 font-medium">{label}</p>
      <div className="space-y-1.5">
        {payload.map((entry: any, i: number) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-dark-300">{entry.name}</span>
            <span className="ml-auto font-semibold text-dark-50">{entry.value?.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TrendsPage() {
  const [competitors, setCompetitors] = useState<any[]>([]);
  const [sentimentData, setSentimentData] = useState<any[]>([]);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCompetitor, setSelectedCompetitor] = useState<string | null>(null);

  const loadData = useCallback(async (daysParam: number) => {
    setLoading(true);
    try {
      const [comps, sent] = await Promise.all([
        api.getCompetitors({}),
        api.getSentiment({ days: daysParam }),
      ]);
      setCompetitors(comps);
      setSentimentData(sent);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(days);
  }, [days, loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData(days);
    setRefreshing(false);
  };

  // Build chart data: group by date, with each competitor as a series
  const compMap = new Map(competitors.map((c) => [c.id, c.name]));
  const chartData = sentimentData.reduce((acc: any[], point) => {
    const date = format(new Date(point.date), "MMM dd");
    let existing = acc.find((d) => d.date === date);
    if (!existing) {
      existing = { date };
      acc.push(existing);
    }
    const name = compMap.get(point.competitor_id) || point.competitor_id?.slice(0, 8);
    existing[name] = point.score;
    return acc;
  }, []);

  const compNames = [...new Set(sentimentData.map((d) => compMap.get(d.competitor_id) || d.competitor_id?.slice(0, 8)))];

  const handleCardClick = (name: string) => {
    setSelectedCompetitor((prev) => (prev === name ? null : name));
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Market Trends</h1>
          <p className="text-dark-400 mt-1">Sentiment trends across your competitive landscape</p>
        </div>
        <div className="flex items-center gap-2">
          {[7, 14, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                days === d
                  ? "bg-primary-600 text-white scale-105"
                  : "bg-dark-800 text-dark-400 hover:text-dark-50"
              }`}
            >
              {d}d
            </button>
          ))}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="ml-2 p-2 rounded-lg bg-dark-800 text-dark-400 hover:text-dark-50 transition disabled:opacity-50"
            title="Refresh data"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div className="bg-dark-900 border border-dark-800 rounded-xl p-6">
        <h2 className="font-semibold mb-4">Sentiment Comparison</h2>
        {chartData.length > 0 ? (
          <div className="animate-fade-in">
            <ResponsiveContainer width="100%" height={400}>
              <AreaChart data={chartData}>
                <defs>
                  {compNames.map((name, i) => (
                    <linearGradient key={name} id={`gradient-${i}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} domain={[0, 100]} />
                <RechartsTooltip content={<CustomTooltip />} />
                <Legend />
                {compNames.map((name, i) => {
                  const isSelected = selectedCompetitor === null || selectedCompetitor === name;
                  return (
                    <Area
                      key={name}
                      type="monotone"
                      dataKey={name}
                      stroke={COLORS[i % COLORS.length]}
                      strokeWidth={isSelected ? 2.5 : 1}
                      strokeOpacity={isSelected ? 1 : 0.2}
                      fill={`url(#gradient-${i})`}
                      fillOpacity={isSelected ? 1 : 0.05}
                      dot={false}
                      animationDuration={1200}
                      animationEasing="ease-out"
                    />
                  );
                })}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-[400px] flex items-center justify-center text-dark-500">
            <div className="text-center animate-float">
              <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No trend data available yet</p>
              <p className="text-xs mt-1">Add competitors and run ingestion to start tracking</p>
            </div>
          </div>
        )}
      </div>

      {/* Competitor Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
        {competitors.map((c, i) => {
          const name = c.name;
          const isActive = selectedCompetitor === null || selectedCompetitor === name;

          return (
            <div
              key={c.id}
              onClick={() => handleCardClick(name)}
              className={`bg-dark-900 border rounded-xl p-4 card-hover cursor-pointer transition-all ${
                isActive ? "border-dark-800" : "border-dark-800/50 opacity-40"
              } ${selectedCompetitor === name ? "ring-1 ring-primary-500/50" : ""}`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                <span className="font-medium">{c.name}</span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-lg font-bold">{c.sentiment_score.toFixed(1)}%</p>
                  <p className="text-xs text-dark-400">Sentiment</p>
                </div>
                <div>
                  <p className="text-lg font-bold">{c.recent_activities}</p>
                  <p className="text-xs text-dark-400">Activities</p>
                </div>
                <div>
                  <p className={`text-lg font-bold ${c.sentiment_change > 0 ? "text-green-400" : c.sentiment_change < 0 ? "text-red-400" : "text-dark-300"}`}>
                    {c.sentiment_change > 0 ? "+" : ""}{c.sentiment_change.toFixed(1)}
                  </p>
                  <p className="text-xs text-dark-400">Change</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
