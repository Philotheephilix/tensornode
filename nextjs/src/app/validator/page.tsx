"use client";

import { useMemo, useState } from "react";
import WalletConnectClient from "@/components/WalletConnectClient";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

export default function ValidatorPage() {
  const [query, setQuery] = useState("");
  const [truth, setTruth] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [selectedSubnet, setSelectedSubnet] = useState<string>("");

  const subnets = useMemo(() => {
    return [
      { id: "llm", title: "LLM", description: "General-purpose language model" },
      { id: "translation", title: "Translation", description: "Text translation services" },
      { id: "stt", title: "Speech-to-Text (STT)", description: "Transcribe speech audio" },
      { id: "tts", title: "Text-to-Speech (TTS)", description: "Synthesize natural speech" },
      { id: "embeddings", title: "Embeddings", description: "Vector embeddings generation" },
      { id: "vision", title: "Vision", description: "Image understanding and OCR" },
    ];
  }, []);

  async function onSubmit() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: query, messages: [] }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Query failed: ${res.status} ${text}`);
      }
      const json = await res.json();
      const output = typeof json?.result === "string" ? json.result : JSON.stringify(json);
      setResult(output);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen w-full px-4 py-6 sm:px-8 sm:py-8">
      <header className="mx-auto w-full max-w-4xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-lg font-semibold">Validator</div>
            <Badge variant="secondary" className="text-xs">WC Connected</Badge>
          </div>
          <div className="flex items-center gap-2">
            <WalletConnectClient />
          </div>
        </div>
        <Separator className="mt-4" />
      </header>

      <main className="mx-auto mt-6 w-full max-w-4xl flex flex-col gap-6">
        {error && (
          <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="rounded border p-4">
          <div className="font-medium mb-3">Select Subnet</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {subnets.length === 0 ? (
              <div className="text-sm text-gray-600">No subnets available</div>
            ) : (
              subnets.map(sn => (
                <button
                  key={sn.id}
                  className={`rounded border p-3 text-left transition-shadow ${selectedSubnet === sn.id ? 'ring-2 ring-blue-500' : ''}`}
                  onClick={() => setSelectedSubnet(sn.id)}
                >
                  <div className="font-medium">{sn.title}</div>
                  <div className="text-xs text-gray-600">{sn.description}</div>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="rounded border p-4">
          <div className="font-medium mb-3">Inputs</div>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-600">Query</label>
              <textarea
                className="min-h-[120px] w-full rounded border px-3 py-2 text-sm"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Enter your query..."
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-600">Truth</label>
              <textarea
                className="min-h-[120px] w-full rounded border px-3 py-2 text-sm"
                value={truth}
                onChange={(e) => setTruth(e.target.value)}
                placeholder="Enter the ground-truth or context..."
              />
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={onSubmit} disabled={loading || !query}>
                {loading ? "Querying..." : "Query miners"}
              </Button>
            </div>
          </div>
        </section>

        {result && (
          <section className="rounded border p-4">
            <div className="font-medium mb-3">Result</div>
            <pre className="whitespace-pre-wrap break-words text-sm">{result}</pre>
          </section>
        )}
      </main>
    </div>
  );
} 