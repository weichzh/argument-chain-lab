# 论证链访谈提示词工具包

## 文件

- `argument-chain-interviewer-prompt-v1.0.md`：复制给 AI 的主提示词。
- `argument-chain-expansion-pack.schema.json`：最终候选扩展包的 JSON Schema。
- `argument-chain-expansion-pack-template.json`：空白数据包模板。
- `argument-chain-pack-tools.py`：校验扩展包、合并导出模型 JSON 的辅助脚本。

## 推荐使用方式

1. 在新对话中上传主提示词、Schema 和当前题库 `model-0.6.0.json`。
2. 要求 AI 严格按照主提示词开始访谈。
3. 用户可以随时输入 `显示当前链条`、`保存检查点` 或 `结束并导出`。
4. 结束时保存：
   - `argument-chain-summary.md`
   - `argument-chain-expansion-pack.json`
5. 校验扩展包：

```bash
python argument-chain-pack-tools.py validate argument-chain-expansion-pack.json \
  --schema argument-chain-expansion-pack.schema.json
```

6. 将候选内容合并到一个模型快照：

```bash
python argument-chain-pack-tools.py merge \
  model-0.6.0.json \
  argument-chain-expansion-pack.json \
  model-merged.json \
  --schema argument-chain-expansion-pack.schema.json \
  --allow-draft
```

`--allow-draft` 只适合候选／审查环境。准备进入正式题库时，应先完成证据审核、去重、政治措辞审核、引用检查和路径完整性检查，并把数据包的 `promotionReady` 改为 `true`。

## 当前系统边界

论证链实验室 0.6.0 通过 `public/bank/manifest.json` 读取版本化 JSON 题库，`src/data/model.js` 只负责运行时校验和只读适配。辅助脚本合并的是离线模型快照，不会自动更新题库清单；要让结果进入网页，仍需审核合并生成的模型并更新清单指向。

## 隐私

扩展包包含政治观点、价值承诺、事实信念、矛盾和修订记录，属于敏感数据。默认使用匿名别名，不应收集不必要的身份信息，也不应将数据用于就业、执法、信贷、教育录取、政治审查或其他高风险决策。
