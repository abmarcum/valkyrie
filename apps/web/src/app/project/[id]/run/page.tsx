"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { ORCHESTRATOR_URL } from "@/lib/config";

interface LogMessage {
  timestamp: string;
  agent: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
}

interface Milestone {
  name: string;
  status: "idle" | "running" | "success" | "failed";
}

interface UserSession {
  username: string;
  role: string;
  tenantId: string;
}

export default function RunPipeline() {
  const router = useRouter();
  const { id } = useParams();
  const [useCache, setUseCache] = useState(true);
  const [user, setUser] = useState<UserSession | null>(null);
  
  const logsEndRef = useRef<HTMLDivElement | null>(null);

  const getSession = (): UserSession | null => {
    if (typeof window === "undefined") return null;
    const token = localStorage.getItem("token");
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      return {
        username: payload.username,
        role: payload.role,
        tenantId: payload.tenantId
      };
    } catch (e) {
      return null;
    }
  };

  useEffect(() => {
    const session = getSession();
    if (!session) {
      router.push("/login");
      return;
    }
    setUser(session);
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    router.push("/login");
  };

  const handleRestart = async () => {
    if (user?.role === "viewer") {
      alert("Permission Denied: Viewers cannot trigger swarm pipeline restarts.");
      return;
    }
    if (!id || !confirm("Are you sure you want to restart the multi-agent pipeline run? This will clear logs and rebuild code.")) return;
    
    const token = localStorage.getItem("token");
    try {
      const response = await fetch(`${ORCHESTRATOR_URL}/api/projects/${id}/restart`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ useCache })
      });
      if (response.ok) {
        window.location.reload();
      } else {
        const errData = await response.json();
        alert(errData.error || "Failed to restart pipeline.");
      }
    } catch (err) {
      console.error("Error restarting project pipeline:", err);
    }
  };

  const handleCancel = async () => {
    if (user?.role === "viewer") {
      alert("Permission Denied: Viewers cannot cancel active swarms.");
      return;
    }
    if (!id || !confirm("Are you sure you want to cancel the running agent swarm pipeline?")) return;
    
    const token = localStorage.getItem("token");
    try {
      const response = await fetch(`${ORCHESTRATOR_URL}/api/projects/${id}/cancel`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (response.ok) {
        alert("Pipeline cancellation request submitted.");
      } else {
        const errData = await response.json();
        alert(errData.error || "Failed to cancel pipeline.");
      }
    } catch (err) {
      console.error("Error cancelling project pipeline:", err);
    }
  };

  const [milestones, setMilestones] = useState<Milestone[]>([
    { name: "Product Manager", status: "running" },
    { name: "Software Architect", status: "idle" },
    { name: "Data Architect", status: "idle" },
    { name: "UI/UX Designer", status: "idle" },
    { name: "Developer Agent", status: "idle" },
    { name: "Security Architect", status: "idle" },
    { name: "Tech Writer", status: "idle" },
    { name: "QA Engineer (Runner)", status: "idle" },
  ]);

  const [logs, setLogs] = useState<LogMessage[]>([
    {
      timestamp: "",
      agent: "System",
      message: "Awaiting real-time pipeline connection...",
      type: "info",
    },
  ]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  useEffect(() => {
    // Set active mount time on client
    setLogs([
      {
        timestamp: new Date().toLocaleTimeString(),
        agent: "System",
        message: "Awaiting real-time pipeline connection...",
        type: "info",
      }
    ]);
  }, []);

  useEffect(() => {
    if (!id) return;
    const token = localStorage.getItem("token");
    if (!token) return;

    // Connect to SSE stream passing OAuth token in query params
    const eventSource = new EventSource(`${ORCHESTRATOR_URL}/api/projects/${id}/stream?token=${token}`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.error) {
          console.error(data.error);
          eventSource.close();
          return;
        }

        if (data.milestones && data.milestones.length > 0) {
          setMilestones(data.milestones.map((m: any) => ({
            name: m.role,
            status: m.status
          })));
        }

        if (data.logs) {
          setLogs(data.logs);
        }
      } catch (err) {
        console.error("Error parsing SSE data:", err);
      }
    };

    eventSource.onerror = (err) => {
      console.error("EventSource failed:", err);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [id]);

  const isViewer = user?.role === "viewer";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50 py-3 sm:py-0 min-h-16 flex items-center">
        <div className="max-w-7xl w-full mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-3 self-start sm:self-center">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20">
              V
            </div>
            <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
              VALKYRIE
            </span>
          </div>
          <nav className="flex flex-wrap items-center justify-start sm:justify-end gap-3 sm:gap-6 text-sm font-medium text-slate-400 w-full sm:w-auto">
            <a href="/dashboard" className="hover:text-slate-200 transition-colors">Dashboard</a>
            {user?.role === "admin" && (
              <a href="/admin" className="hover:text-slate-200 transition-colors">Administration</a>
            )}
            <div className="hidden sm:block h-4 w-[1px] bg-slate-800"></div>
            <label className="flex items-center space-x-2 text-xs font-bold text-slate-300 select-none cursor-pointer">
              <input
                type="checkbox"
                checked={useCache}
                onChange={(e) => setUseCache(e.target.checked)}
                className="rounded border-slate-700 bg-slate-800 text-violet-500 focus:ring-0 focus:ring-offset-0 disabled:opacity-50"
                disabled={isViewer}
              />
              <span>Use Cache</span>
            </label>
            <button
              onClick={handleRestart}
              className="px-3 py-1 text-xs rounded bg-violet-600 hover:bg-violet-500 text-white font-bold transition-all shadow-md shadow-violet-500/10 disabled:opacity-50"
              disabled={isViewer}
            >
              Restart Swarm
            </button>
            <button
              onClick={handleCancel}
              className="px-3 py-1 text-xs rounded bg-rose-600 hover:bg-rose-500 text-white font-bold transition-all shadow-md shadow-rose-500/10 disabled:opacity-50"
              disabled={isViewer}
            >
              Cancel Swarm
            </button>
            <div className="hidden sm:block h-4 w-[1px] bg-slate-800"></div>
            {user && (
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 capitalize">
                  {user.username} ({user.role})
                </span>
                <button
                  onClick={handleLogout}
                  className="text-xs text-rose-400 hover:text-rose-300 transition-colors"
                >
                  Logout
                </button>
              </div>
            )}
          </nav>
        </div>
      </header>

      {/* Grid Layout */}
      <main className="max-w-7xl mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Side: Milestones */}
        <section className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm shadow-xl h-fit">
          <h2 className="text-xl font-bold text-slate-100 mb-6">Orchestration Progress</h2>
          
          <div className="space-y-6 relative">
            <div className="absolute left-[11px] top-2 bottom-2 w-[2px] bg-slate-800 -z-10" />
            
            {milestones.map((ms, index) => (
              <div key={index} className="flex items-start space-x-4">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center border font-bold text-xs ${
                  ms.status === "success" 
                    ? "bg-emerald-500/10 border-emerald-500 text-emerald-400" 
                    : ms.status === "running"
                    ? "bg-violet-500/20 border-violet-500 text-violet-400 animate-pulse"
                    : ms.status === "failed"
                    ? "bg-red-500/10 border-red-500 text-red-400"
                    : "bg-slate-950 border-slate-800 text-slate-500"
                }`}>
                  {ms.status === "success" ? "✓" : index + 1}
                </div>
                <div>
                  <h3 className={`text-sm font-semibold ${
                    ms.status === "running" ? "text-violet-400" : ms.status === "success" ? "text-slate-200" : "text-slate-500"
                  }`}>
                    {ms.name}
                  </h3>
                  <p className="text-[10px] text-slate-500 capitalize">{ms.status}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Right Side: SSE Agent Logs */}
        <section className="lg:col-span-2 bg-slate-900/40 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm shadow-xl flex flex-col min-h-[500px]">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-slate-100">Live Agent Debates & Output</h2>
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-violet-500 animate-ping" />
              <span className="text-xs text-slate-400 font-mono">SSE Telemetry Active</span>
            </div>
          </div>

          {isViewer && (
            <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400 font-sans">
              ⚠️ Swarm operations (Restart, Cancel) are disabled for Viewers.
            </div>
          )}

          <div className="flex-1 bg-slate-950 rounded-xl border border-slate-800 p-6 font-mono text-xs overflow-y-auto space-y-4 max-h-[450px]">
            {logs.map((log, index) => (
              <div key={index} className="space-y-1">
                <div className="flex items-center space-x-2 text-[10px]">
                  <span className="text-slate-500">{log.timestamp}</span>
                  <span className={`font-bold px-1.5 py-0.5 rounded ${
                    log.agent === "Developer Agent" 
                      ? "bg-indigo-500/10 text-indigo-400" 
                      : log.agent === "QA Engineer (Local Runner)"
                      ? "bg-red-500/10 text-red-400"
                      : "bg-slate-800 text-slate-300"
                  }`}>
                    {log.agent}
                  </span>
                </div>
                <p className={`${
                  log.type === "success" 
                    ? "text-emerald-400" 
                    : log.type === "error" 
                    ? "text-rose-400 font-semibold"
                    : "text-slate-300"
                }`}>
                  {log.message}
                </p>
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        </section>

      </main>
    </div>
  );
}
