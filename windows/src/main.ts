import { emit, listen } from "@tauri-apps/api/event";
import { terminateTargets, uniqueValues, type PortUsage } from "./core";
import {
  invoke,
  type AppInfo,
  type AutoRefreshChanged,
  type PortScanResult,
  type TerminateResult,
  type UpdateStatus,
} from "./ipc";
import { escapeHtml, render } from "./render";
import { $, isTauriRuntime, isTray, state } from "./state";

const rowsElement = $<HTMLTableSectionElement>("#port-rows");
const contextMenu = $("#context-menu");
const settingsModal = $("#settings-modal");
let toastTimer: ReturnType<typeof setTimeout> | undefined;

function showToast(message: string, kind: "info" | "success" | "error" = "info"): void {
  const toast = $("#toast");
  toast.textContent = message;
  toast.dataset.kind = kind;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.hidden = true;
  }, 3200);
}

function errorMessage(error: unknown): string {
  if (typeof error === "string") return error;
  return error instanceof Error ? error.message : String(error || "未知错误");
}

function eventElement(event: Event): Element | null {
  return event.target instanceof Element ? event.target : null;
}

async function scanPorts(showActivity = true): Promise<void> {
  if (state.scanning) return;
  const now = Date.now();
  if (!showActivity && now - state.lastScanStartedAt < 2500) return;
  state.scanning = true;
  state.showActivity = showActivity;
  state.lastScanStartedAt = now;
  if (showActivity) state.error = "";
  render();
  try {
    const result = await invoke<PortScanResult>("scan_ports");
    state.ports = result.ports;
    state.diagnostic = result.diagnosticText;
    state.lastUpdated = new Date();
    state.error = "";
  } catch (error) {
    state.error = errorMessage(error);
    state.diagnostic = state.error;
  } finally {
    state.scanning = false;
    state.showActivity = false;
    render();
  }
}

async function terminate(usages: PortUsage[]): Promise<void> {
  const targets = terminateTargets(usages);
  if (!targets.length) {
    showToast("没有可关闭的进程", "error");
    return;
  }
  hideContextMenu();
  try {
    const result = await invoke<TerminateResult>("terminate_processes", { targets });
    showToast(`已关闭 PID ${result.terminatedPids.join(", ")}`, "success");
    await new Promise((resolve) => setTimeout(resolve, 400));
    await scanPorts(true);
  } catch (error) {
    showToast(errorMessage(error), "error");
  }
}

async function revealPath(path: string | undefined): Promise<void> {
  if (!path || path.includes(" 个目录")) return;
  try {
    await invoke<void>("reveal_in_explorer", { path });
  } catch (error) {
    showToast(errorMessage(error), "error");
  }
}

async function copyPath(path: string | undefined): Promise<void> {
  if (!path || path.includes(" 个目录")) return;
  try {
    await invoke<void>("copy_text", { text: path });
    showToast("已拷贝项目路径", "success");
  } catch (error) {
    showToast(errorMessage(error), "error");
  }
}

function showContextMenu(event: MouseEvent, rowKey: string): void {
  const usages = state.rowTargets.get(rowKey);
  if (!usages) return;
  event.preventDefault();
  state.activeContextRow = rowKey;
  const paths = uniqueValues(usages.map((port) => port.workingDirectory).filter(Boolean));
  const hasSinglePath = paths.length === 1;
  contextMenu.querySelectorAll<HTMLElement>(".path-action").forEach((item) => {
    item.hidden = !hasSinglePath;
  });
  $("#context-close-service span:last-child").textContent = usages.length > 1
    ? "关闭此端口的所有服务"
    : "关闭端口服务";
  contextMenu.hidden = false;
  const rect = contextMenu.getBoundingClientRect();
  contextMenu.style.left = `${Math.min(event.clientX, window.innerWidth - rect.width - 8)}px`;
  contextMenu.style.top = `${Math.min(event.clientY, window.innerHeight - rect.height - 8)}px`;
}

function hideContextMenu(): void {
  contextMenu.hidden = true;
  state.activeContextRow = null;
}

function openSettings(): void {
  settingsModal.hidden = false;
  $<HTMLInputElement>("#auto-refresh-toggle").checked = state.autoRefresh;
  $("#update-result").textContent = "";
  $<HTMLButtonElement>("#check-update").focus();
}

function closeSettings(): void {
  settingsModal.hidden = true;
}

function applyAutoRefresh(enabled: boolean): void {
  state.autoRefresh = enabled;
  localStorage.setItem("portAutoRefresh", String(enabled));
  if (!isTray) {
    $<HTMLInputElement>("#auto-refresh-toggle").checked = enabled;
  }
}

async function loadAppInfo(): Promise<void> {
  try {
    const info = await invoke<AppInfo>("get_app_info");
    $("#sidebar-version").textContent = `v${info.version}`;
    $("#settings-version").textContent = `v${info.version}`;
    $("#settings-build").textContent = info.build;
  } catch {
    // 浏览器预览模式下沿用 HTML 里的占位版本号。
  }
}

async function checkForUpdates(): Promise<void> {
  const button = $<HTMLButtonElement>("#check-update");
  const resultElement = $("#update-result");
  button.disabled = true;
  resultElement.textContent = "正在检查…";
  try {
    const result = await invoke<UpdateStatus>("check_for_updates");
    state.releaseUrl = result.releaseUrl;
    if (result.hasUpdate) {
      resultElement.innerHTML = `发现 v${escapeHtml(result.latestVersion)} · <button id="open-release" type="button">打开下载页</button>`;
      $("#open-release").addEventListener("click", () => {
        void invoke<void>("open_release_url", { url: state.releaseUrl });
      });
    } else {
      resultElement.textContent = `当前已是最新版本（v${result.currentVersion}）`;
    }
  } catch (error) {
    resultElement.textContent = errorMessage(error);
  } finally {
    button.disabled = false;
  }
}

