# bilibili-learning-progress 开发指南

## 🛠️ 核心指令 (Build & Test Commands)
> IMPORTANT: 不要猜测扩展加载方式或构建入口，按下面的实际项目命令执行。

* **安装依赖**: 优先使用 `pnpm install`，仅在 `pnpm` 不可用时再用 `npm install`
* **本地开发**: 优先使用 `pnpm dev`
* **完整构建**: 优先使用 `pnpm build`
* **格式化代码**: 优先使用 `pnpm fmt`
* **打包扩展 Zip**: 优先使用 `pnpm zip`
* **加载到 Chrome**: 在 `chrome://extensions/` 中加载 `build/` 目录，不要加载仓库根目录

## 📐 代码风格与架构 (Code Style & Architecture)
* **技术栈**: 本项目是 `React + Vite + TypeScript + CRXJS` 的 Chrome 扩展，不是普通网站项目。
* **模块规范**: 使用 ES Modules (`import/export`)，保持现有 TypeScript 风格，不要引入 CommonJS。
* **入口结构**:
  - `src/manifest.ts` 是扩展页面、权限、图标、content script 注册的唯一事实来源
  - `src/popup/` 负责扩展按钮弹窗
  - `src/options/` 作为稳定的仪表盘页面入口
  - `src/newtab/` 存放真正的学习进度仪表盘实现
  - `src/contentScript/` 负责在 Bilibili 页面采集和展示悬浮进度
* **界面职责**:
  - popup 保持极简，只负责打开仪表盘页面
  - 仪表盘逻辑集中在 `src/newtab/`，不要在 popup 和 options 中重复实现同一套业务
* **数据存储**:
  - 本地课程数据主 key 为 `blp:learning-courses`
  - Gist 同步配置和元信息定义在 `src/gistSync.ts`
  - 没有明确迁移方案时，不要随意修改现有 storage key 或同步数据结构

## ⚠️ 避坑指南与特殊规则 (Gotchas & Constraints)
* **新标签页禁区**: 除非用户明确要求重新接管 Chrome 新建标签页，否则不要恢复 `chrome_url_overrides.newtab`。
* **页面作用域**: 除非用户明确扩大范围，否则 content script 只作用于 `https://www.bilibili.com/video/*`。
* **真实验证**: 改完 popup、options、manifest、图标、content script 之后，不能只看代码，必须重新构建并在 Chrome 中重新加载已解压扩展验证。
* **图标资源同步**:
  - `public/img/logo-16.png`、`logo-32.png`、`logo-48.png`、`logo-128.png` 是扩展实际使用的图标
  - `public/icons/logo.svg` 是可编辑矢量源文件
  - `src/assets/logo.png` 与 `public/icons/logo.ico` 也要保持同步
* **构建认知**: 改了 `public/` 下的图标文件后，如果没有重新执行 `npm run build`，Chrome 里的扩展图标不会更新。

## 🚀 工作流与修改规范 (Workflow & Change Rules)
* **开发前**: 先运行 `archkit wakeup .`，再开始做开发判断。
* **优先策略**: 优先在现有入口和现有页面上改，不要没有必要就新增 manifest 页面、权限或新的扩展 surface。
* **修改入口类文件后**: 任何涉及 `src/manifest.ts`、`src/popup/`、`src/options/`、`src/newtab/` 的变更，完成后都要执行 `npm run build`。
* **文档同步**: 如果扩展加载方式、入口结构、使用流程发生变化，要同步更新 `README.md` 和本文件。
* **提交规范**: Git commit 使用 Conventional Commits，例如 `fix(extension-ui): open dashboard from popup`。
