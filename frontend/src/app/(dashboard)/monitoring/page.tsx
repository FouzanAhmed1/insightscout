"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Eye, AlertTriangle, CheckCircle, Play, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { useToast } from "@/components/ui/Toast";

type HistoryFilter = "all" | "changes" | "no_changes";

export default function MonitoringPage() {
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [competitors, setCompetitors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [monitoringIds, setMonitoringIds] = useState<Set<string>>(new Set());
  const [expandedSnapshots, setExpandedSnapshots] = useState<Set<string>>(new Set());
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("all");
  const { toast } = useToast();

  useEffect(() => {
    async function load() {
      try {
        const [snaps, comps] = await Promise.all([api.getSnapshots(), api.getCompetitors({})]);
        setSnapshots(snaps);
        setCompetitors(comps);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleMonitor = async (compId: string, url: string) => {
    setMonitoringIds((prev) => new Set(prev).add(compId));
    try {
      await api.triggerMonitoring(compId, url);
      toast("success", "Monitoring Queued", "Website monitoring queued (CLIP + OpenCV pipeline)");
    } catch (err) {
      console.error(err);
      toast("error", "Monitoring Failed", "Could not queue website monitoring. Please try again.");
    }
    // Keep the spinner for 3 seconds to show monitoring-in-progress state
    setTimeout(() => {
      setMonitoringIds((prev) => {
        const next = new Set(prev);
        next.delete(compId);
        return next;
      });
    }, 3000);
  };

  const toggleSnapshot = (id: string) => {
    setExpandedSnapshots((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const filteredSnapshots = snapshots.filter((s) => {
    if (historyFilter === "changes") return s.changes_detected;
    if (historyFilter === "no_changes") return !s.changes_detected;
    return true;
  });

  const competitorsWithWebsite = competitors.filter((c) => c.website);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Website Monitoring</h1>
        <p className="text-dark-400 mt-1">CLIP vision + OpenCV change detection pipeline</p>
      </div>

      {/* Competitor Monitors */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
        {competitorsWithWebsite.map((c) => {
          const isMonitoring = monitoringIds.has(c.id);

          return (
            <div key={c.id} className="bg-dark-900 border border-dark-800 rounded-xl p-4 card-hover transition-all">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium">{c.name}</h3>
                <button
                  onClick={() => handleMonitor(c.id, c.website)}
                  disabled={isMonitoring}
                  className="text-primary-400 hover:text-primary-300 transition disabled:opacity-50"
                >
                  {isMonitoring ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                </button>
              </div>
              <p className="text-xs text-dark-400 truncate mb-2">{c.website}</p>
              {isMonitoring ? (
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-primary-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-primary-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                  <span className="text-xs text-primary-400 ml-1">Monitoring in progress...</span>
                </div>
              ) : (
                <p className="text-xs text-dark-500">Click play to trigger CLIP + OpenCV analysis</p>
              )}
            </div>
          );
        })}
        {competitorsWithWebsite.length === 0 && (
          <div className="col-span-full text-center py-8 text-dark-500">
            <div className="animate-float">
              <Eye className="w-12 h-12 mx-auto mb-3 opacity-30" />
            </div>
            <p>No competitors with websites to monitor</p>
          </div>
        )}
      </div>

      {/* Snapshot History */}
      <div className="bg-dark-900 border border-dark-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Monitoring History</h2>
          <div className="flex items-center gap-1.5">
            {(
              [
                { key: "all", label: "All" },
                { key: "changes", label: "Changes Detected" },
                { key: "no_changes", label: "No Changes" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setHistoryFilter(tab.key)}
                className={`px-3 py-1 rounded-lg text-xs transition ${
                  historyFilter === tab.key
                    ? "bg-primary-600 text-white"
                    : "bg-dark-800 text-dark-400 hover:text-dark-50"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {snapshots.length > 0 ? (
          filteredSnapshots.length > 0 ? (
            <div className="relative">
              {/* Vertical timeline line */}
              <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-dark-700" />

              <div className="space-y-3">
                {filteredSnapshots.map((s) => {
                  const isExpanded = expandedSnapshots.has(s.id);
                  const hasDiffSummary = s.diff_summary && s.diff_summary.trim().length > 0;

                  return (
                    <div key={s.id} className="relative pl-10">
                      {/* Timeline dot */}
                      <div
                        className={`absolute left-[10px] top-5 w-[11px] h-[11px] rounded-full border-2 ${
                          s.changes_detected
                            ? "border-yellow-400 bg-yellow-400/30"
                            : "border-green-400 bg-green-400/30"
                        }`}
                      />

                      <div
                        className={`rounded-lg bg-dark-800/50 transition-all ${
                          hasDiffSummary ? "cursor-pointer hover:bg-dark-800/70" : ""
                        }`}
                        onClick={() => hasDiffSummary && toggleSnapshot(s.id)}
                      >
                        <div className="flex items-center justify-between p-4">
                          <div className="flex items-center gap-3">
                            {hasDiffSummary && (
                              isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-dark-400 flex-shrink-0" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-dark-400 flex-shrink-0" />
                              )
                            )}
                            {s.changes_detected ? (
                              <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
                            ) : (
                              <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                            )}
                            <div>
                              <p className="text-sm font-medium truncate max-w-md">{s.url}</p>
                              <div className="flex items-center gap-2">
                                <p className="text-xs text-dark-400">
                                  {format(new Date(s.created_at), "MMM dd, yyyy HH:mm")}
                                </p>
                                <span className="text-xs text-dark-500">
                                  ({formatDistanceToNow(new Date(s.created_at), { addSuffix: true })})
                                </span>
                              </div>
                            </div>
                          </div>
                          <span
                            className={`text-xs px-2 py-1 rounded-full flex-shrink-0 ${
                              s.changes_detected
                                ? "bg-yellow-500/20 text-yellow-400"
                                : "bg-green-500/20 text-green-400"
                            }`}
                          >
                            {s.changes_detected ? "Changes Detected" : "No Changes"}
                          </span>
                        </div>

                        {/* Expandable diff summary */}
                        {isExpanded && hasDiffSummary && (
                          <div className="px-4 pb-4 pt-0">
                            <div className="p-3 rounded-lg bg-dark-900 border border-dark-700/50 text-xs text-dark-300 whitespace-pre-wrap">
                              {s.diff_summary}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-dark-500">
              <p className="text-sm">No snapshots match the selected filter</p>
            </div>
          )
        ) : (
          <div className="text-center py-8 text-dark-500">
            <div className="animate-float">
              <Eye className="w-12 h-12 mx-auto mb-3 opacity-30" />
            </div>
            <p className="text-sm">No monitoring snapshots yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