if (!isTray) {
  $("#search-input").addEventListener("input", (event) => {
    state.query = (event.target as HTMLInputElement).value;
    render();
  });
  $("#refresh-button").addEventListener("click", () => scanPorts(true));
  $("#protocol-filter").addEventListener("click", (event) => {
    const button = eventElement(event)?.closest<HTMLButtonElement>("button[data-value]");
    if (!button) return;
    const protocol = button.dataset.value;
    if (protocol !== "all" && protocol !== "TCP" && protocol !== "UDP") return;
    state.protocol = protocol;
    $("#protocol-filter").querySelectorAll("button").forEach((item) => item.classList.toggle("active", item === button));
    render();
  });
  $("#scope-filter").addEventListener("click", (event) => {
    const button = eventElement(event)?.closest<HTMLButtonElement>("button[data-value]");
    if (!button) return;
    const scope = button.dataset.value;
    if (scope !== "project" && scope !== "all") return;
    state.scope = scope;
    $("#scope-filter").querySelectorAll("button").forEach((item) => item.classList.toggle("active", item === button));
    render();
  });
  rowsElement.addEventListener("click", (event) => {
    const disclosure = eventElement(event)?.closest<HTMLElement>("[data-expand-port]");
    if (disclosure) {
      const port = Number(disclosure.dataset.expandPort);
      state.expanded.has(port) ? state.expanded.delete(port) : state.expanded.add(port);
      render();
      return;
    }
    const path = eventElement(event)?.closest<HTMLElement>("[data-path-key]");
    const pathKey = path?.dataset.pathKey;
    if (pathKey) revealPath(state.pathTargets.get(pathKey));
  });
  rowsElement.addEventListener("contextmenu", (event) => {
    const row = eventElement(event)?.closest<HTMLTableRowElement>("tr[data-row-key]");
    if (row?.dataset.rowKey) showContextMenu(event, row.dataset.rowKey);
  });
  $("#version-button").addEventListener("click", openSettings);
  $("#auto-refresh-toggle").addEventListener("change", (event) => {
    const enabled = (event.target as HTMLInputElement).checked;
    applyAutoRefresh(enabled);
    if (isTauriRuntime) void emit<AutoRefreshChanged>("auto-refresh-changed", { enabled });
  });
  $("#check-update").addEventListener("click", checkForUpdates);
  document.querySelectorAll<HTMLElement>(".modal-close").forEach((button) => button.addEventListener("click", closeSettings));
  settingsModal.addEventListener("mousedown", (event) => {
    if (event.target === settingsModal) closeSettings();
  });
  loadAppInfo();
} else {
  $("#tray-refresh").addEventListener("click", () => scanPorts(true));
  $("#tray-open-main").addEventListener("click", () => {
    void invoke<void>("show_main_window");
  });
  $("#tray-content").addEventListener("click", (event) => {
    const path = eventElement(event)?.closest<HTMLElement>("[data-path-key]");
    const pathKey = path?.dataset.pathKey;
    if (pathKey) revealPath(state.pathTargets.get(pathKey));
  });
  $("#tray-content").addEventListener("contextmenu", (event) => {
    const row = eventElement(event)?.closest<HTMLElement>("[data-row-key]");
    if (row?.dataset.rowKey) showContextMenu(event, row.dataset.rowKey);
  });
}

$("#context-close-service").addEventListener("click", () => {
  const usages = state.activeContextRow ? state.rowTargets.get(state.activeContextRow) : undefined;
  if (usages) terminate(usages);
});
$("#context-copy-path").addEventListener("click", () => {
  const usages = state.activeContextRow ? state.rowTargets.get(state.activeContextRow) || [] : [];
  const path = uniqueValues(usages.map((port) => port.workingDirectory).filter(Boolean))[0];
  hideContextMenu();
  copyPath(path);
});
$("#context-open-path").addEventListener("click", () => {
  const usages = state.activeContextRow ? state.rowTargets.get(state.activeContextRow) || [] : [];
  const path = uniqueValues(usages.map((port) => port.workingDirectory).filter(Boolean))[0];
  hideContextMenu();
  revealPath(path);
});

document.addEventListener("mousedown", (event) => {
  if (!eventElement(event)?.closest("#context-menu")) hideContextMenu();
});
document.addEventListener("keydown", (event) => {
  if (event.ctrlKey && event.key.toLowerCase() === "r") {
    event.preventDefault();
    scanPorts(true);
  }
  if (event.key === "Escape") {
    hideContextMenu();
    if (!settingsModal.hidden) closeSettings();
  }
});

if (isTauriRuntime) {
  void listen("refresh-ports", () => scanPorts(true));
  void listen<AutoRefreshChanged>("auto-refresh-changed", (event) => {
    applyAutoRefresh(event.payload.enabled);
  });
  if (!isTray) void listen("open-settings", openSettings);
}

window.addEventListener("storage", (event) => {
  if (event.key === "portAutoRefresh" && event.newValue !== null) {
    applyAutoRefresh(event.newValue !== "false");
  }
});

setInterval(() => {
  if (state.autoRefresh) scanPorts(false);
}, 3000);

render();
scanPorts(true);
