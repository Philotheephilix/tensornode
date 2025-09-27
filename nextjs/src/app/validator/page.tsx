"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import WalletConnectClient from "@/components/WalletConnectClient";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

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
  const [result, setResult] = useState<string | null>(null);
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

  async function onSubmit() {
    setLoading(true);
    setError(null);
    setResult(null);
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

      setResult(JSON.stringify({ validatorResponse: json, payloadSent: payload }, null, 2));

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
                  className={`rounded border p-3 text-left transition-shadow ${selectedSubnet === sn.id ? 'ring-2 ring-blue-500' : ''} ${sn.id !== 'llm' ? 'opacity-50 cursor-not-allowed' : ''}`}
                  onClick={() => sn.id === 'llm' && setSelectedSubnet(sn.id)}
                  disabled={sn.id !== 'llm'}
                >
                  <div className="font-medium">{sn.title}</div>
                  <div className="text-xs text-gray-600">{sn.description}</div>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="rounded border p-4">
          <div className="font-medium mb-3">Available VMs</div>
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
                            <a className="text-blue-600 underline" href={apiUrl} target="_blank" rel="noreferrer">{apiUrl}</a>
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

        <section className="rounded border p-4">
          <div className="font-medium mb-3">Inputs</div>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-600">Validator Account ID</label>
              <input
                className="w-full rounded border px-3 py-2 text-sm"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                placeholder="e.g. 0.0.12345"
              />
            </div>
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
              <label className="text-xs text-gray-600">Answer</label>
              <textarea
                className="min-h-[120px] w-full rounded border px-3 py-2 text-sm"
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