import React, { useState } from "react";
import { Server, Activity, HardDrive, Calendar, RefreshCw, Layers, ShieldAlert, Cpu, Eye, Info, X } from "lucide-react";
import { NodeInfo, PodInfo, KubeEvent } from "../types";

interface ClusterOverviewProps {
  nodes: NodeInfo[];
  pods: PodInfo[];
  events: KubeEvent[];
  activeNamespace: string;
  onRefresh: () => void;
  onSelectPod: (pod: PodInfo) => void;
}

export default function ClusterOverview({
  nodes,
  pods,
  events,
  activeNamespace,
  onRefresh,
  onSelectPod,
}: ClusterOverviewProps) {
  const [selectedNode, setSelectedNode] = useState<NodeInfo | null>(null);

  // Filter pods to active namespace
  const activeNamespacePods = activeNamespace === "all" ? pods : pods.filter(p => p.namespace === activeNamespace);

  const runningCount = activeNamespacePods.filter(p => p.status === "Running").length;
  const pendingCount = activeNamespacePods.filter(p => p.status === "Pending" || p.status === "ContainerCreating").length;
  const failedCount = activeNamespacePods.filter(p => p.status === "Failed").length;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Running":
        return "bg-emerald-500 shadow-emerald-500/20";
      case "ContainerCreating":
      case "Pending":
        return "bg-amber-500 animate-pulse shadow-amber-500/20";
      case "Failed":
        return "bg-rose-500 shadow-rose-500/20 animate-bounce";
      default:
        return "bg-slate-500";
    }
  };

  return (
    <div className="space-y-6">
      {/* Metrics bento-grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Metric Card 1 */}
        <div className="bg-[#111112] border border-[#262626] p-5 rounded-2xl flex items-center justify-between shadow-lg shadow-[#0a0a0b]/20">
          <div className="space-y-2">
            <span className="text-[10px] font-mono font-bold tracking-wider text-[#666666] uppercase">
              Nodes Healthy
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-sans text-[#e2e2e4]">
                {nodes.filter((n) => n.status === "Ready").length}
              </span>
              <span className="text-xs text-[#999999] font-mono">/ {nodes.length}</span>
            </div>
            <p className="text-[10px] text-emerald-400 font-mono">100% Control plane active</p>
          </div>
          <div className="p-3 bg-emerald-500/10 rounded-xl">
            <Server className="h-6 w-6 text-emerald-400" />
          </div>
        </div>

        {/* Metric Card 2 */}
        <div className="bg-[#111112] border border-[#262626] p-5 rounded-2xl flex items-center justify-between shadow-lg shadow-[#0a0a0b]/20">
          <div className="space-y-2">
            <span className="text-[10px] font-mono font-bold tracking-wider text-[#666666] uppercase">
              Pods Active
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-sans text-[#e2e2e4]">{runningCount}</span>
              <span className="text-xs text-[#999999] font-mono">/ {activeNamespacePods.length}</span>
            </div>
            <p className="text-[10px] text-[#999999] font-mono flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
              {pendingCount} creating | <span className="text-rose-400">{failedCount} failed</span>
            </p>
          </div>
          <div className="p-3 bg-[#326ce5]/10 rounded-xl">
            <Activity className="h-6 w-6 text-[#326ce5]" />
          </div>
        </div>

        {/* Metric Card 3 */}
        <div className="bg-[#111112] border border-[#262626] p-5 rounded-2xl flex items-center justify-between shadow-lg shadow-[#0a0a0b]/20">
          <div className="space-y-2">
            <span className="text-[10px] font-mono font-bold tracking-wider text-[#666666] uppercase">
              Aggregate CPU
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-sans text-[#e2e2e4]">
                {Math.round(nodes.reduce((acc, n) => acc + n.cpuUsed, 0) / nodes.length)}%
              </span>
            </div>
            <div className="w-24 h-1 bg-[#1a1a1a] rounded-full overflow-hidden mt-1">
              <div
                className="h-full bg-amber-400"
                style={{
                  width: `${nodes.reduce((acc, n) => acc + n.cpuUsed, 0) / nodes.length}%`,
                }}
              />
            </div>
          </div>
          <div className="p-3 bg-amber-500/10 rounded-xl">
            <Cpu className="h-6 w-6 text-amber-400" />
          </div>
        </div>

        {/* Metric Card 4 */}
        <div className="bg-[#111112] border border-[#262626] p-5 rounded-2xl flex items-center justify-between shadow-lg shadow-[#0a0a0b]/20">
          <div className="space-y-2">
            <span className="text-[10px] font-mono font-bold tracking-wider text-[#666666] uppercase">
              Aggregate Memory
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-sans text-[#e2e2e4]">
                {Math.round(nodes.reduce((acc, n) => acc + n.memUsed, 0) / nodes.length)}%
              </span>
            </div>
            <div className="w-24 h-1 bg-[#1a1a1a] rounded-full overflow-hidden mt-1">
              <div
                className="h-full bg-sky-400"
                style={{
                  width: `${nodes.reduce((acc, n) => acc + n.memUsed, 0) / nodes.length}%`,
                }}
              />
            </div>
          </div>
          <div className="p-3 bg-sky-500/10 rounded-xl">
            <HardDrive className="h-6 w-6 text-sky-400" />
          </div>
        </div>
      </div>

      {/* Primary section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Visual Pods Matrix */}
        <div className="bg-[#111112] border border-[#262626] rounded-2xl p-5 shadow-xl shadow-[#0a0a0b]/10 lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-[#999999]" />
              <h3 className="font-sans font-semibold text-sm text-[#e2e2e4]">
                Interactive Pod Health Matrix
              </h3>
            </div>
            <span className="text-[10px] font-mono text-[#999999] px-2.5 py-0.5 bg-[#1a1a1a] rounded-full border border-[#262626]">
              Namespace: {activeNamespace}
            </span>
          </div>

          <p className="text-[11px] text-[#999999] leading-normal">
            Hover over and click any pod node to view its live performance logs, ports, environment bindings, and labels.
          </p>

          <div className="grid grid-cols-4 sm:grid-cols-8 md:grid-cols-10 gap-3 pt-3">
            {activeNamespacePods.map((pod) => (
              <button
                key={pod.name}
                onClick={() => onSelectPod(pod)}
                className="group relative bg-[#0a0a0b] hover:bg-[#1a1a1a] border border-[#262626] rounded-xl p-3 flex flex-col items-center justify-center transition-all cursor-pointer aspect-square"
              >
                {/* Glowing status circle */}
                <div className={`h-4.5 w-4.5 rounded-full shadow-lg flex items-center justify-center transition-all group-hover:scale-110 ${getStatusColor(pod.status)}`}>
                  {pod.status === "Failed" && <span className="text-[7px] text-white font-bold font-mono">!</span>}
                </div>

                <span className="text-[9px] font-mono font-medium text-[#999999] truncate w-full text-center mt-2.5">
                  {pod.name.split("-").slice(0, 2).join("-")}
                </span>

                {/* Micro tooltip */}
                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block bg-[#0a0a0b] text-[#e2e2e4] font-mono text-[9px] px-2 py-1 rounded shadow-xl border border-[#262626] whitespace-nowrap z-50">
                  {pod.name} ({pod.status})
                </span>
              </button>
            ))}
            {activeNamespacePods.length === 0 && (
              <div className="col-span-full py-12 text-center text-[#666666] font-mono text-xs">
                No active pods in namespace: {activeNamespace}
              </div>
            )}
          </div>

          {/* Status Color Legend */}
          <div className="flex items-center gap-4 pt-3 border-t border-[#262626]/60 text-[10px] font-mono text-[#999999]">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> Running
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" /> Creating/Pending
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-rose-500" /> CrashLoopBackOff/Failed
            </span>
          </div>
        </div>

        {/* Nodes Grid */}
        <div className="bg-[#111112] border border-[#262626] rounded-2xl p-5 shadow-xl shadow-[#0a0a0b]/10 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-sans font-semibold text-sm text-[#e2e2e4] flex items-center gap-2">
              <Server className="h-4 w-4 text-[#999999]" /> Cluster Nodes
            </h3>
            <button
              onClick={onRefresh}
              className="text-[10px] font-mono text-[#326ce5] hover:text-[#2557c0] flex items-center gap-1"
            >
              <RefreshCw className="h-3 w-3" /> reload
            </button>
          </div>

          <div className="space-y-3">
            {nodes.map((node) => (
              <div
                key={node.name}
                onClick={() => setSelectedNode(node)}
                className="bg-[#0a0a0b] hover:bg-[#1a1a1a]/40 p-3.5 rounded-xl border border-[#262626] flex items-center justify-between cursor-pointer transition-colors group"
              >
                <div className="space-y-1">
                  <div className="text-xs font-semibold text-[#e2e2e4] flex items-center gap-1.5">
                    {node.name}
                    {node.roles === "control-plane" && (
                      <span className="text-[8px] px-1 bg-violet-500/10 text-violet-400 border border-violet-500/20 rounded font-mono uppercase">
                        Master
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] font-mono text-[#999999]">
                    {node.version} | age: {node.age}
                  </div>
                </div>

                <div className="text-right space-y-2">
                  <div className="flex gap-3 text-[10px] font-mono">
                    <span className={node.cpuUsed > 80 ? "text-rose-400 font-semibold" : "text-[#e2e2e4]"}>
                      CPU: {node.cpuUsed}%
                    </span>
                    <span className={node.memUsed > 80 ? "text-rose-400 font-semibold" : "text-[#e2e2e4]"}>
                      MEM: {node.memUsed}%
                    </span>
                  </div>
                  <div className="h-1 w-28 bg-[#1a1a1a] rounded-full overflow-hidden ml-auto">
                    <div
                      className={`h-full ${node.cpuUsed > 80 ? "bg-rose-500" : "bg-[#326ce5]"}`}
                      style={{ width: `${node.cpuUsed}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Events / Audit trail */}
      <div className="bg-[#111112] border border-[#262626] rounded-2xl p-5 shadow-xl shadow-[#0a0a0b]/10 space-y-4">
        <h3 className="font-sans font-semibold text-sm text-[#e2e2e4] flex items-center gap-2">
          <Calendar className="h-4 w-4 text-[#999999]" /> Cluster Audit Trail & Log Stream
        </h3>

        <div className="border border-[#262626] rounded-xl overflow-hidden bg-[#0a0a0b]">
          <div className="grid grid-cols-12 gap-3 px-4 py-2 bg-[#111112] text-[10px] font-mono font-bold tracking-wider text-[#999999] border-b border-[#262626] uppercase">
            <div className="col-span-2">Age</div>
            <div className="col-span-2">Type</div>
            <div className="col-span-2">Reason</div>
            <div className="col-span-2">Resource</div>
            <div className="col-span-4">Message</div>
          </div>

          <div className="divide-y divide-[#262626] max-h-56 overflow-y-auto">
            {events.map((evt, i) => (
              <div
                key={i}
                className="grid grid-cols-12 gap-3 px-4 py-2.5 text-[11px] font-mono text-[#e2e2e4] items-center hover:bg-[#111112]/40"
              >
                <div className="col-span-2 text-[#999999]">{evt.time}</div>
                <div className="col-span-2">
                  <span
                    className={`px-1.5 py-0.5 rounded font-bold text-[9px] uppercase ${
                      evt.type === "Warning"
                        ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                        : "bg-[#1a1a1a] text-[#e2e2e4]"
                    }`}
                  >
                    {evt.type}
                  </span>
                </div>
                <div className="col-span-2 text-[#e2e2e4] font-semibold">{evt.reason}</div>
                <div className="col-span-2 text-[#326ce5] truncate">{evt.object}</div>
                <div className="col-span-4 text-[#999999]">{evt.message}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Node Detail Sheet Modal */}
      {selectedNode && (
        <div className="fixed inset-0 z-50 bg-[#0a0a0b]/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111112] border border-[#262626] rounded-2xl max-w-lg w-full p-6 relative shadow-2xl space-y-5">
            <button
              onClick={() => setSelectedNode(null)}
              className="absolute top-4 right-4 p-1 text-[#999999] hover:text-[#e2e2e4] hover:bg-[#1a1a1a] rounded"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#326ce5]/10 border border-[#326ce5]/20 rounded-xl text-[#326ce5]">
                <Server className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-[#e2e2e4] font-sans">{selectedNode.name}</h4>
                <p className="text-[10px] font-mono text-[#999999]">Node specifications & resources</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 bg-[#0a0a0b] p-4 rounded-xl border border-[#262626] text-xs font-mono">
              <div>
                <span className="text-[#666666] block">ROLE</span>
                <span className="text-[#e2e2e4] font-semibold">{selectedNode.roles}</span>
              </div>
              <div>
                <span className="text-[#666666] block">KUBELET VERSION</span>
                <span className="text-[#e2e2e4]">{selectedNode.version}</span>
              </div>
              <div className="mt-2">
                <span className="text-[#666666] block">AGE</span>
                <span className="text-[#e2e2e4]">{selectedNode.age}</span>
              </div>
              <div className="mt-2">
                <span className="text-[#666666] block">OS PLATFORM</span>
                <span className="text-[#e2e2e4]">Linux / Alpine</span>
              </div>
              <div className="mt-2">
                <span className="text-[#666666] block">CPU MAXIMUM CAPACITY</span>
                <span className="text-[#e2e2e4]">{selectedNode.cpuMax}</span>
              </div>
              <div className="mt-2">
                <span className="text-[#666666] block">MEMORY MAXIMUM CAPACITY</span>
                <span className="text-[#e2e2e4]">{selectedNode.memMax}</span>
              </div>
            </div>

            <div className="space-y-3">
              <span className="text-[10px] font-mono font-bold text-[#666666] uppercase block">
                Live Node Capacity Utilization
              </span>
              <div className="space-y-2 text-xs font-mono">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-[#999999]">CPU Load</span>
                    <span className="text-[#e2e2e4]">{selectedNode.cpuUsed}%</span>
                  </div>
                  <div className="h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
                    <div className="h-full bg-amber-400" style={{ width: `${selectedNode.cpuUsed}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-[#999999]">Memory Load</span>
                    <span className="text-[#e2e2e4]">{selectedNode.memUsed}%</span>
                  </div>
                  <div className="h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
                    <div className="h-full bg-sky-400" style={{ width: `${selectedNode.memUsed}%` }} />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedNode(null)}
                className="px-4 py-2 bg-[#1a1a1a] hover:bg-[#262626] text-[#e2e2e4] text-xs font-medium rounded-lg transition-colors cursor-pointer"
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
