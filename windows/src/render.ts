import {
  displayCommand,
  filterPorts,
  groupPorts,
  serverLabel,
  shortPath,
  uniqueValues,
  type PortUsage,
} from "./core";
import { $, isTray, state } from "./state";

interface AggregatedRow {
  protocol: string;
  command: string;
  pid: string;
  address: string;
  state: string;
  path: string;
}

// 渲染时复用的静态容器元素
const rowsElement = $<HTMLTableSectionElement>("#port-rows");
const tableScroll = $("#table-scroll");
const emptyState = $("#empty-state");

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function processBrand(port: PortUsage): string {
  const haystack = `${displayCommand(port)} ${port.command} ${port.executablePath}`.toLowerCase();
  const brands: ReadonlyArray<readonly [string, string]> = [
    ["visual studio code", "vscode"], ["code.exe", "vscode"], ["vscode", "vscode"],
    ["intellij", "intellijidea"], ["webstorm", "webstorm"], ["phpstorm", "phpstorm"],
    ["pycharm", "pycharm"], ["goland", "goland"], ["rubymine", "rubymine"],
    ["datagrip", "datagrip"], ["clion", "clion"], ["rider", "rider"],
    ["google chrome", "googlechrome"], ["chrome.exe", "googlechrome"],
    ["docker", "docker"], ["orbstack", "orbstack"], ["postgres", "postgres"],
    ["mysql", "mysql"], ["redis", "redis"], ["node", "node"], ["python", "python"],
    ["java", "java"], ["ruby", "ruby"], ["rust", "rust"], ["cargo", "rust"],
    ["golang", "go"], ["go.exe", "go"], ["wechat", "wechat"], ["微信", "wechat"],
  ];
  return brands.find(([needle]) => haystack.includes(needle))?.[1] || "";
}

export function processCell(port: PortUsage, text: string, multiple = false): string {
  if (multiple) {
    return `<span class="process-cell"><span class="process-stack">◫</span><span>${escapeHtml(text)}</span></span>`;
  }
  const brand = processBrand(port);
  const icon = brand
    ? `<img src="./process-icons/${brand}.${brand === "orbstack" ? "png" : "svg"}" alt="" />`
    : `<span class="process-fallback">${escapeHtml((text || "?").slice(0, 1).toUpperCase())}</span>`;
  return `<span class="process-cell">${icon}<span title="${escapeHtml(text)}">${escapeHtml(text)}</span></span>`;
}

export function pathButton(path: string): string {
  if (!path || path === "-") return `<span class="muted">-</span>`;
  const key = `path-${state.pathTargets.size}`;
  state.pathTargets.set(key, path);
  return `<button class="path-button" type="button" data-path-key="${key}" title="${escapeHtml(path)}">${escapeHtml(shortPath(path))}</button>`;
}

export function aggregate(usages: PortUsage[]): AggregatedRow {
  const protocols = uniqueValues(usages.map((port) => port.protocolName));
  const commands = uniqueValues(usages.map(displayCommand));
  const pids = uniqueValues(usages.map((port) => port.pid));
  const addresses = uniqueValues(usages.map((port) => port.address));
  const states = uniqueValues(usages.map((port) => port.state || "-"));
  const paths = uniqueValues(usages.map((port) => port.workingDirectory).filter(Boolean));
  return {
    protocol: protocols.join(" / "),
    command: commands.length === 1 ? commands[0] : `${commands.length} 个进程`,
    pid: pids.length === 1 ? String(pids[0]) : `${pids.length} 项`,
    address: addresses.length === 1 ? addresses[0] : `${addresses.length} 个地址`,
    state: states.join(" / "),
    path: paths.length === 1 ? paths[0] : paths.length ? `${paths.length} 个目录` : "-",
  };
}

function currentPorts(): PortUsage[] {
  return filterPorts(state.ports, state);
}

export function rowMarkup(
  usages: PortUsage[],
  { detail = false, groupPort = null }: { detail?: boolean; groupPort?: number | null } = {},
): string {
  const primary = usages[0];
  const multiple = usages.length > 1 && !detail;
  const values = detail
    ? {
        protocol: primary.protocolName,
        command: displayCommand(primary),
        pid: String(primary.pid),
        address: primary.address,
        state: primary.state || "-",
        path: primary.workingDirectory || "-",
      }
    : aggregate(usages);
  const port = groupPort ?? primary.port;
  const key = `row-${state.rowTargets.size}`;
  state.rowTargets.set(key, usages);
  const isExpanded = state.expanded.has(port);
  const disclosure = multiple
    ? `<button type="button" class="disclosure ${isExpanded ? "expanded" : ""}" data-expand-port="${port}" aria-label="展开端口 ${port}">›</button>`
    : "";
  const projectPath = !detail && values.path.includes(" 个目录") ? "-" : values.path;
  return `<tr data-row-key="${key}" class="${detail ? "detail-row" : "group-row"}">
    <td>${disclosure}</td>
    <td class="port-number">${detail ? "" : port.toLocaleString()}</td>
    <td><span class="protocol ${values.protocol === "TCP" ? "tcp" : values.protocol === "UDP" ? "udp" : ""}">${escapeHtml(values.protocol)}</span></td>
    <td>${processCell(primary, values.command, multiple)}</td>
    <td>${primary.isProjectService ? pathButton(projectPath) : '<span class="muted">-</span>'}</td>
    <td class="mono ${multiple ? "muted" : ""}">${escapeHtml(values.pid)}</td>
    <td class="mono address" title="${escapeHtml(values.address)}">${escapeHtml(values.address)}</td>
    <td class="muted">${escapeHtml(values.state)}</td>
  </tr>`;
}

