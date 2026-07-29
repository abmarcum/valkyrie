"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ORCHESTRATOR_URL } from "@/lib/config";

export default function Login() {
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    // If token exists, direct to dashboard
    const token = localStorage.getItem("token");
    if (token) {
      router.push("/dashboard");
    }
  }, [router]);

  const handleOAuthLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setError("Please enter a username to proceed.");
      return;
    }
    setError("");
    
    // Redirect to Mock OAuth Authorize endpoint using current domain origin
    const client_id = "valkyrie-web";
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const redirect_uri = encodeURIComponent(`${origin}/oauth/callback`);
    const response_type = "code";
    const authUrl = `${ORCHESTRATOR_URL}/oauth/authorize?client_id=${client_id}&redirect_uri=${redirect_uri}&response_type=${response_type}&username=${encodeURIComponent(username.trim())}&state=valk_state`;
    
    window.location.href = authUrl;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between font-sans relative overflow-hidden">
      {/* Background Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-violet-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="max-w-7xl w-full mx-auto px-6 h-20 flex items-center justify-between z-10">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20">
            V
          </div>
          <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
            VALKYRIE
          </span>
        </div>
      </header>

      {/* Main Card */}
      <main className="flex-1 flex items-center justify-center px-6 z-10">
        <div className="w-full max-w-md bg-slate-900/40 border border-slate-800 rounded-2xl p-8 backdrop-blur-md shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-slate-100 to-indigo-400 bg-clip-text text-transparent">
              Welcome back
            </h1>
            <p className="text-sm text-slate-400">
              Authorize via Mock OAuth to access your multi-agent workspaces.
            </p>
          </div>

          <form onSubmit={handleOAuthLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Username
              </label>
              <input
                type="text"
                placeholder="e.g. admin, user_john, viewer_alice"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-slate-200 focus:outline-none focus:border-violet-500 transition-colors"
                required
              />
              <p className="text-[10px] text-slate-500 mt-1.5 leading-relaxed">
                Tip: Enter a name containing <code className="text-violet-400">admin</code> to get Admin access, or <code className="text-violet-400">viewer</code> for Read-Only access.
              </p>
            </div>

            {error && (
              <p className="text-xs text-rose-500 font-semibold">{error}</p>
            )}

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold transition-all shadow-lg shadow-indigo-500/20 text-sm"
            >
              Sign In via OAuth 2.0
            </button>
          </form>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-6 bg-slate-950/40 text-center text-[10px] text-slate-600 font-mono z-10">
        <p>© 2026 Valkyrie Swarm App. Secure username authentication module active.</p>
      </footer>
    </div>
  );
}
