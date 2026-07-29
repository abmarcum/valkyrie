"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ORCHESTRATOR_URL } from "@/lib/config";

interface Project {
  id: string;
  name: string;
  description: string;
  language: string;
  cloud: string;
  status: string;
  createdAt: string;
}

interface UserSession {
  username: string;
  role: string;
  tenantId: string;
}

interface Company {
  id: string;
  name: string;
}

interface AttachedFile {
  id: string;
  name: string;
  type: "TXT" | "PDF";
  size: number;
  text: string;
  loading: boolean;
  error?: string;
}

export default function Dashboard() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [user, setUser] = useState<UserSession | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [language, setLanguage] = useState("go");
  const [cloud, setCloud] = useState("onprem");
  const [dbPlatform, setDbPlatform] = useState("none");
  const [failover, setFailover] = useState("basic");
  const [vcsRepo, setVcsRepo] = useState("");
  const [vcsAuthType, setVcsAuthType] = useState("personal_access_token");
  const [githubInstallationId, setGithubInstallationId] = useState("");

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

  const fetchProjects = async (token: string) => {
    try {
      const response = await fetch(`${ORCHESTRATOR_URL}/api/projects`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setProjects(data.map((p: any) => ({
          id: p.id,
          name: p.name,
          description: p.description || "",
          language: p.programmingLanguage || "TypeScript",
          cloud: p.deployTarget || "AWS",
          status: p.agentRuns?.[0]?.status || "PLANNING",
          createdAt: p.createdAt.split("T")[0]
        })));
      } else if (response.status === 401) {
        localStorage.removeItem("token");
        router.push("/login");
      }
    } catch (err) {
      console.error("Error fetching projects:", err);
    }
  };

  const fetchCompanies = async (token: string) => {
    try {
      const response = await fetch(`${ORCHESTRATOR_URL}/api/admin/companies`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setCompanies(data);
        if (data.length > 0) {
          setSelectedCompanyId(data[0].id);
        }
      }
    } catch (err) {
      console.error("Error fetching companies:", err);
    }
  };

  useEffect(() => {
    const session = getSession();
    if (!session) {
      router.push("/login");
      return;
    }
    setUser(session);
    const token = localStorage.getItem("token");
    if (token) {
      fetchProjects(token);
      if (session.role === "admin") {
        fetchCompanies(token);
      }
    }
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    router.push("/login");
  };

  const handleDelete = async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (user?.role === "viewer") {
      alert("Permission Denied: Viewers cannot delete projects.");
      return;
    }

    if (!confirm("Are you sure you want to delete this project and clean up its code workspace?")) return;

    const token = localStorage.getItem("token");
    try {
      const response = await fetch(`${ORCHESTRATOR_URL}/api/projects/${projectId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (response.ok) {
        if (token) fetchProjects(token);
      } else {
        const errData = await response.json();
        alert(errData.error || "Failed to delete project.");
      }
    } catch (err) {
      console.error("Error deleting project:", err);
    }
  };

  const handleFileUpload = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    
    for (const file of fileArray) {
      const fileId = `file-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const isPdf = file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf";
      const isTxt = file.name.toLowerCase().endsWith(".txt") || file.type === "text/plain";

      if (!isPdf && !isTxt) {
        alert(`Unsupported file format for '${file.name}'. Please upload .txt or .pdf specification files.`);
        continue;
      }

      const newFile: AttachedFile = {
        id: fileId,
        name: file.name,
        type: isPdf ? "PDF" : "TXT",
        size: file.size,
        text: "",
        loading: true
      };

      setAttachedFiles(prev => [...prev, newFile]);

      try {
        if (isTxt) {
          const text = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve((e.target?.result as string) || "");
            reader.onerror = (e) => reject(e);
            reader.readAsText(file);
          });
          setAttachedFiles(prev => prev.map(f => f.id === fileId ? { ...f, text, loading: false } : f));
        } else if (isPdf) {
          const formData = new FormData();
          formData.append("file", file);
          const res = await fetch("/api/parse-pdf", {
            method: "POST",
            body: formData
          });
          if (res.ok) {
            const data = await res.json();
            setAttachedFiles(prev => prev.map(f => f.id === fileId ? { ...f, text: data.text, loading: false } : f));
          } else {
            const errData = await res.json();
            setAttachedFiles(prev => prev.map(f => f.id === fileId ? { ...f, loading: false, error: errData.error || "Failed to parse PDF" } : f));
          }
        }
      } catch (err: any) {
        setAttachedFiles(prev => prev.map(f => f.id === fileId ? { ...f, loading: false, error: err.message || "Failed to read file" } : f));
      }
    }
  };

  const removeAttachedFile = (id: string) => {
    setAttachedFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (user?.role === "viewer") {
      alert("Permission Denied: Viewers cannot trigger new swarm generations.");
      return;
    }
    if (!name) return;
    const projectId = `proj-${Date.now()}`;
    const token = localStorage.getItem("token");

    // Append text extracted from uploaded specification documents
    let combinedDescription = description.trim();
    const loadedFilesText = attachedFiles
      .filter(f => !f.loading && f.text && !f.error)
      .map(f => `\n\n--- ATTACHED SPECIFICATION DOCUMENT: ${f.name} (${f.type}) ---\n${f.text}`)
      .join("");

    if (loadedFilesText) {
      combinedDescription = (combinedDescription ? combinedDescription : "Project built according to attached specification documents.") + loadedFilesText;
    }

    try {
      const response = await fetch(`${ORCHESTRATOR_URL}/api/projects/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          projectId,
          projectName: name,
          language,
          cloud: cloud.toUpperCase(),
          dbPlatform,
          description: combinedDescription,
          vcsRepo,
          vcsAuthType,
          githubInstallationId: vcsAuthType === "github_app" ? githubInstallationId : undefined,
          tenantId: user?.role === "admin" ? selectedCompanyId : undefined
        }),
      });

      if (response.ok) {
        router.push(`/project/${projectId}/run`);
      } else {
        const errData = await response.json();
        alert(errData.error || "Failed to start agent swarm run.");
      }
    } catch (err) {
      console.error("Error communicating with orchestrator:", err);
    }
  };

  const isViewer = user?.role === "viewer";
  const isAdmin = user?.role === "admin";

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
            <a href="/dashboard" className="text-violet-400 hover:text-violet-300 transition-colors">Dashboard</a>
            {isAdmin && (
              <a href="/admin" className="hover:text-slate-200 transition-colors">Administration</a>
            )}
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

      {/* Main Grid */}
      <main className="max-w-7xl mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Creator Form */}
        <section className="lg:col-span-2 bg-slate-900/40 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm shadow-xl">
          <h2 className="text-2xl font-bold text-slate-100 mb-2">Create New Application</h2>
          <p className="text-slate-400 text-sm mb-6">Describe the system you need. Valkyrie's agent swarm will construct, scan, audit, and deploy it.</p>

          {isViewer && (
            <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400">
              ⚠️ You are logged in with the <strong>Viewer</strong> role. Workspace creation and swarm controls are disabled.
            </div>
          )}

          <form onSubmit={handleCreate} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Project Name</label>
                <input
                  type="text"
                  placeholder="e.g. Billing Microservice"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-slate-200 focus:outline-none focus:border-violet-500 transition-colors disabled:opacity-50"
                  required
                  disabled={isViewer}
                />
              </div>

              {isAdmin && companies.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Target Company / Tenant</label>
                  <select
                    value={selectedCompanyId}
                    onChange={(e) => setSelectedCompanyId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-slate-200 focus:outline-none focus:border-violet-500 transition-colors"
                  >
                    {companies.map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.id})</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Detailed Requirements</label>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs font-semibold text-violet-400 hover:text-violet-300 flex items-center space-x-1.5 transition-colors disabled:opacity-50"
                  disabled={isViewer}
                >
                  <span>📎 Attach .txt / .pdf Documents</span>
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
                  multiple
                  accept=".txt,.pdf,text/plain,application/pdf"
                  className="hidden"
                />
              </div>

              <textarea
                placeholder="Specify endpoints, authentication, database structure, failover behavior, caching, and specific business flows..."
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-slate-200 focus:outline-none focus:border-violet-500 transition-colors disabled:opacity-50"
                disabled={isViewer}
              />

              {/* Drag & Drop File Upload Zone */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (!isViewer && e.dataTransfer.files) {
                    handleFileUpload(e.dataTransfer.files);
                  }
                }}
                onClick={() => !isViewer && fileInputRef.current?.click()}
                className="mt-2 border border-dashed border-slate-800 hover:border-slate-700 bg-slate-950/40 rounded-lg p-3 text-center transition-colors cursor-pointer group"
              >
                <p className="text-xs text-slate-500 group-hover:text-slate-400 transition-colors">
                  Drag & drop requirement files here or click to browse (<span className="text-slate-400 font-mono">.txt, .pdf</span>)
                </p>
              </div>

              {/* Attached Files Badge List */}
              {attachedFiles.length > 0 && (
                <div className="mt-3 space-y-2">
                  {attachedFiles.map(file => (
                    <div key={file.id} className="flex items-center justify-between bg-slate-900/80 border border-slate-800 rounded-lg px-3 py-2 text-xs">
                      <div className="flex items-center space-x-2 overflow-hidden">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border ${
                          file.type === "PDF" 
                            ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                            : "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
                        }`}>
                          {file.type}
                        </span>
                        <span className="font-medium text-slate-200 truncate max-w-[200px] sm:max-w-[300px]" title={file.name}>
                          {file.name}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          ({(file.size / 1024).toFixed(1)} KB)
                        </span>
                      </div>

                      <div className="flex items-center space-x-2">
                        {file.loading ? (
                          <span className="text-[10px] text-amber-400 animate-pulse font-semibold">Parsing...</span>
                        ) : file.error ? (
                          <span className="text-[10px] text-rose-400 font-semibold" title={file.error}>Error</span>
                        ) : (
                          <span className="text-[10px] text-emerald-400 font-semibold font-mono">
                            ✓ {file.text.length.toLocaleString()} chars
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => removeAttachedFile(file.id)}
                          className="text-slate-500 hover:text-rose-400 font-bold px-1 transition-colors"
                          title="Remove file"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Programming Language</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-slate-200 focus:outline-none focus:border-violet-500 transition-colors disabled:opacity-50"
                  disabled={isViewer}
                >
                  <option value="go">Go (Fiber/Gin)</option>
                  <option value="typescript">TypeScript (Next.js/Node)</option>
                  <option value="python">Python (FastAPI/Django)</option>
                  <option value="java">Java (Spring Boot / Maven)</option>
                  <option value="cpp">C++ (CMake / STL)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Target Platform</label>
                <select
                  value={cloud}
                  onChange={(e) => setCloud(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-slate-200 focus:outline-none focus:border-violet-500 transition-colors disabled:opacity-50"
                  disabled={isViewer}
                >
                  <option value="onprem">On-Premises (Docker/K8s)</option>
                  <option value="aws">Amazon Web Services (AWS)</option>
                  <option value="gcp">Google Cloud Platform (GCP)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Database Platform</label>
                <select
                  value={dbPlatform}
                  onChange={(e) => setDbPlatform(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-slate-200 focus:outline-none focus:border-violet-500 transition-colors disabled:opacity-50"
                  disabled={isViewer}
                >
                  <option value="none">None (Stateless / In-Memory)</option>
                  <option value="postgresql">PostgreSQL (Relational)</option>
                  <option value="mongodb">MongoDB (Document)</option>
                  <option value="redis">Redis (In-Memory Key/Value)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Failover Strategy</label>
                <select
                  value={failover}
                  onChange={(e) => setFailover(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-slate-200 focus:outline-none focus:border-violet-500 transition-colors disabled:opacity-50"
                  disabled={isViewer}
                >
                  <option value="basic">Single Instance with Auto-Restart</option>
                  <option value="multi-zone">Multi-Availability Zone (Active-Active)</option>
                  <option value="region">Multi-Region Replication</option>
                </select>
              </div>
            </div>

            {/* VCS configuration section */}
            <div className="border-t border-slate-800 pt-6 space-y-4">
              <h3 className="text-sm font-bold text-slate-200">Repository & Auth Configurations</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">VCS Repo URL</label>
                  <input
                    type="text"
                    placeholder="e.g. github.com/acme/my-billing-service"
                    value={vcsRepo}
                    onChange={(e) => setVcsRepo(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-slate-200 focus:outline-none focus:border-violet-500 transition-colors disabled:opacity-50"
                    disabled={isViewer}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Authentication Method</label>
                  <select
                    value={vcsAuthType}
                    onChange={(e) => setVcsAuthType(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-slate-200 focus:outline-none focus:border-violet-500 transition-colors disabled:opacity-50"
                    disabled={isViewer}
                  >
                    <option value="personal_access_token">Personal Access Token (GITHUB_TOKEN Env)</option>
                    <option value="github_app">GitHub App Authorization</option>
                  </select>
                </div>
              </div>

              {vcsAuthType === "github_app" && (
                <div className="animate-fadeIn">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">GitHub App Installation ID</label>
                  <input
                    type="text"
                    placeholder="e.g. 51239845"
                    value={githubInstallationId}
                    onChange={(e) => setGithubInstallationId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-slate-200 focus:outline-none focus:border-violet-500 transition-colors disabled:opacity-50 font-mono"
                    required={vcsAuthType === "github_app"}
                    disabled={isViewer}
                  />
                  <p className="text-[10px] text-slate-500 mt-1.5 leading-relaxed">
                    Enter the GitHub App installation numeric ID. The orchestrator will dynamically request an Installation Access Token (IAT) to sign push requests.
                  </p>
                </div>
              )}
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold rounded-lg transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50"
              disabled={isViewer}
            >
              Initialize Agent Swarm Run
            </button>
          </form>
        </section>

        {/* Existing Projects Sidebar */}
        <section className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm shadow-xl flex flex-col">
          <h2 className="text-xl font-bold text-slate-100 mb-6">Active Pipelines</h2>
          
          <div className="space-y-4 flex-1">
            {projects.map((proj) => (
              <div
                key={proj.id}
                className="border border-slate-800 hover:border-slate-700 bg-slate-950/40 p-4 rounded-xl transition-all cursor-pointer group"
                onClick={() => router.push(`/project/${proj.id}/run`)}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-slate-200 group-hover:text-violet-400 transition-colors">{proj.name}</h3>
                  <div className="flex items-center space-x-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      proj.status === "ACTIVE" 
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                        : proj.status === "QA_LOOP"
                        ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        : "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                    }`}>
                      {proj.status}
                    </span>
                    {!isViewer && (
                      <button
                        onClick={(e) => handleDelete(proj.id, e)}
                        className="text-xs text-rose-500 hover:text-rose-400 font-bold px-1.5 py-0.5 rounded border border-rose-500/20 hover:bg-rose-500/10 transition-colors"
                        title="Delete Project"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-xs text-slate-400 line-clamp-2 mb-3">{proj.description}</p>
                <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono">
                  <span>{proj.language} • {proj.cloud}</span>
                  <span>{proj.createdAt}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

      </main>
    </div>
  );
}