export function renderMain(): void {
  if (isTray) return;
  const visiblePorts = currentPorts();
  const groups = groupPorts(visiblePorts);
  state.rowTargets.clear();
  state.pathTargets.clear();

  const html: string[] = [];
  for (const group of groups) {
    html.push(rowMarkup(group.usages));
    if (group.usages.length > 1 && state.expanded.has(group.port)) {
      for (const usage of group.usages) html.push(rowMarkup([usage], { detail: true, groupPort: group.port }));
    }
  }
  rowsElement.innerHTML = html.join("");

  const isEmpty = visiblePorts.length === 0 && !state.scanning;
  emptyState.hidden = !isEmpty;
  tableScroll.hidden = isEmpty;
  $("#empty-title").textContent = state.error
    ? "扫描失败"
    : state.scope === "project"
      ? "没有找到项目服务端口"
      : "没有找到端口占用";
  $("#empty-message").textContent = state.error
    || (state.scope === "project"
      ? "当前默认只显示本机开发服务的 TCP 监听端口。"
      : "尝试刷新，或以管理员身份运行以读取受保护的系统进程。");

  const tcpCount = state.ports.filter((port) => port.protocolName === "TCP").length;
  const udpCount = state.ports.filter((port) => port.protocolName === "UDP").length;
  const processSource = state.scope === "project"
    ? state.ports.filter((port) => port.isProjectService)
    : state.ports;
  $("#tcp-count").textContent = String(tcpCount);
  $("#udp-count").textContent = String(udpCount);
  $("#process-count").textContent = String(new Set(processSource.map((port) => port.pid).filter(Boolean)).size);
  $("#visible-count").textContent = state.showActivity ? "" : String(visiblePorts.length);
  $("#status-label").textContent = state.showActivity ? "正在扫描" : state.error ? "扫描失败" : "已列出";
  $("#status-dot").className = state.error ? "error" : state.showActivity ? "loading" : "ok";
  $("#diagnostic").textContent = `${state.lastUpdated ? state.lastUpdated.toLocaleTimeString() : "尚未刷新"} · ${state.diagnostic}`;
  $("#refresh-button").classList.toggle("spinning", state.showActivity);
  $<HTMLButtonElement>("#refresh-button").disabled = state.scanning;
}

export function renderTray(): void {
  if (!isTray) return;
  const projectPorts = state.ports.filter((port) => port.isProjectService);
  $("#tray-title").textContent = projectPorts.length ? `项目服务 ${projectPorts.length}` : "项目服务";
  $("#tray-subtitle").textContent = state.showActivity
    ? "正在扫描"
    : state.error
      ? "扫描失败"
      : projectPorts.length
        ? `${new Set(projectPorts.map((port) => port.pid)).size} 个进程`
        : "没有项目端口";
  $("#tray-refresh").classList.toggle("spinning", state.showActivity);
  $<HTMLButtonElement>("#tray-refresh").disabled = state.scanning;

  const content = $("#tray-content");
  if (state.error) {
    content.innerHTML = `<div class="tray-empty"><strong>扫描失败</strong><span>${escapeHtml(state.error)}</span></div>`;
    return;
  }
  if (!projectPorts.length && !state.scanning) {
    content.innerHTML = '<div class="tray-empty"><strong>没有项目端口</strong><span>当前没有本机项目服务监听端口。</span></div>';
    return;
  }

  state.rowTargets.clear();
  state.pathTargets.clear();
  const rows = projectPorts.slice(0, 8).map((port) => {
    const key = `tray-path-${state.pathTargets.size}`;
    const rowKey = `tray-row-${state.rowTargets.size}`;
    state.pathTargets.set(key, port.workingDirectory);
    state.rowTargets.set(rowKey, [port]);
    const command = displayCommand(port);
    return `<button class="tray-port-row" type="button" data-path-key="${key}" data-row-key="${rowKey}" title="${escapeHtml(port.workingDirectory || "未知项目")}">
      <span class="tray-port-top"><strong>${port.port.toLocaleString()}</strong>${processCell(port, command)}<em>${escapeHtml(serverLabel(port))}</em><i>TCP</i></span>
      <span class="tray-project">▱ ${escapeHtml(shortPath(port.workingDirectory) || "未知项目")}</span>
    </button>`;
  });
  if (projectPorts.length > 8) rows.push(`<div class="tray-more">还有 ${projectPorts.length - 8} 个项目端口</div>`);
  content.innerHTML = rows.join("");
}

export function render(): void {
  renderMain();
  renderTray();
}
