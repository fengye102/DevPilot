import type { PortFilters, PortScope, PortProtocol, PortUsage } from "./core";

// 运行环境：托盘视图通过 ?view=tray 区分
export const isTray = new URLSearchParams(window.location.search).get("view") === "tray";
document.body.classList.toggle("tray-view", isTray);

// 浏览器预览（非 Tauri 运行时）时 ipc.ts 会改用本地模拟数据
export const isTauriRuntime = "__TAURI_INTERNALS__" in window;

export interface ViewState extends PortFilters {
  ports: PortUsage[];
  scanning: boolean;
  showActivity: boolean;
  error: string;
  lastUpdated: Date | null;
  lastScanStartedAt: number;
  diagnostic: string;
  expanded: Set<number>;
  rowTargets: Map<string, PortUsage[]>;
  pathTargets: Map<string, string>;
  activeContextRow: string | null;
  autoRefresh: boolean;
  releaseUrl: string;
}

export const state: ViewState = {
  ports: [],
  scope: "project" satisfies PortScope,
  protocol: "all" satisfies PortProtocol | "all",
  query: "",
  scanning: false,
  showActivity: false,
  error: "",
  lastUpdated: null,
  lastScanStartedAt: 0,
  diagnostic: "尚未执行扫描",
  expanded: new Set<number>(),
  rowTargets: new Map<string, PortUsage[]>(),
  pathTargets: new Map<string, string>(),
  activeContextRow: null,
  autoRefresh: localStorage.getItem("portAutoRefresh") !== "false",
  releaseUrl: "",
};

export const $ = <T extends HTMLElement = HTMLElement>(selector: string): T => {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`缺少界面元素：${selector}`);
  return element;
};
