"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import WalletConnectPanel from "@/components/WalletConnect";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  const [dockerUrl, setDockerUrl] = useState("");
  const [deployMode, setDeployMode] = useState<"upload" | "url">("upload");
  const [dockerPort, setDockerPort] = useState<number>(3000);
  const [creating, setCreating] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [allocating, setAllocating] = useState(false);
  const [instanceName, setInstanceName] = useState("");
  const [stoppingId, setStoppingId] = useState<string>("");
  const [terminatingId, setTerminatingId] = useState<string>("");
  const instanceRegistryContractId = useMemo(
    () => process.env.NEXT_PUBLIC_INSTANCE_REGISTRY_CONTRACT_ID || "",
    []
  );

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

  function removeMyVmIdForAccount(acct: string, id: string) {
    try {
      const key = `myMinerVmIds:${acct}`;
      const existing = loadMyVmIdsForAccount(acct);
      const next = existing.filter((x) => x !== id);
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

  async function allocateVmForMiner(name: string): Promise<string | null> {
    if (!accountId) {
      setError("Please connect your wallet first");
      return null;
    }
    setAllocating(true);
    setError(null);
    try {
      const res = await fetch(`${backendBaseUrl}/allocate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minerAddress: accountId, instanceName: name || "default-vm" }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Allocate VM failed: ${res.status} ${text}`);
      }
      const rec = await res.json();
      const id = (rec?.vmId || rec?.id || "") as string;
      if (!id) return null;
      saveMyVmIdForAccount(accountId, id);
      await fetchVms();
      return id;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return null;
    } finally {
      setAllocating(false);
    }
  }

  async function deployDockerToVm(vmId: string, fileOrUrl: File | string) {
    setDeploying(true);
    setError(null);
    try {
      if (typeof fileOrUrl === "string") {
        // URL-based deploy on VM
        const res = await fetch(`${backendBaseUrl}/vms/${encodeURIComponent(vmId)}/docker/url`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dockerfile_url: fileOrUrl, workdir: "ubuntu-docker" }),
        });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(`Docker URL deploy failed: ${res.status} ${text}`);
        }
        await res.json().catch(() => null);
      } else {
        // Local upload
        const form = new FormData();
        form.append("file", fileOrUrl, fileOrUrl.name);
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
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setDeploying(false);
    }
  }

  async function registerInstanceOnChain(vmId: string) {
    try {
      if (!accountId) throw new Error("Wallet not connected");
      if (!instanceRegistryContractId) throw new Error("Missing NEXT_PUBLIC_INSTANCE_REGISTRY_CONTRACT_ID");
      // Fetch fresh VM list to get public IP
      const res = await fetch(`${backendBaseUrl}/vms`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to fetch VMs: ${res.status}`);
      const fresh = (await res.json()) as Array<Record<string, any>>;
      const vm = fresh.find(v => (v.id || v.vmId) === vmId) || {} as any;
      const publicIp = vm.publicIp as string | undefined;
      if (!publicIp) throw new Error("VM public IP not found yet");
      const url = `http://${publicIp}:${dockerPort}`;
      const body = {
        contractId: instanceRegistryContractId,
        subnetId: 1,
        minerAddress: accountId,
        state: true,
        url,
      };
      const api = "/api/instance-registry/register-instance";
      const reg = await fetch(api, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!reg.ok) {
        const txt = await reg.text().catch(() => "");
        throw new Error(`Register instance failed: ${reg.status} ${txt}`);
      }
      await reg.json().catch(() => null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function stopMiner(vmId: string) {
    setStoppingId(vmId);
    setError(null);
    try {
      const res = await fetch(`${backendBaseUrl}/vms/${encodeURIComponent(vmId)}/docker/stop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Stop miner failed: ${res.status} ${text}`);
      }
      await res.json().catch(() => null);
      if (accountId) removeMyVmIdForAccount(accountId, vmId);
      await fetchVms();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setStoppingId("");
    }
  }

  async function terminateVm(vmId: string) {
    if (!vmId) return;
    setError(null);
    setTerminatingId(vmId);
    try {
      const res = await fetch(`${backendBaseUrl}/vms`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vmIds: [vmId] }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Terminate VM failed: ${res.status} ${text}`);
      }
      if (accountId) removeMyVmIdForAccount(accountId, vmId);
      await fetchVms();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setTerminatingId("");
    }
  }

  async function onCreateAndDeploy() {
    if ((deployMode === "upload" && !dockerFile) || (deployMode === "url" && !dockerUrl.trim())) {
      setError("Provide a Dockerfile or URL");
      return;
    }
    const vmId = await createNewVmForAccount();
    if (!vmId) return;
    if (accountId) saveMyVmIdForAccount(accountId, vmId);
    await deployDockerToVm(vmId, deployMode === "url" ? dockerUrl.trim() : (dockerFile as File));
    await fetchVms();
    await registerInstanceOnChain(vmId);
  }

  async function onAllocateAndDeploy() {
    if ((deployMode === "upload" && !dockerFile) || (deployMode === "url" && !dockerUrl.trim())) {
      setError("Provide a Dockerfile or URL");
      return;
    }
    const vmId = await allocateVmForMiner(instanceName.trim());
    if (!vmId) return;
    await deployDockerToVm(vmId, deployMode === "url" ? dockerUrl.trim() : (dockerFile as File));
    await fetchVms();
    await registerInstanceOnChain(vmId);
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
                  <th className="py-2 pr-3">Actions</th>
                  <th className="py-2 pr-3">Actions</th>
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
                    const apiUrl = publicIp ? `http://${publicIp}:3000/api/chat` : "";
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
                        <td className="py-2 pr-3">
                          <div className="flex items-center gap-2">
                            <Button size="sm" onClick={() => id && stopMiner(id)} disabled={!id || stoppingId === id}>
                              {stoppingId === id ? "Stopping..." : "Stop"}
                            </Button>
                            <Button size="sm" onClick={() => id && terminateVm(id)} disabled={!id || terminatingId === id}>
                              {terminatingId === id ? "Terminating..." : "Terminate"}
                            </Button>
                          </div>
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
              <label className="text-xs text-gray-600">Instance Name</label>
              <input
                type="text"
                placeholder="e.g. miner-alpha"
                className="w-full rounded border px-2 py-1 text-sm"
                value={instanceName}
                onChange={(e) => setInstanceName(e.target.value)}
                disabled={creating || deploying || allocating}
              />
            </div>
            <Tabs value={deployMode} onValueChange={(v: any) => setDeployMode(v as any)}>
              <TabsList>
                <TabsTrigger value="upload">Upload</TabsTrigger>
                <TabsTrigger value="url">URL</TabsTrigger>
              </TabsList>
              <div className="mt-3">
                <TabsContent value="upload">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-gray-600">Dockerfile</label>
                    <input
                      type="file"
                      accept=".Dockerfile, Dockerfile, text/*, application/octet-stream"
                      onChange={(e) => setDockerFile(e.target.files?.[0] || null)}
                      disabled={creating || deploying || allocating}
                    />
                  </div>
                </TabsContent>
                <TabsContent value="url">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-gray-600">Dockerfile URL</label>
                    <Input
                      type="url"
                      placeholder="https://raw.githubusercontent.com/.../Dockerfile"
                      value={dockerUrl}
                      onChange={(e) => setDockerUrl(e.target.value)}
                      disabled={creating || deploying || allocating}
                    />
                  </div>
                </TabsContent>
              </div>
            </Tabs>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-600" htmlFor="docker-port">Expose Port</label>
              <input
                id="docker-port"
                type="number"
                className="w-24 rounded border px-2 py-1 text-sm"
                value={dockerPort}
                onChange={(e) => setDockerPort(Number(e.target.value) || 3000)}
                disabled={creating || deploying || allocating}
              />
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={onCreateAndDeploy} disabled={!dockerFile || creating || deploying}>
                {creating ? "Creating VM..." : deploying ? "Deploying..." : "Create & Deploy"}
              </Button>
              <Button onClick={onAllocateAndDeploy} disabled={!dockerFile || allocating || deploying || !accountId}>
                {allocating ? "Allocating..." : deploying ? "Deploying..." : "Allocate & Deploy"}
              </Button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
} 