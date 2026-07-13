# 构建与发布

## 静态构建

```bash
npm install
npm test
npm run export:model
npm run build
```

`dist/` 可部署到支持静态文件的托管服务。Vite `base` 使用相对路径，支持子目录部署。

## 单文件

```bash
npm run bundle:single
```

输出为根目录 `argument-chain-lab.html`。CSS、JavaScript 与题库均由生产构建内联，不依赖远程字体、图片或脚本。

## Sites

发布到 Sites 需要完整的 Sites building 与 hosting 生命周期工具。运行环境没有这些工具时，不应虚构公开 URL；应交付 `dist/`、静态站点压缩包与单文件网页，待可用环境中再发布。
