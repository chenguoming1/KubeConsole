import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Gemini client lazily
let aiClient: GoogleGenAI | null = null;
function getAi(): GoogleGenAI | null {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (key && key !== "MY_GEMINI_API_KEY") {
      aiClient = new GoogleGenAI({
        apiKey: key,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });
    }
  }
  return aiClient;
}

// -------------------------------------------------------------
// KUBERNETES SIMULATOR STATE ENGINE
// -------------------------------------------------------------

interface NodeInfo {
  name: string;
  status: "Ready" | "NotReady";
  roles: string;
  age: string;
  version: string;
  cpuUsed: number; // percentage
  memUsed: number; // percentage
  cpuMax: string;
  memMax: string;
  podsCount: number;
}

interface PodInfo {
  name: string;
  namespace: string;
  status: "Running" | "Pending" | "Failed" | "ContainerCreating" | "Terminating";
  ready: string;
  restarts: number;
  age: string;
  ip: string;
  node: string;
  cpu: number; // m
  mem: number; // Mi
  image: string;
  ports: number[];
  env: Array<{ name: string; value: string }>;
  creationTimestamp: string;
  labels: Record<string, string>;
  controlledBy?: string;
}

interface DeploymentInfo {
  name: string;
  namespace: string;
  replicas: number;
  availableReplicas: number;
  readyReplicas: number;
  image: string;
  age: string;
  selector: Record<string, string>;
  creationTimestamp: string;
}

interface ServiceInfo {
  name: string;
  namespace: string;
  type: "ClusterIP" | "NodePort" | "LoadBalancer" | "ExternalName";
  clusterIp: string;
  externalIp: string;
  ports: string;
  age: string;
  selector: Record<string, string>;
  creationTimestamp: string;
}

interface NamespaceInfo {
  name: string;
  status: "Active" | "Terminating";
  age: string;
  creationTimestamp: string;
}

interface ConfigMapInfo {
  name: string;
  namespace: string;
  data: Record<string, string>;
  age: string;
}

interface SecretInfo {
  name: string;
  namespace: string;
  type: string;
  data: Record<string, string>; // base64 encoded mock data
  age: string;
}

interface KubeEvent {
  time: string;
  type: "Normal" | "Warning";
  reason: string;
  object: string;
  message: string;
}

// In-Memory Cluster DB
let nodes: NodeInfo[] = [
  { name: "control-plane-node-1", status: "Ready", roles: "control-plane", age: "12d", version: "v1.28.2", cpuUsed: 18, memUsed: 42, cpuMax: "4 Cores", memMax: "16 GiB", podsCount: 8 },
  { name: "worker-node-1", status: "Ready", roles: "worker", age: "12d", version: "v1.28.2", cpuUsed: 52, memUsed: 68, cpuMax: "8 Cores", memMax: "32 GiB", podsCount: 12 },
  { name: "worker-node-2", status: "Ready", roles: "worker", age: "12d", version: "v1.28.2", cpuUsed: 31, memUsed: 29, cpuMax: "8 Cores", memMax: "32 GiB", podsCount: 7 },
  { name: "worker-node-3", status: "Ready", roles: "worker", age: "5d", version: "v1.28.2", cpuUsed: 78, memUsed: 84, cpuMax: "8 Cores", memMax: "32 GiB", podsCount: 16 }
];

let namespaces: NamespaceInfo[] = [
  { name: "default", status: "Active", age: "12d", creationTimestamp: "2026-06-13T10:00:00Z" },
  { name: "kube-system", status: "Active", age: "12d", creationTimestamp: "2026-06-13T10:00:00Z" },
  { name: "production", status: "Active", age: "8d", creationTimestamp: "2026-06-17T11:30:00Z" },
  { name: "development", status: "Active", age: "4d", creationTimestamp: "2026-06-21T14:45:00Z" }
];

let pods: PodInfo[] = [
  // kube-system pods
  { name: "coredns-55cb58b774-8qzr2", namespace: "kube-system", status: "Running", ready: "1/1", restarts: 0, age: "12d", ip: "10.244.0.2", node: "control-plane-node-1", cpu: 8, mem: 16, image: "registry.k8s.io/coredns/coredns:v1.10.1", ports: [53], env: [], creationTimestamp: "2026-06-13T10:01:00Z", labels: { "k8s-app": "kube-dns", "pod-template-hash": "55cb58b774" } },
  { name: "coredns-55cb58b774-9t9lm", namespace: "kube-system", status: "Running", ready: "1/1", restarts: 1, age: "12d", ip: "10.244.0.3", node: "control-plane-node-1", cpu: 7, mem: 14, image: "registry.k8s.io/coredns/coredns:v1.10.1", ports: [53], env: [], creationTimestamp: "2026-06-13T10:01:00Z", labels: { "k8s-app": "kube-dns", "pod-template-hash": "55cb58b774" } },
  { name: "kube-proxy-8fsh7", namespace: "kube-system", status: "Running", ready: "1/1", restarts: 0, age: "12d", ip: "192.168.1.10", node: "worker-node-1", cpu: 12, mem: 28, image: "registry.k8s.io/kube-proxy:v1.28.2", ports: [], env: [], creationTimestamp: "2026-06-13T10:02:00Z", labels: { "k8s-app": "kube-proxy" } },
  { name: "kube-proxy-mshs9", namespace: "kube-system", status: "Running", ready: "1/1", restarts: 0, age: "12d", ip: "192.168.1.11", node: "worker-node-2", cpu: 11, mem: 27, image: "registry.k8s.io/kube-proxy:v1.28.2", ports: [], env: [], creationTimestamp: "2026-06-13T10:02:00Z", labels: { "k8s-app": "kube-proxy" } },
  { name: "metrics-server-575bc74f9d-pqr99", namespace: "kube-system", status: "Running", ready: "1/1", restarts: 0, age: "12d", ip: "10.244.1.4", node: "worker-node-1", cpu: 15, mem: 45, image: "registry.k8s.io/sig-storage/livenessprobe:v2.11.0", ports: [443], env: [], creationTimestamp: "2026-06-13T10:05:00Z", labels: { "k8s-app": "metrics-server" } },

  // default pods
  { name: "frontend-nginx-6df6948598-89qrs", namespace: "default", status: "Running", ready: "1/1", restarts: 0, age: "4d", ip: "10.244.1.25", node: "worker-node-1", cpu: 22, mem: 34, image: "nginx:alpine", ports: [80], env: [], creationTimestamp: "2026-06-21T18:00:00Z", labels: { "app": "frontend", "tier": "web" }, controlledBy: "Deployment/frontend-nginx" },
  { name: "backend-api-7b44747db9-abcde", namespace: "default", status: "Running", ready: "1/1", restarts: 2, age: "4d", ip: "10.244.2.14", node: "worker-node-2", cpu: 55, mem: 128, image: "node:18-alpine", ports: [8080], env: [{ name: "DB_HOST", value: "postgres-service" }, { name: "DB_PORT", value: "5432" }], creationTimestamp: "2026-06-21T18:10:00Z", labels: { "app": "backend", "tier": "api" }, controlledBy: "Deployment/backend-api" },
  { name: "postgres-db-0", namespace: "default", status: "Running", ready: "1/1", restarts: 0, age: "10d", ip: "10.244.3.5", node: "worker-node-3", cpu: 85, mem: 256, image: "postgres:15-alpine", ports: [5432], env: [{ name: "POSTGRES_USER", value: "admin" }, { name: "POSTGRES_PASSWORD", value: "supersecret" }], creationTimestamp: "2026-06-15T09:00:00Z", labels: { "app": "database", "role": "primary" } },

  // production pods
  { name: "e-commerce-web-5fcb98b948-xszr1", namespace: "production", status: "Running", ready: "1/1", restarts: 0, age: "8d", ip: "10.244.3.31", node: "worker-node-3", cpu: 65, mem: 98, image: "node:20-alpine", ports: [3000], env: [{ name: "REDIS_HOST", value: "redis-service" }], creationTimestamp: "2026-06-17T11:40:00Z", labels: { "app": "shop", "component": "web" }, controlledBy: "Deployment/e-commerce-web" },
  { name: "e-commerce-web-5fcb98b948-xszr2", namespace: "production", status: "Running", ready: "1/1", restarts: 0, age: "8d", ip: "10.244.3.32", node: "worker-node-3", cpu: 58, mem: 95, image: "node:20-alpine", ports: [3000], env: [{ name: "REDIS_HOST", value: "redis-service" }], creationTimestamp: "2026-06-17T11:40:00Z", labels: { "app": "shop", "component": "web" }, controlledBy: "Deployment/e-commerce-web" },
  { name: "redis-cache-0", namespace: "production", status: "Running", ready: "1/1", restarts: 0, age: "8d", ip: "10.244.1.88", node: "worker-node-1", cpu: 45, mem: 64, image: "redis:alpine", ports: [6379], env: [], creationTimestamp: "2026-06-17T11:35:00Z", labels: { "app": "cache" } }
];

