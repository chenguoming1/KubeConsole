import React, { useState } from "react";
import { Cpu, Send, FileCode, CheckCircle, ChevronRight, Sparkles, RefreshCw, AlertCircle, Plus, Trash2, HelpCircle } from "lucide-react";
import { RbacRole, NamespaceInfo } from "../types";

interface DeployWizardProps {
  namespaces: NamespaceInfo[];
  activeNamespace: string;
  activeRole: RbacRole;
  onRefreshAll: () => void;
  yamlFromCopilot?: string;
  clearYamlFromCopilot?: () => void;
}

export default function DeployWizard({
  namespaces,
  activeNamespace,
  activeRole,
  onRefreshAll,
  yamlFromCopilot,
  clearYamlFromCopilot,
}: DeployWizardProps) {
  const [activeTab, setActiveTab] = useState<"wizard" | "yaml">("wizard");

  // Wizard States
  const [name, setName] = useState("");
  const [namespace, setNamespace] = useState(activeNamespace === "all" ? "default" : activeNamespace);
  const [image, setImage] = useState("");
  const [replicas, setReplicas] = useState(1);
  const [port, setPort] = useState("");
  const [createService, setCreateService] = useState(false);
  const [createDeployment, setCreateDeployment] = useState(true);
  const [serviceType, setServiceType] = useState("ClusterIP");

  const [envVars, setEnvVars] = useState<Array<{ name: string; value: string }>>([]);
  const [newEnvName, setNewEnvName] = useState("");
  const [newEnvValue, setNewEnvValue] = useState("");

  const [cpu, setCpu] = useState("100");
  const [mem, setMem] = useState("256");

  // YAML Manifest Editor state
  const [yamlConfig, setYamlConfig] = useState(`apiVersion: apps/v1
kind: Deployment
metadata:
  name: sample-nginx
  namespace: default
  labels:
    app: web
spec:
  replicas: 2
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
      - name: nginx
        image: nginx:alpine
        ports:
        - containerPort: 80
`);

  // Loaded from Copilot
  React.useEffect(() => {
    if (yamlFromCopilot) {
      setYamlConfig(yamlFromCopilot);
      setActiveTab("yaml");
      if (clearYamlFromCopilot) clearYamlFromCopilot();
    }
  }, [yamlFromCopilot]);

  // AI Prompt assistant inside deployment
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  // Status/Error indicators
  const [submitting, setSubmitting] = useState(false);
  const [outcome, setOutcome] = useState<{ status: "idle" | "success" | "error"; message: string }>({
    status: "idle",
    message: "",
  });

  const handleAddEnv = () => {
    if (!newEnvName.trim()) return;
    setEnvVars((prev) => [...prev, { name: newEnvName.trim(), value: newEnvValue.trim() }]);
    setNewEnvName("");
    setNewEnvValue("");
  };

  const handleRemoveEnv = (index: number) => {
    setEnvVars((prev) => prev.filter((_, i) => i !== index));
  };

  // Run AI Manifest generation
  const handleAiGenerate = async () => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    setOutcome({ status: "idle", message: "" });

    try {
      const promptText = `Generate a fully optimized Kubernetes YAML deployment configuration block based on this prompt: "${aiPrompt}". Return ONLY valid YAML inside markdown block.`;
      const res = await fetch("/api/copilot/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: promptText }),
      });

      const data = await res.json();
      // Extract code block
      const match = data.text.match(/```(?:yaml)?([\s\S]*?)```/);
      const code = match ? match[1].trim() : data.text.trim();

      setYamlConfig(code);
      setActiveTab("yaml");
      setOutcome({ status: "success", message: "YAML manifest synthesized by Gemini Loaded!" });
    } catch (err: any) {
      setOutcome({ status: "error", message: `AI generator failed: ${err.message}` });
    } finally {
      setAiLoading(false);
    }
  };

  const handleDeployWizard = async () => {
    // RBAC check
    if (activeRole === "ReadOnly") {
      setOutcome({ status: "error", message: "RBAC Forbidden: User in role ReadOnly is unauthorized to deploy workloads." });
      return;
    }

    if (!name.trim() || !image.trim()) {
      setOutcome({ status: "error", message: "Application Name and Docker Image fields are mandatory." });
      return;
    }

    setSubmitting(true);
    setOutcome({ status: "idle", message: "" });

    try {
      const res = await fetch("/api/k8s/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          namespace,
          image: image.trim(),
          replicas,
          ports: port,
          createService,
          createDeployment,
          serviceType,
          env: envVars,
          cpu,
          mem,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to deploy resources");

      setOutcome({ status: "success", message: `Deployment sequence for "${name}" successfully requested on namespace: "${namespace}".` });
      onRefreshAll();

      // Reset
      setName("");
      setImage("");
      setPort("");
      setEnvVars([]);
    } catch (err: any) {
      setOutcome({ status: "error", message: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeployYaml = async () => {
    // RBAC check
    if (activeRole === "ReadOnly") {
      setOutcome({ status: "error", message: "RBAC Forbidden: User in role ReadOnly is unauthorized to deploy workloads." });
      return;
    }

    setSubmitting(true);
    setOutcome({ status: "idle", message: "" });

    try {
      const res = await fetch("/api/k8s/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ yaml: yamlConfig }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to apply YAML configuration");

      setOutcome({ status: "success", message: "YAML Configuration successfully applied and synced into simulated cluster." });
      onRefreshAll();
    } catch (err: any) {
      setOutcome({ status: "error", message: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Selector tab buttons */}
      <div className="flex items-center justify-between border-b border-[#262626] pb-3">
        <div className="flex gap-2">
          <button
            onClick={() => {
              setActiveTab("wizard");
              setOutcome({ status: "idle", message: "" });
            }}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              activeTab === "wizard"
                ? "bg-[#326ce5] text-white"
                : "bg-[#1a1a1a]/40 text-[#999999] hover:text-[#e2e2e4]"
            }`}
          >
            Deploy Workload Wizard
          </button>
          <button
            onClick={() => {
              setActiveTab("yaml");
              setOutcome({ status: "idle", message: "" });
            }}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              activeTab === "yaml"
                ? "bg-[#326ce5] text-white"
                : "bg-[#1a1a1a]/40 text-[#999999] hover:text-[#e2e2e4]"
            }`}
          >
            Raw YAML Manifest
          </button>
        </div>

        <span className="text-[10px] font-mono text-[#666666] uppercase tracking-widest font-bold">
          RBAC: {activeRole}
        </span>
      </div>

      {/* Outcome notification box */}
      {outcome.status !== "idle" && (
        <div
          className={`p-4 rounded-xl flex items-start gap-3 border text-xs font-mono leading-relaxed ${
            outcome.status === "success"
              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
              : "bg-rose-500/10 text-rose-400 border-rose-500/20"
          }`}
        >
          {outcome.status === "success" ? (
            <CheckCircle className="h-4.5 w-4.5 shrink-0" />
          ) : (
            <AlertCircle className="h-4.5 w-4.5 shrink-0" />
          )}
          <span>{outcome.message}</span>
        </div>
      )}

      {/* Tabs Layout */}
      {activeTab === "wizard" ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Wizard Form */}
          <div className="bg-[#111112] border border-[#262626] rounded-2xl p-6 lg:col-span-2 space-y-5 shadow-lg">
            <h3 className="font-sans font-semibold text-sm text-[#e2e2e4]">Workload Parameters</h3>

            <div className="grid grid-cols-2 gap-4">
              {/* App name */}
              <div className="space-y-1.5 col-span-2 sm:col-span-1">
                <label className="text-[10px] font-mono text-[#999999] uppercase tracking-wider block">
                  Application Name <span className="text-[#326ce5]">*</span>
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. backend-redis"
                  className="w-full bg-[#0a0a0b] border border-[#262626] rounded-lg px-3 py-2 text-xs text-[#e2e2e4] outline-none focus:border-[#326ce5]"
                />
              </div>

              {/* Namespace */}
              <div className="space-y-1.5 col-span-2 sm:col-span-1">
                <label className="text-[10px] font-mono text-[#999999] uppercase tracking-wider block">
                  Target Namespace <span className="text-[#326ce5]">*</span>
                </label>
                <select
                  value={namespace}
                  onChange={(e) => setNamespace(e.target.value)}
                  className="w-full bg-[#0a0a0b] border border-[#262626] rounded-lg px-3 py-2 text-xs text-[#e2e2e4] outline-none focus:border-[#326ce5] cursor-pointer"
                >
                  {namespaces.map((ns) => (
                    <option key={ns.name} value={ns.name}>
                      {ns.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Docker Image */}
              <div className="space-y-1.5 col-span-2">
                <label className="text-[10px] font-mono text-[#999999] uppercase tracking-wider block">
                  Container Docker Image <span className="text-[#326ce5]">*</span>
                </label>
                <input
                  value={image}
                  onChange={(e) => setImage(e.target.value)}
                  placeholder="e.g. redis:alpine, node:18-slim, nginx:latest"
                  className="w-full bg-[#0a0a0b] border border-[#262626] rounded-lg px-3 py-2 text-xs text-[#e2e2e4] outline-none focus:border-[#326ce5]"
                />
              </div>

              {/* Replicas & Port */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono text-[#999999] uppercase tracking-wider block">
                  Replicas count
                </label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={replicas}
                  onChange={(e) => setReplicas(parseInt(e.target.value, 10))}
                  className="w-full bg-[#0a0a0b] border border-[#262626] rounded-lg px-3 py-2 text-xs text-[#e2e2e4] outline-none focus:border-[#326ce5]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-mono text-[#999999] uppercase tracking-wider block">
                  Target container port (Optional)
                </label>
                <input
                  type="number"
                  placeholder="e.g. 80, 8080, 6379"
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  className="w-full bg-[#0a0a0b] border border-[#262626] rounded-lg px-3 py-2 text-xs text-[#e2e2e4] outline-none focus:border-[#326ce5]"
                />
              </div>
            </div>

            {/* Service exposure */}
            <div className="space-y-3 bg-[#0a0a0b] p-4 border border-[#262626] rounded-xl">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-[#e2e2e4]">Expose Network Port</h4>
                  <p className="text-[10px] text-[#999999]">Generate corresponding ClusterIP or LoadBalancer Service</p>
                </div>
                <input
                  type="checkbox"
                  checked={createService}
                  onChange={(e) => setCreateService(e.target.checked)}
                  disabled={!port}
                  className="h-4.5 w-4.5 accent-[#326ce5] rounded cursor-pointer"
                />
              </div>

              {createService && port && (
                <div className="pt-2">
                  <label className="text-[9px] font-mono text-[#666666] uppercase block mb-1">
                    SERVICE TYPE
                  </label>
                  <div className="flex gap-4 text-xs font-mono">
                    {["ClusterIP", "NodePort", "LoadBalancer"].map((t) => (
                      <label key={t} className="flex items-center gap-1.5 text-[#e2e2e4] cursor-pointer">
                        <input
                          type="radio"
                          name="srvType"
                          value={t}
                          checked={serviceType === t}
                          onChange={(e) => setServiceType(e.target.value)}
                          className="accent-[#326ce5]"
                        />
                        {t}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Environment variables */}
            <div className="space-y-3">
              <span className="text-[10px] font-mono font-bold text-[#666666] uppercase tracking-wider block">
                Environment variables (Config / Secrets)
              </span>

              {/* Existing variables */}
              {envVars.length > 0 && (
                <div className="space-y-1.5 bg-[#0a0a0b] p-3 rounded-lg border border-[#262626]">
                  {envVars.map((env, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs font-mono bg-[#111112] px-3 py-1.5 rounded border border-[#262626] text-[#e2e2e4]">
                      <span>
                        <span className="text-[#999999] font-semibold">{env.name}</span> = <span className="text-[#326ce5]">{env.value}</span>
                      </span>
                      <button
                        onClick={() => handleRemoveEnv(idx)}
                        className="text-[#666666] hover:text-rose-400 p-0.5"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Env Form */}
              <div className="flex gap-2">
                <input
                  placeholder="NAME (e.g. DB_HOST)"
                  value={newEnvName}
                  onChange={(e) => setNewEnvName(e.target.value)}
                  className="bg-[#0a0a0b] text-xs text-[#e2e2e4] border border-[#262626] rounded-lg px-3 py-1.5 flex-1 outline-none font-mono"
                />
                <input
                  placeholder="VALUE (e.g. postgres-service)"
                  value={newEnvValue}
                  onChange={(e) => setNewEnvValue(e.target.value)}
                  className="bg-[#0a0a0b] text-xs text-[#e2e2e4] border border-[#262626] rounded-lg px-3 py-1.5 flex-1 outline-none font-mono"
                />
                <button
                  onClick={handleAddEnv}
                  className="px-3 bg-[#1a1a1a] text-[#e2e2e4] rounded-lg hover:bg-[#262626] transition-colors flex items-center justify-center cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Deploy wizard action button */}
            <div className="flex justify-end pt-2 border-t border-[#262626]/60">
              <button
                onClick={handleDeployWizard}
                disabled={submitting || activeRole === "ReadOnly"}
                className="px-5 py-2.5 bg-[#326ce5] hover:bg-[#2557c0] font-sans font-semibold text-xs text-white rounded-xl shadow-lg hover:shadow-[#326ce5]/20 flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Deploying...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Deploy Workload
                  </>
                )}
              </button>
            </div>
          </div>

          {/* AI Manifest Builder Sidebar */}
          <div className="bg-[#111112] border border-[#262626] rounded-2xl p-6 shadow-lg space-y-4 h-fit">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#326ce5] animate-pulse" />
              <h3 className="font-sans font-semibold text-sm text-[#e2e2e4]">
                AI Manifest Generator
              </h3>
            </div>
            <p className="text-[11px] text-[#999999] leading-normal">
              Describe your desired multi-container or clustered setup in plain English. Gemini will automatically synthesize the correct YAML configuration for you.
            </p>

            <textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="e.g. deploy a persistent MongoDB service with a ClusterIP on port 27017..."
              className="w-full h-32 bg-[#0a0a0b] border border-[#262626] rounded-lg p-3 text-xs text-[#e2e2e4] outline-none focus:border-[#326ce5] font-sans leading-normal resize-none"
            />

            <button
              onClick={handleAiGenerate}
              disabled={aiLoading || !aiPrompt.trim()}
              className="w-full py-2 bg-gradient-to-tr from-[#326ce5] to-[#2557c0] text-white font-medium text-xs rounded-xl hover:opacity-90 flex items-center justify-center gap-1.5 transition-all shadow-lg cursor-pointer disabled:opacity-50"
            >
              {aiLoading ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  Generating Manifest...
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" />
                  Generate Manifest Block
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        /* YAML Config Editor View */
        <div className="space-y-4">
          <p className="text-xs text-[#999999] leading-normal font-sans">
            Paste or modify standard Kubernetes configurations directly. Supporting all standard apiGroups like <code className="font-mono bg-[#111112] px-1 py-0.5 rounded text-[#326ce5]">apps/v1</code> and types <code className="font-mono bg-[#111112] px-1 py-0.5 rounded text-[#326ce5]">Deployment</code>, <code className="font-mono bg-[#111112] px-1 py-0.5 rounded text-[#326ce5]">Pod</code>, and <code className="font-mono bg-[#111112] px-1 py-0.5 rounded text-[#326ce5]">Service</code>.
          </p>

          <div className="border border-[#262626] rounded-2xl overflow-hidden shadow-xl bg-[#0a0a0b] flex flex-col min-h-[380px]">
            {/* Header controls */}
            <div className="px-4 py-2 bg-[#111112] border-b border-[#262626] flex items-center justify-between text-xs text-[#999999]">
              <span className="font-mono text-[10px] tracking-wider uppercase text-[#666666] font-bold">manifest.yaml</span>
              <span className="text-[10px] text-[#326ce5] font-mono">YAML validation enabled</span>
            </div>

            <textarea
              value={yamlConfig}
              onChange={(e) => setYamlConfig(e.target.value)}
              className="flex-1 p-4 bg-transparent outline-none font-mono text-xs text-[#e2e2e4] leading-relaxed min-h-[300px] resize-y select-all"
            />
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={handleDeployYaml}
              disabled={submitting || activeRole === "ReadOnly"}
              className="px-5 py-2.5 bg-[#326ce5] hover:bg-[#2557c0] font-sans font-semibold text-xs text-white rounded-xl shadow-lg hover:shadow-[#326ce5]/20 flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Applying Manifest...
                </>
              ) : (
                <>
                  <FileCode className="h-4 w-4" />
                  Apply Manifest Configuration
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
