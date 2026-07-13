# 方法来源与保留意见

本项目不是任何单一哲学理论的实现。它把若干可组合的方法转换为一套机械对话程序，同时保留它们之间的理论分歧。

## 1. Hume 与最小桥接约束

《人性论》III.1.1 要求解释从“是／不是”到“应该／不应该”的新关系。本系统采用更窄的模型论版本：若评价谓词不能由描述语汇定义，只含描述谓词的 F 不能在所有解释中固定 V 的评价外延；因此每条路径必须显式出现至少一个含规范内容的 B。

这是一项关于题库推导形式的约束，不等于证明非认知主义、价值虚无主义或任何特定元伦理学立场。

## 2. 可定义性、制度事实与厚概念

Searle 对承诺与制度事实的分析提醒我们：某些看似描述性的谓词可能已通过构成性规则携带义务结构。系统因此要求检查规范内容是否已经写入 F 的语义；若是，不能再把该 F 当作完全非评价性的独立前提。厚概念与事实／价值缠结仍需要人工语义审阅，不能由关键词过滤解决。

## 3. Toulmin：资料、保证与主张

Toulmin 的 data–warrant–claim 布局启发了界面中的 F／B／V 解剖。这里的 B 类似 warrant，但范围更窄：它必须承担从描述条件到规范地位的连接，而且其自身可以成为下一轮待说明的 V。

## 4. 可撤销论证：Dung、García 与 Simari

普通政策理由很少是封闭的演绎证明。Dung 的抽象论证框架使支持、攻击和未决状态能够以图结构保存；García 与 Simari 的可撤销逻辑程序则展示了如何让弱规则、反驳与辩证检验共同决定某项结论是否得到 warrant。系统据此用 `⇝` 表示初步支持，并允许事实失败、桥梁拒绝、反例、冲突和题库缺口击败当前路径。

## 5. 对话、承诺与批判性问题

Walton 与 Krabbe 的对话模型区分了一个人私下“相信什么”与其在对话中公开承担什么承诺。系统因此不声称读取人格本质，而只维护可修订的 commitment store。论证模板及其后续问题也借鉴了 argumentation schemes 与 critical questions：选择一条理由并不结束审查，而是触发对前提、适用条件、例外与竞争理由的追问。

## 6. 反思均衡与 deliberated judgment

Rawls 的“具体判断—原则—反例—修订”往返启发了递归停止和最小差异反例。Cailloux 与 Meinard 的 deliberated judgment 框架进一步支持把用户对论证与反论证的态度纳入决策模型，而不是只读取最终偏好。系统不假设用户一开始就拥有少数稳定、完备且一致的价值公理；固定点可以在对话中形成，也可以在反例后撤回。

## 7. 普遍化压力与相关区别

Hare 对规范判断一致适用的要求启发了对象替换测试，但系统不要求无条件机械一致。用户可以提出例外；条件是例外应指出与原则内容相关的事实差别。无法指出差别时，系统记录适用范围张力，而不是直接判定用户虚伪或非理性。

## 8. Value-Based Argumentation 与后置价值排序

Bench-Capon 的 Value-Based Argumentation Frameworks 说明：论证的接受可能取决于受众对价值的排序。本系统反过来使用这一思想：先从实际政策论证中发现用户确认的价值，再只对这些已出现价值安排预设两难。价值顺序不是事前问卷轴，而是后置、局部、可循环的比较关系。

## 9. AGM 与信念修订日志

同一 F 或 B 出现相反回答时，系统不覆盖旧数据，而要求用户明确选择修订、撤回、范围分化或悬置。该机制只借用了信念修订的基本问题意识，并未声称完整实现 AGM 公理体系。

## 10. 为什么不直接沿用政治坐标测试

常见政治测试适合快速比较表态，但通常把具体回答直接累加到预设价值轴，难以区分：

- 相同政策结论、不同规范理由；
- 相同价值基础、不同经验信念；
- 用户真正接受的原则与系统替其推断的原则；
- 稳定承诺、暂时无从回答和题库遗漏。

本项目只借鉴它们的政策题材与低摩擦选择界面，不沿用其“答案直接映射意识形态坐标”的评分机制。

## 11. 仍未解决的问题

- F 与 B 的边界可能受厚概念、制度语义与语境影响。
- 一条 B 的“最小性”相对于语言、背景规则和论证目的，不存在完全中立的自动判定。
- 自然语言中的相关区别、击败者和隐含前提无法仅凭形式类型充分识别。
- 预设论证图永远可能漏掉用户真正的理由；“这些都不是”只能标记缺口，不能自动补图。
- 用户确认“不再追问”只说明当前反思停止，不说明原则客观不可证明、不可质疑或永远稳定。
- 结构相似反例仍可能被措辞、对象熟悉度与情绪显著影响。
- 成对两难只能形成局部偏好信息，不足以推出稳定、传递、情境无关的完整价值序。
- 题库作者对哪些政策、事实与理由值得纳入的选择本身需要公开审计和多元复核。

因此系统的目标是暴露论证责任、事实依赖、停止点、冲突和修订历史，而不是充当价值真理判定器。

## 参考文献（题库方法层）

- Alchourrón, C. E., Gärdenfors, P., & Makinson, D. (1985). *On the Logic of Theory Change: Partial Meet Contraction and Revision Functions*.
- Bench-Capon, T. J. M. (2002). *Value Based Argumentation Frameworks*.
- Cailloux, O., & Meinard, Y. (2018). *A Formal Framework for Deliberated Judgment*.
- Dung, P. M. (1995). *On the Acceptability of Arguments and its Fundamental Role in Nonmonotonic Reasoning, Logic Programming and n-Person Games*.
- García, A. J., & Simari, G. R. (2004). *Defeasible Logic Programming: An Argumentative Approach*.
- Hare, R. M. (1952). *The Language of Morals*.
- Hume, D. (1739–1740). *A Treatise of Human Nature*, III.1.1.
- Rawls, J. (1951). *Outline of a Decision Procedure for Ethics*.
- Searle, J. R. (1964). *How to Derive “Ought” from “Is”*.
- Toulmin, S. E. (1958). *The Uses of Argument*.
- Walton, D., & Krabbe, E. C. W. (1995). *Commitment in Dialogue: Basic Concepts of Interpersonal Reasoning*.
