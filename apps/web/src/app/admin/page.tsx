"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ORCHESTRATOR_URL } from "@/lib/config";

interface AgentCost {
  role: string;
  tokensUsed: number;
  costUSD: number;
  color: string;
}

interface UserSession {
  username: string;
  role: string;
  tenantId: string;
}

interface Company {
  id: string;
  name: string;
  createdAt: string;
}

interface DbUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  tenantId: string;
  tenant: {
    name: string;
  };
  createdAt: string;
}

interface Project {
  id: string;
  name: string;
  description: string | null;
  programmingLanguage: string;
  deployTarget: string;
  vcsAuthType: string;
  agentRuns?: Array<{ status: string }>;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<UserSession | null>(null);
  const [apiKey, setApiKey] = useState("valk_live_8f3d...9c2d");
  const [gitStatus] = useState("Connected (GitHub App)");
  const [selectedModel, setSelectedModel] = useState("claude-sonnet-5");
  const [selectedProvider, setSelectedProvider] = useState("anthropic");
  const [googleApiKey, setGoogleApiKey] = useState("");
  const [anthropicApiKey, setAnthropicApiKey] = useState("");
  const [openaiApiKey, setOpenaiApiKey] = useState("");
  const [ollamaIp, setOllamaIp] = useState("http://localhost:11434");
  const [settingsLoading, setSettingsLoading] = useState(false);

  // Companies and Users state
  const [companies, setCompanies] = useState<Company[]>([]);
  const [usersList, setUsersList] = useState<DbUser[]>([]);

