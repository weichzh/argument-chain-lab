# 构建与发布

应用与题库 1.2.2 使用 `npm run test:release` 一次执行单元检查、生产构建和针对生产产物的浏览器回归。CI 同样使用生产预览，不以开发服务器测试替代产物验收。

构建生成 `dist/client/release.json`，记录应用版本、题库版本、完整源码提交和题库哈希。正式发布必须由干净、已推送的提交构建，在线读取该文件并核对 `sourceCommit`、`sourceDirty: false`；Sites 返回部署成功与在线关键路径通过是两项独立证据。旧候选归档工作流改为手动触发，维护旧 R2 区时才启用。

1.2 的当前产品是同源静态站点：浏览器读取 v4 正式题库、保存本地进度，并按需读取娱乐 benchmark 或直接调用用户选择的 AI 服务商。

## 静态站点

```bash
npm install
npm test
npm run build
npm run test:e2e
```

把完整 `dist/` 目录部署到静态托管。目录包含 HTML、代码分块、`runtime-config.js` 和 `bank/`；不能只上传 `index.html`。Vite `base` 使用相对路径，支持子目录部署。

发布前确认：

- `dist/client/bank/manifest.json` 的 `default` 为 `1.2.2`；
- manifest 只有一个 `status: current` 的 v4 模型；
- `model-1.2.2.json`、`ideology-benchmark-1.2.2.json` 和 `model-v4.schema.json` 可以从部署 Origin 读取；
- 1.0 和 0.9 模型只位于 `bank/legacy/`，且 `loadInProduct` 为 `false`；
- 首次进入和普通问卷不会请求娱乐 benchmark，只有用户主动生成娱乐匹配后才请求；
- 桌面与移动端的题前信息顺序、根判断、顺序诊断、理由、自定义理由、回退、刷新、跳过、结果、中英并列候选组和单道精度题流程通过；
- 无 AI 配置时问卷仍可完整使用，AI 失败不会改变进度。

## 旧会话

1.0 与 1.1 结构化进度直接续用 1.2 的兼容核心模型，不进入旧版归档。

首次读取 0.9 本地进度时，客户端将其保存在新版 `legacyArchive` 中并开始空白 v4 问卷。验收应确认旧 `conditional` 和组件回答没有进入新版 `policyResults`，同时可以在“本地数据”中查看和导出旧记录。

## AI

AI 配置只存在当前页面内存中。静态站点不需要服务器端密钥，也不应在构建变量、日志或部署产物中写入真实凭据。浏览器直接调用用户选择的模型服务商。

## 兼容贡献边界

`worker/`、`shared/` 和候选审核脚本仍保留旧贡献契约的独立验证与私有 R2 边界，但 1.2 前端不提交旧贡献包，v4 manifest 也不加载 `community-contributions-v1.json`。旧候选不能在没有完整框架、局部目标和 v4 理由审核的情况下进入新版正式题库。

若需要维护旧候选区，先运行：

```bash
node scripts/test-contribution-pipeline.mjs
npm run dev:worker
```

这项兼容运维不等同于 1.2 正式题库发布。

## 发布验收

发布结论必须区分：

- `npm test`、`npm run build`：本地模型、代码和构建证据；
- `npm run test:e2e`：本地真实 Chromium 证据；
- 部署 Origin 的浏览器检查：真实目标证据；
- 生产发布：只有部署状态成功并完成在线关键路径后才能声明。
