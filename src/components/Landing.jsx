import React from 'react';
import { ArrowRight, Check, Scale } from './Icons.jsx';

const steps = [
  ['选择一个政策结论', '先记录你目前支持、反对或无法判断。系统暂时不推测你属于哪一种政治立场。'],
  ['分别检查事实和原则', '先问事实命题 F 是否为真，再问规范原则 B 是否可以接受。两类问题不会混在一起。'],
  ['继续说明原则的理由', '如果你接受 B，系统会继续问为什么。上一层的 B 会成为下一层需要说明的规范结论。'],
  ['确认当前基本价值', '只有当你明确表示“不再用另一条规范原则说明它”时，系统才把它记为当前基本价值 G。'],
  ['用相似案例和两难题检查', '相似案例检查原则是否稳定；两难题记录不同价值在具体情境中的优先关系。'],
];

const concepts = [
  {
    symbol: 'F',
    title: '事实命题',
    copy: '只描述世界是什么样，可以判断为真或假。',
    example: '例：可靠研究显示，这项政策每年能减少 100 起重伤。',
  },
  {
    symbol: 'B',
    title: '规范原则（桥接原则）',
    copy: '明确说明这些事实为什么会产生“应该怎样做”的理由。',
    example: '例：如果能明显减少重伤，而且没有同样有效、限制更小的办法，国家就有一项采用该政策的理由。',
  },
  {
    symbol: 'V',
    title: '当前结论',
    copy: '本轮需要说明的政策结论或规范原则。',
    example: '例：国家应该采用这项政策。',
  },
  {
    symbol: 'G',
    title: '当前基本价值',
    copy: '你在本轮对话中明确独立接受、暂时不再用更深规范原则说明的价值。',
    example: '例：避免死亡和重伤，本身就是制度必须认真考虑的理由。',
  },
];

export default function Landing({ onStart, onMethod }) {
  return (
    <main className="landing">
      <section className="hero-section">
        <div className="hero-copy">
          <h1>把一个政治判断的理由，<br />逐层说明清楚。</h1>
          <p className="hero-lead">
            这不是政治坐标测试。系统会依次记录：你相信哪些事实、你接受哪些“应该”原则、
            这些原则还依赖什么理由，以及你在哪里暂时停止继续追问。
          </p>
          <div className="hero-actions">
            <button className="primary-button large" type="button" onClick={onStart}>开始第一条论证链 <ArrowRight size={18} /></button>
            <button className="secondary-button large" type="button" onClick={onMethod}>先看概念与完整例子</button>
          </div>
          <div className="privacy-line"><Check size={17} /> 答案只保存在当前浏览器；报告不生成意识形态标签。</div>
        </div>

        <div className="hero-proof" aria-label="最小桥接原则示例">
          <div className="proof-eyebrow">一个完整的政策理由</div>
          <div className="plain-proof-stack">
            <div className="plain-proof-item fact">
              <span>F · 事实</span>
              <p>可靠研究显示，这项措施每年能减少 100 起重伤；目前没有同样有效、但对个人限制更小的办法。</p>
            </div>
            <div className="plain-proof-item bridge">
              <span>B · 规范原则</span>
              <p>如果一项措施能明显减少死亡或重伤，而且没有同样有效、限制更小的替代方案，国家就有一项采用它的理由。</p>
            </div>
            <div className="plain-proof-item conclusion">
              <span>V · 结论</span>
              <p>国家应该采用这项措施。</p>
            </div>
          </div>
          <div className="bridge-necessity plain">
            <p><strong>关键点：</strong>即使两个人都接受 F，他们仍可能对 V 有不同判断，因为他们可能不接受同一条规范原则 B。因此，系统必须把 B 单独写出来，并继续询问你为什么接受它。</p>
          </div>
          <div className="proof-question"><span>形式表示：<b>F ＋ B ⇝ V</b></span><strong>⇝ 表示“提供一项可以被反驳的理由”，不是自动证明。</strong></div>
        </div>
      </section>

      <section className="concept-section" aria-labelledby="concept-title">
        <div className="section-heading-row">
          <div>
            <h2 id="concept-title">四个关键概念</h2>
            <p>技术符号会保留，但技术术语第一次出现时都会解释，并配合具体例子。</p>
          </div>
        </div>
        <div className="concept-grid">
          {concepts.map((item) => (
            <article key={item.symbol} className={`concept-card ${item.symbol.toLowerCase()}`}>
              <span>{item.symbol}</span>
              <div><h3>{item.title}</h3><p>{item.copy}</p><small>{item.example}</small></div>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-flow" aria-labelledby="flow-title">
        <div className="section-heading-row">
          <div>
            <h2 id="flow-title">系统怎样完成一次追问</h2>
            <p>当前原型设置 4 个政策入口。每个政策都可能沿多条理由继续追问，最长预设路径为 4 层。</p>
          </div>
          <Scale size={32} />
        </div>
        <ol className="flow-list five-steps">
          {steps.map(([title, copy], index) => (
            <li key={title}>
              <span className="flow-number">{String(index + 1).padStart(2, '0')}</span>
              <div><h3>{title}</h3><p>{copy}</p></div>
            </li>
          ))}
        </ol>
      </section>

      <section className="landing-caution">
        <strong>系统记录的是你在本轮对话中公开接受的理由。</strong>
        <span>出现矛盾、暂不判断、题库没有覆盖你的理由，或者原则只在某些条件下适用，都属于有效结果。</span>
      </section>
    </main>
  );
}
