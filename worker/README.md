# 题库候选服务

> 1.2 兼容说明：当前 v4 前端不提交本 Worker 的旧贡献包，正式 manifest 也不加载旧社区扩展。本目录只保留既有私有候选区的数据边界和独立验证；旧候选必须按完整政策框架重新设计并审核后，才能进入 1.2 正式题库。

这个 Worker 只有一个写入职责：接收用户已经在浏览器中预览并明确同意公开的完整论证，执行严格白名单校验、文本规范化和内容哈希，然后写入私有 R2 候选区。它不代理 AI，不接收账号、会话、AI 配置、原始自由输入、时间、设备或行为数据。

## 数据边界

- `POST /v1/contributions` 只接受 `shared/contribution-package.schema.json` 描述的版本 1 贡献包。
- Worker 运行 `shared/contribution-contract.js` 中更严格的链条完整性检查；任意未知字段都会使整个请求被拒绝，不会被静默删除。
- 所有事实回答必须是 `true`，所有桥接原则回答必须是 `accept`，末层必须是独立确认的固定点，压力测试必须已经解决，且客户端必须声明没有未解决冲突或题库缺口。
- Worker 和定时审核任务都会扫描常见邮箱、电话号码、身份证号和密钥格式。扫描只能降低误收风险，不能证明文本绝对不含个人信息。
- R2 对象正文只包含规范化贡献包及其 SHA-256 内容哈希。对象键由内容哈希派生，相同内容重复提交不会产生新的候选对象。

成功写入返回 HTTP `202`，相同内容已经存在时返回 HTTP `200`；两者都只返回 `accepted`、`duplicate` 和 `contentHash`。格式或完整性失败返回 HTTP `422`，过大请求返回 HTTP `413`，存储暂时不可用返回 HTTP `503`。错误响应只包含错误代码和字段路径，不回显用户提交的文本。

## 本地运行

正式环境先创建 `argument-chain-candidates` bucket。Wrangler 的默认本地开发使用本机模拟存储；只有需要远程预览时，才另建一个预览 bucket，并在自己的 Wrangler 配置中覆盖绑定。候选 bucket 不得开启公开访问或绑定公开自定义域名，也不要把 R2 凭据写入仓库。

```bash
npx wrangler r2 bucket create argument-chain-candidates
npx wrangler --config worker/wrangler.jsonc dev
```

`ALLOWED_ORIGINS` 是逗号分隔的静态站点 Origin 精确列表。Worker 配置默认关闭可检索的 Observability 日志，代码也不记录请求 IP、Header 或 Cloudflare 请求属性；仍需在上线前检查账号级分析、Logpush 和安全产品设置是否符合隐私声明。提交接口没有账号系统，CORS 不是防滥用机制；生产部署还应在 Cloudflare 控制台设置请求速率限制和只包含聚合计数的告警。

部署前把 `worker/wrangler.jsonc` 中的 bucket 名称和 `ALLOWED_ORIGINS` 改成真实值，然后运行：

```bash
npx wrangler --config worker/wrangler.jsonc deploy
```

## GitHub Actions

`.github/workflows/review-candidates.yml` 从 `candidates/v1/` 最多拉取 25 个旧契约候选，重新执行 Schema 校验、哈希验证、去重和敏感信息扫描。通过的内容写入 `public/bank/community-contributions-v1.json` 供兼容审核；该文件不在 v4 manifest 中，人工合并也不会自动使内容进入 1.2 正式题库。

仓库需要配置以下 GitHub Actions Secrets：

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET`

R2 API token 只授予这个 bucket 的对象读写权限。未通过结构或隐私校验的对象会被删除；已经进入公开审核 PR 或被判定为重复的对象也会从 R2 删除，避免保留不再需要的副本。审核报告只记录对象键、处理结果和错误代码，不复制候选文本。

审核者可以直接修改 PR 中的规范化命题或条件，但不能添加 Schema 白名单以外的字段。编辑后运行下面的命令重新规范化文本并计算内容哈希；若修改引入重复论证、敏感信息或不完整状态，命令会失败而不会静默删改字段。

```bash
node scripts/normalize-community-bank.mjs public/bank/community-contributions-v1.json
```

## 验证

共享契约、Worker 写入边界和本地审核流水线使用同一个无外部依赖测试入口：

```bash
node scripts/test-contribution-pipeline.mjs
```
