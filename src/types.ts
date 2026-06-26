export interface NodeInfo {
  name: string;
  status: "Ready" | "NotReady";
  roles: string;
  age: string;
  version: string;
  cpuUsed: number;
  memUsed: number;
  cpuMax: string;
  memMax: string;
  podsCount: number;
}

export interface PodInfo {
  name: string;
  namespace: string;
  status: "Running" | "Pending" | "Failed" | "ContainerCreating" | "Terminating";
  ready: string;
  restarts: number;
  age: string;
  ip: string;
  node: string;
  cpu: number;
  mem: number;
  image: string;
  ports: number[];
  env: Array<{ name: string; value: string }>;
  creationTimestamp: string;
  labels: Record<string, string>;
  controlledBy?: string;
}

export interface DeploymentInfo {
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

export interface ServiceInfo {
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

export interface NamespaceInfo {
  name: string;
  status: "Active" | "Terminating";
  age: string;
  creationTimestamp: string;
}

export interface ConfigMapInfo {
  name: string;
  namespace: string;
  data: Record<string, string>;
  age: string;
}

export interface SecretInfo {
  name: string;
  namespace: string;
  type: string;
  data: Record<string, string>;
  age: string;
}

export interface KubeEvent {
  time: string;
  type: "Normal" | "Warning";
  reason: string;
  object: string;
  message: string;
}

export type RbacRole = "ClusterAdmin" | "NamespaceManager" | "Developer" | "ReadOnly";

export interface ClusterState {
  nodes: NodeInfo[];
  namespaces: NamespaceInfo[];
  pods: PodInfo[];
  deployments: DeploymentInfo[];
  services: ServiceInfo[];
  configMaps: ConfigMapInfo[];
  secrets: SecretInfo[];
  events: KubeEvent[];
}