  // Selected company detail state
  const [selectedCompanyDetail, setSelectedCompanyDetail] = useState<Company | null>(null);
  const [selectedCompanyProjects, setSelectedCompanyProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  // Forms state
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newCompanyId, setNewCompanyId] = useState("");
  const [creatingCompany, setCreatingCompany] = useState(false);

  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserRole, setNewUserRole] = useState("user");
  const [newUserTenantId, setNewUserTenantId] = useState("");
  const [creatingUser, setCreatingUser] = useState(false);

  const [agentCosts, setAgentCosts] = useState<AgentCost[]>([
    { role: "Product Manager", tokensUsed: 125000, costUSD: 1.88, color: "bg-blue-500" },
    { role: "Software Architect", tokensUsed: 240000, costUSD: 3.60, color: "bg-indigo-500" },
    { role: "UI/UX Designer", tokensUsed: 180000, costUSD: 2.70, color: "bg-purple-500" },
    { role: "Data Architect", tokensUsed: 95000, costUSD: 1.43, color: "bg-pink-500" },
    { role: "AI/ML Engineer", tokensUsed: 310000, costUSD: 4.65, color: "bg-violet-500" },
    { role: "Security Architect", tokensUsed: 210000, costUSD: 3.15, color: "bg-red-500" },
    { role: "Tech Writer", tokensUsed: 150000, costUSD: 2.25, color: "bg-amber-500" },
    { role: "SRE", tokensUsed: 175000, costUSD: 2.63, color: "bg-teal-500" },
    { role: "QA Engineer", tokensUsed: 290000, costUSD: 4.35, color: "bg-emerald-500" },
  ]);

  const [projectCount, setProjectCount] = useState(0);

  const colorsMap: Record<string, string> = {
    "Product Manager": "bg-blue-500",
    "Software Architect": "bg-indigo-500",
    "UI/UX Designer": "bg-purple-500",
    "Data Architect": "bg-pink-500",
    "AI/ML Engineer": "bg-violet-500",
    "Security Architect": "bg-red-500",
    "Tech Writer": "bg-amber-500",
    "SRE": "bg-teal-500",
    "QA Engineer": "bg-emerald-500",
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

  const fetchSettings = async (token: string) => {
    try {
      const response = await fetch(`${ORCHESTRATOR_URL}/api/admin/settings`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setSelectedModel(data.selectedModel);
        setSelectedProvider(data.selectedProvider || "ollama");
        setGoogleApiKey(data.googleApiKey || "");
        setAnthropicApiKey(data.anthropicApiKey || "");
        setOpenaiApiKey(data.openaiApiKey || "");
        setOllamaIp(data.ollamaIp || "http://localhost:11434");
      }
    } catch (err) {
      console.error("Error fetching settings:", err);
    }
  };

  const fetchAdminLists = async (token: string) => {
    try {
      const resCompanies = await fetch(`${ORCHESTRATOR_URL}/api/admin/companies`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (resCompanies.ok) {
        const data = await resCompanies.json();
        setCompanies(data);
        if (data.length > 0 && !newUserTenantId) {
          setNewUserTenantId(data[0].id);
        }
      }

      const resUsers = await fetch(`${ORCHESTRATOR_URL}/api/admin/users`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (resUsers.ok) {
        const data = await resUsers.json();
        setUsersList(data);
      }
    } catch (e) {
      console.error("Error fetching companies/users lists:", e);
    }
  };

  const handleModelChange = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem("token");
    if (!token) return;

    setSettingsLoading(true);
    try {
      const response = await fetch(`${ORCHESTRATOR_URL}/api/admin/settings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          selectedModel,
          selectedProvider,
          googleApiKey,
          anthropicApiKey,
          openaiApiKey,
          ollamaIp
        })
      });
      if (response.ok) {
        alert("System AI Swarm settings updated successfully!");
      } else {
        const data = await response.json();
        alert(data.error || "Failed to update settings.");
      }
    } catch (err) {
      console.error("Error saving settings:", err);
      alert("Error saving settings.");
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyName) return;
    const token = localStorage.getItem("token");
    if (!token) return;

    setCreatingCompany(true);
    try {
      const response = await fetch(`${ORCHESTRATOR_URL}/api/admin/companies`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          id: newCompanyId || undefined,
          name: newCompanyName
        })
      });
      if (response.ok) {
        alert("Company created successfully!");
        setNewCompanyName("");
        setNewCompanyId("");
        fetchAdminLists(token);
      } else {
        const err = await response.json();
        alert(err.error || "Failed to create company.");
      }
    } catch (err) {
      console.error("Error creating company:", err);
    } finally {
      setCreatingCompany(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail || !newUserTenantId) return;
    const token = localStorage.getItem("token");
    if (!token) return;

    setCreatingUser(true);
    try {
      const response = await fetch(`${ORCHESTRATOR_URL}/api/admin/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          email: newUserEmail,
          name: newUserName || undefined,
          role: newUserRole,
          tenantId: newUserTenantId
        })
      });
      if (response.ok) {
        alert("User created successfully!");
        setNewUserEmail("");
        setNewUserName("");
        fetchAdminLists(token);
      } else {
        const err = await response.json();
        alert(err.error || "Failed to create user.");
      }
    } catch (err) {
      console.error("Error creating user:", err);
    } finally {
      setCreatingUser(false);
    }
  };

  const selectCompany = async (company: Company) => {
    setSelectedCompanyDetail(company);
    const token = localStorage.getItem("token");
    if (!token) return;

    setLoadingProjects(true);
    try {
      const response = await fetch(`${ORCHESTRATOR_URL}/api/admin/companies/${company.id}/projects`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setSelectedCompanyProjects(data);
      }
    } catch (e) {
      console.error("Error fetching company projects:", e);
    } finally {
      setLoadingProjects(false);
    }
  };

  const rotateApiKey = () => {
    setApiKey("valk_live_" + Math.random().toString(36).substring(2, 8) + "..." + Math.random().toString(36).substring(2, 6));
    alert("Mock API Key Rotated successfully!");
  };

  const fetchStats = async (token: string) => {
    try {
      const response = await fetch(`${ORCHESTRATOR_URL}/api/admin/stats`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setProjectCount(data.projectCount);
        if (data.agentCosts) {
          setAgentCosts(data.agentCosts.map((c: any) => ({
            role: c.role,
            tokensUsed: c.tokensUsed,
            costUSD: c.costUSD,
            color: colorsMap[c.role] || "bg-slate-500"
          })));
        }
      } else if (response.status === 401 || response.status === 403) {
        router.push("/dashboard");
      }
    } catch (err) {
      console.error("Error fetching admin stats:", err);
    }
  };

  useEffect(() => {
    const session = getSession();
    if (!session) {
      router.push("/login");
      return;
    }
    if (session.role !== "admin") {
      alert("Forbidden: Admin privileges are required to access this panel.");
      router.push("/dashboard");
      return;
    }
    setUser(session);
    
    const token = localStorage.getItem("token");
    if (token) {
      fetchStats(token);
      fetchSettings(token);
      fetchAdminLists(token);
      
      const interval = setInterval(() => fetchStats(token), 5000);
      return () => clearInterval(interval);
    }
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    router.push("/login");
  };

  const totalCost = agentCosts.reduce((acc, curr) => acc + curr.costUSD, 0);
  const totalTokens = agentCosts.reduce((acc, curr) => acc + curr.tokensUsed, 0);

  if (!user || user.role !== "admin") {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center font-sans">
        <div className="text-center space-y-4">
          <div className="w-10 h-10 border-t-2 border-violet-500 animate-spin mx-auto" />
          <p className="text-sm text-slate-400">Verifying administrator credentials...</p>
        </div>
      </div>
    );
  }

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
            <a href="/admin" className="text-violet-400 hover:text-violet-300 transition-colors">Administration</a>
            <div className="hidden sm:block h-4 w-[1px] bg-slate-800"></div>
            {user && (
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 capitalize font-mono">
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

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-10 space-y-8">
        
        {/* Row 1: Repository Authorization & API Secret Key */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm shadow-xl flex flex-col justify-between">
            <div>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Repository Authorization</h3>
              <p className="text-xl font-bold text-emerald-400">{gitStatus}</p>
            </div>
            <div className="mt-4 text-xs text-slate-400">
              <p>Repository connection is active. Commits and issues will be posted on behalf of Valkyrie.</p>
            </div>
          </div>

          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm shadow-xl flex flex-col justify-between">
            <div>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">API Secret Key</h3>
              <p className="text-xl font-mono font-bold text-slate-300">{apiKey}</p>
            </div>
            <div className="mt-4 text-xs text-slate-400">
              <span onClick={rotateApiKey} className="text-violet-400 hover:underline cursor-pointer font-bold">Rotate API key</span>
            </div>
          </div>
        </section>

        {/* AI Global Configuration Section */}
        <section className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm shadow-xl">
          <h2 className="text-xl font-bold text-slate-100 mb-2">Swarm AI Engine Configurations</h2>
          <p className="text-slate-400 text-sm mb-6">Select which AI LLM model and provider to deploy when triggering multi-agent pipeline debate runs.</p>

          <form onSubmit={handleModelChange} className="space-y-6 max-w-4xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">AI Provider</label>
                <select
                  value={selectedProvider}
                  onChange={(e) => {
                    const prov = e.target.value;
                    setSelectedProvider(prov);
                    if (prov === "google") setSelectedModel("gemini-3.5-flash");
                    else if (prov === "anthropic") setSelectedModel("claude-sonnet-5");
                    else if (prov === "openai") setSelectedModel("gpt-5.6-luna");
                    else if (prov === "ollama") setSelectedModel("qwen3-coder:latest");
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-slate-200 focus:outline-none focus:border-violet-500 transition-colors"
                >
                  <option value="anthropic">Anthropic Claude API</option>
                  <option value="google">Google Gemini API</option>
                  <option value="openai">OpenAI GPT API</option>
                  <option value="ollama">Ollama (Local Swarm Inference)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Active LLM Model</label>
                <input
                  type="text"
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  placeholder="e.g. qwen3-coder:latest"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-slate-200 focus:outline-none focus:border-violet-500 transition-colors font-mono"
                />
              </div>
            </div>

            {selectedProvider !== "ollama" ? (
              <div className="grid grid-cols-1 gap-4">
                {selectedProvider === "google" && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Google API Key</label>
                    <input
                      type="password"
                      value={googleApiKey}
                      onChange={(e) => setGoogleApiKey(e.target.value)}
                      placeholder="AIzaSy..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-slate-200 focus:outline-none focus:border-violet-500 transition-colors font-mono"
                    />
                  </div>
                )}
                {selectedProvider === "anthropic" && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Anthropic API Key</label>
                    <input
                      type="password"
                      value={anthropicApiKey}
                      onChange={(e) => setAnthropicApiKey(e.target.value)}
                      placeholder="sk-ant-..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-slate-200 focus:outline-none focus:border-violet-500 transition-colors font-mono"
                    />
                  </div>
                )}
                {selectedProvider === "openai" && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">OpenAI API Key</label>
                    <input
                      type="password"
                      value={openaiApiKey}
                      onChange={(e) => setOpenaiApiKey(e.target.value)}
                      placeholder="sk-..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-slate-200 focus:outline-none focus:border-violet-500 transition-colors font-mono"
                    />
                  </div>
                )}
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Ollama Connection Endpoint (IP/Domain)</label>
                <input
                  type="text"
                  value={ollamaIp}
                  onChange={(e) => setOllamaIp(e.target.value)}
                  placeholder="http://localhost:11434"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-slate-200 focus:outline-none focus:border-violet-500 transition-colors font-mono"
                />
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={settingsLoading}
                className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold transition-all shadow-md shadow-indigo-500/10 disabled:opacity-50 text-sm h-11 flex items-center justify-center"
              >
                {settingsLoading ? "Saving Settings..." : "Save AI Swarm Settings"}
              </button>
            </div>
          </form>
        </section>

        {/* Companies & Users Creator Panel */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Companies Manager */}
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm shadow-xl space-y-6">
            <h2 className="text-xl font-bold text-slate-100">Company Management</h2>
            <p className="text-xs text-slate-400 -mt-4">Register new companies / tenants to support isolated multi-tenant deployments.</p>

            <form onSubmit={handleCreateCompany} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Company Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Initech Corp"
                    value={newCompanyName}
                    onChange={(e) => setNewCompanyName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-violet-500 transition-colors"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Company ID (Slug Identifier)</label>
                  <input
                    type="text"
                    placeholder="e.g. initech"
                    value={newCompanyId}
                    onChange={(e) => setNewCompanyId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-violet-500 transition-colors font-mono"
                    required
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={creatingCompany}
                className="w-full py-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-bold text-slate-200 transition-all disabled:opacity-50"
              >
                {creatingCompany ? "Creating..." : "Create Company"}
              </button>
            </form>

            <div className="border-t border-slate-800 pt-4">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Registered Companies (Click to view details)</h3>
              <div className="max-h-[200px] overflow-y-auto space-y-2 pr-2">
                {companies.map((c) => (
                  <div 
                    key={c.id} 
                    onClick={() => selectCompany(c)}
                    className={`flex justify-between items-center border p-3 rounded-lg text-xs cursor-pointer transition-all ${
                      selectedCompanyDetail?.id === c.id 
                        ? "bg-violet-600/10 border-violet-500/50" 
                        : "bg-slate-950/40 border-slate-800/80 hover:border-slate-700"
                    }`}
                  >
                    <span className="font-semibold text-slate-200">{c.name}</span>
                    <span className="font-mono text-[10px] text-slate-500">ID: {c.id}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Users Manager */}
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm shadow-xl space-y-6">
            <h2 className="text-xl font-bold text-slate-100">User Management</h2>
            <p className="text-xs text-slate-400 -mt-4">Provision new team members and assign explicit RBAC roles dynamically.</p>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">User Email</label>
                  <input
                    type="email"
                    placeholder="e.g. milton@intech.com"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-violet-500 transition-colors"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Display Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Milton Waddams"
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-violet-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">RBAC Role</label>
                  <select
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-violet-500 transition-colors"
                  >
                    <option value="user">User (Standard Creator)</option>
                    <option value="admin">Admin (All Privileges)</option>
                    <option value="viewer">Viewer (Read-Only Portal)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Company / Tenant</label>
                  <select
                    value={newUserTenantId}
                    onChange={(e) => setNewUserTenantId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-violet-500 transition-colors"
                  >
                    {companies.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                type="submit"
                disabled={creatingUser || companies.length === 0}
                className="w-full py-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-bold text-slate-200 transition-all disabled:opacity-50"
              >
                {creatingUser ? "Creating..." : "Create User"}
              </button>
            </form>

            <div className="border-t border-slate-800 pt-4">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Provisioned Users</h3>
              <div className="max-h-[200px] overflow-y-auto space-y-2 pr-2">
                {usersList.map((u) => (
                  <div key={u.id} className="flex justify-between items-center bg-slate-950/40 border border-slate-800/80 p-3 rounded-lg text-xs">
                    <div>
                      <p className="font-semibold text-slate-200">{u.email}</p>
                      {u.name && <p className="text-[10px] text-slate-400">{u.name}</p>}
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-violet-500/10 border border-violet-500/20 text-violet-400 font-mono mr-2">
                        {u.role}
                      </span>
                      <span className="font-mono text-[10px] text-slate-500">{u.tenant?.name || u.tenantId}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Selected Company Profile & Associated Project Details */}
        {selectedCompanyDetail && (
          <section className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm shadow-xl space-y-6 animate-fadeIn">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Company Details</h3>
                <p className="text-2xl font-extrabold text-slate-100">{selectedCompanyDetail.name}</p>
              </div>
              <button
                onClick={() => setSelectedCompanyDetail(null)}
                className="text-xs text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 transition-all font-bold"
              >
                Clear Selection
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
              <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-850">
                <span className="text-xs text-slate-500 uppercase font-semibold">Tenant Identifier</span>
                <p className="text-base font-mono font-bold text-slate-300 mt-1">{selectedCompanyDetail.id}</p>
              </div>
              <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-850">
                <span className="text-xs text-slate-500 uppercase font-semibold">Creation Date</span>
                <p className="text-base font-bold text-slate-300 mt-1">{new Date(selectedCompanyDetail.createdAt).toLocaleDateString()}</p>
              </div>
              <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-850">
                <span className="text-xs text-slate-500 uppercase font-semibold">Associated Projects</span>
                <p className="text-lg font-bold text-violet-400 mt-1">{selectedCompanyProjects.length}</p>
              </div>
            </div>

            <div className="space-y-4 pt-2">
              <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Associated Projects (Click to open run view)</h4>
              
              {loadingProjects ? (
                <div className="flex items-center space-x-2 text-xs text-slate-500 py-4">
                  <div className="w-4 h-4 border-t-2 border-violet-500 animate-spin" />
                  <span>Loading projects data...</span>
                </div>
              ) : selectedCompanyProjects.length === 0 ? (
                <p className="text-xs text-slate-500 italic py-4">No projects have been created for this company yet.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {selectedCompanyProjects.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => router.push(`/project/${p.id}/run`)}
                      className="bg-slate-950/40 hover:bg-slate-950 border border-slate-850 hover:border-slate-700 p-4 rounded-xl cursor-pointer transition-all space-y-3 group"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="font-semibold text-slate-200 group-hover:text-violet-400 transition-colors text-sm block">{p.name}</span>
                          <span className="text-[9px] font-mono text-violet-400 block mt-0.5">Project ID: {p.id}</span>
                        </div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400 uppercase">
                          {p.agentRuns?.[0]?.status || "PLANNING"}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 line-clamp-2 min-h-[32px]">{p.description || "No description provided."}</p>
                      <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono border-t border-slate-900 pt-3">
                        <span>{p.programmingLanguage} • {p.deployTarget}</span>
                        <span>{p.vcsAuthType === "github_app" ? "Git App" : "Token"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Row 2: Metrics Dashboard */}
        <section className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm shadow-xl">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h2 className="text-2xl font-bold text-slate-100">AI Cost Analysis</h2>
              <p className="text-slate-400 text-sm">Aggregated metrics detailing tokens consumed and USD expenditure across your agent swarms.</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-extrabold text-violet-400">${totalCost.toFixed(2)}</p>
              <p className="text-xs text-slate-500">{totalTokens.toLocaleString()} Total Tokens</p>
            </div>
          </div>

          {/* Graphical Cost Breakdown */}
          <div className="space-y-6">
            <div>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Expenditure Contribution by Agent Persona</h3>
              
              {/* Cost bar representation */}
              <div className="w-full h-4 bg-slate-950 rounded-full overflow-hidden flex">
                {agentCosts.map((agent) => {
                  const percentage = totalCost > 0 ? (agent.costUSD / totalCost) * 100 : 0;
                  return (
                    <div
                      key={agent.role}
                      className={`${agent.color} h-full`}
                      style={{ width: `${percentage}%` }}
                      title={`${agent.role}: $${agent.costUSD.toFixed(2)} (${percentage.toFixed(1)}%)`}
                    />
                  );
                })}
              </div>
            </div>

            {/* List details */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-4">
              {agentCosts.map((agent) => (
                <div key={agent.role} className="flex items-center space-x-4 bg-slate-950/40 border border-slate-800 p-4 rounded-xl">
                  <div className={`w-3 h-3 rounded-full ${agent.color}`} />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-200">{agent.role}</p>
                    <p className="text-xs text-slate-500">{agent.tokensUsed.toLocaleString()} tokens</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-100">${agent.costUSD.toFixed(2)}</p>
                    <p className="text-[10px] text-slate-500">
                      {totalCost > 0 ? ((agent.costUSD / totalCost) * 100).toFixed(1) : 0}%
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

      </main>
    </div>
  );
}
