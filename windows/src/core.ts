export type PortProtocol = "TCP" | "UDP";
export type PortScope = "project" | "all";

export interface PortUsage {
  id: string;
  command: string;
  pid: number;
  user: string;
  protocolName: PortProtocol;
  address: string;
  port: number;
  state: string;
  executablePath: string;
  workingDirectory: string;
  parentCommand: string;
  isProjectService: boolean;
  processStartTime: number;
}

export interface TerminateTarget {
  pid: number;
  processStartTime: number;
}

export interface PortFilters {
  scope: PortScope;
  protocol: PortProtocol | "all";
  query: string;
}

export interface PortGroup {
  port: number;
  usages: PortUsage[];
}

const WINDOWS_SHELLS = new Set([
  "cmd",
  "cmd.exe",
  "powershell",
  "powershell.exe",
  "pwsh",
  "pwsh.exe",
]);

export function displayCommand(port: PortUsage): string {
  const parent = (port.parentCommand || "").trim();
  const command = (port.command || "").trim();
  const normalizedParent = parent.toLowerCase();
  const normalizedCommand = command.toLowerCase();
  if (
    port.isProjectService &&
    parent &&
    normalizedParent !== normalizedCommand &&
    !WINDOWS_SHELLS.has(normalizedParent)
  ) {
    return parent;
  }
  return command || "-";
}

export function shortPath(path: string): string {
  if (!path) return "";
  const parts = path.split(/[\\/]+/).filter(Boolean);
  return parts.length ? `…/${parts.at(-1)}` : path;
}

export function serverLabel(port: PortUsage): string {
  let host = port.address;
  if (["0.0.0.0", "::", "[::]", "*"].includes(host)) host = "localhost";
  if (["::1", "[::1]"].includes(host)) host = "127.0.0.1";
  return `${host}:${port.port}`;
}

export function filterPorts(ports: readonly PortUsage[], filters: PortFilters): PortUsage[] {
  const search = filters.query.trim().toLowerCase();
  return ports.filter((port) => {
    if (filters.scope === "project" && !port.isProjectService) return false;
    if (filters.protocol !== "all" && port.protocolName !== filters.protocol) return false;
    if (!search) return true;
    return [
      port.command,
      port.parentCommand,
      port.user,
      port.address,
      port.workingDirectory,
      String(port.port),
      String(port.pid),
    ].some((value) => (value || "").toLowerCase().includes(search));
  });
}

export function groupPorts(ports: readonly PortUsage[]): PortGroup[] {
  const byPort = new Map<number, PortUsage[]>();
  for (const port of ports) {
    const group = byPort.get(port.port);
    if (group) {
      group.push(port);
    } else {
      byPort.set(port.port, [port]);
    }
  }
  return [...byPort.entries()]
    .sort(([left], [right]) => left - right)
    .map(([port, usages]) => ({ port, usages }));
}

export function uniqueValues<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

// 终止目标：按 PID 去重并携带进程启动时间，供后端校验 PID 未被复用。
export function terminateTargets(usages: readonly PortUsage[]): TerminateTarget[] {
  const byPid = new Map<number, number>();
  for (const usage of usages) {
    if (usage.pid > 0 && !byPid.has(usage.pid)) {
      byPid.set(usage.pid, usage.processStartTime);
    }
  }
  return [...byPid.entries()]
    .sort(([left], [right]) => left - right)
    .map(([pid, processStartTime]) => ({ pid, processStartTime }));
}

export function compareVersions(left: string, right: string): -1 | 0 | 1 {
  const parse = (version: string): { parts: number[]; prerelease: boolean } => {
    const normalized = version.replace(/^[vV]/, "");
    const dashIndex = normalized.indexOf("-");
    const core = dashIndex === -1 ? normalized : normalized.slice(0, dashIndex);
    const parts = core
      .split(".")
      .map((part) => Number.parseInt(part.match(/^\d+/)?.[0] || "0", 10));
    return { parts, prerelease: dashIndex !== -1 };
  };
  const a = parse(left);
  const b = parse(right);
  for (let index = 0; index < Math.max(a.parts.length, b.parts.length); index += 1) {
    const delta = (a.parts[index] || 0) - (b.parts[index] || 0);
    if (delta !== 0) return delta > 0 ? 1 : -1;
  }
  // 主版本号相同：预发布版本低于正式版本。
  if (a.prerelease !== b.prerelease) return a.prerelease ? -1 : 1;
  return 0;
}
