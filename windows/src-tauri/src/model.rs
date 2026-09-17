use serde::Serialize;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PortUsage {
    pub id: String,
    pub command: String,
    pub pid: u32,
    pub user: String,
    pub protocol_name: String,
    pub address: String,
    pub port: u16,
    pub state: String,
    pub executable_path: String,
    pub working_directory: String,
    pub parent_command: String,
    pub is_project_service: bool,
    /// 进程启动时间（秒级时间戳），用于终止前校验 PID 未被复用。
    pub process_start_time: u64,
}

/// 终止目标：PID + 扫描时记录的进程启动时间。
#[derive(Clone, Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminateTarget {
    pub pid: u32,
    pub process_start_time: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PortScanResult {
    pub ports: Vec<PortUsage>,
    pub raw_socket_count: usize,
    pub diagnostic_text: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminateResult {
    pub terminated_pids: Vec<u32>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    pub version: String,
    pub build: String,
    pub platform: &'static str,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateStatus {
    pub current_version: String,
    pub latest_version: String,
    pub has_update: bool,
    pub release_url: String,
}
