import React from "react";

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between font-sans">
      
      {/* Header */}
      <header className="max-w-7xl w-full mx-auto px-6 h-20 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20">
            V
          </div>
          <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
            VALKYRIE
          </span>
        </div>
        <a 
          href="/login" 
          className="px-4 py-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 hover:text-slate-200 text-sm font-semibold transition-all"
        >
          Dashboard Login
        </a>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-5xl mx-auto px-6 flex flex-col items-center justify-center text-center space-y-8">
        
        {/* Badge */}
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-xs text-violet-400 font-semibold uppercase tracking-wider">
          <span>⚡ Next-Gen Enterprise App Scaffolder</span>
        </div>

        {/* Hero Title */}
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight max-w-4xl leading-[1.1] bg-gradient-to-r from-slate-100 via-slate-100 to-indigo-400 bg-clip-text text-transparent">
          Orchestrate Agent Swarms to Build Enterprise SaaS
        </h1>

        {/* Hero Subtitle */}
        <p className="max-w-2xl text-lg text-slate-400 leading-relaxed">
          Provide your specifications and deployment environments. Valkyrie launches collaborative product, architecture, security, performance, cost, and SRE agents to construct, scan, and deploy production-ready applications.
        </p>

        {/* CTA Actions */}
        <div className="flex flex-col sm:flex-row gap-4 pt-4">
          <a
            href="/login"
            className="px-8 py-4 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold transition-all shadow-lg shadow-indigo-500/30 flex items-center justify-center text-base"
          >
            Launch Builder Dashboard
          </a>
          <a
            href="/admin"
            className="px-8 py-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 font-semibold transition-all flex items-center justify-center text-base"
          >
            Analyze AI Cost & Logs
          </a>
        </div>

        {/* Flow visual layout */}
        <div className="w-full max-w-4xl border border-slate-900 bg-slate-950 p-1.5 rounded-2xl shadow-2xl relative mt-16 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent z-10" />
          <div className="border border-slate-800 bg-slate-900/10 rounded-xl p-8 flex flex-col md:flex-row items-center justify-around gap-6 font-mono text-xs text-slate-500">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-indigo-500" />
              <span>1. Enter Specs</span>
            </div>
            <div className="h-[1px] w-8 bg-slate-850 md:w-16" />
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-violet-500" />
              <span>2. Multi-Agent Debate</span>
            </div>
            <div className="h-[1px] w-8 bg-slate-850 md:w-16" />
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span>3. QA Local Testing Loop</span>
            </div>
            <div className="h-[1px] w-8 bg-slate-850 md:w-16" />
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>4. SRE Deployment</span>
            </div>
          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-8 bg-slate-950/40 text-center text-xs text-slate-600 font-mono">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 Valkyrie Inc. All rights reserved.</p>
          <div className="flex space-x-6">
            <a href="https://github.com" className="hover:text-slate-400">GitHub App</a>
            <a href="/admin" className="hover:text-slate-400">Telemetry Specs</a>
          </div>
        </div>
      </footer>

    </div>
  );
}

