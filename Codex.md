# DevPilot 工作区规范

## 项目目标

DevPilot 是一个 Windows 开发辅助工具。本仓库仅维护 Windows 客户端及相关资源、文档和持续集成配置。

## 目录约定

- `windows/`：Windows 客户端代码，包括 Web 前端与 Tauri/Rust 后端。
- `assets/`：仓库级品牌和产品图片。
- `.github/workflows/`：Windows 持续集成与发布工作流。
- `.agents/`：代理和插件配置。

## 工作规则

1. 修改代码前先阅读根目录 `README.md`、`windows/README.md`、依赖清单、入口文件和测试。
2. 新文件应放入职责对应的现有目录，不在仓库根目录堆放临时文件。
3. 仅保留 Windows 平台实现，不新增其他操作系统的条件分支、构建脚本或发布配置。
4. 不提交依赖目录、编译目录、缓存、日志、临时文件或本地密钥。
5. 完成修改前运行 Windows 子项目已有的测试、类型检查和构建命令。