let deployments: DeploymentInfo[] = [
  { name: "coredns", namespace: "kube-system", replicas: 2, availableReplicas: 2, readyReplicas: 2, image: "registry.k8s.io/coredns/coredns:v1.10.1", age: "12d", selector: { "k8s-app": "kube-dns" }, creationTimestamp: "2026-06-13T10:01:00Z" },
  { name: "frontend-nginx", namespace: "default", replicas: 1, availableReplicas: 1, readyReplicas: 1, image: "nginx:alpine", age: "4d", selector: { "app": "frontend" }, creationTimestamp: "2026-06-21T18:00:00Z" },
  { name: "backend-api", namespace: "default", replicas: 1, availableReplicas: 1, readyReplicas: 1, image: "node:18-alpine", age: "4d", selector: { "app": "backend" }, creationTimestamp: "2026-06-21T18:10:00Z" },
  { name: "e-commerce-web", namespace: "production", replicas: 2, availableReplicas: 2, readyReplicas: 2, image: "node:20-alpine", age: "8d", selector: { "app": "shop" }, creationTimestamp: "2026-06-17T11:40:00Z" }
];

let services: ServiceInfo[] = [
  { name: "kube-dns", namespace: "kube-system", type: "ClusterIP", clusterIp: "10.96.0.10", externalIp: "<none>", ports: "53/UDP,53/TCP", age: "12d", selector: { "k8s-app": "kube-dns" }, creationTimestamp: "2026-06-13T10:01:00Z" },
  { name: "frontend-service", namespace: "default", type: "LoadBalancer", clusterIp: "10.96.145.201", externalIp: "34.120.45.89", ports: "80:31080/TCP", age: "4d", selector: { "app": "frontend" }, creationTimestamp: "2026-06-21T18:05:00Z" },
  { name: "backend-service", namespace: "default", type: "ClusterIP", clusterIp: "10.96.222.18", externalIp: "<none>", ports: "8080/TCP", age: "4d", selector: { "app": "backend" }, creationTimestamp: "2026-06-21T18:12:00Z" },
  { name: "postgres-service", namespace: "default", type: "ClusterIP", clusterIp: "10.96.54.12", externalIp: "<none>", ports: "5432/TCP", age: "10d", selector: { "app": "database" }, creationTimestamp: "2026-06-15T09:00:50Z" },
  { name: "shop-service", namespace: "production", type: "LoadBalancer", clusterIp: "10.96.18.254", externalIp: "35.192.105.41", ports: "80:31200/TCP", age: "8d", selector: { "app": "shop" }, creationTimestamp: "2026-06-17T11:42:00Z" },
  { name: "redis-service", namespace: "production", type: "ClusterIP", clusterIp: "10.96.105.88", externalIp: "<none>", ports: "6379/TCP", age: "8d", selector: { "app": "cache" }, creationTimestamp: "2026-06-17T11:36:00Z" }
];

let configMaps: ConfigMapInfo[] = [
  { name: "kube-root-ca.crt", namespace: "default", data: { "ca.crt": "-----BEGIN CERTIFICATE-----\nMIIByjCCAWGgAwIBAgIBADANBgkqhkiG9w0BAQsFADAVMRMwEQYDVQQDEwprdWJl\n..." }, age: "12d" },
  { name: "app-config", namespace: "default", data: { "API_TIMEOUT": "5000", "MAX_CONNECTIONS": "200", "DEBUG": "false" }, age: "4d" }
];

let secrets: SecretInfo[] = [
  { name: "db-secrets", namespace: "default", type: "Opaque", data: { "password": "c3VwZXJzZWNyZXQ=", "username": "YWRtaW4=" }, age: "10d" },
  { name: "shop-payment-token", namespace: "production", type: "Opaque", data: { "api_token": "bGl2ZV90b2tlbl85ODIzNDk4Mjc=" }, age: "8d" }
];

let events: KubeEvent[] = [
  { time: "18m", type: "Normal", reason: "ScalingReplicaSet", object: "Deployment/e-commerce-web", message: "Scaled replica set e-commerce-web-5fcb98b948 to 2" },
  { time: "15m", type: "Normal", reason: "Scheduled", object: "Pod/e-commerce-web-5fcb98b948-xszr2", message: "Successfully assigned production/e-commerce-web-5fcb98b948-xszr2 to worker-node-3" },
  { time: "15m", type: "Normal", reason: "Pulled", object: "Pod/e-commerce-web-5fcb98b948-xszr2", message: "Container image \"node:20-alpine\" already present on machine" },
  { time: "15m", type: "Normal", reason: "Created", object: "Pod/e-commerce-web-5fcb98b948-xszr2", message: "Created container shop" },
  { time: "15m", type: "Normal", reason: "Started", object: "Pod/e-commerce-web-5fcb98b948-xszr2", message: "Started container shop" },
  { time: "10m", type: "Normal", reason: "Unhealthy", object: "Pod/backend-api-7b44747db9-abcde", message: "Liveness probe failed: HTTP probe failed with statuscode: 500" },
  { time: "10m", type: "Normal", reason: "Killing", object: "Pod/backend-api-7b44747db9-abcde", message: "Container backend failed liveness probe, will be restarted" },
  { time: "9m", type: "Normal", reason: "Started", object: "Pod/backend-api-7b44747db9-abcde", message: "Started container backend (restarted 2 times)" }
];

// Helper to push a live event
function pushEvent(type: "Normal" | "Warning", reason: string, object: string, message: string) {
  events.unshift({
    time: "now",
    type,
    reason,
    object,
    message
  });
  if (events.length > 50) events.pop();
}

