import React, { useState, useRef, useEffect } from "react";
import { Bot, Send, X, Terminal, FileCode, Check, Copy, Sparkles, AlertCircle } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  text: string;
}

interface CopilotPanelProps {
  onApplyYaml?: (yaml: string) => void;
  onExecuteCommand?: (cmd: string) => void;
  onClose: () => void;
}

export default function CopilotPanel({ onApplyYaml, onExecuteCommand, onClose }: CopilotPanelProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      text: "Hi! I am your Gemini-powered Kubernetes Copilot. Ask me to generate deployment configs, write kubectl command scripts, or explain complex cluster topologies.\n\nTry clicking one of these suggestions below:",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const suggestions = [
    { label: "Deploy simple Redis Cache", prompt: "Create a standard Deployment YAML manifest for redis with alpine image, port 6379, and name it redis-cache." },
    { label: "Command: logs in kube-system", prompt: "What is the kubectl command to read metrics-server logs in the kube-system namespace?" },
    { label: "Create LoadBalancer Service", prompt: "Write a Service YAML to expose my app frontend-nginx on port 80 as a LoadBalancer service." },
  ];

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim() || loading) return;

    const userMsg: Message = { role: "user", text: textToSend };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/copilot/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: textToSend }),
      });

      if (!response.ok) {
        throw new Error("Failed to consult Gemini");
      }

      const data = await response.json();
      setMessages((prev) => [...prev, { role: "assistant", text: data.text }]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: `Error connecting to Gemini backend: ${err.message}. Please verify the server is running.`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // Helper to extract code blocks from markdown responses
  const renderMessageText = (msg: Message, msgIndex: number) => {
    const text = msg.text;
    const codeBlockRegex = /```(yaml|yml|bash|sh|kubectl|json)?([\s\S]*?)```/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(text)) !== null) {
      const startIndex = match.index;
      const lang = match[1] || "";
      const code = match[2].trim();

      // Push preceding text
      if (startIndex > lastIndex) {
        parts.push(<p key={`text-${lastIndex}`} className="whitespace-pre-line text-xs text-[#e2e2e4]/90 leading-relaxed font-sans">{text.substring(lastIndex, startIndex)}</p>);
      }

      // Identify if it's a YAML or a bash/kubectl command to show appropriate action buttons
      const isYaml = ["yaml", "yml"].includes(lang.toLowerCase()) || code.includes("apiVersion:");
      const isCommand = ["bash", "sh", "kubectl"].includes(lang.toLowerCase()) || code.trim().startsWith("kubectl");

      // Push code block
      const currentCode = code;
      parts.push(
        <div key={`code-${startIndex}`} className="my-3 bg-[#0a0a0b] border border-[#262626] rounded-lg overflow-hidden font-mono text-xs">
          <div className="flex items-center justify-between px-3 py-1.5 bg-[#111112] border-b border-[#262626] text-[10px] text-[#999999]">
            <span className="uppercase font-mono tracking-wider">{lang || "code"}</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => copyToClipboard(currentCode, startIndex)}
                className="hover:text-[#e2e2e4] flex items-center gap-1 cursor-pointer transition-colors"
              >
                {copiedIndex === startIndex ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                {copiedIndex === startIndex ? "Copied" : "Copy"}
              </button>

              {isYaml && onApplyYaml && (
                <button
                  onClick={() => onApplyYaml(currentCode)}
                  className="hover:text-[#326ce5] text-[#326ce5] font-semibold flex items-center gap-1 cursor-pointer transition-colors border-l border-[#262626] pl-2"
                >
                  <FileCode className="h-3 w-3" />
                  Load into Apply
                </button>
              )}

              {isCommand && onExecuteCommand && (
                <button
                  onClick={() => onExecuteCommand(currentCode)}
                  className="hover:text-amber-400 text-amber-500 font-semibold flex items-center gap-1 cursor-pointer transition-colors border-l border-[#262626] pl-2"
                >
                  <Terminal className="h-3 w-3" />
                  Run in CLI
                </button>
              )}
            </div>
          </div>
          <pre className="p-3 overflow-x-auto text-[#e2e2e4] select-all leading-tight whitespace-pre">{code}</pre>
        </div>
      );

      lastIndex = codeBlockRegex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push(<p key={`text-end`} className="whitespace-pre-line text-xs text-[#e2e2e4]/90 leading-relaxed font-sans">{text.substring(lastIndex)}</p>);
    }

    return <div className="space-y-1.5">{parts}</div>;
  };

  return (
    <div className="w-96 border-l border-[#262626] bg-[#111112]/95 backdrop-blur-md flex flex-col h-[calc(100vh-4rem)] sticky top-16 z-30 shadow-2xl">
      {/* Header */}
      <div className="p-4 border-b border-[#262626] flex items-center justify-between bg-[#111112]">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[#326ce5] animate-pulse" />
          <h2 className="text-xs font-bold font-sans text-[#e2e2e4] uppercase tracking-wider">
            Kubernetes Copilot
          </h2>
        </div>
        <button onClick={onClose} className="p-1 text-[#999999] hover:text-[#e2e2e4] hover:bg-[#1a1a1a] rounded">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#0a0a0b]/20">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
            {msg.role === "assistant" ? (
              <div className="h-7 w-7 rounded bg-[#326ce5]/10 border border-[#326ce5]/20 flex items-center justify-center shrink-0">
                <Bot className="h-4 w-4 text-[#326ce5]" />
              </div>
            ) : (
              <div className="h-7 w-7 rounded bg-[#1a1a1a] border border-[#262626] flex items-center justify-center shrink-0">
                <span className="text-[10px] font-mono text-[#999999]">USR</span>
              </div>
            )}
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2.5 text-xs ${
                msg.role === "user"
                  ? "bg-[#326ce5] text-white font-medium"
                  : "bg-[#1a1a1a]/80 border border-[#262626] text-[#e2e2e4]"
              }`}
            >
              {renderMessageText(msg, idx)}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-2.5">
            <div className="h-7 w-7 rounded bg-[#326ce5]/10 border border-[#326ce5]/20 flex items-center justify-center shrink-0 animate-spin">
              <Sparkles className="h-4 w-4 text-[#326ce5]" />
            </div>
            <div className="max-w-[85%] rounded-lg px-3 py-2.5 text-xs bg-[#1a1a1a]/60 border border-[#262626] text-[#999999] animate-pulse">
              Gemini is researching and synthesizing Kubernetes solutions...
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Suggestions shortcuts when chat is fresh */}
      {messages.length === 1 && (
        <div className="p-4 border-t border-[#262626] bg-[#0a0a0b]/40 space-y-1.5">
          <span className="text-[10px] font-mono font-bold tracking-wider text-[#666666] uppercase block">
            SUGGESTIONS
          </span>
          <div className="space-y-1">
            {suggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => handleSend(s.prompt)}
                className="w-full text-left text-[11px] text-[#326ce5] hover:text-[#2557c0] bg-[#326ce5]/5 border border-[#326ce5]/10 hover:border-[#326ce5]/30 px-2.5 py-1.5 rounded-lg transition-colors truncate block"
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input container */}
      <div className="p-4 border-t border-[#262626] bg-[#111112]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend(input);
          }}
          className="flex gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Gemini: e.g. deploy redis cluster..."
            className="flex-1 bg-[#0a0a0b] text-xs text-[#e2e2e4] border border-[#262626] focus:border-[#326ce5] rounded-lg px-3 py-2 outline-none font-sans"
            disabled={loading}
          />
          <button
            type="submit"
            className="bg-[#326ce5] hover:bg-[#2557c0] text-white rounded-lg p-2 transition-colors disabled:opacity-50 shrink-0 cursor-pointer"
            disabled={loading || !input.trim()}
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
        <p className="text-[9px] text-[#666666] text-center mt-2 flex items-center justify-center gap-1">
          <AlertCircle className="h-2.5 w-2.5" /> Powered by Gemini-3.5-Flash
        </p>
      </div>
    </div>
  );
}
