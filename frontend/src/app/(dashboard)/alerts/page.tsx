"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import {
  Bell,
  Plus,
  Trash2,
  Pause,
  Play,
  TrendingUp,
  DollarSign,
  Sparkles,
  Newspaper,
  Users,
  AlertTriangle,
  X,
} from "lucide-react";
import { format } from "date-fns";

const ALERT_TYPE_CONFIG: Record<
  string,
  { color: string; border: string; icon: React.ElementType; label: string; helper: string }
> = {
  sentiment_spike: {
    color: "text-blue-400",
    border: "border-l-blue-500",
    icon: TrendingUp,
    label: "Sentiment Spike",
    helper: "Triggers when sentiment score changes drastically for a tracked competitor.",
  },
  price_change: {
    color: "text-green-400",
    border: "border-l-green-500",
    icon: DollarSign,
    label: "Price Change",
    helper: "Triggers when a competitor updates their pricing or plan structure.",
  },
  new_feature: {
    color: "text-purple-400",
    border: "border-l-purple-500",
    icon: Sparkles,
    label: "New Feature",
    helper: "Triggers when a competitor launches or announces a new feature.",
  },
  press_mention: {
    color: "text-yellow-400",
    border: "border-l-yellow-500",
    icon: Newspaper,
    label: "Press Mention",
    helper: "Triggers when a competitor is mentioned in major press outlets.",
  },
  hiring_surge: {
    color: "text-orange-400",
    border: "border-l-orange-500",
    icon: Users,
    label: "Hiring Surge",
    helper: "Triggers when a competitor significantly increases job postings.",
  },
};

const STATUS_CONFIG: Record<string, { dot: string; bg: string; label: string }> = {
  active: { dot: "bg-green-400", bg: "bg-green-500/15 text-green-400", label: "Active" },
  paused: { dot: "bg-dark-500", bg: "bg-dark-700/50 text-dark-400", label: "Paused" },
  triggered: { dot: "bg-red-400", bg: "bg-red-500/15 text-red-400", label: "Triggered" },
};