// Keep resource ages somewhat updated or dynamic if needed
// Simple Pod generator/cleaner simulator loop
setInterval(() => {
  // Randomly adjust node CPU/memory slightly for raw metrics realism
  nodes.forEach(node => {
    const diff = Math.floor(Math.random() * 5) - 2; // -2 to +2
    node.cpuUsed = Math.max(5, Math.min(95, node.cpuUsed + diff));
    const memDiff = Math.floor(Math.random() * 3) - 1; // -1 to +1
    node.memUsed = Math.max(5, Math.min(95, node.memUsed + memDiff));
  });

  // Randomly adjust Pod CPU/memory usage
  pods.forEach(pod => {
    if (pod.status === "Running") {
      const cpuChange = Math.floor(Math.random() * 5) - 2;
      pod.cpu = Math.max(2, pod.cpu + cpuChange);
      const memChange = Math.floor(Math.random() * 3) - 1;
      pod.mem = Math.max(8, pod.mem + memChange);
    }
  });

  // Handle ContainerCreating transition
  pods.forEach(pod => {
    if (pod.status === "ContainerCreating") {
      pod.status = "Running";
      pod.ready = "1/1";
      pushEvent("Normal", "Started", `Pod/${pod.name}`, `Started container for pod ${pod.name}`);
    }
  });
}, 8000);

// -------------------------------------------------------------
// YAML & KUBECTL COMMANDS ENGINE
// -------------------------------------------------------------

// Basic YAML parser to grab critical resource definitions
function parseKubernetesYaml(yamlStr: string): any[] {
  const documents = yamlStr.split("---").map(doc => doc.trim()).filter(doc => doc.length > 0);
  const parsedDocs: any[] = [];

  for (const doc of documents) {
    const lines = doc.split("\n");
    const result: any = { metadata: {}, spec: {} };
    let currentSection = "";
    let currentContainer: any = null;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;

      const parts = line.split(":");
      const key = parts[0].trim();
      const value = parts.slice(1).join(":").trim();

      // Section check based on indentation (very simple parser)
      if (rawLine.startsWith("apiVersion:")) result.apiVersion = value;
      else if (rawLine.startsWith("kind:")) result.kind = value;
      else if (rawLine.startsWith("metadata:")) currentSection = "metadata";
      else if (rawLine.startsWith("spec:")) currentSection = "spec";

      if (currentSection === "metadata") {
        if (line.startsWith("name:")) result.metadata.name = value;
        else if (line.startsWith("namespace:")) result.metadata.namespace = value;
        else if (line.startsWith("labels:")) {
          result.metadata.labels = {};
        } else if (rawLine.startsWith("    ") && result.metadata.labels) {
          const lParts = line.split(":");
          if (lParts.length >= 2) {
            result.metadata.labels[lParts[0].trim()] = lParts[1].trim();
          }
        }
      }

      if (currentSection === "spec") {
        if (line.startsWith("replicas:")) result.spec.replicas = parseInt(value, 10);
        else if (line.startsWith("type:")) result.spec.type = value;
        else if (line.startsWith("clusterIP:")) result.spec.clusterIP = value;
        else if (line.startsWith("port:")) result.spec.port = parseInt(value, 10);
        else if (line.startsWith("targetPort:")) result.spec.targetPort = value;
        else if (line.startsWith("image:")) {
          result.spec.image = value;
          if (currentContainer) currentContainer.image = value;
        }
      }
    }

    if (result.kind) parsedDocs.push(result);
  }

  return parsedDocs;
}

