"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";

type StepStatus = "waiting" | "running" | "done" | "error";

interface PipelineStep {
  id: string;
  label: string;
  status: StepStatus;
  result?: string;
}

export default function Home() {
  const [topic, setTopic] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [steps, setSteps] = useState<PipelineStep[]>([
    { id: "search", label: "Data Aggregation", status: "waiting" },
    { id: "reader", label: "Contextual Analysis", status: "waiting" },
    { id: "writer", label: "Report Synthesis", status: "waiting" },
    { id: "critic", label: "Critical Review", status: "waiting" },
  ]);
  const [finalReport, setFinalReport] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRun = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;

    setIsRunning(true);
    setFinalReport(null);
    setError(null);
    setSteps((s) => s.map((step) => ({ ...step, status: "waiting", result: undefined })));

    try {
      // In a production environment, this points to NEXT_PUBLIC_API_URL or relative path.
      // We assume Next.js API routes or direct FastAPI connection.
      const url = process.env.NEXT_PUBLIC_API_URL 
        ? `${process.env.NEXT_PUBLIC_API_URL}/api/research/stream?topic=${encodeURIComponent(topic)}`
        : `http://localhost:8000/api/research/stream?topic=${encodeURIComponent(topic)}`;

      const response = await fetch(url);
      
      if (!response.body) {
        throw new Error("No response body");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n\n");
        
        for (const line of lines) {
          if (line.startsWith("data: ")) {
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

            setSteps((prev) => 
              prev.map((s) => {
                if (s.id === data.step) {
                  if (data.status === "done" && data.step === "writer") {
                    setFinalReport(data.result);
                  }
                  return { ...s, status: data.status as StepStatus, result: data.result };
                }
                return s;
              })
            );
          }
        }
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
      setIsRunning(false);
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
    <div className="min-h-screen bg-[var(--background)] selection:bg-neutral-200 dark:selection:bg-neutral-800">
      
      {/* Navigation / Header */}
      <nav className="border-b border-[var(--border)] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-[var(--foreground)] rounded-sm"></div>
          <span className="font-[family-name:var(--font-serif)] font-semibold text-lg tracking-tight">Synthesia</span>
        </div>
        <div className="text-sm text-[var(--muted-foreground)]">
          Authored by Shantanu Tiwari
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-16">
        
        {/* Hero Section */}
        <div className="mb-12">
          <h1 className="font-[family-name:var(--font-serif)] text-4xl md:text-5xl font-semibold tracking-tight mb-4 text-balance">
            Autonomous Research Synthesis.
          </h1>
          <p className="text-[var(--muted-foreground)] text-lg max-w-2xl text-balance">
            Deploy a multi-agent system to aggregate, analyze, and synthesize complex information into structured reports. Built for production scale.
          </p>
        </div>

        {/* Input Section */}
        <form onSubmit={handleRun} className="mb-16 relative">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              disabled={isRunning}
              placeholder="Enter a research topic (e.g., Quantum Error Correction)"
              className="flex-1 bg-[var(--muted)] border border-[var(--border)] rounded-md px-4 py-3 text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--foreground)] transition-all disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={isRunning || !topic.trim()}
              className="bg-[var(--foreground)] text-[var(--background)] px-6 py-3 rounded-md font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 min-w-[140px]"
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
            <p className="text-red-500 text-sm mt-3 font-medium">Error: {error}</p>
          )}
        </form>

        {/* Pipeline Progress */}
        {(isRunning || steps.some(s => s.status !== "waiting")) && (
          <div className="mb-16 border border-[var(--border)] rounded-lg overflow-hidden bg-[var(--background)] shadow-sm">
            <div className="bg-[var(--muted)] px-6 py-3 border-b border-[var(--border)]">
              <h2 className="text-sm font-semibold tracking-wide uppercase text-[var(--muted-foreground)]">Pipeline Status</h2>
            </div>
            <div className="p-6">
              <div className="space-y-6">
                {steps.map((step, idx) => (
                  <div key={step.id} className="flex items-start gap-4">
                    <div className="mt-1">
                      {step.status === "waiting" && <div className="w-5 h-5 rounded-full border-2 border-[var(--border)]" />}
                      {step.status === "running" && <div className="spinner !w-5 !h-5 !border-2" />}
                      {step.status === "done" && (
                        <div className="w-5 h-5 rounded-full bg-[var(--foreground)] flex items-center justify-center">
                          <svg className="w-3 h-3 text-[var(--background)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div>
                      <h3 className={`font-medium ${step.status === "waiting" ? "text-[var(--muted-foreground)]" : "text-[var(--foreground)]"}`}>
                        Step {idx + 1}: {step.label}
                      </h3>
                      {step.status === "running" && <p className="text-sm text-[var(--muted-foreground)] mt-1 animate-pulse">Executing agent protocol...</p>}
                      {step.status === "done" && step.id === "critic" && step.result && (
                         <div className="mt-3 p-4 bg-[var(--muted)] rounded-md text-sm text-[var(--muted-foreground)]">
                           <span className="font-semibold block mb-1">Critic Feedback:</span>
                           {step.result}
                         </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Final Report */}
        {finalReport && (
          <div className="border border-[var(--border)] rounded-lg overflow-hidden bg-[var(--background)] shadow-sm">
            <div className="bg-[var(--muted)] px-6 py-4 border-b border-[var(--border)] flex justify-between items-center">
              <h2 className="text-sm font-semibold tracking-wide uppercase text-[var(--foreground)]">Synthesized Report</h2>
              <button 
                onClick={handleDownload}
                className="text-sm font-medium hover:underline text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
              >
                Download .MD
              </button>
            </div>
            <div className="p-8 prose prose-neutral max-w-none prose-p:text-[var(--foreground)] prose-headings:text-[var(--foreground)]">
              <ReactMarkdown>{finalReport}</ReactMarkdown>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
