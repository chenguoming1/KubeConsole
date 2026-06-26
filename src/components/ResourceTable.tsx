import React, { useState } from "react";
import {
  Search,
  Sliders,
  Trash2,
  Eye,
  Settings,
  Lock,
  Unlock,
  Layers,
  Activity,
  Boxes,
  KeyRound,
  FileJson,
  X,
  Play,
  ArrowRight,
  Sparkles,
  Scale
} from "lucide-react";
import { PodInfo, DeploymentInfo, ServiceInfo, ConfigMapInfo, SecretInfo, RbacRole } from "../types";

interface ResourceTableProps {
  resourceType: "pods" | "deployments" | "services" | "config" | "rbac";
  activeNamespace: string;
  activeRole: RbacRole;
  data: {
    pods: PodInfo[];
    deployments: DeploymentInfo[];
    services: ServiceInfo[];
    configMaps: ConfigMapInfo[];
    secrets: SecretInfo[];
  };
  onRefreshAll: () => void;
  onExecuteCommandInTerminal?: (cmd: string) => void;
}

export default function ResourceTable({
  resourceType,
  activeNamespace,
  activeRole,
  data,
  onRefreshAll,
  onExecuteCommandInTerminal,
}: ResourceTableProps) {
  const [search, setSearch] = useState("");
  const [selectedSpec, setSelectedSpec] = useState<{ name: string; kind: string; specText: string } | null>(null);
  const [scaleDeployment, setScaleDeployment] = useState<DeploymentInfo | null>(null);
  const [scaleValue, setScaleValue] = useState(1);
  const [revealSecretId, setRevealSecretId] = useState<string | null>(null);
  const [scalingLoading, setScalingLoading] = useState(false);

  // Filter items by namespace
  const filterByNamespace = <T extends { namespace: string }>(items: T[]): T[] => {
    if (activeNamespace === "all") return items;
    return items.filter((item) => item.namespace === activeNamespace);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Running":
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Running</span>;
      case "ContainerCreating":
      case "Pending":
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse">Creating</span>;
      case "Failed":
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">Failed</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-slate-800 text-slate-300">{status}</span>;
    }
  };

  // Describe resource spec
  const handleDescribe = (kind: string, name: string, itemData: any) => {
    setSelectedSpec({
      name,
      kind,
      specText: JSON.stringify(itemData, null, 2),
    });
  };

  // Delete resource
  const handleDelete = async (kind: string, namespace: string, name: string) => {
    if (activeRole === "ReadOnly") {
      alert("RBAC Error: ReadOnly role is unauthorized to delete cluster resources.");
      return;
    }
    if (activeRole === "Developer" && namespace === "kube-system") {
      alert("RBAC Error: Developer role is unauthorized to mutate kube-system resources.");
      return;
    }

    const command = `kubectl delete ${kind.toLowerCase()} ${name} -n ${namespace}`;
    if (onExecuteCommandInTerminal) {
      onExecuteCommandInTerminal(command);
    }
  };

  // Scale deployment
  const handleScaleSubmit = async () => {
    if (!scaleDeployment) return;
    setScalingLoading(true);
    try {
      const res = await fetch("/api/k8s/kubectl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          command: `kubectl scale deployment ${scaleDeployment.name} --replicas=${scaleValue} -n ${scaleDeployment.namespace}`,
          role: activeRole,
          namespace: scaleDeployment.namespace,
        }),
      });
      const resData = await res.json();
      if (!resData.success) {
        alert(resData.output);
      } else {
        onRefreshAll();
      }
    } catch (err: any) {
      alert(`Scaling error: ${err.message}`);
    } finally {
      setScalingLoading(false);
      setScaleDeployment(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search & filters */}
      <div className="flex items-center justify-between">
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#666666]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${resourceType}...`}
            className="w-full bg-[#0a0a0b] border border-[#262626] focus:border-[#326ce5] rounded-lg pl-9 pr-3 py-2 text-xs text-[#e2e2e4] outline-none font-sans"
          />
        </div>

        <span className="text-[10px] font-mono text-[#999999]">
          Viewing: {activeNamespace === "all" ? "All Namespaces" : `Namespace: ${activeNamespace}`}
        </span>
      </div>

      {/* Render tables based on resourceType */}
      <div className="border border-[#262626] rounded-xl overflow-hidden bg-[#111112]/60 shadow-xl">
        {resourceType === "pods" && (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#111112] text-[10px] font-mono font-bold tracking-wider text-[#999999] border-b border-[#262626] uppercase">
                <th className="px-5 py-3">Pod Name</th>
                <th className="px-5 py-3">Namespace</th>
                <th className="px-5 py-3">IP Address</th>
                <th className="px-5 py-3">Node</th>
                <th className="px-5 py-3">Containers</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#262626] text-xs text-[#e2e2e4]">
              {filterByNamespace(data.pods)
                .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
                .map((pod) => (
                  <tr key={pod.name} className="hover:bg-[#111112]/20">
                    <td className="px-5 py-3.5 font-semibold text-[#e2e2e4] font-mono truncate max-w-[200px]" title={pod.name}>
                      {pod.name}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-[#999999]">{pod.namespace}</td>
                    <td className="px-5 py-3.5 font-mono text-[#999999]">{pod.ip}</td>
                    <td className="px-5 py-3.5 font-mono text-[#326ce5]">{pod.node}</td>
                    <td className="px-5 py-3.5 font-mono text-[10px]">
                      <span className="px-1.5 py-0.5 bg-[#0a0a0b] rounded text-[#999999] border border-[#262626]">
                        {pod.image.split("/").pop()?.split(":")[0] || pod.image}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">{getStatusBadge(pod.status)}</td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleDescribe("Pod", pod.name, pod)}
                          className="p-1 text-[#999999] hover:text-[#e2e2e4] hover:bg-[#1a1a1a] rounded cursor-pointer"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete("Pod", pod.namespace, pod.name)}
                          className="p-1 text-[#999999] hover:text-rose-400 hover:bg-rose-500/10 rounded cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}

        {resourceType === "deployments" && (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#111112] text-[10px] font-mono font-bold tracking-wider text-[#999999] border-b border-[#262626] uppercase">
                <th className="px-5 py-3">Deployment</th>
                <th className="px-5 py-3">Namespace</th>
                <th className="px-5 py-3">Replicas</th>
                <th className="px-5 py-3">Image Spec</th>
                <th className="px-5 py-3">Age</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#262626] text-xs text-[#e2e2e4]">
              {filterByNamespace(data.deployments)
                .filter((d) => d.name.toLowerCase().includes(search.toLowerCase()))
                .map((deploy) => (
                  <tr key={deploy.name} className="hover:bg-[#111112]/20">
                    <td className="px-5 py-3.5 font-semibold text-[#e2e2e4] font-mono">{deploy.name}</td>
                    <td className="px-5 py-3.5 font-mono text-[#999999]">{deploy.namespace}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5 font-mono font-bold text-[#e2e2e4]">
                        <span>{deploy.availableReplicas}</span>
                        <span className="text-[#666666]">/</span>
                        <span>{deploy.replicas}</span>
                        <span className="text-xs text-[#999999] font-normal">ready</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 font-mono max-w-[200px] truncate" title={deploy.image}>
                      {deploy.image}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-[#999999]">{deploy.age}</td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setScaleDeployment(deploy);
                            setScaleValue(deploy.replicas);
                          }}
                          className="p-1 text-[#326ce5] hover:text-[#528bef] hover:bg-[#1a1a1a] rounded cursor-pointer flex items-center gap-1 text-[11px] font-semibold"
                        >
                          <Scale className="h-4 w-4" /> Scale
                        </button>
                        <button
                          onClick={() => handleDescribe("Deployment", deploy.name, deploy)}
                          className="p-1 text-[#999999] hover:text-[#e2e2e4] hover:bg-[#1a1a1a] rounded cursor-pointer"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete("Deployment", deploy.namespace, deploy.name)}
                          className="p-1 text-[#999999] hover:text-rose-400 hover:bg-rose-500/10 rounded cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}

        {resourceType === "services" && (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#111112] text-[10px] font-mono font-bold tracking-wider text-[#999999] border-b border-[#262626] uppercase">
                <th className="px-5 py-3">Service Name</th>
                <th className="px-5 py-3">Namespace</th>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Cluster IP</th>
                <th className="px-5 py-3">External IP</th>
                <th className="px-5 py-3">Port Mapping</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#262626] text-xs text-[#e2e2e4]">
              {filterByNamespace(data.services)
                .filter((s) => s.name.toLowerCase().includes(search.toLowerCase()))
                .map((svc) => (
                  <tr key={svc.name} className="hover:bg-[#111112]/20">
                    <td className="px-5 py-3.5 font-semibold text-[#e2e2e4] font-mono">{svc.name}</td>
                    <td className="px-5 py-3.5 font-mono text-[#999999]">{svc.namespace}</td>
                    <td className="px-5 py-3.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                        svc.type === "LoadBalancer"
                          ? "bg-violet-500/10 text-violet-400 border border-violet-500/20"
                          : "bg-[#1a1a1a] text-[#999999] border border-[#262626]"
                      }`}>
                        {svc.type}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-[#999999]">{svc.clusterIp}</td>
                    <td className="px-5 py-3.5 font-mono">
                      {svc.externalIp === "<none>" ? (
                        <span className="text-[#666666]">{svc.externalIp}</span>
                      ) : (
                        <span className="text-[#326ce5] font-semibold">{svc.externalIp}</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-[#e2e2e4]">{svc.ports}</td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleDescribe("Service", svc.name, svc)}
                          className="p-1 text-[#999999] hover:text-[#e2e2e4] hover:bg-[#1a1a1a] rounded cursor-pointer"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete("Service", svc.namespace, svc.name)}
                          className="p-1 text-[#999999] hover:text-rose-400 hover:bg-rose-500/10 rounded cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}

        {/* Configuration (ConfigMaps & Secrets combined) */}
        {resourceType === "config" && (
          <div className="space-y-6 p-4">
            {/* ConfigMaps Section */}
            <div>
              <span className="text-[10px] font-mono font-bold tracking-wider text-[#666666] uppercase block mb-3">
                CONFIGMAPS (KeyValue Config Store)
              </span>
              <table className="w-full text-left border-collapse border border-[#262626] rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-[#111112]/60 text-[9px] font-mono font-bold text-[#999999] border-b border-[#262626] uppercase">
                    <th className="px-4 py-2">Name</th>
                    <th className="px-4 py-2">Namespace</th>
                    <th className="px-4 py-2">Keys count</th>
                    <th className="px-4 py-2">Age</th>
                    <th className="px-4 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#262626] text-xs text-[#e2e2e4]">
                  {filterByNamespace(data.configMaps)
                    .map((cm) => (
                      <tr key={cm.name} className="hover:bg-[#111112]/10">
                        <td className="px-4 py-2.5 font-mono font-semibold text-[#e2e2e4]">{cm.name}</td>
                        <td className="px-4 py-2.5 font-mono text-[#999999]">{cm.namespace}</td>
                        <td className="px-4 py-2.5 font-mono text-[#999999]">{Object.keys(cm.data).length}</td>
                        <td className="px-4 py-2.5 font-mono text-[#999999]">{cm.age}</td>
                        <td className="px-4 py-2.5 text-right">
                          <button
                            onClick={() => handleDescribe("ConfigMap", cm.name, cm)}
                            className="p-1 text-[#999999] hover:text-[#e2e2e4] hover:bg-[#1a1a1a] rounded cursor-pointer"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            {/* Secrets Section */}
            <div>
              <span className="text-[10px] font-mono font-bold tracking-wider text-[#666666] uppercase block mb-3">
                SECRETS (Authorized Tokens & Passwords)
              </span>
              <table className="w-full text-left border-collapse border border-[#262626] rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-[#111112]/60 text-[9px] font-mono font-bold text-[#999999] border-b border-[#262626] uppercase">
                    <th className="px-4 py-2">Secret Name</th>
                    <th className="px-4 py-2">Namespace</th>
                    <th className="px-4 py-2">Type</th>
                    <th className="px-4 py-2">Content keys</th>
                    <th className="px-4 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#262626] text-xs text-[#e2e2e4]">
                  {filterByNamespace(data.secrets).map((sec) => (
                    <tr key={sec.name} className="hover:bg-[#1a1a1a]/10">
                      <td className="px-4 py-2.5 font-mono font-semibold text-[#e2e2e4] flex items-center gap-2">
                        <Lock className="h-3.5 w-3.5 text-rose-400" />
                        {sec.name}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[#999999]">{sec.namespace}</td>
                      <td className="px-4 py-2.5 font-mono text-[#999999]">{sec.type}</td>
                      <td className="px-4 py-2.5 font-mono text-[#999999]">
                        {revealSecretId === sec.name ? (
                          <div className="space-y-1 text-[10px] bg-[#0a0a0b] p-2 rounded border border-[#262626] text-amber-300">
                            {Object.entries(sec.data).map(([k, v]) => (
                              <div key={k}>
                                <span>{k}</span>: <span>{atob(v)}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[#666666] italic">🔒 Masked ({Object.keys(sec.data).length} values)</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setRevealSecretId(revealSecretId === sec.name ? null : sec.name)}
                            className="p-1 text-amber-400 hover:text-amber-300 hover:bg-[#1a1a1a] rounded cursor-pointer"
                            title="Decode credentials"
                          >
                            {revealSecretId === sec.name ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                          </button>
                          <button
                            onClick={() => handleDescribe("Secret", sec.name, sec)}
                            className="p-1 text-[#999999] hover:text-[#e2e2e4] hover:bg-[#1a1a1a] rounded cursor-pointer"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* RBAC Rules explorer */}
        {resourceType === "rbac" && (
          <div className="p-5 space-y-6">
            <div>
              <h3 className="font-sans font-semibold text-sm text-[#e2e2e4] flex items-center gap-2 mb-2">
                <KeyRound className="h-4 w-4 text-[#999999]" /> Cluster Role-Based Access Control Policies
              </h3>
              <p className="text-xs text-[#999999] leading-relaxed font-sans mb-4">
                The terminal and visual buttons automatically filter and check authorization policies before committing cluster mutations. Switch active RBAC roles inside the top navigation header to test sandbox constraints.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Admin Policy card */}
                <div className="bg-[#0a0a0b] p-4 border border-[#262626] rounded-xl space-y-2">
                  <span className="text-[10px] font-mono font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-1.5 py-0.5 rounded">
                    CLUSTER ROLE: ClusterAdmin
                  </span>
                  <p className="text-[11px] text-[#e2e2e4]">Unrestricted system administrative control. Authorized for both cluster-wide nodes/namespaces operations and local service configuration.</p>
                  <div className="text-[10px] font-mono text-[#666666]">APIGroups: ["*"] | Resources: ["*"] | Verbs: ["*"]</div>
                </div>

                {/* Namespace Mgr Policy card */}
                <div className="bg-[#0a0a0b] p-4 border border-[#262626] rounded-xl space-y-2">
                  <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded">
                    CLUSTER ROLE: NamespaceManager
                  </span>
                  <p className="text-[11px] text-[#e2e2e4]">Read and write permissions inside workloads, deployments, and namespaces. Forbidden from modifying physical nodes.</p>
                  <div className="text-[10px] font-mono text-[#666666]">APIGroups: ["apps", ""] | Resources: ["pods", "deployments", "services"] | Verbs: ["*"]</div>
                </div>

                {/* Developer Policy card */}
                <div className="bg-[#0a0a0b] p-4 border border-[#262626] rounded-xl space-y-2">
                  <span className="text-[10px] font-mono font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded">
                    CLUSTER ROLE: Developer
                  </span>
                  <p className="text-[11px] text-[#e2e2e4]">Authorized to deploy applications and read logs inside standard developer namespaces. Restricted from touching namespace configurations or the core kube-system namespace.</p>
                  <div className="text-[10px] font-mono text-[#666666]">Namespaces: ["default", "production", "development"] | Verbs: ["get", "apply", "run"]</div>
                </div>

                {/* ReadOnly Policy card */}
                <div className="bg-[#0a0a0b] p-4 border border-[#262626] rounded-xl space-y-2">
                  <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                    CLUSTER ROLE: ReadOnly
                  </span>
                  <p className="text-[11px] text-[#e2e2e4]">Audit and visibility privileges only. Restricts all write operations, scaling requests, running commands, and deletion calls in the shell.</p>
                  <div className="text-[10px] font-mono text-[#666666]">APIGroups: ["*"] | Resources: ["*"] | Verbs: ["get", "list", "watch"]</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Describe / Spec Modal overlay overlay */}
      {selectedSpec && (
        <div className="fixed inset-0 z-50 bg-[#0a0a0b]/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111112] border border-[#262626] rounded-2xl max-w-2xl w-full p-6 relative shadow-2xl flex flex-col max-h-[85vh]">
            <button
              onClick={() => setSelectedSpec(null)}
              className="absolute top-4 right-4 p-1 text-[#999999] hover:text-[#e2e2e4] hover:bg-[#1a1a1a] rounded"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-2.5 mb-4">
              <FileJson className="h-5 w-5 text-[#326ce5]" />
              <div>
                <h4 className="text-sm font-bold text-[#e2e2e4] font-sans">
                  {selectedSpec.kind} / {selectedSpec.name}
                </h4>
                <p className="text-[10px] font-mono text-[#999999]">Kubernetes api-resource specification manifest (JSON)</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-[#0a0a0b] rounded-xl border border-[#262626] font-mono text-xs text-[#e2e2e4]">
              <pre>{selectedSpec.specText}</pre>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-[#262626]/60 mt-4">
              <button
                onClick={() => setSelectedSpec(null)}
                className="px-4 py-2 bg-[#1a1a1a] hover:bg-[#262626] text-[#e2e2e4] text-xs font-medium rounded-lg transition-colors cursor-pointer"
              >
                Close Spec
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scale Deployment Modal Overlay */}
      {scaleDeployment && (
        <div className="fixed inset-0 z-50 bg-[#0a0a0b]/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111112] border border-[#262626] rounded-2xl max-w-md w-full p-6 relative shadow-2xl space-y-4">
            <button
              onClick={() => setScaleDeployment(null)}
              className="absolute top-4 right-4 p-1 text-[#999999] hover:text-[#e2e2e4] hover:bg-[#1a1a1a] rounded"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-2.5">
              <Sliders className="h-5 w-5 text-[#326ce5]" />
              <div>
                <h4 className="text-sm font-bold text-[#e2e2e4] font-sans">
                  Scale Deployment: {scaleDeployment.name}
                </h4>
                <p className="text-[10px] font-mono text-[#999999]">Adjust replica specification parameters</p>
              </div>
            </div>

            <div className="space-y-4 py-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-[#999999] font-mono">Desired replicas:</span>
                <span className="text-lg font-bold text-[#326ce5] font-mono">{scaleValue}</span>
              </div>

              <input
                type="range"
                min={0}
                max={15}
                value={scaleValue}
                onChange={(e) => setScaleValue(parseInt(e.target.value, 10))}
                className="w-full accent-[#326ce5] cursor-pointer"
              />

              <p className="text-[10px] text-[#666666] font-sans leading-normal">
                Setting replicas will dynamically schedule new pod containers on worker nodes or decommission redundant ones to reconcile state immediately.
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setScaleDeployment(null)}
                className="px-4 py-2 bg-[#1a1a1a] hover:bg-[#262626] text-[#e2e2e4] text-xs font-medium rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleScaleSubmit}
                disabled={scalingLoading}
                className="px-4 py-2 bg-[#326ce5] hover:bg-[#2557c0] text-white text-xs font-medium rounded-lg cursor-pointer flex items-center gap-1.5"
              >
                {scalingLoading ? "Scaling..." : "Reconcile Replicas"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
