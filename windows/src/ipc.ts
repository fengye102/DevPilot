import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import type { PortUsage } from "./core";
import { isTauriRuntime } from "./state";

export interface PortScanResult {
  ports: PortUsage[];
  rawSocketCount: number;
  diagnosticText: string;
}

export interface TerminateResult {
  terminatedPids: number[];
}

export interface AppInfo {
  version: string;
  build: string;
  platform: "Windows";
}

export interface UpdateStatus {
  currentVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
  releaseUrl: string;
}

export interface AutoRefreshChanged {
  enabled: boolean;
}

// 浏览器预览模式下的模拟数据，便于不启动 Tauri 直接调试界面
const previewPorts: PortUsage[] = [
  {
    id: "TCP-3000-4242-0.0.0.0",
    command: "node",
    pid: 4242,
    user: "rose",
    protocolName: "TCP",
    address: "0.0.0.0",
    port: 3000,
    state: "LISTEN",
    executablePath: "C:\\Program Files\\nodejs\\node.exe",
    workingDirectory: "C:\\Users\\rose\\code\\DevPilot\\web",
    parentCommand: "pnpm",
    isProjectService: true,
    processStartTime: 0,
  },
  {
    id: "TCP-8080-5310-127.0.0.1",
    command: "main",
    pid: 5310,
    user: "rose",
    protocolName: "TCP",
    address: "127.0.0.1",
    port: 8080,
    state: "LISTEN",
    executablePath: "C:\\Users\\rose\\AppData\\Local\\Temp\\go-build\\main.exe",
    workingDirectory: "C:\\Users\\rose\\code\\api",
    parentCommand: "go",
    isProjectService: true,
    processStartTime: 0,
  },
  {
    id: "UDP-5353-928-0.0.0.0",
    command: "svchost",
    pid: 928,
    user: "SYSTEM",
    protocolName: "UDP",
    address: "0.0.0.0",
    port: 5353,
    state: "",
    executablePath: "C:\\Windows\\System32\\svchost.exe",
    workingDirectory: "C:\\Windows\\System32",
    parentCommand: "services",
    isProjectService: false,
    processStartTime: 0,
  },
];

async function invokePreview<T>(command: string, args: Record<string, unknown>): Promise<T> {
  await new Promise((resolve) => setTimeout(resolve, command === "scan_ports" ? 180 : 30));
  const values: Record<string, unknown> = {
    scan_ports: {
      ports: previewPorts,
      rawSocketCount: previewPorts.length,
      diagnosticText: `preview ${previewPorts.length} ports`,
    } satisfies PortScanResult,
    terminate_processes: {
      terminatedPids: (args.pids as number[] | undefined) || [],
    } satisfies TerminateResult,
    get_app_info: { version: "0.1.0", build: "0.1.0", platform: "Windows" } satisfies AppInfo,
    check_for_updates: {
      currentVersion: "0.1.0",
      latestVersion: "0.1.0",
      hasUpdate: false,
      releaseUrl: "https://github.com/pkc918/DevPilot/releases/latest",
    } satisfies UpdateStatus,
  };
  return values[command] as T;
}

export const invoke = <T>(command: string, args: Record<string, unknown> = {}): Promise<T> =>
  !isTauriRuntime && import.meta.env.DEV ? invokePreview<T>(command, args) : tauriInvoke<T>(command, args);
