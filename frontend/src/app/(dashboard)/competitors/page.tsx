"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import {
  Plus, Search, TrendingUp, TrendingDown, ExternalLink, Trash2, Play,
  LayoutGrid, List, ArrowUpDown, Building2, Globe, Tag, Rss, FileText,
  SearchX, ChevronDown,
} from "lucide-react";
import Link from "next/link";

type SortKey = "name" | "sentiment" | "activities";
type ViewMode = "table" | "grid";

export default function CompetitorsPage() {
  const { toast } = useToast();
  const [competitors, setCompetitors] = useState<any[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>("table");
  const [sortBy, setSortBy] = useState<SortKey>("name");
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [selectedIndustry, setSelectedIndustry] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = async () => {
    try {
      const data = await api.getCompetitors({ search: search || undefined });
      setCompetitors(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [search]);

  const handleSearchInput = useCallback((value: string) => {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(value);
    }, 300);
  }, []);

  const handleDelete = async (id: string) => {
    try {
      await api.deleteCompetitor(id);
      toast("success", "Competitor deleted", "The competitor has been removed.");
      setDeleteConfirmId(null);
      load();
    } catch (err) {
      console.error(err);
      toast("error", "Delete failed", "Could not delete competitor.");
    }
  };

  const handleTriggerIngestion = async (id: string) => {
    try {
      await api.triggerIngestion("custom", id);
      toast("success", "Ingestion triggered", "Data collection has started for this competitor.");
    } catch (err) {
      console.error(err);
      toast("error", "Ingestion failed", "Could not trigger ingestion.");
    }
  };

  // Extract unique industries for filter chips
  const industries = useMemo(() => {
    const set = new Set<string>();
    competitors.forEach((c) => { if (c.industry) set.add(c.industry); });
    return Array.from(set).sort();
  }, [competitors]);

  // Filter + sort
  const displayCompetitors = useMemo(() => {
    let list = selectedIndustry
      ? competitors.filter((c) => c.industry === selectedIndustry)
      : competitors;

    list = [...list].sort((a, b) => {
      if (sortBy === "name") return (a.name || "").localeCompare(b.name || "");
      if (sortBy === "sentiment") return (b.sentiment_score ?? 0) - (a.sentiment_score ?? 0);
      if (sortBy === "activities") return (b.recent_activities ?? 0) - (a.recent_activities ?? 0);
      return 0;
    });

    return list;
  }, [competitors, sortBy, selectedIndustry]);

  const sortLabels: Record<SortKey, string> = { name: "Name", sentiment: "Sentiment", activities: "Activities" };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Competitors</h1>
          <p className="text-dark-400 mt-1">Track and analyze your competitive landscape</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white transition">
          <Plus className="w-4 h-4" /> Add Competitor
        </button>
      </div>

      {/* Search + Sort + View Toggle */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-3 bg-dark-900 border border-dark-800 rounded-lg px-4 py-2 flex-1">
          <Search className="w-4 h-4 text-dark-400" />
          <input
            value={searchInput}
            onChange={(e) => handleSearchInput(e.target.value)}
            placeholder="Search competitors..."
            className="bg-transparent text-sm text-dark-50 placeholder-dark-500 focus:outline-none flex-1"
          />
        </div>

        {/* Sort dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowSortMenu(!showSortMenu)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-dark-900 border border-dark-800 text-sm text-dark-300 hover:text-dark-50 transition"
          >
            <ArrowUpDown className="w-4 h-4" />
            {sortLabels[sortBy]}
            <ChevronDown className="w-3 h-3" />
          </button>
          {showSortMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowSortMenu(false)} />
              <div className="absolute right-0 top-full mt-1 z-20 bg-dark-900 border border-dark-700 rounded-lg shadow-xl overflow-hidden min-w-[140px]">
                {(["name", "sentiment", "activities"] as SortKey[]).map((key) => (
                  <button
                    key={key}
                    onClick={() => { setSortBy(key); setShowSortMenu(false); }}
                    className={`w-full text-left px-4 py-2 text-sm transition ${sortBy === key ? "bg-primary-600/20 text-primary-400" : "text-dark-300 hover:bg-dark-800 hover:text-dark-50"}`}
                  >
                    {sortLabels[key]}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* View toggle */}
        <div className="flex items-center bg-dark-900 border border-dark-800 rounded-lg overflow-hidden">
          <button
            onClick={() => setView("table")}
            className={`p-2 transition ${view === "table" ? "bg-primary-600/20 text-primary-400" : "text-dark-400 hover:text-dark-50"}`}
            title="Table view"
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={() => setView("grid")}
            className={`p-2 transition ${view === "grid" ? "bg-primary-600/20 text-primary-400" : "text-dark-400 hover:text-dark-50"}`}
            title="Grid view"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Industry filter chips */}
      {industries.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setSelectedIndustry(null)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition ${
              selectedIndustry === null
                ? "bg-primary-600/20 text-primary-400 border border-primary-500/30"
                : "bg-dark-800 text-dark-400 border border-dark-700 hover:text-dark-50 hover:border-dark-600"
            }`}
          >
            All
          </button>
          {industries.map((ind) => (
            <button
              key={ind}
              onClick={() => setSelectedIndustry(selectedIndustry === ind ? null : ind)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                selectedIndustry === ind
                  ? "bg-primary-600/20 text-primary-400 border border-primary-500/30"
                  : "bg-dark-800 text-dark-400 border border-dark-700 hover:text-dark-50 hover:border-dark-600"
              }`}
            >
              {ind}
            </button>
          ))}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 bg-dark-800 rounded-xl animate-pulse" style={{ animationDelay: `${i * 100}ms` }} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && displayCompetitors.length === 0 && (
        <div className="bg-dark-900 border border-dark-800 rounded-xl p-12 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-primary-600/10 flex items-center justify-center">
              <Building2 className="w-6 h-6 text-primary-400" />
            </div>
            <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center -ml-4 mt-4">
              <SearchX className="w-5 h-5 text-cyan-400" />
            </div>
          </div>
          <h3 className="text-lg font-semibold text-dark-50 mb-1">
            {search || selectedIndustry ? "No competitors match your filters" : "No competitors yet"}
          </h3>
          <p className="text-dark-400 text-sm mb-4">
            {search || selectedIndustry
              ? "Try adjusting your search or clearing filters."
              : "Start tracking your competitive landscape by adding a competitor."}
          </p>
          {!search && !selectedIndustry && (
            <button
              onClick={() => setShowAdd(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm transition"
            >
              <Plus className="w-4 h-4" /> Add Your First Competitor
            </button>
          )}
        </div>
      )}

      {/* Table View */}
      {!loading && displayCompetitors.length > 0 && view === "table" && (
        <div className="bg-dark-900 border border-dark-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-dark-800">
                <th className="text-left px-6 py-3 text-xs font-medium text-dark-400 uppercase">Name</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-dark-400 uppercase">Industry</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-dark-400 uppercase">Sentiment</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-dark-400 uppercase">Activities</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-dark-400 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayCompetitors.map((c, i) => (
                <tr
                  key={c.id}
                  className="border-b border-dark-800/50 hover:bg-dark-800/30 transition animate-fade-in"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <td className="px-6 py-4">
                    <Link href={`/competitors/${c.id}`} className="font-medium hover:text-primary-400 transition">{c.name}</Link>
                    {c.website && <p className="text-xs text-dark-500 mt-0.5">{c.website}</p>}
                  </td>
                  <td className="px-6 py-4 text-sm text-dark-300">{c.industry || "—"}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium ${c.sentiment_score > 60 ? "text-green-400" : c.sentiment_score > 40 ? "text-yellow-400" : "text-red-400"}`}>
                        {c.sentiment_score.toFixed(1)}%
                      </span>
                      {c.sentiment_change !== 0 && (
                        <span className={`flex items-center text-xs ${c.sentiment_change > 0 ? "text-green-400" : "text-red-400"}`}>
                          {c.sentiment_change > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {Math.abs(c.sentiment_change).toFixed(1)}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-dark-300">{c.recent_activities}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleTriggerIngestion(c.id)} title="Run ingestion" className="text-dark-400 hover:text-primary-400 transition">
                        <Play className="w-4 h-4" />
                      </button>
                      {c.website && (
                        <a href={c.website} target="_blank" rel="noopener noreferrer" className="text-dark-400 hover:text-dark-50 transition">
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                      <button onClick={() => setDeleteConfirmId(c.id)} className="text-dark-400 hover:text-red-400 transition">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Grid View */}
      {!loading && displayCompetitors.length > 0 && view === "grid" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayCompetitors.map((c, i) => (
            <div
              key={c.id}
              className="bg-dark-900 border border-dark-800 rounded-xl p-5 card-hover animate-fade-in"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              {/* Card header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1 min-w-0">
                  <Link href={`/competitors/${c.id}`} className="font-semibold text-dark-50 hover:text-primary-400 transition block truncate">
                    {c.name}
                  </Link>
                  <p className="text-xs text-dark-400 mt-0.5 truncate">{c.industry || "No industry"}</p>
                </div>
                {/* Sentiment gauge */}
                <SentimentGauge score={c.sentiment_score} />
              </div>

              {/* Stats */}
              <div className="flex items-center gap-4 mb-4 text-sm">
                <div>
                  <p className="text-dark-500 text-xs">Activities</p>
                  <p className="font-medium text-dark-50">{c.recent_activities}</p>
                </div>
                {c.sentiment_change !== 0 && (
                  <div>
                    <p className="text-dark-500 text-xs">Change</p>
                    <span className={`flex items-center gap-1 text-sm font-medium ${c.sentiment_change > 0 ? "text-green-400" : "text-red-400"}`}>
                      {c.sentiment_change > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {Math.abs(c.sentiment_change).toFixed(1)}
                    </span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-3 border-t border-dark-800">
                <button onClick={() => handleTriggerIngestion(c.id)} title="Run ingestion" className="p-2 rounded-lg text-dark-400 hover:text-primary-400 hover:bg-primary-600/10 transition">
                  <Play className="w-4 h-4" />
                </button>
                {c.website && (
                  <a href={c.website} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg text-dark-400 hover:text-dark-50 hover:bg-dark-800 transition">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
                <div className="flex-1" />
                <button onClick={() => setDeleteConfirmId(c.id)} className="p-2 rounded-lg text-dark-400 hover:text-red-400 hover:bg-red-500/10 transition">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Modal */}
      {showAdd && <AddCompetitorModal onClose={() => setShowAdd(false)} onAdded={load} />}

      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-backdrop-in" onClick={() => setDeleteConfirmId(null)}>
          <div className="bg-dark-900 border border-dark-700 rounded-xl p-6 w-full max-w-sm animate-modal-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="font-semibold">Delete Competitor</h3>
                <p className="text-sm text-dark-400">This action cannot be undone</p>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteConfirmId(null)} className="px-4 py-2 rounded-lg text-dark-300 hover:text-dark-50 transition">Cancel</button>
              <button onClick={() => handleDelete(deleteConfirmId)} className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white transition">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* Circular sentiment gauge for card view */
function SentimentGauge({ score }: { score: number }) {
  const size = 48;
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const color = score > 60 ? "#4ade80" : score > 40 ? "#facc15" : "#f87171";

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-dark-800"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={`${progress} ${circumference - progress}`}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-xs font-bold" style={{ color }}>
        {Math.round(score)}
      </span>
    </div>
  );
}

function AddCompetitorModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ name: "", website: "", industry: "", description: "", keywords: "", rss_feeds: "" });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.createCompetitor({
        ...form,
        keywords: form.keywords.split(",").map((k) => k.trim()).filter(Boolean),
        rss_feeds: form.rss_feeds.split(",").map((k) => k.trim()).filter(Boolean),
      });
      toast("success", "Competitor added", `${form.name} is now being tracked.`);
      onAdded();
      onClose();
    } catch (err) {
      console.error(err);
      toast("error", "Failed to add competitor", "Please check the form and try again.");
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "w-full pl-10 pr-4 py-2.5 rounded-lg bg-dark-800 border border-dark-700 text-dark-50 placeholder-dark-500 focus:outline-none focus:border-primary-500 transition";

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 animate-backdrop-in" onClick={onClose}>
      <div
        className="bg-dark-900 border border-dark-700 rounded-xl p-6 w-full max-w-lg animate-modal-in"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold mb-6">Add Competitor</h2>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Company Info Section */}
          <div>
            <p className="text-xs font-semibold uppercase text-dark-400 mb-3 tracking-wider">Company Info</p>
            <div className="space-y-3">
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
                <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Company Name" className={inputClass} />
              </div>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
                <input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="Website URL" className={inputClass} />
              </div>
              <div className="relative">
                <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
                <input value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} placeholder="Industry" className={inputClass} />
              </div>
              <div className="relative">
                <FileText className="absolute left-3 top-3 w-4 h-4 text-dark-500" />
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description" rows={2} className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-dark-800 border border-dark-700 text-dark-50 placeholder-dark-500 focus:outline-none focus:border-primary-500 transition" />
              </div>
            </div>
          </div>

          {/* Tracking Config Section */}
          <div>
            <p className="text-xs font-semibold uppercase text-dark-400 mb-3 tracking-wider">Tracking Config</p>
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
                <input value={form.keywords} onChange={(e) => setForm({ ...form, keywords: e.target.value })} placeholder="Keywords (comma-separated)" className={inputClass} />
              </div>
              <div className="relative">
                <Rss className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
                <input value={form.rss_feeds} onChange={(e) => setForm({ ...form, rss_feeds: e.target.value })} placeholder="RSS Feed URLs (comma-separated)" className={inputClass} />
              </div>
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-dark-300 hover:text-dark-50 transition">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white transition disabled:opacity-50">
              {saving ? "Adding..." : "Add Competitor"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
