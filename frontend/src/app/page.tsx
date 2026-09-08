"use client";

import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";

type StepStatus = "waiting" | "running" | "done" | "error";

interface PipelineStep {
  id: string;
  label: string;
  status: StepStatus;
  result?: string;
}

export default function Home() {
  const initialSteps: PipelineStep[] = [
    { id: "search", label: "Data Aggregation", status: "waiting" },
    { id: "reader", label: "Contextual Analysis", status: "waiting" },
    { id: "writer", label: "Report Synthesis", status: "waiting" },
    { id: "critic", label: "Critical Review", status: "waiting" },
  ];

  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Check saved preference or OS preference
    const saved = localStorage.getItem("theme");
    if (saved === "dark" || (!saved && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
      setIsDark(true);
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.setAttribute("data-theme", "light");
    }
  }, []);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.setAttribute("data-theme", next ? "dark" : "light");
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  const [topic, setTopic] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [steps, setSteps] = useState<PipelineStep[]>(initialSteps);
  const [finalReport, setFinalReport] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [latestFeedback, setLatestFeedback] = useState<string | null>(null);
  const [refinementCount, setRefinementCount] = useState(0);
  const [isRefining, setIsRefining] = useState(false);

  const handleRun = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;

    setIsRunning(true);
    setFinalReport(null);
    setError(null);
    setLatestFeedback(null);
    setRefinementCount(0);
    setIsRefining(false);
    // Reset to the original 4 steps (clears any leftover refine steps)
    setSteps(initialSteps.map((s) => ({ ...s, status: "waiting" as StepStatus, result: undefined })));

    try {
      const url = `/api/research?topic=${encodeURIComponent(topic)}`;
      const response = await fetch(url);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Network response was not ok");
      }

      if (!response.body) {
        throw new Error("No response body");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.substring(6));

              if (data.step === "error") {
                setError(data.message);
                setIsRunning(false);
                return;
              }

              if (data.step === "complete") {
                setIsRunning(false);
                return;
              }

              // Update state outside setSteps to avoid nested setState
              if (data.status === "done" && data.step === "writer") {
                setFinalReport(data.result);
              }
              if (data.status === "done" && data.step === "critic") {
                setLatestFeedback(data.result);
              }

              setSteps((prev) =>
                prev.map((s) => {
                  if (s.id === data.step) {
                    return { ...s, status: data.status as StepStatus, result: data.result };
                  }
                  return s;
                })
              );
            } catch (e) {
              console.error("Failed to parse JSON chunk:", line, e);
            }
          }
        }
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
      setIsRunning(false);
    }
  };

  const handleRefine = async () => {
    if (!finalReport || !latestFeedback) return;

    const newVersion = refinementCount + 1;
    // Unique ids so each iteration gets its own steps (no duplicate keys)
    const refineStepId = `refine-${newVersion}`;
    const criticStepId = `critic-refine-${newVersion}`;

    setIsRefining(true);
    setError(null);

    // Append new uniquely-identified steps (previous steps stay intact)
    setSteps((prev) => [
      ...prev,
      { id: refineStepId, label: `Report Refinement v${newVersion + 1}`, status: "waiting" as StepStatus },
      { id: criticStepId, label: `Critical Review v${newVersion + 1}`, status: "waiting" as StepStatus },
    ]);

    try {
      const response = await fetch("/api/research/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report: finalReport, feedback: latestFeedback }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Refine request failed");
      }

      if (!response.body) {
        throw new Error("No response body");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      // Map backend SSE step names → our unique step ids
      const stepMap: Record<string, string> = {
        refine: refineStepId,
        critic: criticStepId,
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.substring(6));

              if (data.step === "error") {
                setError(data.message);
                setIsRefining(false);
                return;
              }

              if (data.step === "complete") {
                setRefinementCount(newVersion);
                setIsRefining(false);
                return;
              }

              // Map backend step name to our unique step id
              const mappedId = stepMap[data.step] || data.step;

              if (data.status === "done" && data.step === "refine") {
                setFinalReport(data.result);
              }
              if (data.status === "done" && data.step === "critic") {
                setLatestFeedback(data.result);
              }

              setSteps((prev) =>
                prev.map((s) => {
                  if (s.id === mappedId) {
                    return { ...s, status: data.status as StepStatus, result: data.result };
                  }
                  return s;
                })
              );
            } catch (e) {
              console.error("Failed to parse JSON chunk:", line, e);
            }
          }
        }
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred during refinement.");
      setIsRefining(false);
    }
  };

  const handleDownload = () => {
    if (!finalReport) return;
    const blob = new Blob([finalReport], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Synthesia_Report_${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[var(--background)] transition-colors duration-300">

      {/* Navigation */}
      <nav className="glass-nav sticky top-0 z-50 border-b border-[var(--border)] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-5 h-5 rounded-md bg-[var(--accent)] flex items-center justify-center">
            <span className="text-white text-xs font-bold">S</span>
          </div>
          <span className="font-[family-name:var(--font-serif)] font-semibold text-lg tracking-tight">Synthesia</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-[var(--border)] hover:bg-[var(--muted)] transition-all duration-200 hover:scale-105"
            aria-label="Toggle theme"
          >
            {isDark ? (
              <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-[var(--muted-foreground)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
          <span className="hidden sm:inline text-xs text-[var(--muted-foreground)] tracking-wide">
            by Shantanu Tiwari
          </span>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-16">

        {/* Hero */}
        <div className="mb-14">
          <h1 className="font-[family-name:var(--font-serif)] text-4xl md:text-5xl font-semibold tracking-tight mb-4 text-balance">
            Autonomous Research Synthesis.
          </h1>
          <p className="text-[var(--muted-foreground)] text-lg max-w-2xl text-balance leading-relaxed">
            Deploy a multi-agent system to aggregate, analyze, and synthesize complex information into structured reports.
          </p>
        </div>

        {/* Input */}
        <form onSubmit={handleRun} className="mb-16 relative">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              disabled={isRunning}
              placeholder="Enter a research topic (e.g., Quantum Error Correction)"
              className="flex-1 bg-[var(--muted)] border border-[var(--border)] rounded-lg px-4 py-3.5 text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all duration-200 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={isRunning || !topic.trim()}
              className="bg-[var(--foreground)] text-[var(--background)] px-6 py-3.5 rounded-lg font-medium hover:opacity-90 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-w-[150px]"
            >
              {isRunning ? (
                <>
                  <span className="spinner"></span>
                  Processing
                </>
              ) : (
                "Initialize Run"
              )}
            </button>
          </div>
          {error && (
            <p className="text-red-500 text-sm mt-3 font-medium">{error}</p>
          )}
        </form>

        {/* Pipeline */}
        {(isRunning || steps.some(s => s.status !== "waiting")) && (
          <div className="mb-16 glass-card rounded-xl overflow-hidden animate-fade-in-up">
            <div className="px-6 py-3.5 border-b border-[var(--glass-border)]">
              <h2 className="text-xs font-semibold tracking-widest uppercase text-[var(--muted-foreground)]">Pipeline Status</h2>
            </div>
            <div className="p-6">
              <div className="space-y-5">
                {steps.map((step, idx) => (
                  <div key={step.id} className="flex items-start gap-4">
                    <div className="mt-0.5 flex-shrink-0">
                      {step.status === "waiting" && <div className="w-5 h-5 rounded-full border-2 border-[var(--border)] transition-colors" />}
                      {step.status === "running" && <div className="spinner !w-5 !h-5 !border-2" />}
                      {step.status === "done" && (
                        <div className="w-5 h-5 rounded-full bg-[var(--accent)] flex items-center justify-center transition-all duration-300">
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className={`font-medium text-sm ${step.status === "waiting" ? "text-[var(--muted-foreground)]" : "text-[var(--foreground)]"} transition-colors`}>
                        Step {idx + 1} — {step.label}
                      </h3>
                      {step.status === "running" && <p className="text-xs text-[var(--muted-foreground)] mt-1 animate-pulse">Executing agent protocol...</p>}

                      {step.status === "done" && step.result && (
                        <div className="mt-2.5 p-3.5 bg-[var(--card-bg)] border border-[var(--border)] rounded-lg text-sm text-[var(--muted-foreground)] max-h-60 overflow-y-auto overflow-x-hidden whitespace-pre-wrap">
                          <span className="font-semibold block mb-1.5 text-[var(--foreground)] text-xs uppercase tracking-wide">Output</span>
                          {step.id === "writer" || step.id.startsWith("refine") ? (
                            "Report drafted successfully. See below for full output."
                          ) : (
                            step.result
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Report */}
        {finalReport && (
          <div className="glass-card rounded-xl overflow-hidden animate-fade-in-up">
            <div className="px-6 py-4 border-b border-[var(--glass-border)] flex justify-between items-center">
              <div className="flex items-center gap-3">
                <h2 className="text-xs font-semibold tracking-widest uppercase text-[var(--foreground)]">Synthesized Report</h2>
                {refinementCount > 0 && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[var(--accent)] text-white">
                    v{refinementCount + 1}
                  </span>
                )}
              </div>
              <button
                onClick={handleDownload}
                className="text-xs font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors px-3 py-1.5 rounded-md hover:bg-[var(--muted)]"
              >
                ↓ Download .md
              </button>
            </div>
            <div className="p-8 prose prose-neutral max-w-none prose-p:text-[var(--foreground)] prose-headings:text-[var(--foreground)] prose-li:text-[var(--foreground)] prose-strong:text-[var(--foreground)]">
              <ReactMarkdown>{finalReport}</ReactMarkdown>
            </div>
          </div>
        )}

        {/* Refine Button */}
        {finalReport && latestFeedback && !isRunning && !isRefining && (
          <div className="mt-8 flex justify-center animate-fade-in-up">
            <button
              onClick={handleRefine}
              className="group flex items-center gap-2.5 px-6 py-3 rounded-xl glass-card text-[var(--foreground)] font-medium hover:scale-[1.02] transition-all duration-200 cursor-pointer"
            >
              <svg className="w-4 h-4 text-[var(--accent)] transition-transform group-hover:rotate-180 duration-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refine Report {refinementCount > 0 ? `(v${refinementCount + 1} → v${refinementCount + 2})` : ""}
            </button>
          </div>
        )}

        {isRefining && (
          <div className="mt-8 flex justify-center animate-fade-in-up">
            <div className="flex items-center gap-2.5 px-6 py-3 rounded-xl glass-card text-[var(--muted-foreground)] font-medium">
              <span className="spinner"></span>
              Refining report...
            </div>
          </div>
        )}

      </main>
    </div>
  );
}