// Process standard kubectl command execution mock
function runMockKubectl(command: string, activeRole: string, activeNamespace: string): { output: string; success: boolean } {
  // Simple RBAC check
  // Roles: "ClusterAdmin" | "NamespaceManager" | "Developer" | "ReadOnly"
  const isReadOnly = activeRole === "ReadOnly";
  const isDeveloper = activeRole === "Developer";
  const isNamespaceManager = activeRole === "NamespaceManager";

  const parts = command.trim().split(/\s+/);
  if (parts[0] !== "kubectl") {
    return { output: `Command must start with "kubectl". Try "kubectl help".`, success: false };
  }

  const action = parts[1];
  if (!action) {
    return { output: `kubectl controls the Kubernetes cluster manager.\n\nUsage:\n  kubectl [command] [type] [name] [flags]\n\nAvailable Commands:\n  get          Display one or many resources\n  describe     Show details of a specific resource\n  create       Create a resource from a file or stdin\n  apply        Apply a configuration to a resource\n  delete       Delete resources by filenames, stdin, resources and names\n  logs         Print the logs for a container in a pod\n  scale        Set a new size for a deployment\n  run          Run a particular image on the cluster`, success: true };
  }

  // Parse namespace flags (-n <ns> or --namespace <ns> or -A / --all-namespaces)
  let targetNamespace = activeNamespace;
  let allNamespaces = false;

  const nIndex = parts.indexOf("-n");
  const nsIndex = parts.indexOf("--namespace");
  if (nIndex !== -1 && parts[nIndex + 1]) {
    targetNamespace = parts[nIndex + 1];
  } else if (nsIndex !== -1 && parts[nsIndex + 1]) {
    targetNamespace = parts[nsIndex + 1];
  }

  if (parts.includes("-A") || parts.includes("--all-namespaces")) {
    allNamespaces = true;
  }

  // RBAC permissions enforcement
  const writeActions = ["create", "apply", "delete", "scale", "run"];
  if (writeActions.includes(action)) {
    if (isReadOnly) {
      return { output: `Error from server (Forbidden): User cannot ${action} resources in RBAC role: ReadOnly`, success: false };
    }
    if (isDeveloper && targetNamespace === "kube-system") {
      return { output: `Error from server (Forbidden): Developer role cannot mutate critical kube-system namespace resources.`, success: false };
    }
    if (isDeveloper && (action === "create" && parts[2] === "namespace")) {
      return { output: `Error from server (Forbidden): Developer role cannot manage Namespaces.`, success: false };
    }
    if (isNamespaceManager && parts[2] === "node") {
      return { output: `Error from server (Forbidden): NamespaceManager cannot manage cluster Nodes.`, success: false };
    }
  }

  // Execute
  switch (action) {
    case "get": {
      const resource = parts[2]?.toLowerCase();
      if (!resource) {
        return { output: `You must specify the type of resource to get. Try "kubectl get pods".`, success: false };
      }

      const exactName = parts[3];

      if (resource === "pod" || resource === "pods" || resource === "po") {
        let filteredPods = pods;
        if (!allNamespaces) {
          filteredPods = pods.filter(p => p.namespace === targetNamespace);
        }

        if (exactName) {
          const found = filteredPods.find(p => p.name === exactName);
          if (!found) return { output: `Error from server (NotFound): pods "${exactName}" not found`, success: false };
          filteredPods = [found];
        }

        if (filteredPods.length === 0) {
          return { output: `No resources found in ${allNamespaces ? "all" : targetNamespace} namespaces.`, success: true };
        }

        let out = allNamespaces 
          ? `${"NAMESPACE".padEnd(16)}${"NAME".padEnd(36)}${"READY".padEnd(8)}${"STATUS".padEnd(20)}${"RESTARTS".padEnd(10)}AGE\n`
          : `${"NAME".padEnd(36)}${"READY".padEnd(8)}${"STATUS".padEnd(20)}${"RESTARTS".padEnd(10)}AGE\n`;

        filteredPods.forEach(p => {
          const line = allNamespaces
            ? `${p.namespace.padEnd(16)}${p.name.padEnd(36)}${p.ready.padEnd(8)}${p.status.padEnd(20)}${String(p.restarts).padEnd(10)}${p.age}`
            : `${p.name.padEnd(36)}${p.ready.padEnd(8)}${p.status.padEnd(20)}${String(p.restarts).padEnd(10)}${p.age}`;
          out += line + "\n";
        });
        return { output: out.trim(), success: true };
      }

      if (resource === "deployment" || resource === "deployments" || resource === "deploy") {
        let filteredDeploys = deployments;
        if (!allNamespaces) {
          filteredDeploys = deployments.filter(d => d.namespace === targetNamespace);
        }

        if (exactName) {
          const found = filteredDeploys.find(d => d.name === exactName);
          if (!found) return { output: `Error from server (NotFound): deployments "${exactName}" not found`, success: false };
          filteredDeploys = [found];
        }

        if (filteredDeploys.length === 0) {
          return { output: `No deployments found in ${allNamespaces ? "all" : targetNamespace} namespaces.`, success: true };
        }

        let out = allNamespaces
          ? `${"NAMESPACE".padEnd(16)}${"NAME".padEnd(24)}${"READY".padEnd(10)}${"UP-TO-DATE".padEnd(12)}${"AVAILABLE".padEnd(12)}AGE\n`
          : `${"NAME".padEnd(24)}${"READY".padEnd(10)}${"UP-TO-DATE".padEnd(12)}${"AVAILABLE".padEnd(12)}AGE\n`;

        filteredDeploys.forEach(d => {
          const readyStr = `${d.readyReplicas}/${d.replicas}`;
          const line = allNamespaces
            ? `${d.namespace.padEnd(16)}${d.name.padEnd(24)}${readyStr.padEnd(10)}${String(d.replicas).padEnd(12)}${String(d.availableReplicas).padEnd(12)}${d.age}`
            : `${d.name.padEnd(24)}${readyStr.padEnd(10)}${String(d.replicas).padEnd(12)}${String(d.availableReplicas).padEnd(12)}${d.age}`;
          out += line + "\n";
        });
        return { output: out.trim(), success: true };
      }

      if (resource === "service" || resource === "services" || resource === "svc") {
        let filteredSvc = services;
        if (!allNamespaces) {
          filteredSvc = services.filter(s => s.namespace === targetNamespace);
        }

        if (exactName) {
          const found = filteredSvc.find(s => s.name === exactName);
          if (!found) return { output: `Error from server (NotFound): services "${exactName}" not found`, success: false };
          filteredSvc = [found];
        }

        if (filteredSvc.length === 0) {
          return { output: `No services found in ${allNamespaces ? "all" : targetNamespace} namespaces.`, success: true };
        }

        let out = allNamespaces
          ? `${"NAMESPACE".padEnd(16)}${"NAME".padEnd(24)}${"TYPE".padEnd(16)}${"CLUSTER-IP".padEnd(16)}${"EXTERNAL-IP".padEnd(16)}${"PORT(S)".padEnd(16)}AGE\n`
          : `${"NAME".padEnd(24)}${"TYPE".padEnd(16)}${"CLUSTER-IP".padEnd(16)}${"EXTERNAL-IP".padEnd(16)}${"PORT(S)".padEnd(16)}AGE\n`;

        filteredSvc.forEach(s => {
          const line = allNamespaces
            ? `${s.namespace.padEnd(16)}${s.name.padEnd(24)}${s.type.padEnd(16)}${s.clusterIp.padEnd(16)}${s.externalIp.padEnd(16)}${s.ports.padEnd(16)}${s.age}`
            : `${s.name.padEnd(24)}${s.type.padEnd(16)}${s.clusterIp.padEnd(16)}${s.externalIp.padEnd(16)}${s.ports.padEnd(16)}${s.age}`;
          out += line + "\n";
        });
        return { output: out.trim(), success: true };
      }

      if (resource === "namespace" || resource === "namespaces" || resource === "ns") {
        let filteredNs = namespaces;
        if (exactName) {
          const found = filteredNs.find(n => n.name === exactName);
          if (!found) return { output: `Error from server (NotFound): namespaces "${exactName}" not found`, success: false };
          filteredNs = [found];
        }

        let out = `${"NAME".padEnd(24)}${"STATUS".padEnd(12)}AGE\n`;
        filteredNs.forEach(n => {
          out += `${n.name.padEnd(24)}${n.status.padEnd(12)}${n.age}\n`;
        });
        return { output: out.trim(), success: true };
      }

      if (resource === "node" || resource === "nodes" || resource === "no") {
        let filteredNodes = nodes;
        if (exactName) {
          const found = filteredNodes.find(n => n.name === exactName);
          if (!found) return { output: `Error from server (NotFound): nodes "${exactName}" not found`, success: false };
          filteredNodes = [found];
        }

        let out = `${"NAME".padEnd(24)}${"STATUS".padEnd(12)}${"ROLES".padEnd(16)}${"AGE".padEnd(8)}VERSION\n`;
        filteredNodes.forEach(n => {
          out += `${n.name.padEnd(24)}${n.status.padEnd(12)}${n.roles.padEnd(16)}${n.age.padEnd(8)}${n.version}\n`;
        });
        return { output: out.trim(), success: true };
      }

      if (resource === "configmap" || resource === "configmaps" || resource === "cm") {
        let filteredCm = configMaps;
        if (!allNamespaces) {
          filteredCm = configMaps.filter(c => c.namespace === targetNamespace);
        }

        let out = `${"NAME".padEnd(30)}${"DATA".padEnd(8)}AGE\n`;
        filteredCm.forEach(c => {
          out += `${c.name.padEnd(30)}${String(Object.keys(c.data).length).padEnd(8)}${c.age}\n`;
        });
        return { output: out.trim(), success: true };
      }

      if (resource === "secret" || resource === "secrets") {
        let filteredSecrets = secrets;
        if (!allNamespaces) {
          filteredSecrets = secrets.filter(s => s.namespace === targetNamespace);
        }

        let out = `${"NAME".padEnd(30)}${"TYPE".padEnd(20)}${"DATA".padEnd(8)}AGE\n`;
        filteredSecrets.forEach(s => {
          out += `${s.name.padEnd(30)}${s.type.padEnd(20)}${String(Object.keys(s.data).length).padEnd(8)}${s.age}\n`;
        });
        return { output: out.trim(), success: true };
      }

      if (resource === "event" || resource === "events") {
        let out = `${"LAST SEEN".padEnd(10)}${"TYPE".padEnd(10)}${"REASON".padEnd(20)}${"OBJECT".padEnd(32)}MESSAGE\n`;
        events.forEach(e => {
          out += `${e.time.padEnd(10)}${e.type.padEnd(10)}${e.reason.padEnd(20)}${e.object.padEnd(32)}${e.message}\n`;
        });
        return { output: out.trim(), success: true };
      }

      if (resource === "all") {
        // Return a summary of everything
        let outputStr = "";
        const podsOut = runMockKubectl(`kubectl get pods -n ${targetNamespace}`, activeRole, targetNamespace).output;
        const svcOut = runMockKubectl(`kubectl get svc -n ${targetNamespace}`, activeRole, targetNamespace).output;
        const deployOut = runMockKubectl(`kubectl get deploy -n ${targetNamespace}`, activeRole, targetNamespace).output;

        outputStr += `[Pods]\n${podsOut}\n\n`;
        outputStr += `[Services]\n${svcOut}\n\n`;
        outputStr += `[Deployments]\n${deployOut}`;
        return { output: outputStr, success: true };
      }

      return { output: `Error: Unknown resource type "${resource}". Supported resources: pods, deployments, services, namespaces, nodes, configmaps, secrets, events, all`, success: false };
    }

    case "describe": {
      const resource = parts[2]?.toLowerCase();
      const name = parts[3];
      if (!resource || !name) {
        return { output: `Syntax: kubectl describe <resource> <name>`, success: false };
      }

      if (resource === "pod" || resource === "pods" || resource === "po") {
        const pod = pods.find(p => p.name === name);
        if (!pod) return { output: `Error from server (NotFound): pods "${name}" not found`, success: false };

        const envLines = pod.env.map(e => `      ${e.name}: ${e.value}`).join("\n") || "      <none>";

        return {
          output: `Name:         ${pod.name}
Namespace:    ${pod.namespace}
Priority:     0
Node:         ${pod.node}/${nodes.find(n => n.name === pod.node)?.cpuUsed}% CPU, ${nodes.find(n => n.name === pod.node)?.memUsed}% MEM
Start Time:   ${pod.creationTimestamp}
Labels:       ${Object.entries(pod.labels).map(([k, v]) => `${k}=${v}`).join(", ")}
Status:       ${pod.status}
IP:           ${pod.ip}
Controlled By: ${pod.controlledBy || "ReplicaSet/" + (pod.name.split("-").slice(0, -1).join("-") || "None")}
Containers:
  application:
    Container ID:   containerd://e6bc2e847...
    Image:          ${pod.image}
    Port:           ${pod.ports.length > 0 ? pod.ports.join(", ") : "<none>"}
    State:          ${pod.status === "Running" ? "Running" : "Waiting"}
    Ready:          ${pod.ready === "1/1" ? "True" : "False"}
    Restart Count:  ${pod.restarts}
    Limits:
      cpu:          200m
      memory:       512Mi
    Requests:
      cpu:          ${pod.cpu}m
      memory:       ${pod.mem}Mi
    Environment:
${envLines}
QoS Class:                   Burstable
Node-Selectors:              <none>
Events:
  Type    Reason     Age    From               Message
  ----    ------     ----   ----               -------
  Normal  Scheduled  10m    default-scheduler  Successfully assigned ${pod.namespace}/${pod.name} to ${pod.node}
  Normal  Pulled     10m    kubelet            Container image "${pod.image}" already present on machine
  Normal  Created    10m    kubelet            Created container application
  Normal  Started    10m    kubelet            Started container application`,
          success: true
        };
      }

      if (resource === "deployment" || resource === "deployments" || resource === "deploy") {
        const deploy = deployments.find(d => d.name === name);
        if (!deploy) return { output: `Error from server (NotFound): deployments "${name}" not found`, success: false };

        return {
          output: `Name:                   ${deploy.name}
Namespace:              ${deploy.namespace}
CreationTimestamp:      ${deploy.creationTimestamp}
Labels:                 app=${deploy.name}
Selector:               ${Object.entries(deploy.selector).map(([k, v]) => `${k}=${v}`).join(", ")}
Replicas:               ${deploy.replicas} desired | ${deploy.replicas} updated | ${deploy.replicas} total | ${deploy.availableReplicas} available | ${deploy.replicas - deploy.availableReplicas} unavailable
StrategyType:           RollingUpdate
MinReadySeconds:        0
RollingUpdateStrategy:  25% max unavailable, 25% max surge
Pod Template:
  Labels:  app=${deploy.name}
  Containers:
   app-container:
    Image:        ${deploy.image}
    Port:         <none>
    Host Port:    <none>
    Environment:  <none>
    Mounts:       <none>
  Volumes:        <none>
Conditions:
  Type           Status  Reason
  ----           ------  ------
  Available      True    MinimumReplicasAvailable
  Progressing    True    NewReplicaSetAvailable`,
          success: true
        };
      }

      if (resource === "service" || resource === "services" || resource === "svc") {
        const svc = services.find(s => s.name === name);
        if (!svc) return { output: `Error from server (NotFound): services "${name}" not found`, success: false };

        return {
          output: `Name:                     ${svc.name}
Namespace:                ${svc.namespace}
Labels:                   <none>
Selector:                 ${Object.entries(svc.selector).map(([k, v]) => `${k}=${v}`).join(", ")}
Type:                     ${svc.type}
IP Family Policy:         SingleStack
IP Families:              IPv4
IP:                       ${svc.clusterIp}
IPs:                      ${svc.clusterIp}
Port:                     <unset>  ${svc.ports}
TargetPort:               80/TCP
Endpoints:                10.244.1.25:80, 10.244.3.31:3000
Session Affinity:         None
External Traffic Policy:  Cluster`,
          success: true
        };
      }

      return { output: `Describe is only supported for: pod, deployment, service`, success: false };
    }

    case "scale": {
      const target = parts[2];
      const replicaFlag = parts.find(p => p.startsWith("--replicas="));
      if (!target || !replicaFlag) {
        return { output: `Syntax: kubectl scale deployment <name> --replicas=<num>`, success: false };
      }

      const deployName = parts[3];
      const replicasVal = parseInt(replicaFlag.split("=")[1], 10);

      if (isNaN(replicasVal) || replicasVal < 0 || replicasVal > 20) {
        return { output: `Error: replicas value must be between 0 and 20.`, success: false };
      }

      const deploy = deployments.find(d => d.name === deployName && d.namespace === targetNamespace);
      if (!deploy) {
        return { output: `Error from server (NotFound): deployments "${deployName}" not found`, success: false };
      }

      const oldReplicas = deploy.replicas;
      deploy.replicas = replicasVal;
      deploy.availableReplicas = replicasVal;
      deploy.readyReplicas = replicasVal;

      pushEvent("Normal", "ScalingReplicaSet", `Deployment/${deployName}`, `Scaled deployment ${deployName} from ${oldReplicas} to ${replicasVal}`);

      // Handle actual Pod adjustment in backend state!
      if (replicasVal > oldReplicas) {
        const countToAdd = replicasVal - oldReplicas;
        for (let i = 0; i < countToAdd; i++) {
          const randSuffix = Math.random().toString(36).substring(2, 7);
          const podName = `${deployName}-${randSuffix}`;
          pods.push({
            name: podName,
            namespace: targetNamespace,
            status: "ContainerCreating",
            ready: "0/1",
            restarts: 0,
            age: "0s",
            ip: `10.244.${Math.floor(Math.random() * 3) + 1}.${Math.floor(Math.random() * 250) + 2}`,
            node: nodes[Math.floor(Math.random() * 3) + 1].name,
            cpu: 10,
            mem: 20,
            image: deploy.image,
            ports: [80],
            env: [],
            creationTimestamp: new Date().toISOString(),
            labels: deploy.selector,
            controlledBy: `Deployment/${deployName}`
          });
          pushEvent("Normal", "Scheduled", `Pod/${podName}`, `Successfully assigned ${targetNamespace}/${podName} to cluster node`);
        }
      } else if (replicasVal < oldReplicas) {
        const countToRemove = oldReplicas - replicasVal;
        let removed = 0;
        // Terminate oldest or matching pods
        for (let i = pods.length - 1; i >= 0; i--) {
          if (pods[i].controlledBy === `Deployment/${deployName}` && pods[i].namespace === targetNamespace) {
            pushEvent("Normal", "Killing", `Pod/${pods[i].name}`, `Stopping container and deleting pod ${pods[i].name}`);
            pods.splice(i, 1);
            removed++;
            if (removed >= countToRemove) break;
          }
        }
      }

      return { output: `deployment.apps/${deployName} scaled`, success: true };
    }

    case "run": {
      const podName = parts[2];
      const imageFlag = parts.find(p => p.startsWith("--image="));
      if (!podName || !imageFlag) {
        return { output: `Syntax: kubectl run <pod-name> --image=<image_name>`, success: false };
      }

      const image = imageFlag.split("=")[1];

      // Check if pod already exists
      if (pods.some(p => p.name === podName && p.namespace === targetNamespace)) {
        return { output: `Error from server (AlreadyExists): pods "${podName}" already exists`, success: false };
      }

      const nodeName = nodes[Math.floor(Math.random() * 3) + 1].name;
      const newPod: PodInfo = {
        name: podName,
        namespace: targetNamespace,
        status: "Running",
        ready: "1/1",
        restarts: 0,
        age: "1s",
        ip: `10.244.${Math.floor(Math.random() * 3) + 1}.${Math.floor(Math.random() * 250) + 2}`,
        node: nodeName,
        cpu: 15,
        mem: 32,
        image,
        ports: [],
        env: [],
        creationTimestamp: new Date().toISOString(),
        labels: { "run": podName }
      };

      pods.push(newPod);
      pushEvent("Normal", "Scheduled", `Pod/${podName}`, `Successfully assigned ${targetNamespace}/${podName} to node ${nodeName}`);
      pushEvent("Normal", "Started", `Pod/${podName}`, `Created and started container with image: "${image}"`);

      return { output: `pod/${podName} created`, success: true };
    }

    case "logs": {
      const podName = parts[2];
      if (!podName) {
        return { output: `Syntax: kubectl logs <pod-name>`, success: false };
      }

      const pod = pods.find(p => p.name === podName && p.namespace === targetNamespace);
      if (!pod) {
        return { output: `Error from server (NotFound): pods "${podName}" not found`, success: false };
      }

      // Return high-fidelity simulated logs based on image
      const logSamples: Record<string, string[]> = {
        nginx: [
          `10.244.0.1 - - [25/Jun/2026:17:40:01 +0000] "GET / HTTP/1.1" 200 612 "-" "Mozilla/5.0"`,
          `10.244.0.1 - - [25/Jun/2026:17:40:05 +0000] "GET /favicon.ico HTTP/1.1" 404 153 "-" "Mozilla/5.0"`,
          `2026/06/25 17:40:10 [notice] 1#1: using the "epoll" event method`,
          `2026/06/25 17:40:10 [notice] 1#1: nginx/1.25.1`,
          `2026/06/25 17:40:10 [notice] 1#1: start worker process 31`,
          `10.244.1.18 - - [25/Jun/2026:17:42:19 +0000] "GET /api/v1/status HTTP/1.1" 200 89 "-" "HealthCheck/1.0"`
        ],
        postgres: [
          `2026-06-25 17:30:01.425 UTC [1] LOG:  starting PostgreSQL 15.3 on x86_64-pc-linux-musl, compiled by gcc (Alpine 12.2.1_git20220924-r10) 12.2.1 20220924, 64-bit`,
          `2026-06-25 17:30:01.426 UTC [1] LOG:  listening on IPv4 address "0.0.0.0", port 5432`,
          `2026-06-25 17:30:01.426 UTC [1] LOG:  listening on IPv6 address "::", port 5432`,
          `2026-06-25 17:30:01.435 UTC [1] LOG:  database system is ready to accept connections`,
          `2026-06-25 17:35:12.822 UTC [34] LOG:  connection received: host=10.244.2.14 port=45832`,
          `2026-06-25 17:35:12.915 UTC [34] LOG:  connection authorized: user=admin database=postgres`
        ],
        node: [
          `[Server] Starting Express cluster instance...`,
          `[Server] Loading configurations: environment=production`,
          `[Server] Database Connected: postgres://postgres-service:5432`,
          `[Server] Listening on Port: 8080`,
          `[Server] [GET] /api/v1/healthz - Status: 200 - Duration: 5ms`,
          `[Server] [POST] /api/v1/checkout - Authorized - items=3 total=145.22`,
          `[Server] [GET] /api/v1/products - Cache Hit`
        ]
      };

      const matchedKey = Object.keys(logSamples).find(key => pod.image.includes(key)) || "node";
      const selectedLogs = logSamples[matchedKey];
      const timestamp = new Date().toISOString().replace("T", " ").substring(0, 19);

      return {
        output: selectedLogs.map(l => `[${timestamp}] ${l}`).join("\n"),
        success: true
      };
    }

    case "delete": {
      const resource = parts[2]?.toLowerCase();
      const name = parts[3];
      if (!resource || !name) {
        return { output: `Syntax: kubectl delete <resource> <name>`, success: false };
      }

      if (resource === "pod" || resource === "pods" || resource === "po") {
        const index = pods.findIndex(p => p.name === name && p.namespace === targetNamespace);
        if (index === -1) {
          return { output: `Error from server (NotFound): pods "${name}" not found`, success: false };
        }

        const pod = pods[index];
        pods.splice(index, 1);
        pushEvent("Normal", "Killing", `Pod/${name}`, `Deleted pod ${name}`);

        // If it belongs to a deployment, recreate it!
        if (pod.controlledBy) {
          const deployName = pod.controlledBy.split("/")[1];
          const deploy = deployments.find(d => d.name === deployName && d.namespace === targetNamespace);
          if (deploy) {
            const randSuffix = Math.random().toString(36).substring(2, 7);
            const newPodName = `${deployName}-${randSuffix}`;
            setTimeout(() => {
              pods.push({
                name: newPodName,
                namespace: targetNamespace,
                status: "ContainerCreating",
                ready: "0/1",
                restarts: 0,
                age: "0s",
                ip: `10.244.${Math.floor(Math.random() * 3) + 1}.${Math.floor(Math.random() * 250) + 2}`,
                node: nodes[Math.floor(Math.random() * 3) + 1].name,
                cpu: 10,
                mem: 20,
                image: deploy.image,
                ports: [80],
                env: [],
                creationTimestamp: new Date().toISOString(),
                labels: deploy.selector,
                controlledBy: `Deployment/${deployName}`
              });
              pushEvent("Normal", "Scheduled", `Pod/${newPodName}`, `Self-healing: Recreating terminated pod of deployment ${deployName}`);
            }, 3000);
          }
        }

        return { output: `pod "${name}" deleted`, success: true };
      }

      if (resource === "deployment" || resource === "deployments" || resource === "deploy") {
        const index = deployments.findIndex(d => d.name === name && d.namespace === targetNamespace);
        if (index === -1) {
          return { output: `Error from server (NotFound): deployments "${name}" not found`, success: false };
        }

        deployments.splice(index, 1);
        pushEvent("Normal", "Killing", `Deployment/${name}`, `Deleted deployment ${name}`);

        // Also delete pods of this deployment
        for (let i = pods.length - 1; i >= 0; i--) {
          if (pods[i].controlledBy === `Deployment/${name}` && pods[i].namespace === targetNamespace) {
            pods.splice(i, 1);
          }
        }

        return { output: `deployment.apps "${name}" deleted`, success: true };
      }

      if (resource === "service" || resource === "services" || resource === "svc") {
        const index = services.findIndex(s => s.name === name && s.namespace === targetNamespace);
        if (index === -1) {
          return { output: `Error from server (NotFound): services "${name}" not found`, success: false };
        }

        services.splice(index, 1);
        pushEvent("Normal", "Killing", `Service/${name}`, `Deleted service ${name}`);
        return { output: `service "${name}" deleted`, success: true };
      }

      if (resource === "namespace" || resource === "namespaces" || resource === "ns") {
        if (name === "default" || name === "kube-system") {
          return { output: `Error: Cannot delete system protected namespace: "${name}"`, success: false };
        }

        const index = namespaces.findIndex(n => n.name === name);
        if (index === -1) {
          return { output: `Error from server (NotFound): namespaces "${name}" not found`, success: false };
        }

        namespaces.splice(index, 1);
        pushEvent("Normal", "Killing", `Namespace/${name}`, `Terminated and deleted namespace ${name}`);

        // Cascade delete pods, deployments, services in that namespace
        for (let i = pods.length - 1; i >= 0; i--) {
          if (pods[i].namespace === name) pods.splice(i, 1);
        }
        for (let i = deployments.length - 1; i >= 0; i--) {
          if (deployments[i].namespace === name) deployments.splice(i, 1);
        }
        for (let i = services.length - 1; i >= 0; i--) {
          if (services[i].namespace === name) services.splice(i, 1);
        }

        return { output: `namespace "${name}" deleted`, success: true };
      }

      return { output: `Deleting is only supported for: pod, deployment, service, namespace`, success: false };
    }

    case "apply":
    case "create": {
      // Typically used with files or stdin
      const hasFile = parts.includes("-f");
      if (!hasFile) {
        if (action === "create" && parts[2] === "namespace") {
          const nsName = parts[3];
          if (!nsName) return { output: `Syntax: kubectl create namespace <name>`, success: false };
          if (namespaces.some(n => n.name === nsName)) {
            return { output: `Error from server (AlreadyExists): namespaces "${nsName}" already exists`, success: false };
          }
          namespaces.push({
            name: nsName,
            status: "Active",
            age: "1s",
            creationTimestamp: new Date().toISOString()
          });
          pushEvent("Normal", "Created", `Namespace/${nsName}`, `Created namespace ${nsName}`);
          return { output: `namespace/${nsName} created`, success: true };
        }

        return { output: `kubectl ${action} require a file input. E.g. "kubectl apply -f manifest.yaml"`, success: false };
      }

      return { output: `File manifest applied successfully (simulation matches visual changes).`, success: true };
    }

    default:
      return { output: `Unknown command "kubectl ${action}". Try "kubectl help" for options.`, success: false };
  }
}

