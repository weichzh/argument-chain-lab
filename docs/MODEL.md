# Model v4 参考：完整政策框架、修订诊断与局部理由图

## 1. 模型解决什么问题

v4 不再把政策描述拆成并列“组件”，而是保存：

1. 一个用户实际判断的完整原方案；
2. 若干完整修改方案；
3. 原方案与修改方案之间的精确差异；
4. 接受某项修改时应定位到的局部反对命题；
5. 针对该局部命题的多条理由；
6. 每条理由的描述前提、判断依据和更深理由。

## 2. 顶层答案

`product.entryAnswers` 必须严格为：

```json
[
  {"id": "yes", "label": "应当"},
  {"id": "no", "label": "不应当"},
  {"id": "uncertain", "label": "不确定"}
]
```

不得加入：

```text
conditional
mixed
depends
partly
```

这些状态只能由后续比较推导，不能作为根答案。

## 3. 情景边界

```json
{
  "scenario": {
    "summary": "本题讨论什么",
    "fixedConditions": [
      {
        "id": "scope_1",
        "text": "已经固定的边界",
        "explanation": "为什么这不是用户要另行回答的组件"
      }
    ],
    "terms": ["需要解释的名词"]
  }
}
```

固定条件只能展示和解释，不得进入回答状态。

## 4. 维度

```json
{
  "sanction": {
    "label": "处罚方式",
    "logicalRole": "means",
    "type": "enum",
    "values": {
      "fine_or_detention": {"label": "可以罚款或拘留"},
      "civil_only": {"label": "只允许较轻民事责任"}
    },
    "explanation": "这个维度改变什么"
  }
}
```

`logicalRole` 允许：

```text
root_action
means
safeguard
parameter
fixed_constraint
```

它只用于作者和检查器，不作为用户标题。

## 5. 完整框架

根框架必须直接包含所有维度：

```json
{
  "speech_root": {
    "label": "原方案",
    "assignments": {
      "legal_rule": "yes",
      "sanction": "fine_or_detention",
      "standard": "open_textured",
      "review": "ordinary"
    }
  }
}
```

修改框架使用继承：

```json
{
  "speech_civil_only": {
    "label": "只允许民事责任",
    "extends": "speech_root",
    "changes": {
      "sanction": "civil_only"
    }
  }
}
```

检查器必须展开为完整赋值后再比较。

## 6. 诊断节点

```json
{
  "id": "speech_test_sanction",
  "candidateFrameId": "speech_civil_only",
  "question": "如果只允许较轻民事责任，这样可以接受吗？",
  "explanation": "这里只改变处罚强度。",
  "acceptedClaimId": "c_speech_reject_sanction",
  "changedDimensionIds": ["sanction"],
  "revisionCost": 1
}
```

必要条件：

- `candidateFrameId` 存在；
- 与根框架不同；
- 实际差异恰好等于 `changedDimensionIds`；
- `acceptedClaimId` 存在并至少有一条理由；
- 诊断成本不应倒退；
- 最后的组合修改可以成本更高。

`revisionCost` 表示作者认定的一次有意义修改单位，不等于简单计算维度数量。

## 7. 条件性接受

引擎保存：

```json
{
  "rootAnswer": "no",
  "rootFrameId": "speech_root",
  "acceptedRevisionFrameId": "speech_civil_only",
  "derivedConditionalAcceptance": true,
  "diagnosisClaimId": "c_speech_reject_sanction"
}
```

不要把原方案改写成支持，也不要把修改回答附在原方案的支持命题上。

## 8. 命题

命题类型：

```text
policy_position
local_objection
normative
value
```

局部反对命题应使用保守表达：

> 某项设计是一个足以改变判断的原因。

不要写成：

> 这是用户唯一的反对原因。

因为顺序诊断只能确认当前测试中的决定性差异，不能证明没有其他原因。

## 9. 理由

