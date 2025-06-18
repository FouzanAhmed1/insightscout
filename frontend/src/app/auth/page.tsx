"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { Brain, Eye, EyeOff, Zap, BarChart3, CheckCircle, Loader2 } from "lucide-react";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);
  const router = useRouter();
  const { login, register } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (isLogin) {
        await login(email, password);
        router.push("/");
      } else {
        await register(email, password, fullName);
        setRegistrationSuccess(true);
        setTimeout(() => {
          router.push("/");
        }, 1500);
      }
    } catch (err: any) {
      setError(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  if (registrationSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-dark-50 mb-2">Account Created!</h2>
          <p className="text-dark-400">Redirecting to your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left — Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary-900 via-dark-900 to-dark-950 flex-col justify-center p-16">
        <div className="flex items-center gap-3 mb-8">
          <Brain className="w-10 h-10 text-primary-400 animate-float" />
          <h1 className="text-3xl font-bold text-dark-50">InsightScout</h1>
        </div>
        <p className="text-xl text-dark-300 mb-12">AI-Powered Real-Time Intelligence Platform</p>
        <div className="space-y-6">
          {[
            { icon: Zap, text: "100K+ records/day ingested from 10+ sources" },
            { icon: Brain, text: "HuggingFace NLP — sentiment, NER, classification" },
            { icon: Eye, text: "CLIP vision + OpenCV change detection" },
            { icon: BarChart3, text: "Agentic insight extraction with clustering" },
          ].map(({ icon: Icon, text }, i) => (
            <div
              key={i}
              className="flex items-center gap-4 animate-fade-in-up opacity-0"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div className="w-10 h-10 rounded-lg bg-primary-500/20 flex items-center justify-center">
                <Icon className="w-5 h-5 text-primary-400" />
              </div>
              <span className="text-dark-200">{text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right — Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <Brain className="w-8 h-8 text-primary-400 animate-float" />
            <h1 className="text-2xl font-bold">InsightScout</h1>
          </div>

          <h2 className="text-2xl font-bold mb-2">{isLogin ? "Welcome back" : "Create your account"}</h2>
          <p className="text-dark-400 mb-8">{isLogin ? "Sign in to your intelligence dashboard" : "Start tracking competitive signals"}</p>

          {error && <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>}

          {/* Animated gradient border wrapper */}
          <div className="p-[1px] rounded-xl bg-gradient-to-r from-primary-500 via-purple-500 to-primary-500 bg-[length:200%_auto] animate-gradient">
            <div className="bg-dark-950 rounded-xl p-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Name field with smooth animation */}
                <div
                  className={`overflow-hidden transition-all duration-300 ${
                    !isLogin ? "max-h-20 opacity-100" : "max-h-0 opacity-0"
                  }`}
                >
                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-1">Full Name</label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full px-4 py-3 rounded-lg bg-dark-800 border border-dark-700 text-dark-50 placeholder-dark-500 focus:outline-none focus:border-primary-500 transition"
                      placeholder="John Doe"
                      tabIndex={isLogin ? -1 : 0}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg bg-dark-800 border border-dark-700 text-dark-50 placeholder-dark-500 focus:outline-none focus:border-primary-500 transition"
                    placeholder="you@company.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-1">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-4 py-3 rounded-lg bg-dark-800 border border-dark-700 text-dark-50 placeholder-dark-500 focus:outline-none focus:border-primary-500 transition pr-12"
                      placeholder="••••••••"
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-dark-200 transition"
                    >
                      {showPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>

                {isLogin && (
                  <div className="text-right">
                    <span className="text-sm text-dark-400 hover:text-primary-400 cursor-pointer transition">
                      Forgot password?
                    </span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-medium transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Please wait...
                    </>
                  ) : isLogin ? (
                    "Sign In"
                  ) : (
                    "Create Account"
                  )}
                </button>
              </form>
            </div>
          </div>

          <p className="mt-6 text-center text-dark-400">
            {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
            <button onClick={() => { setIsLogin(!isLogin); setError(""); }} className="text-primary-400 hover:text-primary-300">
              {isLogin ? "Sign up" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