// -------------------------------------------------------------
// EXPRESS ROUTE ENDPOINTS
// -------------------------------------------------------------

// Cluster status API
app.get("/api/k8s/resources", (req, res) => {
  res.json({
    nodes,
    namespaces,
    pods,
    deployments,
    services,
    configMaps,
    secrets,
    events
  });
});

// Create pod via Deploy Wizard
app.post("/api/k8s/deploy", (req, res) => {
  const { name, namespace, image, replicas, ports, env, cpu, mem } = req.body;

  if (!name || !image) {
    return res.status(400).json({ error: "Name and image are required" });
  }

  const targetNamespace = namespace || "default";

  // Check namespace exists
  if (!namespaces.some(n => n.name === targetNamespace)) {
    namespaces.push({
      name: targetNamespace,
      status: "Active",
      age: "1s",
      creationTimestamp: new Date().toISOString()
    });
    pushEvent("Normal", "Created", `Namespace/${targetNamespace}`, `Created namespace ${targetNamespace} automatically`);
  }

  // If replicas > 1 or default, create a Deployment
  const replicasCount = replicas ? parseInt(replicas, 10) : 1;

  if (replicasCount > 1 || req.body.createDeployment) {
    // Create Deployment
    if (deployments.some(d => d.name === name && d.namespace === targetNamespace)) {
      return res.status(400).json({ error: `Deployment "${name}" already exists in namespace "${targetNamespace}"` });
    }

    deployments.push({
      name,
      namespace: targetNamespace,
      replicas: replicasCount,
      availableReplicas: replicasCount,
      readyReplicas: replicasCount,
      image,
      age: "1s",
      selector: { app: name },
      creationTimestamp: new Date().toISOString()
    });

    pushEvent("Normal", "Created", `Deployment/${name}`, `Created deployment ${name} with ${replicasCount} replicas`);

    // Create pods
    for (let i = 0; i < replicasCount; i++) {
      const randSuffix = Math.random().toString(36).substring(2, 7);
      const podName = `${name}-${randSuffix}`;
      pods.push({
        name: podName,
        namespace: targetNamespace,
        status: "ContainerCreating",
        ready: "0/1",
        restarts: 0,
        age: "1s",
        ip: `10.244.${Math.floor(Math.random() * 3) + 1}.${Math.floor(Math.random() * 250) + 2}`,
        node: nodes[Math.floor(Math.random() * 3) + 1].name,
        cpu: cpu ? parseInt(cpu, 10) : 15,
        mem: mem ? parseInt(mem, 10) : 32,
        image,
        ports: ports ? [parseInt(ports, 10)] : [],
        env: env || [],
        creationTimestamp: new Date().toISOString(),
        labels: { app: name },
        controlledBy: `Deployment/${name}`
      });
      pushEvent("Normal", "Scheduled", `Pod/${podName}`, `Assigned to node and scheduled deployment container`);
    }
  } else {
    // Just a naked Pod
    if (pods.some(p => p.name === name && p.namespace === targetNamespace)) {
      return res.status(400).json({ error: `Pod "${name}" already exists in namespace "${targetNamespace}"` });
    }

    pods.push({
      name,
      namespace: targetNamespace,
      status: "ContainerCreating",
      ready: "0/1",
      restarts: 0,
      age: "1s",
      ip: `10.244.${Math.floor(Math.random() * 3) + 1}.${Math.floor(Math.random() * 250) + 2}`,
      node: nodes[Math.floor(Math.random() * 3) + 1].name,
      cpu: cpu ? parseInt(cpu, 10) : 20,
      mem: mem ? parseInt(mem, 10) : 45,
      image,
      ports: ports ? [parseInt(ports, 10)] : [],
      env: env || [],
      creationTimestamp: new Date().toISOString(),
      labels: { app: name }
    });

    pushEvent("Normal", "Scheduled", `Pod/${name}`, `Assigned naked pod to worker node`);
  }

  // Create Service optionally if port is specified
  if (ports && req.body.createService) {
    const serviceName = `${name}-service`;
    if (!services.some(s => s.name === serviceName && s.namespace === targetNamespace)) {
      services.push({
        name: serviceName,
        namespace: targetNamespace,
        type: req.body.serviceType || "ClusterIP",
        clusterIp: `10.96.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`,
        externalIp: req.body.serviceType === "LoadBalancer" ? `34.120.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` : "<none>",
        ports: `${ports}:${Math.floor(Math.random() * 1000) + 30000}/TCP`,
        age: "1s",
        selector: { app: name },
        creationTimestamp: new Date().toISOString()
      });
      pushEvent("Normal", "Created", `Service/${serviceName}`, `Exposed deployment service on port ${ports}`);
    }
  }

  res.json({ message: "Deployment initiated successfully", status: "success" });
});

