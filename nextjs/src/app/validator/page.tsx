"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import WalletConnectClient from "@/components/WalletConnectClient";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

type Vm = {
  id?: string;
  vmId?: string;
  name?: string;
  vmName?: string;
  publicIp?: string;
  ports?: { port: number; protocol: string }[];
  minerAddress?: string;
  walletAddress?: string;
  status?: string;
  [key: string]: any;
};

export default function ValidatorPage() {
  const backendBaseUrl = useMemo(
    () => process.env.NEXT_PUBLIC_BACKEND_BASE_URL || "http://localhost:8000",
    []
  );

  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState("");
  const [accountId, setAccountId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [topicId, setTopicId] = useState<string | null>(null);
  const [scores, setScores] = useState<{ walletId: string; score: number }[]>([]);
  const [loadingScores, setLoadingScores] = useState(false);
  const [selectedSubnet, setSelectedSubnet] = useState<string>("llm");
  const [vms, setVms] = useState<Vm[]>([]);
  const [loadingVms, setLoadingVms] = useState(false);

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

  useEffect(() => {
    if (!error) return;
    toast({
      title: "Action failed",
      description: (
        <div className="flex items-start gap-2"><AlertTriangle className="h-4 w-4 text-primary" /> <span>{error}</span></div>
      ) as any,
      className:
        "rounded-2xl border border-primary bg-background/80 backdrop-blur-sm ring-1 ring-primary/20 shadow-lg shadow-[#EBB800]/40 [box-shadow:inset_0_1px_0_rgba(255,255,255,0.04)]",
    });
  }, [error]);

  const fetchVms = useCallback(async () => {
    setLoadingVms(true);
    setError(null);
    try {
      const res = await fetch(`${backendBaseUrl}/vms`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to fetch VMs: ${res.status}`);
      const data = (await res.json()) as Vm[];
      setVms(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setVms([]);
    } finally {
      setLoadingVms(false);
    }
  }, [backendBaseUrl]);

  useEffect(() => {
    fetchVms();
  }, [fetchVms]);

  const activeVms = useMemo(() => {
    return vms.filter((vm) => {
      const hasWallet = Boolean(vm.minerAddress || vm.walletAddress);
      if (!hasWallet) return false;
      const s = String(vm.status || "").toLowerCase();
      if (!s) return true; // if backend doesn't provide status, treat as eligible when wallet present
      return s === "active" || s === "running";
    });
  }, [vms]);

  async function pollScores(tid: string, attempts = 12, delayMs = 1000) {
    setLoadingScores(true);
    try {
      for (let i = 0; i < attempts; i++) {
        try {
          const resp = await fetch(`/api/topic/messages?topicId=${encodeURIComponent(tid)}&limit=50&order=desc`, { cache: "no-store" });
          if (!resp.ok) throw new Error(`Topic messages error: ${resp.status}`);
          const body = await resp.json();
          const messages = body?.data?.messages || body?.messages || [];
          let found: { walletId: string; score: number }[] | null = null;
          for (const m of messages) {
            const text = typeof m?.message === "string" ? m.message : "";
            if (!text) continue;
            try {
              const obj = JSON.parse(text);
              const t = String(obj?.type || "").toLowerCase();
              if ((t === "scores" || t === "final_scores") && Array.isArray(obj?.scores)) {
                const arr = (obj.scores as any[]).map((s: any) => ({ walletId: String(s?.walletId || s?.wallet || ""), score: Number(s?.score || 0) }))
                  .filter((s: any) => s.walletId);
                if (arr.length > 0) {
                  found = arr;
                  break;
                }
              }
            } catch {}
          }
          if (found) {
            setScores(found);
            return;
          }
        } catch {}
        await new Promise((r) => setTimeout(r, delayMs));
      }
    } finally {
      setLoadingScores(false);
    }
  }

  async function onSubmit() {
    setLoading(true);
    setError(null);
    setScores([]);
    setTopicId(null);
    try {
      const summarizedVms = activeVms.map((vm) => {
        const id = vm.id || vm.vmId || "";
        const name = vm.name || vm.vmName || "";
        const publicIp = vm.publicIp || "";
        const apiUrl = publicIp ? `http://${publicIp}:3000/api/chat` : "";
        const wallet = vm.minerAddress || vm.walletAddress || "";
        const status = vm.status || "";
        return { ...vm, id, vmId: id, name, vmName: name, publicIp, apiUrl, wallet, status };
      });

      const payload = {
        input: query,
        truth: answer,
        subnet: selectedSubnet,
        vms: summarizedVms,
        accountId: accountId || undefined,
      };

      const res = await fetch(`${backendBaseUrl}/validator`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Validator request failed: ${res.status} ${text}`);
      }
      const json = await res.json();
      const tid = (json && (json.topicId || json.topic_id)) || null;
      if (tid) {
        setTopicId(String(tid));
        pollScores(String(tid)).catch(() => undefined);
      }

      // Log this validator submission to on-chain topic with timestamp and wallet/account id
      try {
        const nowIso = new Date().toISOString();
        const topicMessage = {
          type: "validator_submit",
          timestamp: nowIso,
          accountId: accountId || null,
        };
        await fetch(`/api/topic/submit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topicId: "0.0.6917106", message: JSON.stringify(topicMessage) }),
        }).catch(() => undefined);
      } catch {}
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
        {/* Error is now shown via themed toast; no inline block */}

        <section className="rounded-2xl border p-4 bg-background/60 backdrop-blur-sm ring-1 ring-primary/10">
          <div className="font-medium mb-3">Select Subnet</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {subnets.length === 0 ? (
              <div className="text-sm text-muted-foreground">No subnets available</div>
            ) : (
              subnets.map(sn => (
                <button
                  key={sn.id}
                  className={`rounded border p-3 text-left transition-shadow ${selectedSubnet === sn.id ? 'ring-2 ring-primary' : ''} ${sn.id !== 'llm' ? 'opacity-50 cursor-not-allowed' : ''}`}
                  onClick={() => sn.id === 'llm' && setSelectedSubnet(sn.id)}
                  disabled={sn.id !== 'llm'}
                >
                  <div className="font-medium">{sn.title}</div>
                  <div className="text-xs text-muted-foreground">{sn.description}</div>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="rounded-2xl border p-4 bg-background/60 backdrop-blur-sm ring-1 ring-primary/10">
          <div className="font-medium mb-3">Available Miners</div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left">
                <tr className="border-b">
                  <th className="py-2 pr-3">ID</th>
                  <th className="py-2 pr-3">Name</th>
                  <th className="py-2 pr-3">Public IP</th>
                  <th className="py-2 pr-3">API Link</th>
                  <th className="py-2 pr-3">Wallet</th>
                </tr>
              </thead>
              <tbody>
                {loadingVms ? (
                  <tr><td className="py-3" colSpan={5}>Loading...</td></tr>
                ) : activeVms.length === 0 ? (
                  <tr><td className="py-3" colSpan={5}>No VMs found</td></tr>
                ) : (
                  activeVms.map((vm) => {
                    const id = vm.id || vm.vmId || "";
                    const name = vm.name || vm.vmName || "";
                    const publicIp = vm.publicIp || "";
                    const apiUrl = publicIp ? `http://${publicIp}:3000/api/chat` : "";
                    const wallet = vm.minerAddress || vm.walletAddress || "";
                    return (
                      <tr key={id} className="border-b">
                        <td className="py-2 pr-3 font-mono text-xs">{id}</td>
                        <td className="py-2 pr-3">{name || "—"}</td>
                        <td className="py-2 pr-3">{publicIp || "—"}</td>
                        <td className="py-2 pr-3">
                          {apiUrl ? (
                            <a className="text-primary underline" href={apiUrl} target="_blank" rel="noreferrer">{apiUrl}</a>
                          ) : "—"}
                        </td>
                        <td className="py-2 pr-3">{wallet || "—"}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border p-4 bg-background/60 backdrop-blur-sm ring-1 ring-primary/10">
          <div className="font-medium mb-3">Run a Query</div>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Validator Account ID</label>
              <input
                className="w-full rounded border px-2 py-1 text-sm"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                placeholder="e.g. 0.0.12345"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Query</label>
              <textarea
                className="min-h-[120px] w-full rounded border px-2 py-1 text-sm"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Enter your query..."
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Answer</label>
              <textarea
                className="min-h-[120px] w-full rounded border px-2 py-1 text-sm"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Enter the expected answer (truth)..."
              />
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={onSubmit} disabled={loading || !query}>
                {loading ? "Submitting..." : "Send to validator"}
              </Button>
            </div>
          </div>
        </section>

        {(loadingScores || scores.length > 0) && (
          <section className="rounded-2xl border p-4 bg-background/60 backdrop-blur-sm ring-1 ring-primary/10">
            <div className="font-medium mb-3">Scores</div>
            {loadingScores && scores.length === 0 ? (
              <div className="py-3 text-sm text-muted-foreground">Waiting for scores...</div>
            ) : scores.length === 0 ? (
              <div className="py-3 text-sm text-muted-foreground">No scores found</div>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left">
                    <tr className="border-b">
                      <th className="py-2 pr-3">Wallet</th>
                      <th className="py-2 pr-3">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scores.map((s) => (
                      <tr key={s.walletId} className="border-b">
                        <td className="py-2 pr-3 font-mono text-xs">{s.walletId}</td>
                        <td className="py-2 pr-3">{s.score}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}