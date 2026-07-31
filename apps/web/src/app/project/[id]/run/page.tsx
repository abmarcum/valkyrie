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

interface ProjectData {
  projectId: string;
  projectName: string;
  description: string;
  language: string;
  cloud: string;
  projectScope?: "small" | "medium" | "large";
  vcsRepoUrl: string | null;
  createdAt: string;
  status: string;
  files: Array<{ path: string; size: number; tokens?: number; costUSD?: number }>;
}

function renderFormattedInlineText(text: string) {
  let formatted = text
    .replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 rounded bg-slate-800 text-violet-300 font-mono text-[11px] border border-slate-700">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong class="font-bold text-slate-100">$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em class="italic text-slate-300">$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-violet-400 underline hover:text-violet-300">$1</a>');
  return <span dangerouslySetInnerHTML={{ __html: formatted }} />;
}

function SimpleMarkdownView({ content }: { content: string }) {
  const lines = content.split(/\r?\n/);
  const elements: React.ReactNode[] = [];

  let inCodeBlock = false;
  let codeBlockLang = "";
  let codeBlockLines: string[] = [];
  let inTable = false;
  let tableHeader: string[] = [];
  let tableRows: string[][] = [];

  const flushCodeBlock = (key: string | number) => {
    if (codeBlockLines.length > 0) {
      elements.push(
        <div key={`code-${key}`} className="my-4 rounded-xl border border-slate-800 bg-slate-950 overflow-hidden shadow-lg">
          {codeBlockLang && (
            <div className="px-4 py-1.5 bg-slate-900 border-b border-slate-800 text-[10px] font-mono font-bold text-violet-400 uppercase tracking-wider flex justify-between items-center">
              <span>{codeBlockLang}</span>
              <span className="text-slate-500 font-sans font-normal">{codeBlockLines.length} lines</span>
            </div>
          )}
          <pre className="p-4 font-mono text-xs text-slate-300 overflow-x-auto whitespace-pre leading-relaxed">
            <code>{codeBlockLines.join("\n")}</code>
          </pre>
        </div>
      );
      codeBlockLines = [];
    }
    inCodeBlock = false;
    codeBlockLang = "";
  };

  const flushTable = (key: string | number) => {
    if (tableHeader.length > 0 || tableRows.length > 0) {
      elements.push(
        <div key={`table-${key}`} className="my-4 overflow-x-auto rounded-xl border border-slate-800 bg-slate-950 shadow-md">
          <table className="w-full text-left text-xs text-slate-300">
            {tableHeader.length > 0 && (
              <thead className="bg-slate-900/80 text-slate-200 border-b border-slate-800 font-bold">
                <tr>
                  {tableHeader.map((th, i) => (
                    <th key={i} className="px-4 py-2.5 font-semibold">{th.trim()}</th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody className="divide-y divide-slate-800/60">
              {tableRows.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-slate-900/40 transition-colors">
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="px-4 py-2.5">{renderFormattedInlineText(cell.trim())}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      tableHeader = [];
      tableRows = [];
    }
    inTable = false;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trim().startsWith("```")) {
      if (inCodeBlock) {
        flushCodeBlock(i);
      } else {
        if (inTable) flushTable(i);
        inCodeBlock = true;
        codeBlockLang = line.trim().replace(/^```/, "").trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(line);
      continue;
    }

    if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
      const cells = line.trim().split("|").slice(1, -1);
      if (cells.every(c => /^[\s\-:]+$/.test(c))) {
        continue;
      }
      if (!inTable) {
        inTable = true;
        tableHeader = cells;
      } else {
        tableRows.push(cells);
      }
      continue;
    } else if (inTable) {
      flushTable(i);
    }

    if (line.startsWith("# ")) {
      elements.push(
        <h1 key={i} className="text-xl font-bold text-slate-100 mt-6 mb-3 pb-2 border-b border-slate-800 flex items-center space-x-2">
          <span className="text-violet-400">#</span>
          <span>{line.replace("# ", "")}</span>
        </h1>
      );
    } else if (line.startsWith("## ")) {
      elements.push(
        <h2 key={i} className="text-lg font-bold text-slate-200 mt-5 mb-2.5 flex items-center space-x-2">
          <span className="text-indigo-400">##</span>
          <span>{line.replace("## ", "")}</span>
        </h2>
      );
    } else if (line.startsWith("### ")) {
      elements.push(
        <h3 key={i} className="text-sm font-bold text-slate-300 mt-4 mb-2 flex items-center space-x-2">
          <span className="text-cyan-400">###</span>
          <span>{line.replace("### ", "")}</span>
        </h3>
      );
    } else if (line.startsWith("> [!NOTE]") || line.startsWith("> [!IMPORTANT]") || line.startsWith("> [!TIP]") || line.startsWith("> [!WARNING]")) {
      const type = line.includes("IMPORTANT") ? "IMPORTANT" : line.includes("WARNING") ? "WARNING" : line.includes("TIP") ? "TIP" : "NOTE";
      const colorMap = {
        NOTE: "border-blue-500/50 bg-blue-950/30 text-blue-300",
        IMPORTANT: "border-violet-500/50 bg-violet-950/30 text-violet-300",
        TIP: "border-emerald-500/50 bg-emerald-950/30 text-emerald-300",
        WARNING: "border-amber-500/50 bg-amber-950/30 text-amber-300"
      };
      elements.push(
        <div key={i} className={`my-3 p-3.5 rounded-xl border ${colorMap[type]} font-sans text-xs leading-relaxed`}>
          <div className="font-bold text-[10px] uppercase tracking-wider mb-1 flex items-center space-x-1.5">
            <span>📌</span>
            <span>{type}</span>
          </div>
          <div>{renderFormattedInlineText(line.replace(/^>\s*\[![A-Z]+\]\s*/, ""))}</div>
        </div>
      );
    } else if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
      elements.push(
        <li key={i} className="ml-4 list-disc text-xs text-slate-300 my-1 leading-relaxed">
          {renderFormattedInlineText(line.trim().replace(/^[\-\*]\s*/, ""))}
        </li>
      );
    } else if (/^\d+\.\s/.test(line.trim())) {
      elements.push(
        <li key={i} className="ml-4 list-decimal text-xs text-slate-300 my-1 leading-relaxed">
          {renderFormattedInlineText(line.trim().replace(/^\d+\.\s*/, ""))}
        </li>
      );
    } else if (line.trim() === "") {
      elements.push(<div key={i} className="h-2" />);
    } else {
      elements.push(
        <p key={i} className="text-xs text-slate-300 my-1.5 leading-relaxed font-sans">
          {renderFormattedInlineText(line)}
        </p>
      );
    }
  }

  if (inCodeBlock) flushCodeBlock("end");
  if (inTable) flushTable("end");

  return <div className="space-y-1 font-sans">{elements}</div>;
}

export default function RunPipeline() {
  const router = useRouter();
  const { id } = useParams();
  const [useCache, setUseCache] = useState(true);
  const [user, setUser] = useState<UserSession | null>(null);
  const [projectData, setProjectData] = useState<ProjectData | null>(null);
  const [showAllFiles, setShowAllFiles] = useState(false);
  
  const logsEndRef = useRef<HTMLDivElement | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCopyLogs = () => {
    const formattedLogs = logs.map(l => `[${l.timestamp}] [${l.agent}] ${l.message}`).join("\n");
    if (navigator.clipboard) {
      navigator.clipboard.writeText(formattedLogs);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

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

  const [activeFile, setActiveFile] = useState<{ path: string; content: string; size: number; tokens?: number; costUSD?: number } | null>(null);
  const [loadingFile, setLoadingFile] = useState(false);
  const [copiedFile, setCopiedFile] = useState(false);
  const [approving, setApproving] = useState(false);
  const [viewMode, setViewMode] = useState<"rendered" | "raw">("rendered");

  const handleOpenFile = async (filePath: string) => {
    const token = localStorage.getItem("token");
    if (!token || !id) return;
    setLoadingFile(true);
    const isMarkdown = filePath.toLowerCase().endsWith(".md") || filePath.toLowerCase().includes("doc");
    setViewMode(isMarkdown ? "rendered" : "raw");
    try {
      const res = await fetch(`${ORCHESTRATOR_URL}/api/projects/${id}/file?path=${encodeURIComponent(filePath)}`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        const matched = projectData?.files?.find(f => f.path === filePath);
        setActiveFile({ path: data.path, content: data.content, size: data.size, tokens: matched?.tokens, costUSD: matched?.costUSD });
      } else {
        alert("Failed to load file content.");
      }
    } catch (e: any) {
      alert("Error loading file content: " + e.message);
    } finally {
      setLoadingFile(false);
    }
  };

  const handleApprove = async () => {
    const token = localStorage.getItem("token");
    if (!token || !id) return;
    setApproving(true);
    try {
      const res = await fetch(`${ORCHESTRATOR_URL}/api/projects/${id}/approve`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ useCache })
      });
      if (res.ok) {
        setProjectData(prev => prev ? { ...prev, status: "GENERATING" } : null);
      } else {
        alert("Failed to approve planning specifications.");
      }
    } catch (e: any) {
      alert("Error approving planning specifications: " + e.message);
    } finally {
      setApproving(false);
    }
  };

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

    // Helper to fetch latest run state via REST
    const fetchRunState = async () => {
      try {
        const res = await fetch(`${ORCHESTRATOR_URL}/api/projects/${id}/run`, {
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });
        if (res.ok) {
          const data = await res.json();
          setProjectData({
            projectId: data.projectId,
            projectName: data.projectName,
            description: data.description || "",
            language: data.language || "",
            cloud: data.cloud || "",
            projectScope: data.projectScope || "medium",
            vcsRepoUrl: data.vcsRepoUrl || null,
            createdAt: data.createdAt || "",
            status: data.status || "",
            files: data.files || []
          });
          if (data.logs && Array.isArray(data.logs) && data.logs.length > 0) {
            setLogs(data.logs);
          }
          if (data.status) {
            // Update milestones based on status
            const activeRoleMap: Record<string, string> = {
              "ACTIVE": "Product Manager",
              "QA_LOOP": "QA Engineer (Runner)",
              "COMPLETED": "Tech Writer"
            };
            const currentRole = activeRoleMap[data.status] || "Product Manager";
            setMilestones(prev => prev.map(m => {
              if (m.name === currentRole) return { ...m, status: data.status === "COMPLETED" ? "success" : "running" };
              return m;
            }));
          }
        }
      } catch (e) {
        console.error("Error fetching run state via REST:", e);
      }
    };

    // Immediate REST fetch on page load
    fetchRunState();

    // REST polling interval fallback every 2 seconds
    const pollInterval = setInterval(fetchRunState, 2000);

    // Connect to SSE stream passing OAuth token in query params
    const eventSource = new EventSource(`${ORCHESTRATOR_URL}/api/projects/${id}/stream?token=${token}`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.error) {
          console.error(data.error);
          return;
        }

        if (data.milestones && data.milestones.length > 0) {
          setMilestones(data.milestones.map((m: any) => ({
            name: m.role,
            status: m.status
          })));
        }

        if (data.logs && Array.isArray(data.logs) && data.logs.length > 0) {
          setLogs(data.logs);
        }
      } catch (err) {
        console.error("Error parsing SSE data:", err);
      }
    };

    eventSource.onerror = (err) => {
      console.error("EventSource connection issue, relying on REST polling:", err);
    };

    return () => {
      clearInterval(pollInterval);
      eventSource.close();
    };
  }, [id]);

  const isViewer = user?.role === "viewer";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50 py-3 sm:py-0 min-h-16 flex items-center">
        <div className="max-w-7xl w-full mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <a href="/" className="flex items-center space-x-3 self-start sm:self-center hover:opacity-90 transition-opacity">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20">
              V
            </div>
            <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
              VALKYRIE
            </span>
          </a>
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

        {/* Right Side: Project Overview & SSE Agent Logs */}
        <section className="lg:col-span-2 space-y-6">
          {/* Project Specification & Repository Banner */}
          {projectData && (
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm shadow-xl space-y-5">
              <div className="flex flex-wrap justify-between items-start gap-4 pb-4 border-b border-slate-800">
                <div>
                  <div className="flex items-center space-x-3">
                    <h2 className="text-xl font-bold text-slate-100">{projectData.projectName}</h2>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-violet-500/10 text-violet-400 border border-violet-500/20">
                      {projectData.language} • {projectData.cloud}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold border ${
                      projectData.projectScope === "small"
                        ? "bg-violet-500/10 text-violet-300 border-violet-500/30"
                        : projectData.projectScope === "large"
                        ? "bg-cyan-500/10 text-cyan-300 border-cyan-500/30"
                        : "bg-indigo-500/10 text-indigo-300 border-indigo-500/30"
                    }`}>
                      {projectData.projectScope === "small" ? "⚡ Small Scope (2-4 Code Files)" : projectData.projectScope === "large" ? "🏛 Large Scope (9-15+ Code Files)" : "📦 Medium Scope (5-8 Code Files)"}
                    </span>
                  </div>
                  {projectData.createdAt && (
                    <p className="text-xs text-slate-400 mt-1">
                      📅 Created: <span className="text-slate-300 font-mono">{new Date(projectData.createdAt).toLocaleString()}</span>
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {projectData.vcsRepoUrl && (
                    <a
                      href={projectData.vcsRepoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold transition-all shadow-sm active:scale-95 cursor-pointer"
                    >
                      <svg className="w-4 h-4 fill-current text-slate-300" viewBox="0 0 24 24">
                        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                      </svg>
                      <span>GitHub</span>
                    </a>
                  )}

                  {/* Documentation & License Quick-Access Links (Only render if file exists) */}
                  {projectData.files?.some(f => f.path.toUpperCase() === "LICENSE" || f.path.toLowerCase() === "license.md") && (
                    <button
                      onClick={() => handleOpenFile(projectData.files?.find(f => f.path.toUpperCase() === "LICENSE" || f.path.toLowerCase() === "license.md")?.path || "LICENSE")}
                      className="px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold font-mono transition-all cursor-pointer flex items-center space-x-1"
                      title="View License"
                    >
                      <span>⚖️</span>
                      <span>License</span>
                    </button>
                  )}

                  {projectData.files?.some(f => f.path.toLowerCase() === "readme.md") && (
                    <button
                      onClick={() => handleOpenFile("README.md")}
                      className="px-3 py-1.5 rounded-lg bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/30 text-violet-300 text-xs font-semibold font-mono transition-all cursor-pointer flex items-center space-x-1"
                      title="View README manual"
                    >
                      <span>📖</span>
                      <span>README</span>
                    </button>
                  )}

                  {projectData.files?.some(f => f.path.toLowerCase() === "docs/prd.md") && (
                    <button
                      onClick={() => handleOpenFile("docs/prd.md")}
                      className="px-3 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-semibold font-mono transition-all cursor-pointer flex items-center space-x-1"
                      title="View PRD Specification"
                    >
                      <span>📄</span>
                      <span>PRD</span>
                    </button>
                  )}

                  {projectData.files?.some(f => f.path.toLowerCase() === "docs/architecture.md") && (
                    <button
                      onClick={() => handleOpenFile("docs/architecture.md")}
                      className="px-3 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 text-xs font-semibold font-mono transition-all cursor-pointer flex items-center space-x-1"
                      title="View Architecture Specification"
                    >
                      <span>📐</span>
                      <span>Architecture</span>
                    </button>
                  )}

                  {projectData.files?.some(f => f.path.toLowerCase() === "docs/database.md") && (
                    <button
                      onClick={() => handleOpenFile("docs/database.md")}
                      className="px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-semibold font-mono transition-all cursor-pointer flex items-center space-x-1"
                      title="View Database Schema"
                    >
                      <span>🗄</span>
                      <span>Database</span>
                    </button>
                  )}

                  {projectData.files?.some(f => f.path.toLowerCase() === "docs/api.md") && (
                    <button
                      onClick={() => handleOpenFile("docs/api.md")}
                      className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-semibold font-mono transition-all cursor-pointer flex items-center space-x-1"
                      title="View API Documentation"
                    >
                      <span>🔌</span>
                      <span>API Docs</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Initial Prompt */}
              {projectData.description && (
                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Initial Project Prompt</h3>
                  <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 text-xs text-slate-300 font-sans leading-relaxed whitespace-pre-wrap max-h-36 overflow-y-auto custom-scrollbar">
                    {projectData.description}
                  </div>
                </div>
              )}

              {/* Synthesized Files */}
              {projectData.files && projectData.files.length > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                      Synthesized Source & Specification Files ({projectData.files.length})
                    </h3>
                    {projectData.files.length > 6 && (
                      <button
                        onClick={() => setShowAllFiles(!showAllFiles)}
                        className="text-[11px] font-semibold text-violet-400 hover:text-violet-300 transition-colors cursor-pointer"
                      >
                        {showAllFiles ? "Show Less" : `View All (${projectData.files.length})`}
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(showAllFiles ? projectData.files : projectData.files.slice(0, 6)).map((file, i) => (
                      <button
                        key={i}
                        onClick={() => handleOpenFile(file.path)}
                        className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-violet-500/50 text-[11px] font-mono text-slate-300 hover:text-white transition-all cursor-pointer shadow-sm group"
                        title={`Click to view contents of ${file.path}`}
                      >
                        <span className="group-hover:text-violet-400">📄 {file.path}</span>
                        <span className="text-[9px] text-slate-500 font-sans">({(file.size / 1024).toFixed(1)} KB)</span>
                        {file.costUSD !== undefined && file.costUSD > 0 && (
                          <span className="px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-mono font-semibold">
                            💵 ${file.costUSD.toFixed(5)}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Approval Action Card when status is AWAITING_APPROVAL */}
          {projectData?.status === "AWAITING_APPROVAL" && (
            <div className="bg-gradient-to-r from-violet-950/80 via-indigo-950/80 to-slate-900/90 border-2 border-violet-500/50 rounded-2xl p-6 shadow-2xl backdrop-blur-md space-y-4">
              <div className="flex items-start space-x-4">
                <div className="w-11 h-11 rounded-2xl bg-violet-500/20 border border-violet-400/30 flex items-center justify-center text-2xl shrink-0">
                  📑
                </div>
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <h3 className="text-lg font-bold text-white">Planning Specifications Ready for Review</h3>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse">
                      AWAITING APPROVAL
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    All planning specifications (<code className="text-violet-300 font-mono">docs/prd.md</code>, <code className="text-violet-300 font-mono">docs/architecture.md</code>, <code className="text-violet-300 font-mono">docs/database.md</code>, <code className="text-violet-300 font-mono">docs/ui_ux.md</code>) have been saved to disk. Review the files above and approve when ready to begin Developer Agent code implementation.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-violet-500/20">
                <button
                  onClick={handleApprove}
                  disabled={isViewer || approving}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-bold text-xs transition-all shadow-lg shadow-violet-500/30 active:scale-95 flex items-center space-x-2.5 cursor-pointer disabled:opacity-50"
                >
                  {approving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>Starting Implementation...</span>
                    </>
                  ) : (
                    <>
                      <span className="text-base">🚀</span>
                      <span>Approve & Begin Code Implementation</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Live Agent Debates & Output */}
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm shadow-xl flex flex-col min-h-[500px]">
            <div className="flex flex-wrap justify-between items-center mb-6 gap-3">
              <div>
                <h2 className="text-xl font-bold text-slate-100">Live Agent Debates & Output</h2>
              <p className="text-xs text-slate-400">Real-time log stream from central orchestrator multi-agent swarm</p>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={handleCopyLogs}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-sans font-medium transition-all flex items-center space-x-1.5 shadow-sm active:scale-95 cursor-pointer"
                title="Copy all live logs to clipboard"
              >
                {copied ? (
                  <>
                    <span className="text-emerald-400 font-bold">✓</span>
                    <span className="text-emerald-400 font-bold">Copied!</span>
                  </>
                ) : (
                  <>
                    <span>📋</span>
                    <span>Copy Logs</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {isViewer && (
            <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400 font-sans">
              ⚠️ Swarm operations (Restart, Cancel) are disabled for Viewers.
            </div>
          )}

          <div className="flex-1 bg-slate-950 rounded-xl border border-slate-800 p-6 font-mono text-xs overflow-y-scroll custom-scrollbar space-y-4 max-h-[500px]">
            {logs.map((log, index) => (
              <div key={index} className="space-y-1">
                <div className="flex items-center space-x-2 text-[10px]">
                  <span className="text-slate-500">{log.timestamp}</span>
                  <span className={`font-bold px-1.5 py-0.5 rounded ${
                    log.agent === "Developer Agent" 
                      ? "bg-indigo-500/10 text-indigo-400" 
                      : log.agent === "QA Engineer (Local Runner)" || log.agent === "QA Engineer (Runner)"
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
                    : log.type === "warning"
                    ? "text-amber-400"
                    : "text-slate-300"
                }`}>
                  {log.message}
                </p>
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        </div>
      </section>

      </main>

      {/* Interactive File Viewer Modal */}
      {(activeFile || loadingFile) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
              <div className="flex items-center space-x-3">
                <span className="text-xl">📄</span>
                <div>
                  <h3 className="text-sm font-bold font-mono text-slate-100">{activeFile?.path || "Loading file..."}</h3>
                  {activeFile && (
                    <div className="flex items-center space-x-2 text-[10px] text-slate-400 font-sans mt-0.5">
                      <span>{(activeFile.size / 1024).toFixed(2)} KB</span>
                      <span>•</span>
                      <span>{activeFile.content.split('\n').length} lines</span>
                      {activeFile.costUSD !== undefined && activeFile.costUSD > 0 && (
                        <>
                          <span>•</span>
                          <span className="text-emerald-400 font-semibold font-mono">💵 ${activeFile.costUSD.toFixed(5)} ({activeFile.tokens?.toLocaleString()} tokens)</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-3">
                {/* View Mode Toggle: Rendered Markup vs Raw Code */}
                {activeFile && (
                  <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-1 space-x-1">
                    <button
                      onClick={() => setViewMode("rendered")}
                      className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer flex items-center space-x-1 ${
                        viewMode === "rendered"
                          ? "bg-violet-600 text-white shadow-sm"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      <span>👁</span>
                      <span>Rendered Markup</span>
                    </button>
                    <button
                      onClick={() => setViewMode("raw")}
                      className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer flex items-center space-x-1 ${
                        viewMode === "raw"
                          ? "bg-violet-600 text-white shadow-sm"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      <span>📝</span>
                      <span>Raw Code</span>
                    </button>
                  </div>
                )}

                {activeFile && (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(activeFile.content);
                      setCopiedFile(true);
                      setTimeout(() => setCopiedFile(false), 2000);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-semibold transition-all cursor-pointer flex items-center space-x-1.5"
                  >
                    {copiedFile ? (
                      <>
                        <span className="text-emerald-400">✓</span>
                        <span className="text-emerald-400 font-bold">Copied!</span>
                      </>
                    ) : (
                      <>
                        <span>📋</span>
                        <span>Copy Code</span>
                      </>
                    )}
                  </button>
                )}
                <button
                  onClick={() => setActiveFile(null)}
                  className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all flex items-center justify-center font-bold text-sm cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto bg-slate-950 custom-scrollbar flex-1">
              {loadingFile ? (
                <div className="py-16 text-center space-y-3">
                  <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  <p className="text-xs text-slate-400">Loading file content...</p>
                </div>
              ) : activeFile ? (
                viewMode === "rendered" ? (
                  <SimpleMarkdownView content={activeFile.content} />
                ) : (
                  <pre className="whitespace-pre-wrap leading-relaxed select-text font-mono text-xs text-slate-300">
                    <code>{activeFile.content}</code>
                  </pre>
                )
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