// Create namespace endpoint
app.post("/api/k8s/namespaces", (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "Namespace name is required" });
  if (namespaces.some(n => n.name === name)) {
    return res.status(400).json({ error: `Namespace "${name}" already exists` });
  }

  namespaces.push({
    name,
    status: "Active",
    age: "1s",
    creationTimestamp: new Date().toISOString()
  });
  pushEvent("Normal", "Created", `Namespace/${name}`, `Namespace manually created via web console`);
  res.json({ status: "success", name });
});

// Apply YAML Manifest directly
app.post("/api/k8s/apply", (req, res) => {
  const { yaml } = req.body;
  if (!yaml) return res.status(400).json({ error: "YAML manifest is required" });

  try {
    const docs = parseKubernetesYaml(yaml);
    if (docs.length === 0) {
      return res.status(400).json({ error: "No valid Kubernetes resource manifest found" });
    }

    for (const doc of docs) {
      const name = doc.metadata.name;
      const kind = doc.kind;
      const ns = doc.metadata.namespace || "default";

      if (!name || !kind) continue;

      if (kind === "Namespace") {
        if (!namespaces.some(n => n.name === name)) {
          namespaces.push({
            name,
            status: "Active",
            age: "1s",
            creationTimestamp: new Date().toISOString()
          });
          pushEvent("Normal", "Created", `Namespace/${name}`, `Created Namespace via YAML apply`);
        }
      } else if (kind === "Deployment") {
        // Create or update deployment
        const existingIdx = deployments.findIndex(d => d.name === name && d.namespace === ns);
        const rep = doc.spec.replicas || 1;
        const img = doc.spec.image || "nginx:alpine";

        if (existingIdx !== -1) {
          deployments[existingIdx].replicas = rep;
          deployments[existingIdx].image = img;
          pushEvent("Normal", "ScalingReplicaSet", `Deployment/${name}`, `YAML updated deployment replicas to ${rep}`);
        } else {
          deployments.push({
            name,
            namespace: ns,
            replicas: rep,
            availableReplicas: rep,
            readyReplicas: rep,
            image: img,
            age: "1s",
            selector: doc.metadata.labels || { app: name },
            creationTimestamp: new Date().toISOString()
          });
          pushEvent("Normal", "Created", `Deployment/${name}`, `YAML created deployment`);

          // Spawn pods
          for (let i = 0; i < rep; i++) {
            const podName = `${name}-${Math.random().toString(36).substring(2, 7)}`;
            pods.push({
              name: podName,
              namespace: ns,
              status: "ContainerCreating",
              ready: "0/1",
              restarts: 0,
              age: "1s",
              ip: `10.244.${Math.floor(Math.random() * 3) + 1}.${Math.floor(Math.random() * 250) + 2}`,
              node: nodes[Math.floor(Math.random() * 3) + 1].name,
              cpu: 15,
              mem: 32,
              image: img,
              ports: [],
              env: [],
              creationTimestamp: new Date().toISOString(),
              labels: doc.metadata.labels || { app: name },
              controlledBy: `Deployment/${name}`
            });
          }
        }
      } else if (kind === "Pod") {
        if (!pods.some(p => p.name === name && p.namespace === ns)) {
          pods.push({
            name,
            namespace: ns,
            status: "ContainerCreating",
            ready: "0/1",
            restarts: 0,
            age: "1s",
            ip: `10.244.${Math.floor(Math.random() * 3) + 1}.${Math.floor(Math.random() * 250) + 2}`,
            node: nodes[Math.floor(Math.random() * 3) + 1].name,
            cpu: 15,
            mem: 32,
            image: doc.spec.image || "nginx:alpine",
            ports: doc.spec.port ? [doc.spec.port] : [],
            env: [],
            creationTimestamp: new Date().toISOString(),
            labels: doc.metadata.labels || { app: name }
          });
          pushEvent("Normal", "Scheduled", `Pod/${name}`, `YAML created standalone pod`);
        }
      } else if (kind === "Service") {
        if (!services.some(s => s.name === name && s.namespace === ns)) {
          services.push({
            name,
            namespace: ns,
            type: doc.spec.type || "ClusterIP",
            clusterIp: `10.96.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`,
            externalIp: doc.spec.type === "LoadBalancer" ? `34.120.45.${Math.floor(Math.random() * 250)}` : "<none>",
            ports: `${doc.spec.port || 80}/TCP`,
            age: "1s",
            selector: doc.spec.selector || {},
            creationTimestamp: new Date().toISOString()
          });
          pushEvent("Normal", "Created", `Service/${name}`, `YAML created service`);
        }
      }
    }

    res.json({ status: "success", message: "YAML Configuration applied successfully" });
  } catch (err: any) {
    res.status(400).json({ error: `YAML parsing error: ${err.message}` });
  }
});

