"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { MessageSquare, Send, Loader2, TrendingUp, TrendingDown, Info } from "lucide-react";
import { useToast } from "@/components/ui/Toast";

const MAX_CHARS = 5000;

type FilterTab = "all" | "positive" | "negative";

function SentimentGauge({ score }: { score: number }) {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const filled = (score / 100) * circumference;
  const color =
    score > 60 ? "#22c55e" : score > 40 ? "#eab308" : "#ef4444";

  return (
    <div className="relative w-16 h-16 flex-shrink-0">
      <svg viewBox="0 0 64 64" className="w-full h-full -rotate-90">
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          stroke="#334155"
          strokeWidth="5"
        />
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference - filled}`}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center text-xs font-bold"
        style={{ color }}
      >
        {score}%
      </span>
    </div>
  );
}

export default function SentimentPage() {
  const [summary, setSummary] = useState<any[]>([]);
  const [analyzeText, setAnalyzeText] = useState("");
  const [analyzeResult, setAnalyzeResult] = useState<string | null>(null);
  const [competitors, setCompetitors] = useState<any[]>([]);
  const [selectedComp, setSelectedComp] = useState("");
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [filterTab, setFilterTab] = useState<FilterTab>("all");
  const { toast } = useToast();

  useEffect(() => {
    async function load() {
      try {
        const [s, c] = await Promise.all([api.getSentimentSummary(), api.getCompetitors({})]);
        setSummary(s);
        setCompetitors(c);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleAnalyze = async () => {
    if (!analyzeText.trim()) return;
    setAnalyzing(true);
    setAnalyzeResult(null);
    try {
      await api.analyzeSentiment(analyzeText, selectedComp || undefined);
      setAnalyzeResult("Sentiment analysis queued. Results will appear in the dashboard shortly.");
      toast("success", "Analysis Queued", "Your text has been submitted for sentiment analysis.");
      setAnalyzeText("");
    } catch (err) {
      setAnalyzeResult("Failed to queue analysis");
      toast("error", "Analysis Failed", "Could not queue sentiment analysis. Please try again.");
    } finally {
      setAnalyzing(false);
    }
  };

  const filteredSummary = summary.filter((s) => {
    if (filterTab === "positive") return s.avg_score > 60;
    if (filterTab === "negative") return s.avg_score < 40;
    return true;
  });

  const charCount = analyzeText.length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Sentiment Analysis</h1>
        <p className="text-dark-400 mt-1">HuggingFace NLP-powered sentiment tracking</p>
      </div>

      {/* Analyze Text */}
      <div className="bg-dark-900 border border-dark-800 rounded-xl p-6">
        <h2 className="font-semibold mb-4">Analyze Text</h2>
        <p className="text-dark-400 text-sm mb-4">Submit text for sentiment analysis using the RoBERTa NLP pipeline via RabbitMQ</p>
        <div className="space-y-3">
          <select
            value={selectedComp}
            onChange={(e) => setSelectedComp(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg bg-dark-800 border border-dark-700 text-dark-50 focus:outline-none focus:border-primary-500"
          >
            <option value="">Associate with competitor (optional)</option>
            {competitors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <div className="relative">
            <textarea
              value={analyzeText}
              onChange={(e) => {
                if (e.target.value.length <= MAX_CHARS) setAnalyzeText(e.target.value);
              }}
              placeholder="Paste text to analyze sentiment (e.g., news article, social media post, review)..."
              rows={4}
              className="w-full px-4 py-2.5 rounded-lg bg-dark-800 border border-dark-700 text-dark-50 placeholder-dark-500 focus:outline-none focus:border-primary-500"
            />
            <span
              className={`absolute bottom-3 right-3 text-xs ${
                charCount > MAX_CHARS * 0.9 ? "text-red-400" : "text-dark-500"
              }`}
            >
              {charCount.toLocaleString()}/{MAX_CHARS.toLocaleString()}
            </span>
          </div>

          {/* Tip box */}
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-primary-500/5 border border-primary-500/20">
            <Info className="w-4 h-4 text-primary-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-primary-300/80">
              Best results with product reviews, social media posts, news articles, or customer feedback.
              Longer texts with clear opinions produce more accurate sentiment scores.
            </p>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-dark-500">Processed by: cardiffnlp/twitter-roberta-base-sentiment-latest</span>
            <button
              onClick={handleAnalyze}
              disabled={analyzing || !analyzeText.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {analyzing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Analyzing...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" /> Analyze
                </>
              )}
            </button>
          </div>

          {/* Processing animation */}
          {analyzing && (
            <div className="flex items-center justify-center gap-1.5 py-3">
              <span className="w-2 h-2 rounded-full bg-primary-400 animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-2 h-2 rounded-full bg-primary-400 animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-2 h-2 rounded-full bg-primary-400 animate-bounce" style={{ animationDelay: "300ms" }} />
              <span className="text-sm text-dark-400 ml-2">Processing your text through the NLP pipeline...</span>
            </div>
          )}

          {analyzeResult && !analyzing && <p className="text-sm text-green-400 animate-fade-in">{analyzeResult}</p>}
        </div>
      </div>

      {/* Summary Section */}
      <div className="bg-dark-900 border border-dark-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">7-Day Sentiment Summary</h2>
          <div className="flex items-center gap-1.5">
            {(
              [
                { key: "all", label: "All" },
                { key: "positive", label: "Positive (>60%)" },
                { key: "negative", label: "Negative (<40%)" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilterTab(tab.key)}
                className={`px-3 py-1 rounded-lg text-xs transition ${
                  filterTab === tab.key
                    ? "bg-primary-600 text-white"
                    : "bg-dark-800 text-dark-400 hover:text-dark-50"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {summary.length > 0 ? (
          filteredSummary.length > 0 ? (
            <div className="space-y-3 stagger-children">
              {filteredSummary.map((s: any) => {
                const trend =
                  s.trend != null ? s.trend : s.avg_score > 60 ? 1 : s.avg_score < 40 ? -1 : 0;

                return (
                  <div
                    key={s.competitor_id}
                    className="flex items-center gap-4 p-4 rounded-xl bg-dark-800/50 border border-dark-700/50 card-hover transition-all"
                  >
                    <SentimentGauge score={s.avg_score} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{s.name}</p>
                        {trend > 0 && <TrendingUp className="w-4 h-4 text-green-400" />}
                        {trend < 0 && <TrendingDown className="w-4 h-4 text-red-400" />}
                      </div>
                      <p className="text-xs text-dark-400 mt-0.5">{s.data_points} data points</p>
                      <div className="mt-2 w-full h-2 rounded-full bg-dark-700 overflow-hidden">
                        <div
                          className={`h-full rounded-full animate-progress-fill ${
                            s.avg_score > 60
                              ? "bg-green-500"
                              : s.avg_score > 40
                              ? "bg-yellow-500"
                              : "bg-red-500"
                          }`}
                          style={{ width: `${s.avg_score}%` }}
                        />
                      </div>
                    </div>
                    <span
                      className={`text-lg font-bold w-16 text-right ${
                        s.avg_score > 60 ? "text-green-400" : s.avg_score > 40 ? "text-yellow-400" : "text-red-400"
                      }`}
                    >
                      {s.avg_score}%
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-dark-500">
              <p>No competitors match the selected filter</p>
            </div>
          )
        ) : (
          <div className="text-center py-8 text-dark-500">
            <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No sentiment data available yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
