"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import {
  ArrowLeft, Play, Eye, TrendingUp, TrendingDown,
  ChevronDown, Zap, Activity, Lightbulb, ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format } from "date-fns";

type Tab = "overview" | "activities" | "insights";

export default function CompetitorProfilePage() {
  const { toast } = useToast();
  const { id } = useParams<{ id: string }>();
  const [competitor, setCompetitor] = useState<any>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [sentimentData, setSentimentData] = useState<any[]>([]);
  const [insights, setInsights] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [visibleActivities, setVisibleActivities] = useState(20);

  useEffect(() => {
    async function load() {
      try {
        const [comp, acts, sent, ins] = await Promise.all([
          api.getCompetitor(id),
          api.getActivities({ competitor_id: id, limit: 50 }),
          api.getSentiment({ competitor_id: id, days: 30 }),
          api.getInsights().catch(() => []),
        ]);
        setCompetitor(comp);
        setActivities(acts);
        setSentimentData(sent);
        // Filter insights relevant to this competitor
        setInsights(
          (ins || []).filter((i: any) =>
            i.competitor_id === id ||
            i.competitor_ids?.includes(id) ||
            (i.title || "").toLowerCase().includes((comp.name || "").toLowerCase())
          )
        );
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) return <LoadingSkeleton />;
  if (!competitor) return <p className="text-dark-400">Competitor not found</p>;

  const chartData = sentimentData.map((d) => ({
    date: format(new Date(d.date), "MMM dd"),
    score: d.score,
  }));

  const handleIngestion = async () => {
    try {
      await api.triggerIngestion("custom", id);
      toast("success", "Ingestion triggered", "Data collection has started.");
    } catch (err) {
      console.error(err);
      toast("error", "Ingestion failed", "Could not trigger ingestion.");
    }
  };

  const handleMonitor = async () => {
    if (competitor.website) {
      try {
        await api.triggerMonitoring(id, competitor.website);
        toast("success", "Monitoring triggered", "Website snapshot is being captured.");
      } catch (err) {
        console.error(err);
        toast("error", "Monitoring failed", "Could not trigger website monitoring.");
      }
    } else {
      toast("warning", "No website", "This competitor has no website URL configured.");
    }
  };

  const tabs: { key: Tab; label: string; icon: React.ElementType; count?: number }[] = [
    { key: "overview", label: "Overview", icon: Activity },
    { key: "activities", label: "Activities", icon: Zap, count: activities.length },
    { key: "insights", label: "Insights", icon: Lightbulb, count: insights.length },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <Link href="/competitors" className="flex items-center gap-2 text-dark-400 hover:text-dark-50 transition text-sm">
        <ArrowLeft className="w-4 h-4" /> Back to competitors
      </Link>

      {/* Header */}
      <div
        className="bg-dark-900 border border-dark-800 rounded-xl p-6"
        style={{ borderTopWidth: "2px", borderImage: "linear-gradient(to right, #818cf8, #22d3ee) 1" }}
      >
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">{competitor.name}</h1>
            <p className="text-dark-400 mt-1">{competitor.industry} &middot; {competitor.website}</p>
            {competitor.description && <p className="text-dark-300 mt-2 text-sm max-w-2xl">{competitor.description}</p>}
          </div>
          <div className="flex gap-2 max-sm:hidden">
            <button onClick={handleIngestion} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary-600/20 text-primary-400 hover:bg-primary-600/30 transition text-sm">
              <Play className="w-4 h-4" /> Run Ingestion
            </button>
            <button onClick={handleMonitor} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-dark-800 text-dark-300 hover:text-dark-50 transition text-sm">
              <Eye className="w-4 h-4" /> Monitor Website
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
          <StatBox label="Sentiment" value={`${competitor.sentiment_score.toFixed(1)}%`} change={competitor.sentiment_change} sparkColor="#3b82f6" />
          <StatBox label="Activities" value={competitor.recent_activities} sparkColor="#8b5cf6" />
          <StatBox label="Keywords" value={competitor.keywords?.length || 0} sparkColor="#06b6d4" />
          <StatBox label="RSS Feeds" value={competitor.rss_feeds?.length || 0} sparkColor="#10b981" />
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex items-center gap-1 bg-dark-900 border border-dark-800 rounded-xl p-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition flex-1 justify-center ${
                activeTab === tab.key
                  ? "bg-primary-600/20 text-primary-400"
                  : "text-dark-400 hover:text-dark-50 hover:bg-dark-800/50"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {tab.count != null && (
                <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                  activeTab === tab.key ? "bg-primary-600/30 text-primary-300" : "bg-dark-800 text-dark-500"
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === "overview" && (
        <div className="space-y-6 animate-fade-in">
          {/* Sentiment Chart */}
          <div className="bg-dark-900 border border-dark-800 rounded-xl p-6">
            <h2 className="font-semibold mb-4">Sentiment History</h2>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
                  <YAxis stroke="#64748b" fontSize={12} domain={[0, 100]} />
                  <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px" }} />
                  <Line type="monotone" dataKey="score" stroke="#3b82f6" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-dark-500 text-sm">No sentiment data yet. Run ingestion to collect data.</p>
            )}
          </div>

          {/* Recent activities preview */}
          {activities.length > 0 && (
            <div className="bg-dark-900 border border-dark-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold">Recent Activities</h2>
                <button onClick={() => setActiveTab("activities")} className="text-primary-400 hover:text-primary-300 text-sm transition">
                  View all
                </button>
              </div>
              <div className="space-y-3">
                {activities.slice(0, 3).map((a) => (
                  <ActivityItem key={a.id} activity={a} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "activities" && (
        <div className="bg-dark-900 border border-dark-800 rounded-xl p-6 animate-fade-in">
          <h2 className="font-semibold mb-4">Activities ({activities.length})</h2>
          <div className="space-y-3">
            {activities.slice(0, visibleActivities).map((a, i) => (
              <ActivityItem key={a.id} activity={a} index={i} />
            ))}
            {activities.length === 0 && <p className="text-dark-500 text-sm">No activities detected yet</p>}
          </div>
          {activities.length >= 50 && visibleActivities < activities.length && (
            <div className="mt-6 text-center">
              <button
                onClick={() => setVisibleActivities((v) => v + 20)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-dark-800 text-dark-300 hover:text-dark-50 hover:bg-dark-700 transition text-sm"
              >
                <ChevronDown className="w-4 h-4" />
                Load More
              </button>
            </div>
          )}
        </div>
      )}

      {activeTab === "insights" && (
        <div className="bg-dark-900 border border-dark-800 rounded-xl p-6 animate-fade-in">
          <h2 className="font-semibold mb-4">Insights</h2>
          {insights.length > 0 ? (
            <div className="space-y-3">
              {insights.map((ins, i) => (
                <div
                  key={ins.id || i}
                  className="p-4 rounded-lg bg-dark-800/50 card-hover animate-fade-in"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Lightbulb className="w-4 h-4 text-yellow-400" />
                    <span className="text-sm font-medium">{ins.title}</span>
                    {ins.type && (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-dark-700 text-dark-300">{ins.type}</span>
                    )}
                  </div>
                  <p className="text-xs text-dark-400 leading-relaxed">{ins.summary || ins.description}</p>
                  {ins.created_at && (
                    <p className="text-xs text-dark-500 mt-2">{format(new Date(ins.created_at), "MMM dd, yyyy")}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Lightbulb className="w-8 h-8 text-dark-600 mx-auto mb-2" />
              <p className="text-dark-500 text-sm">No insights available for this competitor yet.</p>
              <p className="text-dark-600 text-xs mt-1">Run ingestion to generate insights.</p>
            </div>
          )}
        </div>
      )}

      {/* Floating action buttons (mobile-friendly) */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-2 z-40 sm:hidden">
        <button
          onClick={handleMonitor}
          className="w-12 h-12 rounded-full bg-dark-800 border border-dark-700 text-dark-300 hover:text-dark-50 shadow-xl flex items-center justify-center transition hover:scale-105"
          title="Monitor Website"
        >
          <Eye className="w-5 h-5" />
        </button>
        <button
          onClick={handleIngestion}
          className="w-12 h-12 rounded-full bg-primary-600 text-white shadow-xl shadow-primary-600/30 flex items-center justify-center transition hover:scale-105 hover:bg-primary-700"
          title="Run Ingestion"
        >
          <Play className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

/* Entity color mapping */
function entityColor(type: string): string {
  const t = type.toUpperCase();
  if (t === "PER" || t === "PERSON") return "bg-purple-500/10 text-purple-400";
  if (t === "ORG" || t === "ORGANIZATION") return "bg-blue-500/10 text-blue-400";
  if (t === "LOC" || t === "LOCATION" || t === "GPE") return "bg-green-500/10 text-green-400";
  if (t === "MISC") return "bg-yellow-500/10 text-yellow-400";
  return "bg-primary-500/10 text-primary-400";
}

function ActivityItem({ activity: a, index = 0 }: { activity: any; index?: number }) {
  return (
    <div
      className="flex items-start gap-4 p-4 rounded-lg bg-dark-800/50 card-hover animate-fade-in"
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
        a.importance === "critical" ? "bg-red-400" : a.importance === "high" ? "bg-yellow-400" : "bg-blue-400"
      }`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="px-2 py-0.5 rounded-full text-xs bg-dark-700 text-dark-300">{a.type}</span>
          <span className="px-2 py-0.5 rounded-full text-xs bg-dark-700 text-dark-300">{a.source}</span>
          <span className="text-xs text-dark-500">{format(new Date(a.created_at), "MMM dd HH:mm")}</span>
        </div>
        <h3 className="text-sm font-medium">{a.title}</h3>
        <p className="text-xs text-dark-400 mt-1 line-clamp-2">{a.description}</p>
        {a.entities?.length > 0 && (
          <div className="flex gap-1 mt-2 flex-wrap">
            {a.entities.slice(0, 5).map((e: any, i: number) => (
              <span key={i} className={`px-1.5 py-0.5 rounded text-xs ${entityColor(e.entity)}`}>
                {e.word} ({e.entity})
              </span>
            ))}
          </div>
        )}
      </div>
      {a.source_url && (
        <a href={a.source_url} target="_blank" rel="noopener noreferrer" className="text-dark-400 hover:text-dark-50 transition flex-shrink-0">
          <ExternalLink className="w-4 h-4" />
        </a>
      )}
    </div>
  );
}

function StatBox({ label, value, change, sparkColor = "#3b82f6" }: { label: string; value: any; change?: number; sparkColor?: string }) {
  // Decorative mini sparkline SVG
  const sparkPath = "M0,12 L4,10 L8,14 L12,8 L16,11 L20,6 L24,9 L28,4 L32,7";

  return (
    <div className="p-3 rounded-lg bg-dark-800/50">
      <p className="text-xs text-dark-400">{label}</p>
      <div className="flex items-center gap-2 mt-1">
        <span className="text-lg font-bold">{value}</span>
        {change != null && change !== 0 && (
          <span className={`flex items-center text-xs ${change > 0 ? "text-green-400" : "text-red-400"}`}>
            {change > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(change).toFixed(1)}
          </span>
        )}
        <svg width="32" height="16" className="ml-auto opacity-60" viewBox="0 0 32 16">
          <path d={sparkPath} fill="none" stroke={sparkColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Back link skeleton */}
      <div className="h-4 w-32 bg-dark-800 rounded animate-pulse" />
      {/* Header skeleton */}
      <div className="bg-dark-900 border border-dark-800 rounded-xl p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="h-7 w-48 bg-dark-800 rounded animate-pulse" />
            <div className="h-4 w-64 bg-dark-800/70 rounded animate-pulse" style={{ animationDelay: "100ms" }} />
          </div>
          <div className="flex gap-2">
            <div className="h-9 w-28 bg-dark-800 rounded-lg animate-pulse" style={{ animationDelay: "200ms" }} />
            <div className="h-9 w-32 bg-dark-800 rounded-lg animate-pulse" style={{ animationDelay: "300ms" }} />
          </div>
        </div>
        <div className="grid grid-cols-4 gap-4 mt-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-dark-800/50 rounded-lg animate-pulse" style={{ animationDelay: `${i * 100}ms` }} />
          ))}
        </div>
      </div>
      {/* Tab skeleton */}
      <div className="h-12 bg-dark-900 border border-dark-800 rounded-xl animate-pulse" />
      {/* Content skeleton */}
      <div className="bg-dark-900 border border-dark-800 rounded-xl p-6">
        <div className="h-5 w-40 bg-dark-800 rounded animate-pulse mb-4" />
        <div className="h-[250px] bg-dark-800/50 rounded-lg animate-pulse" style={{ animationDelay: "200ms" }} />
      </div>
    </div>
  );
}
