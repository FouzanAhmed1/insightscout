"use client";

import { Bell, Search, Sparkles } from "lucide-react";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

export default function Header() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { toast } = useToast();

  const handleGenerateInsights = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    try {
      await api.generateInsights();
      toast({
        title: "Pipeline triggered",
        description: "Insight generation pipeline triggered. Check back in a few minutes.",
        variant: "success",
      });
    } catch (err) {
      console.error(err);
      toast({
        title: "Error",
        description: "Failed to trigger insight generation. Please try again.",
        variant: "error",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && searchQuery.trim()) {
      router.push(`/competitors?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  // Global "/" shortcut to focus search
  if (typeof window !== "undefined") {
    // Using a self-cleanup pattern to avoid duplicate listeners
    if (!(window as any).__insightscout_search_shortcut) {
      (window as any).__insightscout_search_shortcut = true;
      document.addEventListener("keydown", (e) => {
        if (
          e.key === "/" &&
          !["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement)?.tagName)
        ) {
          e.preventDefault();
          searchInputRef.current?.focus();
        }
      });
    }
  }

  return (
    <header className="h-16 border-b border-dark-800 bg-dark-900/50 backdrop-blur flex items-center justify-between px-6">
      {/* Search */}
      <div className="relative flex-1 max-w-md">
        <div
          className={`flex items-center gap-3 px-3 py-2 rounded-lg border transition-all duration-200 ${
            isSearchFocused
              ? "border-primary-500 ring-2 ring-primary-500/20 bg-dark-800/50"
              : "border-transparent"
          }`}
        >
          <Search className="w-4 h-4 text-dark-400 flex-shrink-0" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search competitors, insights..."
            className="bg-transparent text-sm text-dark-100 placeholder-dark-500 focus:outline-none w-full"
          />
        </div>
        {/* Keyboard shortcut hint */}
        {!isSearchFocused && !searchQuery && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <kbd className="px-1.5 py-0.5 rounded border border-dark-700 bg-dark-800 text-dark-500 text-xs font-mono">
              /
            </kbd>
          </div>
        )}
        {isSearchFocused && (
          <p className="absolute -bottom-5 left-3 text-xs text-dark-500">
            Press Enter to search
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleGenerateInsights}
          disabled={isGenerating}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary-600/20 text-primary-400 hover:bg-primary-600/30 transition text-sm ${
            isGenerating ? "opacity-70 cursor-not-allowed" : ""
          }`}
        >
          <Sparkles className={`w-4 h-4 ${isGenerating ? "animate-spin" : ""}`} />
          {isGenerating ? "Generating..." : "Generate Insights"}
        </button>
        <button className="relative text-dark-400 hover:text-dark-50 transition">
          <Bell className="w-5 h-5" />
          <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-primary-500 animate-pulse" />
        </button>
      </div>
    </header>
  );
}
