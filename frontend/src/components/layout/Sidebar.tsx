"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, TrendingUp, MessageSquare,
  Eye, Bell, Settings, LogOut, Brain, ChevronLeft, ChevronRight,
  Sun, Moon,
} from "lucide-react";
import { useState } from "react";
import { useAuthStore } from "@/lib/store";
import { useTheme } from "@/components/ui/ThemeProvider";

const navItems = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/competitors", icon: Users, label: "Competitors" },
  { href: "/trends", icon: TrendingUp, label: "Trends" },
  { href: "/sentiment", icon: MessageSquare, label: "Sentiment" },
  { href: "/monitoring", icon: Eye, label: "Monitoring" },
  { href: "/alerts", icon: Bell, label: "Alerts" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuthStore();
  const { theme, toggleTheme } = useTheme();

  const userInitial = user
    ? (user.full_name || user.email || "U").charAt(0).toUpperCase()
    : "U";

  return (
    <aside className={`${collapsed ? "w-20" : "w-64"} bg-dark-900 border-r border-dark-800 flex flex-col transition-all duration-300`}>
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-dark-800">
        <div className="flex items-center gap-3">
          <div className="relative flex-shrink-0">
            <div className="absolute inset-0 bg-gradient-to-r from-primary-400 to-cyan-400 rounded-full blur-md opacity-40" />
            <Brain className="relative w-8 h-8 text-primary-400" />
          </div>
          {!collapsed && (
            <span className="font-bold text-lg gradient-text bg-gradient-to-r from-primary-400 to-cyan-400 bg-clip-text text-transparent">
              InsightScout
            </span>
          )}
        </div>
        <button onClick={() => setCollapsed(!collapsed)} className="text-dark-400 hover:text-dark-100 transition">
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 space-y-1 px-3">
        {navItems.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || (href !== "/" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-lg transition ${
                active
                  ? "bg-primary-600/20 text-primary-400"
                  : "text-dark-400 hover:text-dark-100 hover:bg-dark-800"
              }`}
            >
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-primary-400" />
              )}
              <Icon className="w-5 h-5 flex-shrink-0 transition-transform duration-200 group-hover:scale-110" />
              {!collapsed && <span className="text-sm font-medium">{label}</span>}
              {collapsed && (
                <div className="tooltip-trigger">
                  <span className="tooltip absolute left-full ml-2 px-2 py-1 rounded bg-dark-700 text-xs whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 z-50">
                    {label}
                  </span>
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Theme toggle + User */}
      <div className="p-4 border-t border-dark-800 space-y-3">
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className={`group flex items-center ${collapsed ? "justify-center" : "gap-3"} w-full px-3 py-2 rounded-lg text-dark-400 hover:text-dark-100 hover:bg-dark-800 transition`}
        >
          <div className="relative w-5 h-5 flex-shrink-0">
            <Sun className={`w-5 h-5 absolute inset-0 transition-all duration-300 ${theme === "light" ? "opacity-100 rotate-0 scale-100" : "opacity-0 rotate-90 scale-0"}`} />
            <Moon className={`w-5 h-5 absolute inset-0 transition-all duration-300 ${theme === "dark" ? "opacity-100 rotate-0 scale-100" : "opacity-0 -rotate-90 scale-0"}`} />
          </div>
          {!collapsed && <span className="text-sm font-medium">{theme === "dark" ? "Dark Mode" : "Light Mode"}</span>}
        </button>

        {/* User avatar */}
        <div className={`flex items-center ${collapsed ? "justify-center" : "gap-3"}`}>
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-400 to-cyan-400 flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-bold text-white">{userInitial}</span>
          </div>
          {!collapsed && user && (
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{user.full_name || user.email}</p>
              <p className="text-xs text-dark-400 truncate">{user.email}</p>
            </div>
          )}
        </div>
        <button
          onClick={() => { logout(); window.location.href = "/auth"; }}
          className="group flex items-center gap-3 text-dark-400 hover:text-red-400 transition w-full"
        >
          <LogOut className="w-5 h-5 flex-shrink-0 transition-transform duration-200 group-hover:-translate-x-0.5" />
          {!collapsed && <span className="text-sm">Sign Out</span>}
        </button>
      </div>
    </aside>
  );
}
