# 构建与发布

系统由两个可独立部署的边界组成：同源静态站点负责题库读取、本地进度和浏览器内 AI 调用；Cloudflare Worker 只负责接收用户明确同意公开的严格完整论证，并写入私有 R2 候选区。

## 静态站点

使用 Volta/npm：

```powershell
npm install
npm test
npm run build
```

或使用 Deno 2：

```powershell
deno task test
deno task build
```

把完整 `dist/` 目录部署到任意静态托管。目录内包含 HTML、代码分块、`runtime-config.js` 与 `bank/`；不能只上传 `index.html`。Vite `base` 使用相对路径，支持子目录部署。

正式题库通过同源 `bank/manifest.json` 选择当前基础版本和可选社区扩展。客户端不直接读取 R2；R2 内容只有经过自动检查、公开 PR 和人工合并后，才随静态站点更新进入正式题库。

## 候选区地址

构建时设置公开的 Worker 基础地址：

```powershell
$env:VITE_BANK_ENDPOINT = 'https://bank.example.com'
npm run build
```

也可以构建后修改 `dist/runtime-config.js`，无需重新编译：

```js
window.__ARGUMENT_CHAIN_BANK_ENDPOINT__ = 'https://bank.example.com';
```

基础地址不要包含 `/v1/contributions`；客户端会自行追加。地址为空时不会上传，用户仍可下载规范化贡献包。

## Worker 与私有 R2

1. 在 Cloudflare 创建私有 bucket，例如 `argument-chain-candidates`，不要开启公开访问或绑定公开域名。
2. 在 `worker/wrangler.jsonc` 中设置真实 bucket 名称和允许提交的静态站点 Origin 精确列表。
3. 本地运行共享契约和 Worker 测试。
4. 部署 Worker，并把部署地址写入静态站点配置。

```powershell
npm test
npx wrangler r2 bucket create argument-chain-candidates
npx wrangler --config worker/wrangler.jsonc deploy
```

Worker 只暴露 `POST /v1/contributions` 和健康检查，不代理 AI，也没有账号、登录或用户数据库。生产环境还应在 Cloudflare 控制台配置速率限制，并检查账号级 Analytics、Logpush 与安全产品设置；应用代码本身关闭 Wrangler Observability，且不记录请求头、IP 或 Cloudflare 请求属性。

## 定期公开审核

`.github/workflows/review-candidates.yml` 每天从 R2 最多读取 25 份候选。仓库需要配置：

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET`

R2 API token 只授予该 bucket 的对象读写权限。流水线重新执行结构校验、敏感格式扫描、内容哈希和去重，通过后更新 `public/bank/community-contributions-v1.json` 并建立公开 PR。前一份审核 PR 未关闭时不会继续取出新候选。

未通过校验、已经进入审核流程或被判定重复的 R2 对象会被删除，避免把候选区变成长期用户数据仓库。人工审核仍需检查命题类型、推导相关性、措辞、遗漏条件和政治平衡；自动校验不等于事实认证。

## 验收边界

发布前至少验证：

- 桌面与移动视口中的题库流程、自由输入、AI 配置和候选确认；
- 未进行独立贡献确认时，网络面板没有对 Worker 的提交请求；
- 贡献请求只包含共享契约允许的完整论证字段；
- `dist/bank/manifest.json` 指向的每个必需文件都可从部署 Origin 读取；
- Worker Origin 白名单与最终静态站点 Origin 完全一致。
