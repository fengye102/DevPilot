# DevPilot 工作区规范

## 项目目标

DevPilot 是一个 Windows 开发辅助工具库仅维护 Windows 客户端及相关资源、文档和持续集成配置
## 目录约定

- `windows/`：Windows 客户端代码，包括 Web 前端与 Tauri/Rust 后端- `assets/`：仓库级品牌和产品图片，不放生成产物- `.github/workflows/`：Windows 持续集成与发布工作流- `.agents/`：代理和插件配置https://img.shields.io/badge/Windows-10%2B-0078D4](windows/)

DevPilot 是一款 Windows 系统托�盘端口监控工具，可快速查看并关闭开发过程中遗留的本地服务端口。

## Windows 客户端

Windows 客户端的功能、开发环境、构建方式和权限说明请参阅 windows/README.md。

## 快速开始

```powershell
cd windows
npm ci
npm run dev
```

## 测试与构建

```powershell
cd windows
npm test
npm run build
```

## 项目结构

```text
.github/workflows/windows.yml  Windows CI 工作流
assets/                       仓库级品牌与产��品资源
windows/                      Windows 客户端及其测试
```
