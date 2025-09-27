"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import WalletConnectPanel from "@/components/WalletConnect";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ensureWalletConnector, getPairedAccountId } from "@/lib/walletconnect";

 type Vm = {
  id?: string;
  vmId?: string;
  name?: string;
  vmName?: string;
  publicIp?: string;
  ports?: { port: number; protocol: string }[];
  [key: string]: any;
};

export default function MinerPage() {
  const backendBaseUrl = useMemo(
    () => process.env.NEXT_PUBLIC_BACKEND_BASE_URL || "http://localhost:8000",
    []
  );

  const [accountId, setAccountId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vms, setVms] = useState<Vm[]>([]);
  const [dockerFile, setDockerFile] = useState<File | null>(null);
  const [dockerPort, setDockerPort] = useState<number>(3000);
  const [creating, setCreating] = useState(false);
  const [deploying, setDeploying] = useState(false);

  function loadMyVmIdsForAccount(acct: string | null): string[] {
    if (!acct) return [];
    try {
      const key = `myMinerVmIds:${acct}`;
      const raw = localStorage.getItem(key);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
    } catch {
      return [];
    }
  }

  function saveMyVmIdForAccount(acct: string, id: string) {
    try {
      const key = `myMinerVmIds:${acct}`;
      const existing = loadMyVmIdsForAccount(acct);
      const next = Array.from(new Set([...existing, id]));
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // ignore
    }
  }

  const myVms = useMemo(() => {
    const ids = loadMyVmIdsForAccount(accountId);
    const byId = new Set(ids);
    const needle = String(accountId || "").toLowerCase();
    return vms.filter((vm) => {
      const id = vm.id || vm.vmId || "";
      if (byId.has(id)) return true;
      const name = (vm.name || vm.vmName || "").toLowerCase();
      return needle && name.includes(needle);
    });
  }, [vms, accountId]);

  const fetchVms = useCallback(async () => {
    setLoading(true);
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
      setLoading(false);
    }
  }, [backendBaseUrl]);

  async function ensureAccount() {
    setError(null);
    try {
      await ensureWalletConnector("warn");
      const acct = await getPairedAccountId();
      setAccountId(acct);
    } catch (e) {
      setAccountId(null);
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function extractIdsFromDeploymentResult(result: any): string[] {
    const ids: string[] = [];
    const visit = (val: any) => {
      if (!val || typeof val !== "object") return;
      if (Array.isArray(val)) {
        val.forEach(visit);
        return;
      }
      for (const [k, v] of Object.entries(val)) {
        const key = String(k).toLowerCase();
        if ((key === "id" || key === "vmid") && typeof v === "string") {
          ids.push(v);
        } else if (Array.isArray(v)) {
          v.forEach(visit);
        } else if (v && typeof v === "object") {
          visit(v);
        }
      }
    };
    visit(result);
    return Array.from(new Set(ids));
  }

  async function createNewVmForAccount(): Promise<string | null> {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch(`${backendBaseUrl}/deploy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: accountId || undefined }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Create VM failed: ${res.status} ${text}`);
      }
      const json = await res.json().catch(() => null as any);
      const ids = extractIdsFromDeploymentResult(json);
      if (ids.length > 0) return ids[0];
      for (let i = 0; i < 9; i += 1) {
        await new Promise((r) => setTimeout(r, 5000));
        await fetchVms();
        const knownIds = new Set(vms.map((vm) => vm.id || vm.vmId).filter(Boolean) as string[]);
        const freshListRes = await fetch(`${backendBaseUrl}/vms`, { cache: "no-store" });
        const fresh = (await freshListRes.json()) as Vm[];
        for (const vm of fresh) {
          const id = (vm.id || vm.vmId) as string | undefined;
          if (id && !knownIds.has(id)) return id;
        }
      }
      return null;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return null;
    } finally {
      setCreating(false);
    }
  }

  async function deployDockerToVm(vmId: string, file: File) {
    setDeploying(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file, file.name);
      form.append("remote_dir", "ubuntu-docker");
      form.append("port", String(dockerPort));
      let lastErr: string | null = null;
      for (let i = 0; i < 6; i += 1) {
        const res = await fetch(`${backendBaseUrl}/vms/${encodeURIComponent(vmId)}/docker/local`, {
          method: "POST",
          body: form,
        });
        if (res.ok) {
          await res.json().catch(() => null);
          lastErr = null;
          break;
        }
        const text = await res.text().catch(() => "");
        lastErr = `Docker deploy failed: ${res.status} ${text}`;
        await new Promise((r) => setTimeout(r, 5000));
      }
      if (lastErr) throw new Error(lastErr);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setDeploying(false);
    }
  }

  async function onCreateAndDeploy() {
    if (!dockerFile) {
      setError("Please choose a Dockerfile first");
      return;
    }
    const vmId = await createNewVmForAccount();
    if (!vmId) return;
    if (accountId) saveMyVmIdForAccount(accountId, vmId);
    await deployDockerToVm(vmId, dockerFile);
    await fetchVms();
  }

  useEffect(() => {
    ensureAccount();
  }, []);

  useEffect(() => {
    fetchVms();
  }, [fetchVms]);

  return (
    <div className="min-h-screen w-full px-4 py-6 sm:px-8 sm:py-8">
      <header className="mx-auto w-full max-w-4xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-lg font-semibold">My Miner</div>
            <Badge variant="secondary" className="text-xs">Account: {accountId ?? "—"}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <WalletConnectPanel variant="compact" />
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
          <div className="font-medium mb-3">Your Miner Instances</div>
          <div className="text-xs text-gray-600 mb-2">Create a VM and deploy your Dockerfile using the form below. Only your instances are shown.</div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left">
                <tr className="border-b">
                  <th className="py-2 pr-3">ID</th>
                  <th className="py-2 pr-3">Name</th>
                  <th className="py-2 pr-3">Public IP</th>
                  <th className="py-2 pr-3">API Endpoint</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td className="py-3" colSpan={4}>Loading...</td></tr>
                ) : myVms.length === 0 ? (
                  <tr><td className="py-3" colSpan={4}>No VMs found for your account</td></tr>
                ) : (
                  myVms.map((vm) => {
                    const id = vm.id || vm.vmId || "";
                    const name = vm.name || vm.vmName || "";
                    const publicIp = vm.publicIp || "";
                    const apiUrl = publicIp ? `http://${publicIp}:3000` : "";
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
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded border p-4">
          <div className="font-medium">Create & Deploy</div>
          <div className="mt-3 flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-600">Dockerfile</label>
              <input
                type="file"
                accept=".Dockerfile, Dockerfile, text/*, application/octet-stream"
                onChange={(e) => setDockerFile(e.target.files?.[0] || null)}
                disabled={creating || deploying}
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-600" htmlFor="docker-port">Expose Port</label>
              <input
                id="docker-port"
                type="number"
                className="w-24 rounded border px-2 py-1 text-sm"
                value={dockerPort}
                onChange={(e) => setDockerPort(Number(e.target.value) || 3000)}
                disabled={creating || deploying}
              />
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={onCreateAndDeploy} disabled={!dockerFile || creating || deploying}>
                {creating ? "Creating VM..." : deploying ? "Deploying..." : "Create & Deploy"}
              </Button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
} 