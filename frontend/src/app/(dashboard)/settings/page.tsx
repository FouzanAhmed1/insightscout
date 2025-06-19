"use client";

import { useState, useRef, useEffect } from "react";
import { useAuthStore } from "@/lib/store";
import { useToast } from "@/components/ui/Toast";
import {
  Database,
  Cpu,
  Server,
  Layers,
  Rss,
  Newspaper,
  MessageCircle,
  Globe,
  Github,
  FileText,
  Youtube,
  Twitter,
  Linkedin,
  Smartphone,
  Eye,
  EyeOff,
  Copy,
  Check,
  Save,
  KeyRound,
} from "lucide-react";

const tabs = [
  { id: "general", label: "General" },
  { id: "pipeline", label: "Pipeline" },
  { id: "sources", label: "Data Sources" },
  { id: "api", label: "API Keys" },
];

const SOURCE_ICONS: Record<string, React.ElementType> = {
  "RSS Feeds": Rss,
  "News API": Newspaper,
  Reddit: MessageCircle,
  "Website Scraping": Globe,
  GitHub: Github,
  "SEC EDGAR": FileText,
  YouTube: Youtube,
  "Twitter/X": Twitter,
  LinkedIn: Linkedin,
  "App Store": Smartphone,
};

const CONNECTED_SOURCES = ["RSS Feeds", "News API", "Reddit", "Website Scraping", "GitHub", "SEC EDGAR"];
const AVAILABLE_SOURCES = ["YouTube", "Twitter/X", "LinkedIn", "App Store"];

const PIPELINE_MODELS = [
  { icon: Cpu, name: "Sentiment Model", value: "cardiffnlp/twitter-roberta-base-sentiment-latest", desc: "RoBERTa-based sentiment classification" },
  { icon: Cpu, name: "NER Model", value: "dslim/bert-base-NER", desc: "BERT-based named entity recognition" },
  { icon: Cpu, name: "Classification", value: "facebook/bart-large-mnli", desc: "Zero-shot activity classification" },
  { icon: Layers, name: "CLIP Model", value: "ViT-B-32 (laion2b)", desc: "Visual embedding + image classification" },
  { icon: Database, name: "Embeddings", value: "all-MiniLM-L6-v2", desc: "Sentence embeddings for clustering" },
  { icon: Server, name: "Task Queue", value: "RabbitMQ", desc: "Async task orchestration" },
];

const API_KEYS = ["NEWS_API_KEY", "REDDIT_CLIENT_ID", "REDDIT_CLIENT_SECRET", "TWITTER_BEARER_TOKEN"];

