import React from 'react';
import { claims, dilemmas, getRelevantDilemmas } from '../data/model.js';
import { collectTerminalCommitments } from '../lib/engine.js';
import { ArrowRight, Scale } from './Icons.jsx';

function uniqueCommitments(state) {
  return [...new Map(collectTerminalCommitments(state).map((item) => [item.claimId, item])).values()];
}

export function DilemmaIntro({ state, dispatch }) {
  const commitments = uniqueCommitments(state);
  const available = getRelevantDilemmas(commitments.map((item) => item.claimId));
  return (
    <main className="dilemma-intro page-shell">
      <div className="dilemma-intro-mark"><Scale size={34} /></div>
      <span className="page-kicker">第二阶段 · 比较你已经确认的基本价值</span>
      <h1>两项价值都值得重视时，<br />你在具体冲突中怎样选择？</h1>
      <p className="page-lead">
        前面的追问告诉我们你愿意直接接受哪些价值，但还不能告诉我们它们发生冲突时谁先让步。
        这里不会把价值换算成抽象总分，只会给出条件明确的两难情境，并记录你在该情境中的选择。
      </p>

      <section className="commitment-strip" aria-label="已经确认的当前基本价值">
        <div className="commitment-strip-head"><strong>本轮已经确认的当前基本价值 G</strong><span>{commitments.length} 项</span></div>
        {commitments.length ? (
          <div className="commitment-list">
            {commitments.map((item, index) => (
              <div key={item.claimId}><span>{String(index + 1).padStart(2, '0')}</span><p>{claims[item.claimId]?.text}</p></div>
            ))}
          </div>
        ) : <p className="empty-copy">前面的政策理由没有形成已经确认的基本价值。系统不会为了生成结果而加入与你无关的通用价值题，接下来会直接进入本轮报告。</p>}
      </section>

      <aside className="dilemma-explainer dilemma-intro-explainer">
        <strong>两难题不是让你宣布哪项价值永远更重要。</strong>
        <p>每道题会先固定事实条件，并明确说明两种方案分别保护什么、牺牲什么。你的答案只表示在这个案例里如何取舍；事实条件变化后，答案也可以变化。</p>
      </aside>

      <div className="dilemma-rules">
        <div><strong>只比较你已经确认过的价值</strong><p>{available.length ? `当前有 ${available.length} 道题同时涉及两项已确认价值。` : '当前没有两项已确认价值出现在同一道预设两难题中。'}</p></div>
        <div><strong>事实条件会先写清楚</strong><p>题目会固定人数、风险、替代方案和程序条件，尽量避免把事实争议混进价值取舍。</p></div>
        <div><strong>允许没有顺序或出现循环</strong><p>你可以回答无法比较。不同情境下形成循环选择时，系统也会照实保留，不强行排成一条价值排行榜。</p></div>
      </div>

      <div className="center-actions">
        {available.length ? <button className="primary-button large" type="button" onClick={() => dispatch({ type: 'START_DILEMMAS' })}>开始 {available.length} 道价值冲突题<ArrowRight /></button> : null}
        <button className={available.length ? 'secondary-button large' : 'primary-button large'} type="button" onClick={() => dispatch({ type: 'SHOW_RESULTS' })}>{available.length ? '暂不比较，直接查看报告' : '查看本轮报告'}</button>
      </div>
    </main>
  );
}

export function DilemmaQuestion({ state, dispatch }) {
  const id = state.dilemmaQueue[state.dilemmaIndex];
  const item = dilemmas.find((dilemma) => dilemma.id === id);
  if (!item) return null;
  const left = claims[item.left];
  const right = claims[item.right];
  const number = state.dilemmaIndex + 1;
  const total = state.dilemmaQueue.length;

  return (
    <main className="dilemma-page page-shell">
      <div className="dilemma-progress"><span>两难题 {number} / {total}</span><div><i style={{ width: `${(number / total) * 100}%` }} /></div></div>
      <span className="page-kicker">只判断这个具体情境</span>
      <h1>{item.title}</h1>
      <p className="dilemma-scenario">{item.scenario}</p>

      <section className="fixed-facts">
        <span>本题直接固定的事实条件</span>
        <ul>{item.fixedFacts.map((fact) => <li key={fact}>{fact}</li>)}</ul>
      </section>

      <aside className="dilemma-explainer">
        <strong>请暂时接受上面的事实设定，再比较两项价值。</strong>
        <p>本题不是在询问这些数字在现实中是否准确，也不是问哪项价值在所有场合都更重要。它只问：当两种方案不能同时实现时，你在本案中愿意选择哪一边。</p>
      </aside>

      <section className="dilemma-sides">
        <article className="dilemma-side left">
          <span>价值 A · 你已经确认的基本价值</span>
          <h2>{left?.shortLabel}</h2>
          <p>{left?.text}</p>
          <strong>选择 A 意味着：{item.leftAction}</strong>
        </article>
        <div className="versus">与</div>
        <article className="dilemma-side right">
          <span>价值 B · 你已经确认的基本价值</span>
          <h2>{right?.shortLabel}</h2>
          <p>{right?.text}</p>
          <strong>选择 B 意味着：{item.rightAction}</strong>
        </article>
      </section>

      <section className="dilemma-scale" aria-label="选择本题中的价值取舍">
        <button type="button" onClick={() => dispatch({ type: 'ANSWER_DILEMMA', response: 'left_strong' })}><strong>明显选择 A</strong><small>在本案中，我愿意让 A 明显优先</small></button>
        <button type="button" onClick={() => dispatch({ type: 'ANSWER_DILEMMA', response: 'left_slight' })}><strong>略微选择 A</strong><small>两边都重要，但我在本案中偏向 A</small></button>
        <button className="undecided" type="button" onClick={() => dispatch({ type: 'ANSWER_DILEMMA', response: 'undecided' })}><strong>本题无法比较</strong><small>我不能给两项价值排出清楚顺序</small></button>
        <button type="button" onClick={() => dispatch({ type: 'ANSWER_DILEMMA', response: 'right_slight' })}><strong>略微选择 B</strong><small>两边都重要，但我在本案中偏向 B</small></button>
        <button type="button" onClick={() => dispatch({ type: 'ANSWER_DILEMMA', response: 'right_strong' })}><strong>明显选择 B</strong><small>在本案中，我愿意让 B 明显优先</small></button>
      </section>
      <p className="dilemma-note">这次选择只适用于本题写明的事实条件。系统不会把它自动扩张为对所有情境都成立的永久价值排序。</p>
    </main>
  );
}
