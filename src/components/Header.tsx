import React from "react";
import { Shield, Network, ChevronDown, Layers, Terminal as TermIcon, AlertTriangle } from "lucide-react";
import { RbacRole, NamespaceInfo } from "../types";

interface HeaderProps {
  namespaces: NamespaceInfo[];
  activeNamespace: string;
  setActiveNamespace: (ns: string) => void;
  activeRole: RbacRole;
  setActiveRole: (role: RbacRole) => void;
  clusterHealthy: boolean;
}

export default function Header({
  namespaces,
  activeNamespace,
  setActiveNamespace,
  activeRole,
  setActiveRole,
  clusterHealthy,
}: HeaderProps) {
  const roles: RbacRole[] = ["ClusterAdmin", "NamespaceManager", "Developer", "ReadOnly"];

  const getRoleBadgeColor = (role: RbacRole) => {
    switch (role) {
      case "ClusterAdmin":
        return "bg-rose-500/10 text-rose-400 border border-rose-500/30";
      case "NamespaceManager":
        return "bg-amber-500/10 text-amber-400 border border-amber-500/30";
      case "Developer":
        return "bg-blue-500/10 text-blue-400 border border-blue-500/30";
      case "ReadOnly":
        return "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30";
    }
  };

  return (
    <header className="h-16 border-b border-[#262626] bg-[#0a0a0b]/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-40">
      {/* Brand */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-gradient-to-tr from-[#326ce5] to-[#2557c0] rounded-lg shadow-lg shadow-[#326ce5]/10">
          <Network className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="font-sans font-bold text-[#e2e2e4] tracking-tight text-base flex items-center gap-2">
            KubeConsole
            <span className="text-xs font-mono font-medium text-[#326ce5] bg-[#326ce5]/10 px-1.5 py-0.5 rounded border border-[#326ce5]/20">
              v1.28
            </span>
          </h1>
          <p className="text-[10px] text-[#999999] font-mono">browser-authorized-session</p>
        </div>
      </div>

      {/* Cluster state & selectors */}
      <div className="flex items-center gap-4">
        {/* Connection status */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-[#111112]/40 rounded-lg border border-[#262626] text-xs text-[#e2e2e4]">
          <span className={`h-2 w-2 rounded-full ${clusterHealthy ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`} />
          <span className="font-mono text-[11px]">
            {clusterHealthy ? "sim-cluster-01 (ready)" : "cluster-disconnected"}
          </span>
        </div>

        {/* Namespace selector */}
        <div className="relative">
          <label className="absolute -top-1.5 left-2 px-1 bg-[#0a0a0b] text-[9px] font-mono text-[#999999]">
            NAMESPACE
          </label>
          <div className="flex items-center gap-1.5 bg-[#111112]/60 hover:bg-[#1a1a1a] text-[#e2e2e4] px-3 py-1.5 rounded-lg border border-[#262626] cursor-pointer text-xs transition-colors group">
            <Layers className="h-3.5 w-3.5 text-[#999999] group-hover:text-[#e2e2e4]" />
            <select
              value={activeNamespace}
              onChange={(e) => setActiveNamespace(e.target.value)}
              className="bg-transparent border-none outline-none pr-6 cursor-pointer font-sans appearance-none"
            >
              <option value="all" className="bg-[#111112] text-[#e2e2e4]">All Namespaces</option>
              {namespaces.map((ns) => (
                <option key={ns.name} value={ns.name} className="bg-[#111112] text-[#e2e2e4]">
                  {ns.name}
                </option>
              ))}
            </select>
            <ChevronDown className="h-3 w-3 text-[#999999] pointer-events-none absolute right-3" />
          </div>
        </div>

        {/* RBAC Role Selector */}
        <div className="relative">
          <label className="absolute -top-1.5 left-2 px-1 bg-[#0a0a0b] text-[9px] font-mono text-[#999999]">
            RBAC ROLE
          </label>
          <div className="flex items-center gap-1.5 bg-[#111112]/60 hover:bg-[#1a1a1a] text-[#e2e2e4] px-3 py-1.5 rounded-lg border border-[#262626] cursor-pointer text-xs transition-colors group">
            <Shield className="h-3.5 w-3.5 text-[#326ce5]" />
            <select
              value={activeRole}
              onChange={(e) => setActiveRole(e.target.value as RbacRole)}
              className="bg-transparent border-none outline-none pr-6 cursor-pointer font-sans appearance-none font-medium"
            >
              {roles.map((r) => (
                <option key={r} value={r} className="bg-[#111112] text-[#e2e2e4]">
                  {r === "ClusterAdmin" ? "ClusterAdmin (Root)" : r}
                </option>
              ))}
            </select>
            <ChevronDown className="h-3 w-3 text-[#999999] pointer-events-none absolute right-3" />
          </div>
        </div>

        {/* User profile */}
        <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-[#262626]">
          <div className="h-8 w-8 rounded-lg bg-[#111112] border border-[#262626] flex items-center justify-between p-1">
            <Shield className={`h-full w-full ${activeRole === "ClusterAdmin" ? "text-rose-400" : "text-[#326ce5]"}`} />
          </div>
          <div className="text-left">
            <div className="text-xs font-medium text-[#e2e2e4] max-w-[120px] truncate">heliexpert</div>
            <div className={`text-[10px] font-mono px-1 rounded inline-block ${getRoleBadgeColor(activeRole)}`}>
              {activeRole}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
