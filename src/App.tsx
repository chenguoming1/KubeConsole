import React, { useState, useEffect } from "react";
import {
  NodeInfo,
  PodInfo,
  DeploymentInfo,
  ServiceInfo,
  NamespaceInfo,
  ConfigMapInfo,
  SecretInfo,
  KubeEvent,
  RbacRole,
  ClusterState
} from "./types";

import Header from "./components/Header";
import Sidebar from "./components/Sidebar";
import CopilotPanel from "./components/CopilotPanel";
import ClusterOverview from "./components/ClusterOverview";
import TerminalView from "./components/TerminalView";
import DeployWizard from "./components/DeployWizard";
import ResourceTable from "./components/ResourceTable";

import { Box, Layers, X, ShieldAlert, Cpu, Heart, CheckCircle, Info, RefreshCw } from "lucide-react";

export default function App() {
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [activeNamespace, setActiveNamespace] = useState<string>("all");
  const [activeRole, setActiveRole] = useState<RbacRole>("ClusterAdmin");
  const [copilotOpen, setCopilotOpen] = useState<boolean>(true);

  // Cluster State
  const [nodes, setNodes] = useState<NodeInfo[]>([]);
  const [namespaces, setNamespaces] = useState<NamespaceInfo[]>([]);
  const [pods, setPods] = useState<PodInfo[]>([]);
  const [deployments, setDeployments] = useState<DeploymentInfo[]>([]);
  const [services, setServices] = useState<ServiceInfo[]>([]);
  const [configMaps, setConfigMaps] = useState<ConfigMapInfo[]>([]);
  const [secrets, setSecrets] = useState<SecretInfo[]>([]);
  const [events, setEvents] = useState<KubeEvent[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [clusterHealthy, setClusterHealthy] = useState<boolean>(true);

  // Interactive sheet for Pod details
  const [inspectedPod, setInspectedPod] = useState<PodInfo | null>(null);
  const [podLogs, setPodLogs] = useState<string>("");
  const [logsLoading, setLogsLoading] = useState<boolean>(false);

  // Command broker from Copilot to TerminalView
  const [commandToExecute, setCommandToExecute] = useState<string>("");
  // YAML broker from Copilot to DeployWizard Manifest Editor
  const [yamlFromCopilot, setYamlFromCopilot] = useState<string>("");

  const fetchResources = async () => {
    try {
      const res = await fetch("/api/k8s/resources");
      if (!res.ok) throw new Error("Could not fetch resources");
      const data: ClusterState = await res.json();

      setNodes(data.nodes);
      setNamespaces(data.namespaces);
      setPods(data.pods);
      setDeployments(data.deployments);
      setServices(data.services);
      setConfigMaps(data.configMaps);
      setSecrets(data.secrets);
      setEvents(data.events);

      setClusterHealthy(true);
    } catch (err) {
      console.error(err);
      setClusterHealthy(false);
    } finally {
      setLoading(false);
    }
  };

  // Poll resources periodically to keep UI reactive
  useEffect(() => {
    fetchResources();
    const interval = setInterval(fetchResources, 5000);
    return () => clearInterval(interval);
  }, []);

  // Fetch individual Pod logs when a pod is inspected
  const fetchPodLogs = async (podName: string) => {
    setLogsLoading(true);
    setPodLogs("");
    try {
      const res = await fetch("/api/k8s/kubectl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          command: `kubectl logs ${podName}`,
          role: activeRole,
          namespace: activeNamespace === "all" ? "default" : activeNamespace,
        }),
      });
      const data = await res.json();
      setPodLogs(data.output);
    } catch (err: any) {
      setPodLogs(`Failed to query logs: ${err.message}`);
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    if (inspectedPod) {
      fetchPodLogs(inspectedPod.name);
    }
  }, [inspectedPod]);

  // Handle Action Brokers
  const handleExecuteCommandFromCopilot = (cmd: string) => {
    // Navigate to terminal tab and set broker command
    setActiveTab("terminal");
    setCommandToExecute(cmd);
  };

  const handleApplyYamlFromCopilot = (yaml: string) => {
    // Navigate to deploy tab and set broker yaml
    setActiveTab("deploy");
    setYamlFromCopilot(yaml);
  };

  // Delete Pod within inspected Pod modal
  const handleDeleteInspectedPod = async () => {
    if (!inspectedPod) return;
    if (activeRole === "ReadOnly") {
      alert("RBAC Error: ReadOnly role is unauthorized to delete pods.");
      return;
    }

    try {
      const res = await fetch("/api/k8s/kubectl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          command: `kubectl delete pod ${inspectedPod.name} -n ${inspectedPod.namespace}`,
          role: activeRole,
          namespace: inspectedPod.namespace,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        alert(data.output);
      } else {
        setInspectedPod(null);
        fetchResources();
      }
    } catch (err: any) {
      alert(`Delete error: ${err.message}`);
    }
  };

  // Calculate cluster resource metrics for sidebar gauges
  const calculateClusterStats = () => {
    const totalPods = pods.length;
    const runningPods = pods.filter((p) => p.status === "Running").length;
    const avgCpu = nodes.length > 0 ? Math.round(nodes.reduce((acc, n) => acc + n.cpuUsed, 0) / nodes.length) : 0;
    const avgMem = nodes.length > 0 ? Math.round(nodes.reduce((acc, n) => acc + n.memUsed, 0) / nodes.length) : 0;

    return {
      podsRunning: runningPods,
      podsTotal: totalPods || 1,
      cpuUtil: avgCpu,
      memUtil: avgMem,
    };
  };

  const getActiveTabTitle = () => {
    switch (activeTab) {
      case "overview":
        return "Cluster Overview & Telemetry";
      case "pods":
        return "Workloads: Pods & Deployments";
      case "services":
        return "Networking: Service Ports & LoadBalancers";
      case "config":
        return "Storage: ConfigMaps & Cluster Secrets";
      case "terminal":
        return "kubectl CLI Interactive Shell";
      case "deploy":
        return "Deploy Application Workload";
      case "rbac":
        return "Access & Security Authorization";
      default:
        return "Kubernetes Control Plane";
    }
  };

  if (loading) {
    return (
      <div className="h-screen bg-[#0a0a0b] text-[#e2e2e4] flex flex-col items-center justify-center gap-4">
        <div className="relative">
          <Layers className="h-12 w-12 text-[#326ce5] animate-pulse" />
          <RefreshCw className="h-6 w-6 text-[#326ce5] absolute top-3 left-3 animate-spin" />
        </div>
        <div className="text-center space-y-1.5">
          <h2 className="font-sans font-bold text-[#e2e2e4]">KubeConsole Control Plane</h2>
          <p className="text-xs text-[#999999] font-mono animate-pulse">Establishing authorized API connection proxy...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#0a0a0b] text-[#e2e2e4] min-h-screen flex flex-col font-sans antialiased select-none selection:bg-[#326ce5]/30">
      {/* Top Header */}
      <Header
        namespaces={namespaces}
        activeNamespace={activeNamespace}
        setActiveNamespace={setActiveNamespace}
        activeRole={activeRole}
        setActiveRole={setActiveRole}
        clusterHealthy={clusterHealthy}
      />

      {/* Main Container */}
      <div className="flex flex-1 relative overflow-hidden">
        {/* Navigation Sidebar */}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          copilotOpen={copilotOpen}
          setCopilotOpen={setCopilotOpen}
          clusterStats={calculateClusterStats()}
        />

        {/* Primary Workspace Panel */}
        <main className="flex-1 p-6 overflow-y-auto h-[calc(100vh-4rem)] bg-[#0a0a0b]/40">
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Context title banner */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold font-sans text-[#e2e2e4] tracking-tight">
                  {getActiveTabTitle()}
                </h2>
                <p className="text-xs text-[#999999] font-mono mt-0.5">
                  Scope: {activeNamespace === "all" ? "all-namespaces" : `ns/${activeNamespace}`} | Authorized: {activeRole}
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs font-mono text-[#666666]">
                <Heart className="h-3.5 w-3.5 text-rose-500 animate-pulse" />
                Cluster Healthy
              </div>
            </div>

            {/* Dynamic View Panels */}
            {activeTab === "overview" && (
              <ClusterOverview
                nodes={nodes}
                pods={pods}
                events={events}
                activeNamespace={activeNamespace}
                onRefresh={fetchResources}
                onSelectPod={(pod) => setInspectedPod(pod)}
              />
            )}

            {activeTab === "pods" && (
              <div className="space-y-6">
                <ResourceTable
                  resourceType="pods"
                  activeNamespace={activeNamespace}
                  activeRole={activeRole}
                  data={{ pods, deployments, services, configMaps, secrets }}
                  onRefreshAll={fetchResources}
                  onExecuteCommandInTerminal={handleExecuteCommandFromCopilot}
                />
                <ResourceTable
                  resourceType="deployments"
                  activeNamespace={activeNamespace}
                  activeRole={activeRole}
                  data={{ pods, deployments, services, configMaps, secrets }}
                  onRefreshAll={fetchResources}
                  onExecuteCommandInTerminal={handleExecuteCommandFromCopilot}
                />
              </div>
            )}

            {activeTab === "services" && (
              <ResourceTable
                resourceType="services"
                activeNamespace={activeNamespace}
                activeRole={activeRole}
                data={{ pods, deployments, services, configMaps, secrets }}
                onRefreshAll={fetchResources}
                onExecuteCommandInTerminal={handleExecuteCommandFromCopilot}
              />
            )}

            {activeTab === "config" && (
              <ResourceTable
                resourceType="config"
                activeNamespace={activeNamespace}
                activeRole={activeRole}
                data={{ pods, deployments, services, configMaps, secrets }}
                onRefreshAll={fetchResources}
                onExecuteCommandInTerminal={handleExecuteCommandFromCopilot}
              />
            )}

            {activeTab === "terminal" && (
              <TerminalView
                activeRole={activeRole}
                activeNamespace={activeNamespace === "all" ? "default" : activeNamespace}
                onRefreshAll={fetchResources}
                commandToExecute={commandToExecute}
                clearCommandToExecute={() => setCommandToExecute("")}
              />
            )}

            {activeTab === "deploy" && (
              <DeployWizard
                namespaces={namespaces}
                activeNamespace={activeNamespace}
                activeRole={activeRole}
                onRefreshAll={fetchResources}
                yamlFromCopilot={yamlFromCopilot}
                clearYamlFromCopilot={() => setYamlFromCopilot("")}
              />
            )}

            {activeTab === "rbac" && (
              <ResourceTable
                resourceType="rbac"
                activeNamespace={activeNamespace}
                activeRole={activeRole}
                data={{ pods, deployments, services, configMaps, secrets }}
                onRefreshAll={fetchResources}
              />
            )}
          </div>
        </main>

        {/* Sliding Gemini Copilot Assistant Panel */}
        {copilotOpen && (
          <CopilotPanel
            onApplyYaml={handleApplyYamlFromCopilot}
            onExecuteCommand={handleExecuteCommandFromCopilot}
            onClose={() => setCopilotOpen(false)}
          />
        )}
      </div>

      {/* Pod Detail / Inspector Modal Sheet */}
      {inspectedPod && (
        <div className="fixed inset-0 z-50 bg-[#0a0a0b]/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111112] border border-[#262626] rounded-2xl max-w-2xl w-full p-6 relative shadow-2xl flex flex-col max-h-[90vh] space-y-4">
            <button
              onClick={() => setInspectedPod(null)}
              className="absolute top-4 right-4 p-1 text-[#999999] hover:text-[#e2e2e4] hover:bg-[#1a1a1a] rounded"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Header info */}
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-[#326ce5]/10 border border-[#326ce5]/20 text-[#326ce5] rounded-xl">
                <Box className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#e2e2e4] font-sans flex items-center gap-2">
                  {inspectedPod.name}
                </h3>
                <p className="text-[10px] font-mono text-[#999999] mt-0.5">
                  Namespace: <span className="text-[#326ce5]">{inspectedPod.namespace}</span> | Node: <span className="text-[#e2e2e4]">{inspectedPod.node}</span>
                </p>
              </div>
            </div>

            {/* Spec grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-[#0a0a0b] p-4 rounded-xl border border-[#262626] text-[11px] font-mono">
              <div>
                <span className="text-[#666666] block">STATUS</span>
                <span className="text-[#e2e2e4] font-bold">{inspectedPod.status}</span>
              </div>
              <div>
                <span className="text-[#666666] block">IP ADDRESS</span>
                <span className="text-[#e2e2e4]">{inspectedPod.ip}</span>
              </div>
              <div>
                <span className="text-[#666666] block">CONTAINERS</span>
                <span className="text-[#e2e2e4]">{inspectedPod.ready} ready</span>
              </div>
              <div>
                <span className="text-[#666666] block">RESTARTS</span>
                <span className="text-[#e2e2e4]">{inspectedPod.restarts} restarts</span>
              </div>
            </div>

            {/* Container stdout/stderr log panel */}
            <div className="space-y-1.5 flex-1 flex flex-col min-h-0">
              <span className="text-[10px] font-mono font-bold text-[#666666] uppercase block">
                Container STDOUT/STDERR logs
              </span>
              <div className="flex-1 overflow-y-auto p-4 bg-[#0a0a0b] rounded-xl border border-[#262626] font-mono text-[11px] text-[#e2e2e4] leading-normal max-h-56">
                {logsLoading ? (
                  <span className="text-[#666666] animate-pulse">Streaming terminal stdout...</span>
                ) : (
                  <pre className="whitespace-pre-wrap">{podLogs}</pre>
                )}
              </div>
            </div>

            {/* Labels and env variables */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-[#666666] uppercase block">Labels</span>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(inspectedPod.labels).map(([k, v]) => (
                    <span key={k} className="px-2 py-0.5 bg-[#1a1a1a] border border-[#262626] text-[#e2e2e4] text-[10px]">
                      {k}={v}
                    </span>
                  ))}
                </div>
              </div>

              {inspectedPod.env.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-[#666666] uppercase block">Environment Variables</span>
                  <div className="space-y-1 bg-[#0a0a0b] p-2 rounded border border-[#262626] text-[10px]">
                    {inspectedPod.env.map((e) => (
                      <div key={e.name} className="text-[#999999]">
                        <span className="text-[#e2e2e4] font-semibold">{e.name}</span> = {e.value}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex justify-between items-center pt-3 border-t border-[#262626]/60 mt-2">
              <button
                onClick={handleDeleteInspectedPod}
                disabled={activeRole === "ReadOnly"}
                className="px-4 py-2 bg-[#ef4444]/10 hover:bg-[#ef4444]/20 text-[#ef4444] border border-[#ef4444]/20 text-xs font-medium rounded-lg cursor-pointer transition-colors disabled:opacity-50"
              >
                Terminated/Delete Pod
              </button>
              <button
                onClick={() => setInspectedPod(null)}
                className="px-4 py-2 bg-[#1a1a1a] hover:bg-[#262626] text-[#e2e2e4] text-xs font-medium rounded-lg cursor-pointer transition-colors"
              >
                Close details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
