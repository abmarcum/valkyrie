"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function OAuthCallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState("Exchanging authorization code...");
  const [error, setError] = useState("");

  useEffect(() => {
    const code = searchParams.get("code");
    if (!code) {
      setError("No authorization code provided in the callback URL.");
      return;
    }

    const exchangeCode = async () => {
      try {
        const response = await fetch("http://localhost:4000/oauth/token", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            code,
            grant_type: "authorization_code"
          })
        });

        if (response.ok) {
          const data = await response.json();
          localStorage.setItem("token", data.access_token);
          setStatus("Authentication successful! Redirecting...");
          setTimeout(() => {
            router.push("/dashboard");
          }, 1000);
        } else {
          const errData = await response.json();
          setError(errData.error || "Failed to exchange authorization code.");
        }
      } catch (err) {
        console.error("Token exchange error:", err);
        setError("Network error communicating with the authentication server.");
      }
    };

    exchangeCode();
  }, [searchParams, router]);

  return (
    <div className="w-full max-w-md bg-slate-900/40 border border-slate-800 rounded-2xl p-8 backdrop-blur-md text-center space-y-4 shadow-2xl">
      <div className="w-12 h-12 rounded-full border-t-2 border-violet-500 animate-spin mx-auto mb-2" />
      <h2 className="text-xl font-bold tracking-tight">Valkyrie Authentication</h2>
      
      {error ? (
        <div className="space-y-4">
          <p className="text-sm text-rose-500 font-medium">{error}</p>
          <button
            onClick={() => router.push("/login")}
            className="px-4 py-2 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 text-xs font-bold transition-all"
          >
            Back to Login
          </button>
        </div>
      ) : (
        <p className="text-sm text-slate-400 font-medium">{status}</p>
      )}
    </div>
  );
}

export default function OAuthCallback() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center font-sans">
      <Suspense fallback={
        <div className="w-full max-w-md bg-slate-900/40 border border-slate-800 rounded-2xl p-8 backdrop-blur-md text-center space-y-4 shadow-2xl">
          <div className="w-12 h-12 rounded-full border-t-2 border-violet-500 animate-spin mx-auto mb-2" />
          <h2 className="text-xl font-bold tracking-tight">Valkyrie Authentication</h2>
          <p className="text-sm text-slate-400 font-medium">Loading callback context...</p>
        </div>
      }>
        <OAuthCallbackHandler />
      </Suspense>
    </div>
  );
}