```json
{
  "id": "r_speech_procedure_discretion",
  "targetClaimId": "c_speech_reject_procedure",
  "title": "模糊标准容易导致选择性执法",
  "summary": "...",
  "premises": [
    {
      "id": "...",
      "role": "discretion",
      "statement": "...",
      "question": "...",
      "formula": {
        "pred": "OpenTextured",
        "args": ["frame:speech_root", "dimension:c_speech_reject_procedure"]
      }
    }
  ],
  "bridgeClaimId": "n_law_predictable_reviewable",
  "formalization": {
    "languageVersion": "arglogic-dialogue-1.0",
    "schemeId": "procedural_risk",
    "policyId": "speech_restriction",
    "contextFrameId": "speech_root",
    "premiseRoles": {
      "discretion": ["..."],
      "review_gap": ["..."]
    },
    "bridgeClaimId": "n_law_predictable_reviewable",
    "conclusionClaimId": "c_speech_reject_procedure"
  }
}
```

## 10. 多条更深理由

若两个理由都指向同一个 `targetClaimId`，用户会看到两个不同选项。

例如：

```text
“规则应明确并可复核”
可以继续基于：
- 法治与可预期性；
- 免受任意支配。
```

模型不能给每个中间原则只保留唯一父节点。

## 11. 暂时停止点

价值命题具有：

```json
{
  "terminalCandidate": true,
  "whenUserContinuesPastCandidate": "offer_custom_deeper_reason"
}
```

含义是：

- 题库允许用户暂时停止；
- 不宣称哲学上已经不可追问；
- 用户继续时进入自定义理由，不显示空理由页。

## 12. 反方理由

根判断使用：

```json
{
  "counterClaims": {
    "whenSupportingRoot": "该政策的实质反对命题",
    "whenOpposingWithoutAcceptedRevision": "该政策的原方案支持命题"
  }
}
```

若用户接受了某个修改方案，反方必须针对同一个局部争点。每个诊断节点保存：

```json
{
  "acceptedClaimId": "为什么原方案的这一设计不可接受",
  "counterClaimId": "为什么原方案的这一设计可能仍有必要"
}
```

例如用户反对罚款或拘留，反方应讨论较强处罚是否不可替代，而不是只重复“禁令有社会收益”。

反方理由使用同一理由结构和同一假设检查。

## 13. 新政策的作者流程

1. 写清完整原方案；
2. 把题设边界和可修改政策维度分开；
3. 为每个维度定义有限值；
4. 建立根框架；
5. 根据用户可能反对的位置设计少量完整修改框架；
6. 先测试单一有意义修改，再测试必要组合；
7. 为每个接受叶写局部命题；
8. 为默认核心政策的支持命题、所有局部命题和最终实质反对命题各写至少两条理由；附加精度题的局部诊断命题至少有一条已策展理由；
9. 为每条理由选择方案、前提角色和更深原则；
10. 运行结构、语义、变异和浏览器测试。

## 14. 不应加入正式题库的内容

- 只有政策标签、没有完整方案；
- 修改后没有生成新框架；
- 组件回答仍指向原政策结论；
- 题设事实被要求赞成或反对；
- 默认核心政策只有一个预定理由路径；
- 继续追问会进入空白页；
- 把“第一个发现的差异”写成“唯一原因”；
- 用意识形态名称标记理由；
- 未经来源和人工审查的 AI 内容。

## 15. 文件的完整性状态

`model-1.1.0.json` 已满足：

- JSON Schema v4；
- 语义引用和角色检查；
- 完整框架检查；
- 框架差异检查；
- 理由图无环；
- 所有非终点桥梁有更深理由；
- 8 个默认核心政策的所有支持、诊断和最终反对叶至少两条理由；
- 5 个附加精度题的每个诊断叶至少一条已策展理由；
- 顶层没有 `conditional`。

正式模型共有 13 项政策、53 个政策维度、63 个完整框架、50 个诊断节点、197 个命题、302 条理由和 602 个形式实体。`product.defaultPolicyIds` 固定默认 8 题，`product.entertainmentTieBreakerPolicyIds` 保存 5 项按需精度题。

## 16. 娱乐基准边界

`ideology-benchmark-1.1.0.json` 不属于正式模型，只保存 52 个测试原型及其预期路径。必须保持：

- benchmark 的 `targetModelVersion` 与当前正式模型一致；
- 正式模型中不出现 benchmark 原型标签；
- benchmark 默认不加载，只在用户主动启用娱乐结果后读取；
- 未回答或跳过的特征只降低覆盖度，不作为与原型的分歧；
- round-trip 唯一性只验证实现一致性，不表示历史忠实度或真实用户分类准确率。