/* ── Inline Confirm Modal ─────────────────────────────────── */
function ConfirmModal({
  title,
  message,
  confirmLabel = "Delete",
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 animate-backdrop-in"
      onClick={onCancel}
    >
      <div
        className="bg-dark-900 border border-dark-700 rounded-xl p-6 w-full max-w-sm animate-modal-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-red-500/15 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-400" />
          </div>
          <h3 className="text-lg font-semibold">{title}</h3>
        </div>
        <p className="text-sm text-dark-400 mb-6">{message}</p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-dark-300 hover:text-dark-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white transition"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main Page ────────────────────────────────────────────── */
export default function AlertsPage() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  const { toast } = useToast();

  const load = async () => {
    try {
      setAlerts(await api.getAlerts());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const toggleStatus = async (alert: any) => {
    const newStatus = alert.status === "active" ? "paused" : "active";
    await api.updateAlert(alert.id, { status: newStatus });
    setFlashId(alert.id);
    setTimeout(() => setFlashId(null), 600);
    toast(
      "success",
      newStatus === "active" ? "Alert resumed" : "Alert paused",
      `"${alert.name}" is now ${newStatus}.`
    );
    load();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await api.deleteAlert(deleteId);
    toast("success", "Alert deleted", "The alert has been removed.");
    setDeleteId(null);
    load();
  };

  /* Summary counts */
  const counts = alerts.reduce(
    (acc, a) => {
      if (a.status === "active") acc.active++;
      else if (a.status === "paused") acc.paused++;
      else if (a.status === "triggered") acc.triggered++;
      return acc;
    },
    { active: 0, paused: 0, triggered: 0 }
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Alerts</h1>
          <p className="text-dark-400 mt-1">
            Configure automated competitive intelligence alerts
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white transition"
        >
          <Plus className="w-4 h-4" /> New Alert
        </button>
      </div>

      {/* Summary Bar */}
      {alerts.length > 0 && (
        <div className="flex items-center gap-4 px-4 py-3 rounded-xl bg-dark-900 border border-dark-800">
          <span className="text-sm text-dark-400">
            <span className="font-semibold text-green-400">{counts.active}</span> active
          </span>
          <span className="w-px h-4 bg-dark-700" />
          <span className="text-sm text-dark-400">
            <span className="font-semibold text-dark-300">{counts.paused}</span> paused
          </span>
          <span className="w-px h-4 bg-dark-700" />
          <span className="text-sm text-dark-400">
            <span className="font-semibold text-red-400">{counts.triggered}</span> triggered
          </span>
        </div>
      )}

      {/* Alert List */}
      <div className="space-y-3 stagger-children">
        {alerts.map((a) => {
          const typeConf = ALERT_TYPE_CONFIG[a.type] ?? ALERT_TYPE_CONFIG.sentiment_spike;
          const statusConf = STATUS_CONFIG[a.status] ?? STATUS_CONFIG.active;
          const TypeIcon = typeConf.icon;

          return (
            <div
              key={a.id}
              className={`card-hover bg-dark-900 border border-dark-800 border-l-4 ${typeConf.border} rounded-xl p-4 flex items-center justify-between transition-all duration-300 ${
                flashId === a.id ? "ring-2 ring-primary-500/40" : ""
              }`}
            >
              <div className="flex items-center gap-4">
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    a.status === "active" ? "bg-green-500/20" : "bg-dark-800"
                  }`}
                >
                  <TypeIcon
                    className={`w-5 h-5 ${
                      a.status === "active" ? typeConf.color : "text-dark-500"
                    }`}
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">{a.name}</h3>
                    {/* Status badge */}
                    <span
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${statusConf.bg}`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${statusConf.dot} ${
                          a.status === "active" ? "animate-pulse" : ""
                        }`}
                      />
                      {statusConf.label}
                    </span>
                  </div>
                  <p className="text-sm text-dark-400">
                    {typeConf.label} &middot; {a.description}
                  </p>
                  {a.last_triggered && (
                    <p className="text-xs text-dark-500 mt-0.5">
                      Last triggered: {format(new Date(a.last_triggered), "MMM dd HH:mm")}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleStatus(a)}
                  className="p-2 rounded-lg text-dark-400 hover:text-dark-50 hover:bg-dark-800 transition"
                  title={a.status === "active" ? "Pause" : "Resume"}
                >
                  {a.status === "active" ? (
                    <Pause className="w-4 h-4" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                </button>
                <button
                  onClick={() => setDeleteId(a.id)}
                  className="p-2 rounded-lg text-dark-400 hover:text-red-400 hover:bg-red-500/10 transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
        {alerts.length === 0 && !loading && (
          <div className="text-center py-16 text-dark-500">
            <Bell className="w-14 h-14 mx-auto mb-4 opacity-30 animate-float" />
            <p className="text-lg font-medium mb-1">No alerts configured</p>
            <p className="text-sm text-dark-600">
              Create your first alert to start monitoring competitors.
            </p>
          </div>
        )}
      </div>

      {/* Add Alert Modal */}
      {showAdd && <AddAlertModal onClose={() => setShowAdd(false)} onAdded={load} />}

      {/* Delete Confirmation Modal */}
      {deleteId && (
        <ConfirmModal
          title="Delete Alert"
          message="Are you sure you want to delete this alert? This action cannot be undone."
          confirmLabel="Delete"
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}

/* ── Add Alert Modal ──────────────────────────────────────── */
function AddAlertModal({
  onClose,
  onAdded,
}: {
  onClose: () => void;
  onAdded: () => void;
}) {
  const [form, setForm] = useState({
    name: "",
    type: "sentiment_spike",
    description: "",
    target: "",
  });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.createAlert(form);
      toast("success", "Alert created", `"${form.name}" is now active.`);
      onAdded();
      onClose();
    } catch (err) {
      console.error(err);
      toast("error", "Failed to create alert", "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const selectedType = ALERT_TYPE_CONFIG[form.type];

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 animate-backdrop-in"
      onClick={onClose}
    >
      <div
        className="bg-dark-900 border border-dark-700 rounded-xl p-6 w-full max-w-md animate-modal-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">Create Alert</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-dark-400 hover:text-dark-50 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1.5">
              Alert Name
            </label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Competitor pricing update"
              className="w-full px-4 py-2.5 rounded-lg bg-dark-800 border border-dark-700 text-dark-50 placeholder-dark-500 focus:outline-none focus:border-primary-500 transition"
            />
          </div>

          {/* Type selector */}
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1.5">
              Alert Type
            </label>
            <div className="space-y-2">
              {Object.entries(ALERT_TYPE_CONFIG).map(([key, conf]) => {
                const Icon = conf.icon;
                const isSelected = form.type === key;
                return (
                  <button
                    type="button"
                    key={key}
                    onClick={() => setForm({ ...form, type: key })}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition text-left ${
                      isSelected
                        ? "border-primary-500 bg-primary-500/10"
                        : "border-dark-700 bg-dark-800/50 hover:border-dark-600"
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isSelected ? conf.color : "text-dark-500"}`} />
                    <div className="flex-1 min-w-0">
                      <span
                        className={`text-sm font-medium ${
                          isSelected ? "text-dark-50" : "text-dark-300"
                        }`}
                      >
                        {conf.label}
                      </span>
                    </div>
                    {isSelected && (
                      <div className="w-2 h-2 rounded-full bg-primary-500" />
                    )}
                  </button>
                );
              })}
            </div>
            {selectedType && (
              <p className="text-xs text-dark-500 mt-2">{selectedType.helper}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1.5">
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Optional details about this alert"
              rows={2}
              className="w-full px-4 py-2.5 rounded-lg bg-dark-800 border border-dark-700 text-dark-50 placeholder-dark-500 focus:outline-none focus:border-primary-500 transition"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-dark-300 hover:text-dark-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-medium transition disabled:opacity-50"
            >
              {saving ? "Creating..." : "Create Alert"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
