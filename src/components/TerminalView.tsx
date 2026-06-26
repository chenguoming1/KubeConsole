import React, { useState, useRef, useEffect } from "react";
import { Terminal as TermIcon, Play, HelpCircle, CornerDownLeft, Shield, Sparkles, ChevronRight, RefreshCw } from "lucide-react";
import { RbacRole } from "../types";

interface TerminalViewProps {
  activeRole: RbacRole;
  activeNamespace: string;
  onRefreshAll?: () => void;
  // Callback so that external tools can insert a command directly
  commandToExecute?: string;
  clearCommandToExecute?: () => void;
}

interface CommandHistoryEntry {
  command: string;
  output: string;
  success: boolean;
  timestamp: string;
}

export default function TerminalView({
  activeRole,
  activeNamespace,
  onRefreshAll,
  commandToExecute,
  clearCommandToExecute,
}: TerminalViewProps) {
  const [command, setCommand] = useState("");
  const [history, setHistory] = useState<CommandHistoryEntry[]>([
    {
      command: "kubectl get nodes",
      output: `NAME                     STATUS   ROLES           AGE   VERSION
control-plane-node-1     Ready    control-plane   12d   v1.28.2
worker-node-1            Ready    worker          12d   v1.28.2
worker-node-2            Ready    worker          12d   v1.28.2
worker-node-3            Ready    worker          5d    v1.28.2`,
      success: true,
      timestamp: "17:30:00",
    },
  ]);
  const [commandHistoryIndex, setCommandHistoryIndex] = useState<number>(-1);
  const [typedCommands, setTypedCommands] = useState<string[]>(["kubectl get nodes"]);
  const [loading, setLoading] = useState(false);

  const consoleEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, loading]);

  // Execute external commands directly (e.g., from Copilot)
  useEffect(() => {
    if (commandToExecute) {
      setCommand(commandToExecute);
      executeCommand(commandToExecute);
      if (clearCommandToExecute) clearCommandToExecute();
    }
  }, [commandToExecute]);

  const executeCommand = async (cmdString: string) => {
    const trimmed = cmdString.trim();
    if (!trimmed) return;

    setLoading(true);
    setCommand("");

    // Add command to navigation history
    const newTyped = [...typedCommands, trimmed];
    setTypedCommands(newTyped);
    setCommandHistoryIndex(-1);

    const timestamp = new Date().toLocaleTimeString().substring(0, 8);

    try {
      const res = await fetch("/api/k8s/kubectl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          command: trimmed,
          role: activeRole,
          namespace: activeNamespace,
        }),
      });

      const data = await res.json();

      setHistory((prev) => [
        ...prev,
        {
          command: trimmed,
          output: data.output,
          success: data.success,
          timestamp,
        },
      ]);

      // If modification action succeeded, trigger re-fetch of resource matrices
      if (data.success && onRefreshAll && (trimmed.includes("delete") || trimmed.includes("scale") || trimmed.includes("apply") || trimmed.includes("run") || trimmed.includes("create"))) {
        onRefreshAll();
      }
    } catch (err: any) {
      setHistory((prev) => [
        ...prev,
        {
          command: trimmed,
          output: `Error connecting to API backend service: ${err.message}`,
          success: false,
          timestamp,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      executeCommand(command);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (typedCommands.length === 0) return;
      const nextIdx = commandHistoryIndex === -1 ? typedCommands.length - 1 : Math.max(0, commandHistoryIndex - 1);
      setCommandHistoryIndex(nextIdx);
      setCommand(typedCommands[nextIdx]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (commandHistoryIndex === -1) return;
      if (commandHistoryIndex === typedCommands.length - 1) {
        setCommandHistoryIndex(-1);
        setCommand("");
      } else {
        const nextIdx = commandHistoryIndex + 1;
        setCommandHistoryIndex(nextIdx);
        setCommand(typedCommands[nextIdx]);
      }
    }
  };

  const clearConsole = () => {
    setHistory([]);
  };

  const quickCommands = [
    { label: "Get Active Pods", cmd: "kubectl get pods" },
    { label: "Get Cluster Nodes", cmd: "kubectl get nodes" },
    { label: "Get All Resources", cmd: "kubectl get all" },
    { label: "Describe Frontend Service", cmd: "kubectl describe svc frontend-service" },
    { label: "Describe DB Secrets", cmd: "kubectl describe secret db-secrets" },
    { label: "Show Audit Events", cmd: "kubectl get events" },
  ];

  return (
    <div className="space-y-4">
      {/* Prompt / Title banner */}
      <div className="bg-[#111112] border border-[#262626] p-4 rounded-xl flex items-center justify-between shadow-lg text-xs">
        <div className="flex items-center gap-2.5">
          <div className="p-1 bg-amber-500/10 text-amber-400 rounded">
            <Shield className="h-4 w-4" />
          </div>
          <div>
            <div className="font-semibold text-[#e2e2e4] flex items-center gap-1.5">
              Secure CLI Browser Shell
              <span className="text-[10px] font-mono px-1 bg-[#1a1a1a] border border-[#262626] text-[#999999] rounded">
                Namespace: {activeNamespace}
              </span>
            </div>
            <p className="text-[11px] text-[#999999] mt-0.5">
              kubectl operations authorized via RBAC: <span className="font-mono text-[#326ce5] font-bold">{activeRole}</span>
            </p>
          </div>
        </div>

        <button
          onClick={clearConsole}
          className="px-3 py-1.5 bg-[#1a1a1a] hover:bg-[#262626] font-mono text-[11px] text-[#e2e2e4] rounded border border-[#262626] hover:border-[#262626] transition-colors cursor-pointer"
        >
          clear shell
        </button>
      </div>

      {/* Quick shortcuts bar */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-mono text-[10px] text-[#666666] mr-1 uppercase font-bold">Quick CLI Commands:</span>
        {quickCommands.map((qc, i) => (
          <button
            key={i}
            onClick={() => {
              setCommand(qc.cmd);
              executeCommand(qc.cmd);
            }}
            className="px-2.5 py-1 bg-[#1a1a1a] hover:bg-[#262626] text-[#e2e2e4] rounded-lg border border-[#262626] hover:border-[#262626] transition-all font-mono text-[11px] flex items-center gap-1 cursor-pointer"
          >
            <ChevronRight className="h-3 w-3 text-[#666666]" />
            {qc.label}
          </button>
        ))}
      </div>

      {/* Terminal Board */}
      <div className="bg-[#0a0a0b] border border-[#262626] rounded-2xl overflow-hidden shadow-2xl flex flex-col min-h-[420px] max-h-[600px] font-mono">
        {/* Window controls */}
        <div className="px-4 py-2 bg-[#111112] border-b border-[#262626] flex items-center justify-between text-xs text-[#999999]">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-rose-500/80 inline-block" />
            <span className="h-3 w-3 rounded-full bg-amber-500/80 inline-block" />
            <span className="h-3 w-3 rounded-full bg-emerald-500/80 inline-block" />
            <span className="text-[10px] text-[#999999] ml-2">kubectl-secure-proxy (zsh)</span>
          </div>
          <div className="text-[10px] text-[#666666] flex items-center gap-1.5">
            <Sparkles className="h-3 w-3 text-[#326ce5]" />
            Gemini parsing enabled
          </div>
        </div>

        {/* Output console */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs text-[#e2e2e4] selection:bg-[#1a1a1a] leading-normal select-all">
          {history.map((h, i) => (
            <div key={i} className="space-y-1.5">
              {/* Command Prompt */}
              <div className="flex items-center gap-1.5 font-semibold text-[#999999]">
                <span className="text-emerald-400">heliexpert@k8s-console</span>
                <span>:</span>
                <span className="text-[#326ce5]">~</span>
                <span className="text-[#999999]">$</span>
                <span className="text-[#e2e2e4] select-all font-bold">{h.command}</span>
                <span className="text-[10px] text-slate-600 font-mono ml-auto">{h.timestamp}</span>
              </div>

              {/* Output Content */}
              <pre className={`whitespace-pre-wrap font-mono p-3 bg-[#111112]/40 rounded-lg border leading-relaxed ${
                h.success ? "text-[#e2e2e4] border-[#262626]" : "text-rose-400 border-rose-950/40 bg-rose-950/5"
              }`}>
                {h.output}
              </pre>
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-[#326ce5] animate-pulse font-mono">
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              <span>Querying kubernetes API server proxy...</span>
            </div>
          )}

          <div ref={consoleEndRef} />
        </div>

        {/* Input prompt line */}
        <div className="p-3 bg-[#111112] border-t border-[#262626] flex items-center gap-2">
          <div className="flex items-center gap-1 text-[#999999] text-xs select-none">
            <span className="text-emerald-400">heliexpert@k8s-console</span>
            <span>:</span>
            <span className="text-[#326ce5]">~</span>
            <span className="text-[#999999]">$</span>
          </div>
          <input
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type kubectl command... (e.g. kubectl get pods)"
            className="flex-1 bg-transparent border-none outline-none font-mono text-xs text-[#e2e2e4] placeholder:text-[#666666] font-semibold"
            disabled={loading}
            autoFocus
          />
          <button
            onClick={() => executeCommand(command)}
            className="p-1.5 bg-[#1a1a1a] hover:bg-[#262626] text-[#e2e2e4] border border-[#262626] rounded-lg cursor-pointer transition-colors"
            disabled={loading || !command.trim()}
          >
            <Play className="h-3 w-3" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 text-[11px] text-[#666666] font-mono justify-center">
        <HelpCircle className="h-3 w-3" />
        Use <kbd className="px-1 py-0.5 bg-[#1a1a1a] rounded">ArrowUp</kbd> and <kbd className="px-1 py-0.5 bg-[#1a1a1a] rounded">ArrowDown</kbd> to cycle command execution history logs.
      </div>
    </div>
  );
}
