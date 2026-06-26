import React from "react";
import {
  LayoutDashboard,
  Box,
  Layers2,
  Lock,
  Terminal,
  Cpu,
  ShieldCheck,
  Bot,
  Zap,
  HelpCircle,
  FolderTree
} from "lucide-react";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  copilotOpen: boolean;
  setCopilotOpen: (open: boolean) => void;
  clusterStats: {
    podsRunning: number;
    podsTotal: number;
    cpuUtil: number;
    memUtil: number;
  };
}

export default function Sidebar({
  activeTab,
  setActiveTab,
  copilotOpen,
  setCopilotOpen,
  clusterStats,
}: SidebarProps) {
  const menuItems = [
    { id: "overview", label: "Cluster Health", icon: LayoutDashboard },
    { id: "pods", label: "Pods & Workloads", icon: Box },
    { id: "services", label: "Services & Networking", icon: Layers2 },
    { id: "config", label: "Config & Secrets", icon: Lock },
    { id: "terminal", label: "kubectl CLI Shell", icon: Terminal },
    { id: "deploy", label: "Deploy Wizard", icon: Cpu },
    { id: "rbac", label: "Access & RBAC", icon: ShieldCheck },
  ];

  return (
    <aside className="w-64 border-r border-[#262626] bg-[#111112] flex flex-col justify-between h-[calc(100vh-4rem)] sticky top-16">
      {/* Navigation */}
      <div className="p-4 space-y-6">
        <div>
          <span className="text-[10px] font-mono font-semibold tracking-wider text-[#666666] uppercase px-3">
            CLUSTER EXPLORER
          </span>
          <nav className="mt-2 space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                    isActive
                      ? "bg-[#1a1a1a] text-[#326ce5] border-l-2 border-[#326ce5] font-semibold"
                      : "text-[#999999] hover:text-[#e2e2e4] hover:bg-[#1a1a1a]/50"
                  }`}
                >
                  <Icon className={`h-4 w-4 ${isActive ? "text-[#326ce5]" : "text-[#999999]"}`} />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Dynamic quick assistant shortcut */}
        <div className="bg-[#111112]/40 border border-[#262626] p-4 rounded-xl space-y-3">
          <div className="flex items-center gap-2">
            <div className="p-1 bg-[#326ce5]/10 rounded-md">
              <Bot className="h-4 w-4 text-[#326ce5] animate-bounce" />
            </div>
            <span className="text-xs font-semibold text-[#e2e2e4]">Gemini Copilot</span>
          </div>
          <p className="text-[11px] text-[#999999] leading-relaxed">
            Stuck writing YAML or looking for kubectl helper scripts? Speak to the Gemini Assistant.
          </p>
          <button
            onClick={() => setCopilotOpen(!copilotOpen)}
            className={`w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs transition-all ${
              copilotOpen
                ? "bg-[#326ce5] text-white font-medium hover:bg-[#2557c0]"
                : "bg-[#326ce5]/10 text-[#326ce5] border border-[#326ce5]/20 hover:bg-[#326ce5]/20"
            }`}
          >
            <Zap className="h-3 w-3" />
            {copilotOpen ? "Close Copilot" : "Open Kube Copilot"}
          </button>
        </div>
      </div>

      {/* Footer Resource Monitors */}
      <div className="p-4 border-t border-[#262626] space-y-4 bg-[#0a0a0b]/40">
        <span className="text-[10px] font-mono font-semibold tracking-wider text-[#666666] uppercase block">
          RESOURCE GAUGES
        </span>

        {/* Pods usage gauge */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] font-mono text-[#999999]">
            <span>Pods Running</span>
            <span>{clusterStats.podsRunning}/{clusterStats.podsTotal}</span>
          </div>
          <div className="h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#326ce5] transition-all duration-500"
              style={{ width: `${(clusterStats.podsRunning / clusterStats.podsTotal) * 100}%` }}
            />
          </div>
        </div>

        {/* CPU usage gauge */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] font-mono text-[#999999]">
            <span>Cluster-wide CPU</span>
            <span>{clusterStats.cpuUtil}%</span>
          </div>
          <div className="h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                clusterStats.cpuUtil > 80 ? "bg-rose-500" : clusterStats.cpuUtil > 50 ? "bg-amber-500" : "bg-emerald-500"
              }`}
              style={{ width: `${clusterStats.cpuUtil}%` }}
            />
          </div>
        </div>

        {/* Memory usage gauge */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] font-mono text-[#999999]">
            <span>Cluster-wide Mem</span>
            <span>{clusterStats.memUtil}%</span>
          </div>
          <div className="h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                clusterStats.memUtil > 80 ? "bg-rose-500" : clusterStats.memUtil > 50 ? "bg-amber-500" : "bg-emerald-400"
              }`}
              style={{ width: `${clusterStats.memUtil}%` }}
            />
          </div>
        </div>

        <div className="text-[10px] text-[#666666] font-mono text-center flex items-center justify-center gap-1 pt-1">
          <HelpCircle className="h-3 w-3" />
          Press ? for shortcuts
        </div>
      </div>
    </aside>
  );
}