// Run kubectl CLI command securely
app.post("/api/k8s/kubectl", (req, res) => {
  const { command, role, namespace } = req.body;

  if (!command) return res.status(400).json({ error: "Kubectl command is required" });

  const result = runMockKubectl(command, role || "ClusterAdmin", namespace || "default");
  res.json(result);
});

// AI COPILOT ENDPOINT - Translate English to Kubectl or YAML
app.post("/api/copilot/chat", async (req, res) => {
  const { prompt, chatHistory } = req.body;

  if (!prompt) return res.status(400).json({ error: "Prompt is required" });

  const ai = getAi();
  if (!ai) {
    // Return a smart local generator if Gemini API key isn't provided or set up yet
    const localSuggestions: Record<string, string> = {
      deploy: `To deploy a web pod with nginx, you can use:
\`\`\`bash
kubectl run web-server --image=nginx:alpine --port=80
\`\`\`

Or apply this deployment YAML:
\`\`\`yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx-deployment
  namespace: default
spec:
  replicas: 3
  selector:
    matchLabels:
      app: nginx
  template:
    metadata:
      labels:
        app: nginx
    spec:
      containers:
      - name: nginx
        image: nginx:alpine
        ports:
        - containerPort: 80
\`\`\``,
      get: `Here are the essential get commands:
- Get all pods: \`kubectl get pods\`
- Get details in a namespace: \`kubectl get pods -n kube-system\`
- Describe a specific pod: \`kubectl describe pod coredns-55cb58b774-8qzr2 -n kube-system\``,
      rbac: `Kubernetes uses Role-Based Access Control to secure cluster resources. Your current environment supports:
- **ClusterAdmin**: Unrestricted read/write root privileges.
- **NamespaceManager**: Can edit resources within namespaced boundaries (Deployments, Pods, Services) but cannot manage cluster Nodes.
- **Developer**: Scoped to developer namespace, restricted from kube-system or Namespace management.
- **ReadOnly**: Viewer access. Blocked from write operations.`
    };

    const matchedKey = Object.keys(localSuggestions).find(key => prompt.toLowerCase().includes(key)) || "deploy";
    return res.json({
      text: `[Offline Simulation Mode]\n\n${localSuggestions[matchedKey]}\n\n*(To get smart dynamically synthesized Gemini answers, configure your GEMINI_API_KEY in the Settings > Secrets panel)*`
    });
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: `You are an expert Kubernetes Solutions Architect and DevOps engineer. 
Your job is to assist users of a browser-based Kubernetes Dashboard.
Always provide correct, clean yaml files, or clear bash kubectl commands.
Respond concisely. Format YAML manifests inside markdown blocks.
When asked to write a command, write the exact 'kubectl' command they can paste into their terminal.
Ensure your responses are clear, human-focused, and educational.`
      }
    });

    res.json({ text: response.text });
  } catch (err: any) {
    res.status(500).json({ error: `AI Assistant Error: ${err.message}` });
  }
});


// -------------------------------------------------------------
// VITE AND PRODUCTION SERVING
// -------------------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
