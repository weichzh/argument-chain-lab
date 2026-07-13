import React from 'react';
import { sources } from '../data/model.js';
import { X } from './Icons.jsx';

function ConceptCard({ symbol, title, children, example, tone }) {
  return (
    <article className={`method-concept-card ${tone || ''}`}>
      <span>{symbol}</span>
      <div><h3>{title}</h3><p>{children}</p>{example ? <small><b>例子：</b>{example}</small> : null}</div>
    </article>
  );
}

export default function MethodModal({ open, onClose }) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="method-modal" role="dialog" aria-modal="true" aria-labelledby="method-title">
        <header className="modal-header">
          <div><span>概念、例子与形式规则</span><h2 id="method-title">系统每一步到底在问什么</h2></div>
          <button className="modal-close" type="button" onClick={onClose} aria-label="关闭概念说明"><X /></button>
        </header>

        <div className="method-scroll">
          <section className="method-section lead-method plain-first">
            <h3>先看一个完整而具体的例子</h3>
            <p className="method-lead-copy">
              假设我们正在讨论一项安全措施。研究显示它能减少重伤，而且目前没有同样有效、限制更小的替代办法。
              这些事实还没有直接回答“国家应不应该采用”。要得到政策理由，还需要明确加入一条规范原则。
            </p>
            <div className="worked-example method-example-chain">
              <div className="worked-example-row fact"><span>F · 事实</span><p>可靠研究显示，这项措施每年能减少 100 起重伤；目前没有同样有效、但对个人限制更小的办法。</p></div>
              <div className="worked-example-row bridge"><span>B · 规范原则</span><p>如果一项措施能明显减少死亡或重伤，而且没有同样有效、限制更小的替代办法，那么国家至少有一项理由采用它。</p></div>
              <div className="worked-example-row conclusion"><span>V · 结论</span><p>国家至少有一项理由采用这项措施。</p></div>
            </div>
            <p className="method-note">
              只接受 F 的人仍然可以拒绝 V，因为他可能不接受 B。例如，他可能认为这项措施侵犯了一项不能被安全收益覆盖的权利。
              因此，系统不能把事实答案直接换算成政策答案，必须把 B 单独写出来询问。
            </p>
          </section>

          <section className="method-section concept-definition-section">
            <h3>四个符号分别表示什么</h3>
            <div className="method-concept-grid method-concept-list">
              <ConceptCard symbol="F" title="事实命题" tone="fact" example="这项政策实施后，重伤案件比可比地区减少了 20%。">
                只描述世界是什么样，原则上可以由研究、观察、制度文本或题目设定判断为真或假。F 不能含有“应该”“公平”“有理由”等评价。
              </ConceptCard>
              <ConceptCard symbol="B" title="规范原则（技术名称：桥接原则）" tone="bridge" example="如果措施明显减少重伤且没有较温和替代，国家至少有一项理由采用。">
                说明一组事实为什么会产生支持或反对结论的理由。B 明确含有规范内容，例如“应该”“不得”“至少有一项理由”。
              </ConceptCard>
              <ConceptCard symbol="V" title="当前需要说明的结论" tone="conclusion" example="国家应该实施这项措施。">
                可以是最初的政策结论，也可以是上一层刚接受的规范原则。只要它仍然是一条价值判断，系统就可以继续问“为什么”。
              </ConceptCard>
              <ConceptCard symbol="G" title="当前基本价值" tone="terminal" example="避免死亡和重伤，本身就是公共制度必须给予很高权重的理由。">
                你明确表示现在愿意直接接受、暂时不再用另一条规范原则说明的价值。G 是本轮对话中的承诺，不是系统宣布的客观公理，也可以以后修订。
              </ConceptCard>
            </div>
          </section>

          <section className="method-section">
            <h3>“最小桥接原则”究竟说了什么</h3>
            <p>
              它只提出一个结构要求：当结论 V 含有评价或规范内容，而事实 F 本身不含这种内容时，
              F 不能单独决定 V。论证中至少要明确出现一条含有规范内容的 B。
            </p>
            <div className="method-case-example">
              <strong>它没有说什么</strong>
              <p>它没有证明某一条具体 B 是正确的，也没有证明加入任意 B 后结论就必然成立。它只是要求论证者不能把价值判断藏在“因此”两个字里面。</p>
            </div>
            <div className="method-formula operational"><span className="f">F₁,…,Fₙ</span><b>＋</b><span className="b">B</span><b>⇝</b><span className="v">V</span></div>
            <div className="support-legend">
              <span>⇝</span><p><strong>给结论增加一项理由：</strong>前提成立时，结论获得支持，但仍可能被其他事实、例外或竞争价值反驳。</p>
              <span>⊨</span><p><strong>严格逻辑蕴含：</strong>只要所有前提为真，结论在所有允许的解释中都必须为真。现实政策理由通常没有这么强。</p>
            </div>
          </section>

          <section className="method-section">
            <h3>为什么接受 B 以后还要继续追问</h3>
            <p>B 自己也是一条价值判断，所以它也需要说明。系统会把上一层的 B 作为下一层新的 V，再问它依靠哪些事实和更一般的规范原则。</p>
            <div className="recursive-demo readable">
              <div><span>第 1 层</span><p><b>F₀：</b>措施确实减少严重伤害，而且没有较温和替代。<br /><b>B₀：</b>满足这些条件时，国家至少有一项理由采用。<br /><b>V₀：</b>国家应该采用。</p></div>
              <div><span>第 2 层</span><p>继续问：为什么“减少严重伤害”会产生国家行动的理由？此时上一层的 <b>B₀</b> 成为新的 <b>V₁</b>。</p></div>
              <div><span>可能的回答</span><p>因为死亡和重伤会严重削弱人的行动能力，而公共制度必须高度重视避免这种损失。</p></div>
              <div className="terminal"><span>确认 G</span><p>只有当你明确回答“即使暂时拿掉其他规范前提，我现在仍直接接受它”，系统才把这条原则记录为当前基本价值。</p></div>
            </div>
          </section>

          <section className="method-section two-column-method readable-columns">
            <div>
              <h3>“我不知道事实真假”表示什么</h3>
              <p>事实命题仍然是真的或假的。你选择“目前不知道”，只表示现有信息不足以让你判断，并不是说命题出现了第三种真值。</p>
              <strong>例：某制度是否减少 15% 的袭击，在现实中有一个答案；你可以合理地暂时不知道。</strong>
            </div>
            <div>
              <h3>“我想不到更深理由”表示什么</h3>
              <p>它不自动说明当前原则就是你的基本价值。系统会再次询问：你是愿意直接接受它，还是只是暂时回答不出来。</p>
              <strong>例：“我现在解释不出来”与“我明确把平等个人决定权作为当前起点”不是同一个回答。</strong>
            </div>
          </section>

          <section className="method-section">
            <h3>相似案例检查的目的</h3>
            <p>
              系统会改变人物、党派或群体，但尽量保持与原则有关的条件不变，然后再次询问同一原则是否适用。
              这样可以检查你接受的是一条一般原则，还是只接受原案例中的具体结论。
            </p>
            <div className="method-case-example">
              <strong>例子</strong>
              <p>你接受“没有明确规则、理由说明和独立监督的公权力应受限制”。系统随后把掌权者换成你更信任的人，但仍保留“没有规则、没有说明、没有监督”三个条件。若你不再要求限制，就需要指出还有哪项与原则有关的事实发生了变化。</p>
            </div>
            <ul className="method-bullets readable-list">
              <li><b>仍然适用：</b>你愿意在相关条件相同时使用同一原则。</li>
              <li><b>补充适用条件：</b>你指出风险强度、同意条件、替代方案等相关事实确实不同。</li>
              <li><b>不适用但说不出相关差别：</b>系统只记录“适用条件尚未说明”，不作人格判断。</li>
              <li><b>撤回原则：</b>新案例使你改变看法，这条理由重新成为未完成状态。</li>
            </ul>
          </section>

          <section className="method-section">
            <h3>相反回答怎样处理</h3>
            <p>如果你对同一句 F 一次答真、一次答假，或对同一句 B 一次接受、一次拒绝，系统会暂停并让你说明，不会自动覆盖旧答案。</p>
            <ul className="method-bullets readable-list">
              <li><b>修改旧回答：</b>你改变了看法，以当前回答为准。</li>
              <li><b>撤回当前回答：</b>这次点错或重新考虑后，继续沿用以前的判断。</li>
              <li><b>两次条件不同：</b>题库把两个实际不同的命题写成了一个，需要补充适用条件。</li>
              <li><b>暂时不判断：</b>你目前无法确定，系统把以前和当前答案都记为未判断。</li>
            </ul>
          </section>

          <section className="method-section">
            <h3>两难题怎样得到价值优先关系</h3>
            <p>只有当两项价值都经过前面的论证并被你确认为 G，系统才会提出同时涉及它们的两难题。题目会先固定事实，再要求在两个不能同时实现的方案之间选择。</p>
            <div className="method-case-example">
              <strong>例子</strong>
              <p>一项禁令每年确定多避免 50 起重伤，但它长期禁止所有成年人一种不伤害他人的选择，而且没有第三种方案。选择禁令，表示在本题条件下更重视避免重伤；选择不禁，表示更重视平等的个人决定权。这个答案不会自动变成永久排序。</p>
            </div>
          </section>

          <details className="method-section formal-appendix">
            <summary>查看命题 1.1 的正式表述与模型论证明</summary>
            <div>
              <h3>命题 1.1 · 最小桥接原则</h3>
              <p>
                设 <em>F</em> 为一组只含非评价性描述的命题，<em>V</em> 为包含一个不能由非评价性语汇定义的评价谓词的结论。
                如果没有至少一条把相关描述性属性与评价地位联系起来的规范原则 <em>B</em>，则 <em>F</em> 不蕴含 <em>V</em>。
              </p>
              <div className="method-formula theorem"><span className="f">F₁,…,Fₙ</span><b>⊭</b><span className="v">V</span></div>
              <ol className="method-proof-list">
                <li><span>1</span><p>构造两个解释，让它们对 F 中每一项非评价性事实完全一致。</p></li>
                <li><span>2</span><p>让两个解释对 V 中不可由非评价语汇定义的评价谓词给出不同外延。</p></li>
                <li><span>3</span><p>于是两个解释都满足 F，但只有其中一个满足 V，所以 F 不能单独蕴含 V。</p></li>
                <li><span>4</span><p>加入限制解释的 B 后，严格蕴含才有可能；但只有 B 被写成充分条件、所有相关前提也已列全时，才能写成 F ＋ B ⊨ V。</p></li>
              </ol>
              <p className="method-note">
                系统保留“可定义性”例外：如果规范含义已经被制度规则或构成性规则写入某个谓词，就不能再把该谓词当作完全非评价的语汇。
              </p>
            </div>
          </details>

          <section className="method-section">
            <h3>研究与形式化来源</h3>
            <div className="source-list">
              {sources.map((source) => (
                <article key={source.id}><span>{source.year}</span><div><strong>{source.author}</strong><p>{source.title}</p><small>{source.role}</small></div></article>
              ))}
            </div>
          </section>

          <section className="method-section limitation-section">
            <h3>本系统不能证明什么</h3>
            <p>
              它不能证明某个基本价值客观为真，不能穷尽你的全部理由，也不能把一次回答当作永久人格特征。
              它只负责把本轮理由写清楚：你接受哪些事实，接受哪条规范原则，为什么继续追问，在哪里停止，以及哪些问题仍未解决。
            </p>
          </section>
        </div>
      </section>
    </div>
  );
}