export default function SettingsPage() {
  const { user } = useAuthStore();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("general");
  const [tabKey, setTabKey] = useState(0); // for re-triggering fade animation
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [underline, setUnderline] = useState({ left: 0, width: 0 });

  /* Profile form state */
  const [profileName, setProfileName] = useState(user?.full_name || "");
  const [savingProfile, setSavingProfile] = useState(false);

  /* API key visibility */
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  /* Animated tab underline */
  useEffect(() => {
    const el = tabRefs.current[activeTab];
    if (el) {
      setUnderline({ left: el.offsetLeft, width: el.offsetWidth });
    }
  }, [activeTab]);

  const switchTab = (id: string) => {
    setActiveTab(id);
    setTabKey((k) => k + 1);
  };

  const handleSaveProfile = () => {
    setSavingProfile(true);
    setTimeout(() => {
      setSavingProfile(false);
      toast("success", "Profile updated", "Your display name has been saved.");
    }, 500);
  };

  const toggleKeyVisibility = (key: string) => {
    setVisibleKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(`${key}=••••••••`);
    setCopiedKey(key);
    toast("info", "Copied to clipboard", `${key} reference copied.`);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSourceToggle = () => {
    toast("info", "Coming soon", "Data source toggling will be available in a future update.");
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-dark-400 mt-1">Configure your intelligence platform</p>
      </div>

      {/* Tab Bar with animated underline */}
      <div className="relative">
        <div className="flex gap-2 border-b border-dark-800 pb-px">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              ref={(el) => { tabRefs.current[tab.id] = el; }}
              onClick={() => switchTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium transition -mb-px ${
                activeTab === tab.id ? "text-dark-50" : "text-dark-400 hover:text-dark-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
          {/* Sliding underline */}
          <div
            className="absolute bottom-0 h-0.5 bg-primary-500 rounded-full transition-all duration-300 ease-out"
            style={{ left: underline.left, width: underline.width }}
          />
        </div>
      </div>

      {/* Tab Content */}
      <div key={tabKey} className="animate-fade-in">
        {/* ── General Tab ─────────────────────────────────── */}
        {activeTab === "general" && (
          <div className="space-y-6">
            {/* Account info */}
            <div className="card-hover bg-dark-900 border border-dark-800 rounded-xl p-6">
              <h3 className="font-medium mb-4">Account Information</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-dark-500 mb-1">Email</label>
                  <p className="text-sm text-dark-300">{user?.email}</p>
                </div>
              </div>
            </div>

            {/* Editable profile */}
            <div className="card-hover bg-dark-900 border border-dark-800 rounded-xl p-6">
              <h3 className="font-medium mb-4">Profile</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-1.5">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    placeholder="Enter your name"
                    className="w-full max-w-sm px-4 py-2.5 rounded-lg bg-dark-800 border border-dark-700 text-dark-50 placeholder-dark-500 focus:outline-none focus:border-primary-500 transition"
                  />
                </div>
                <button
                  onClick={handleSaveProfile}
                  disabled={savingProfile}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium transition disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {savingProfile ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Pipeline Tab ────────────────────────────────── */}
        {activeTab === "pipeline" && (
          <div className="space-y-6">
            <div className="card-hover bg-dark-900 border border-dark-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium">AI Pipeline Configuration</h3>
                <span className="text-sm text-dark-400">
                  <span className="font-semibold text-green-400">{PIPELINE_MODELS.length}/{PIPELINE_MODELS.length}</span>{" "}
                  models available
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {PIPELINE_MODELS.map(({ icon: Icon, name, value, desc }) => (
                  <div
                    key={name}
                    className="card-hover p-4 rounded-lg bg-dark-800/50 border border-dark-700"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className="w-4 h-4 text-primary-400" />
                      <span className="text-sm font-medium">{name}</span>
                      <span className="ml-auto flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                        <span className="text-xs text-green-400">Loaded</span>
                      </span>
                    </div>
                    <p className="text-xs text-dark-300 font-mono">{value}</p>
                    <p className="text-xs text-dark-500 mt-1">{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Data Sources Tab ────────────────────────────── */}
        {activeTab === "sources" && (
          <div className="space-y-6">
            {/* Connected */}
            <div className="card-hover bg-dark-900 border border-dark-800 rounded-xl p-6">
              <h3 className="font-medium mb-4">Connected Sources</h3>
              <div className="space-y-2">
                {CONNECTED_SOURCES.map((source) => {
                  const Icon = SOURCE_ICONS[source] || Globe;
                  return (
                    <div
                      key={source}
                      className="card-hover flex items-center justify-between p-3 rounded-lg bg-dark-800/50"
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="w-4 h-4 text-primary-400" />
                        <span className="text-sm">{source}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="px-2 py-0.5 rounded-full text-xs bg-green-500/20 text-green-400">
                          Connected
                        </span>
                        {/* Toggle switch (visual) */}
                        <button
                          onClick={handleSourceToggle}
                          className="relative w-9 h-5 rounded-full bg-green-500/30 transition-colors"
                        >
                          <span className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-green-400 transition-transform" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Available */}
            <div className="card-hover bg-dark-900 border border-dark-800 rounded-xl p-6">
              <h3 className="font-medium mb-4">Available Sources</h3>
              <div className="space-y-2">
                {AVAILABLE_SOURCES.map((source) => {
                  const Icon = SOURCE_ICONS[source] || Globe;
                  return (
                    <div
                      key={source}
                      className="card-hover flex items-center justify-between p-3 rounded-lg bg-dark-800/50"
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="w-4 h-4 text-dark-500" />
                        <span className="text-sm text-dark-400">{source}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="px-2 py-0.5 rounded-full text-xs bg-dark-700 text-dark-400">
                          Available
                        </span>
                        {/* Toggle switch (visual, off state) */}
                        <button
                          onClick={handleSourceToggle}
                          className="relative w-9 h-5 rounded-full bg-dark-700 transition-colors"
                        >
                          <span className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-dark-500 transition-transform" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── API Keys Tab ────────────────────────────────── */}
        {activeTab === "api" && (
          <div className="space-y-6">
            <div className="card-hover bg-dark-900 border border-dark-800 rounded-xl p-6">
              <div className="flex items-center gap-2 mb-1">
                <KeyRound className="w-4 h-4 text-primary-400" />
                <h3 className="font-medium">API Keys</h3>
              </div>
              <p className="text-sm text-dark-400 mb-4">
                These keys are configured via environment variables in the backend{" "}
                <code className="text-xs px-1.5 py-0.5 rounded bg-dark-800 text-dark-300">
                  .env
                </code>{" "}
                file. Values shown here are masked for security.
              </p>

              <div className="space-y-2 font-mono text-sm">
                {API_KEYS.map((key) => {
                  const isVisible = visibleKeys[key];
                  const isCopied = copiedKey === key;
                  return (
                    <div
                      key={key}
                      className="card-hover flex items-center gap-2 p-3 rounded-lg bg-dark-800/50 border border-dark-700"
                    >
                      <span className="text-dark-300 flex-1 min-w-0 truncate">
                        {key}=
                        <span className="text-dark-500">
                          {isVisible ? "sk-xxxx...redacted" : "••••••••"}
                        </span>
                      </span>
                      <button
                        onClick={() => toggleKeyVisibility(key)}
                        className="p-1.5 rounded text-dark-500 hover:text-dark-50 transition"
                        title={isVisible ? "Hide" : "Show"}
                      >
                        {isVisible ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => copyKey(key)}
                        className="p-1.5 rounded text-dark-500 hover:text-dark-50 transition"
                        title="Copy"
                      >
                        {isCopied ? (
                          <Check className="w-4 h-4 text-green-400" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>

              <p className="text-xs text-dark-600 mt-4">
                To update these keys, modify the <code className="text-dark-500">.env</code> file
                in your backend deployment and restart the service.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
