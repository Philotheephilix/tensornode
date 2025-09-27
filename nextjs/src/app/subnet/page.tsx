"use client";

import { useEffect, useMemo, useState } from "react";
import WalletConnectClient from "@/components/WalletConnectClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vms, setVms] = useState<Vm[]>([]);
  const [selectedVmId, setSelectedVmId] = useState<string>("");
  const [dockerFile, setDockerFile] = useState<File | null>(null);
  const [dockerUrl, setDockerUrl] = useState("");
  const [deployMode, setDeployMode] = useState<"upload" | "url">("upload");
  const [dockerPort, setDockerPort] = useState<number>(3000);
  const [creating, setCreating] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [terminatingId, setTerminatingId] = useState<string>("");
  const [accountId, setAccountId] = useState<string | null>(null);
  const [instanceName, setInstanceName] = useState("");
  const [allocating, setAllocating] = useState(false);
  const instanceRegistryContractId = useMemo(
    () => process.env.NEXT_PUBLIC_INSTANCE_REGISTRY_CONTRACT_ID || "",
    []
  );
  const [selectedNode, setSelectedNode] = useState<string>("llm");
  const nodeTypes = [
    { key: "llm", title: "LLM", desc: "Large Language Model", available: true },
    { key: "translation", title: "Translation", desc: "Text Translation", available: false },
    { key: "sst", title: "SST", desc: "Speech-to-Speech", available: false },
    { key: "tts", title: "TTS", desc: "Text-to-Speech", available: false },
    { key: "vision", title: "Vision", desc: "Image/Video", available: false },
  ];

  const effectiveVmId = useMemo(() => {
    if (selectedVmId) return selectedVmId;
    const first = vms[0];
    return (first?.id || first?.vmId || "");
  }, [selectedVmId, vms]);

  async function fetchVms() {
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
  }

  async function onCreateVm() {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch(`${backendBaseUrl}/deploy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error(`Create VM failed: ${res.status}`);
      await fetchVms();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCreating(false);
    }
  }

  useEffect(() => {
    (async () => {
      try {
        await ensureWalletConnector("warn");
        const acct = await getPairedAccountId();
        setAccountId(acct);
      } catch {
        setAccountId(null);
      }
    })();
  }, []);

  async function onAllocate() {
    if (!accountId) {
      setError("Please connect your wallet first");
      return;
    }
    setAllocating(true);
    setError(null);
    try {
      const res = await fetch(`${backendBaseUrl}/allocate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minerAddress: accountId, instanceName: instanceName.trim() || "subnet-node" }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Allocate failed: ${res.status} ${text}`);
      }
      await res.json().catch(() => null);
      await fetchVms();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setAllocating(false);
    }
  }

  async function onUploadDockerfile() {
    if (!effectiveVmId) {
      setError("Please select a VM first");
      return;
    }
    if ((deployMode === "upload" && !dockerFile) || (deployMode === "url" && !dockerUrl.trim())) {
      setError("Provide a Dockerfile or URL");
      return;
    }
    setDeploying(true);
    setError(null);
    try {
      if (deployMode === "url") {
        const res = await fetch(`${backendBaseUrl}/vms/${encodeURIComponent(effectiveVmId)}/docker/url`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dockerfile_url: dockerUrl.trim(), workdir: "ubuntu-docker" }),
        });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(`Docker URL deploy failed: ${res.status} ${text}`);
        }
        await res.json().catch(() => null);
      } else if (dockerFile) {
        const form = new FormData();
        form.append("file", dockerFile, dockerFile.name);
        form.append("remote_dir", "ubuntu-docker");
        form.append("port", String(dockerPort));
        const res = await fetch(`${backendBaseUrl}/vms/${encodeURIComponent(effectiveVmId)}/docker/local`, {
          method: "POST",
          body: form,
        });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(`Docker deploy failed: ${res.status} ${text}`);
        }
        await res.json().catch(() => null);
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

  async function onOpenSshPort() {
    if (!effectiveVmId) {
      setError("Please select a VM first");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const current = vms.find(v => (v.id || v.vmId) === effectiveVmId);
      const currentPorts = Array.isArray(current?.ports) ? current!.ports : [];
      const ensure22 = currentPorts.some(p => p.port === 22) ? currentPorts : [...currentPorts, { port: 22, protocol: "tcp" }];
      const body = { updates: [{ id: effectiveVmId, openPorts: ensure22 }] };
      const res = await fetch(`${backendBaseUrl}/vms`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Failed to update ports: ${res.status}`);
      await fetchVms();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function onStopMiner() {
    if (!effectiveVmId) {
      setError("Please select a VM first");
      return;
    }
    setStopping(true);
    setError(null);
    try {
      const res = await fetch(`${backendBaseUrl}/vms/${encodeURIComponent(effectiveVmId)}/docker/stop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Stop miner failed: ${res.status} ${text}`);
      }
      await res.json().catch(() => null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setStopping(false);
    }
  }

  async function onTerminateVm(vmId: string) {
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
      await fetchVms();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setTerminatingId("");
    }
  }

  useEffect(() => {
    fetchVms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backendBaseUrl]);

  return (
    <div className="min-h-screen w-full px-4 py-6 sm:px-8 sm:py-8">
      <header className="mx-auto w-full max-w-4xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-lg font-semibold">Subnet Node Manager</div>
            <Badge variant="secondary" className="text-xs">VMs: {vms.length}</Badge>
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
          <div className="font-medium mb-3">Choose Your Node Type</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {nodeTypes.map((nt) => {
              const disabled = !nt.available;
              const isActive = selectedNode === nt.key;
              return (
                <button
                  key={nt.key}
                  type="button"
                  onClick={() => !disabled && setSelectedNode(nt.key)}
                  className="text-left"
                  disabled={disabled}
                  aria-disabled={disabled}
                >
                  <Card className={`${disabled ? "opacity-50 grayscale cursor-not-allowed" : "cursor-pointer"} ${isActive ? "ring-2 ring-primary" : ""}`}>
                    <CardHeader>
                      <CardTitle>{nt.title}</CardTitle>
                      <CardDescription>{nt.desc}</CardDescription>
                    </CardHeader>
                  </Card>
                </button>
              );
            })}
          </div>
        </section>

        {selectedNode === "llm" ? (
          <>
        <section className="rounded border p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="font-medium">Connected Miners</div>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={fetchVms} disabled={loading}>Refresh</Button>
              <Button size="sm" onClick={onOpenSshPort} disabled={loading || !effectiveVmId}>Open SSH (22)</Button>
              <Button size="sm" onClick={onCreateVm} disabled={creating}>{creating ? "Creating..." : "Create Miner Instance (VM)"}</Button>
            </div>
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left">
                <tr className="border-b">
                  <th className="py-2 pr-3">Select</th>
                  <th className="py-2 pr-3">ID</th>
                  <th className="py-2 pr-3">Name</th>
                  <th className="py-2 pr-3">Public IP</th>
                  <th className="py-2 pr-3">API Endpoint</th>
                  <th className="py-2 pr-3">Open Ports</th>
                  <th className="py-2 pr-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td className="py-3" colSpan={7}>Loading...</td></tr>
                ) : vms.length === 0 ? (
                  <tr><td className="py-3" colSpan={7}>No VMs found</td></tr>
                ) : (
                  vms.map((vm) => {
                    const id = vm.id || vm.vmId || "";
                    const name = vm.name || vm.vmName || "";
                    const publicIp = vm.publicIp || "";
                    const apiUrl = publicIp ? `http://${publicIp}:3000` : "";
                    const ports = (vm.ports || []).map(p => `${p.port}/${p.protocol}`).join(", ");
                    const isTerminating = terminatingId === id;
                    return (
                      <tr key={id} className="border-b">
                        <td className="py-2 pr-3">
                          <input
                            type="radio"
                            name="selectedVm"
                            value={id}
                            checked={effectiveVmId === id}
                            onChange={() => setSelectedVmId(id)}
                          />
                        </td>
                        <td className="py-2 pr-3 font-mono text-xs">{id}</td>
                        <td className="py-2 pr-3">{name || "—"}</td>
                        <td className="py-2 pr-3">{publicIp || "—"}</td>
                        <td className="py-2 pr-3">
                          {apiUrl ? (
                            <a className="text-blue-600 underline" href={apiUrl} target="_blank" rel="noreferrer">{apiUrl}</a>
                          ) : "—"}
                        </td>
                        <td className="py-2 pr-3">{ports || "—"}</td>
                        <td className="py-2 pr-3">
                          <Button
                            size="sm"
                            onClick={() => onTerminateVm(id)}
                            disabled={!id || isTerminating}
                          >
                            {isTerminating ? "Terminating..." : "Terminate"}
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
          </>
        ) : (
          <section className="rounded border p-4">
            <div className="font-medium">Details</div>
            <div className="text-sm text-muted-foreground mt-2">Selected node type is not yet available. Please choose LLM to proceed.</div>
          </section>
        )}
      </main>
    </div>
  );
} 