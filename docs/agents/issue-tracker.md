# Issue Tracker: GitHub

本仓库的 Issue 和 PRD 使用 GitHub Issues，通过 `gh` CLI 操作。

## 常用操作

- 创建：`gh issue create --title "..." --body "..."`
- 查看：`gh issue view <number> --comments`
- 列表：`gh issue list --state open --json number,title,body,labels,comments`
- 评论：`gh issue comment <number> --body "..."`
- 添加标签：`gh issue edit <number> --add-label "..."`
- 移除标签：`gh issue edit <number> --remove-label "..."`
- 关闭：`gh issue close <number> --comment "..."`

仓库由当前目录的 Git remote 确定。

## PR 作为请求入口

**否。** 外部 PR 默认不进入 triage 请求队列。

## 技能约定

- “发布到 Issue Tracker”表示创建 GitHub Issue。
- “读取相关 Ticket”表示执行 `gh issue view <number> --comments`。
- GitHub Issue 和 PR 共用编号；无法判断时先尝试 `gh pr view`，再尝试 `gh issue view`。
