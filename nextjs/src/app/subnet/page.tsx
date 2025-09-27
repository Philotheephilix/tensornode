"use client";

import { useEffect, useMemo, useState } from "react";
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
  const [dockerPort, setDockerPort] = useState<number>(3000);
  const [creating, setCreating] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [terminatingId, setTerminatingId] = useState<string>("");

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

  async function onUploadDockerfile() {
    if (!effectiveVmId) {
      setError("Please select a VM first");
      return;
    }
    if (!dockerFile) {
      setError("Please choose a Dockerfile to upload");
      return;
    }
    setDeploying(true);
    setError(null);
    try {
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
      // optional: handle response
      await res.json().catch(() => null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setDeploying(false);
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
            <div className="text-lg font-semibold">Miner Manager</div>
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
          <div className="flex items-center justify-between gap-3">
            <div className="font-medium">Connected Miners</div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={fetchVms} disabled={loading}>Refresh</Button>
              <Button variant="outline" size="sm" onClick={onOpenSshPort} disabled={loading || !effectiveVmId}>Open SSH (22)</Button>
              <Button size="sm" onClick={onCreateVm} disabled={creating}>{creating ? "Creating..." : "Create Miner (VM)"}</Button>
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
                            variant="destructive"
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

        <section className="rounded border p-4">
          <div className="font-medium">Deploy Docker to Selected Miner</div>
          <div className="mt-3 flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-600">Dockerfile</label>
              <input
                type="file"
                accept=".Dockerfile, Dockerfile, text/*, application/octet-stream"
                onChange={(e) => setDockerFile(e.target.files?.[0] || null)}
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
              />
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={onUploadDockerfile} disabled={deploying || !dockerFile || !effectiveVmId}>
                {deploying ? "Deploying..." : "Deploy Docker"}
              </Button>
              <Button variant="outline" onClick={onStopMiner} disabled={stopping || !effectiveVmId}>
                {stopping ? "Stopping..." : "Stop Miner"}
              </Button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
} 