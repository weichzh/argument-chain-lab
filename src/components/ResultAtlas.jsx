import React from 'react';
import { ArrowDown, ArrowUpRight } from 'lucide-react';
import { buildResultAtlas, VISUAL_STATES } from '../lib/resultVisuals.js';

export default function ResultAtlas({ model, state, dispatch }) {
  const atlas = buildResultAtlas(model, state);
  const renderTile = (row, index) => {
    const content = <>
      <span className="atlas-tile-top"><span>{String(index + 1).padStart(2, '0')}</span>
        {row.result ? <ArrowDown size={14} aria-hidden="true" /> : <ArrowUpRight size={14} aria-hidden="true" />}</span>
      <strong>{row.title}</strong>
      <span className={`atlas-state state-${row.status}`}><i aria-hidden="true">{VISUAL_STATES[row.status].mark}</i>{row.label}</span>
      {row.changed ? <small>含复核改判</small> : row.reviewPending ? <small>理由可继续核对</small> : null}
    </>;
    const name = `${row.title}：${row.label}，${row.result ? '查看判断边界' : '继续作答'}`;
    return <li key={row.id} data-state={row.status}>
      {row.result ? <a aria-label={name} href={`#result-${row.id}`}>{content}</a>
        : <button type="button" aria-label={name} onClick={() => dispatch({ type: 'OPEN_POLICY', policyId: row.id })}>{content}</button>}
    </li>;
  };
  return <section className="result-atlas" aria-labelledby="result-atlas-title">
    <div className="atlas-heading"><div><span className="section-eyebrow">01 · 本轮总览</span><h2 id="result-atlas-title" tabIndex={-1}>先看判断落在哪里</h2>
      <p>每一格是一项情景。接受目标，不等于接受所有安排。</p></div>
      <div className="atlas-count"><strong>{atlas.completed}<span> / {atlas.coreTotal}</span></strong><small>核心情景已作答</small></div>
    </div>
    <div className="atlas-strip" aria-hidden="true">{atlas.rows.filter(row => row.core).map(row => <span className={`state-${row.status}`} key={row.id} />)}</div>
    <dl className="atlas-legend" aria-label="核心情景的状态数量">{Object.entries(atlas.counts).filter(([, count]) => count > 0).map(([id, count]) => <div key={id} className={`state-${id}`}>
      <dt><i aria-hidden="true">{VISUAL_STATES[id].mark}</i>{VISUAL_STATES[id].label}</dt><dd>{count}</dd>
    </div>)}</dl>
    <ol className="atlas-tiles" aria-label="八个核心情景">{atlas.rows.filter(row => row.core).map(renderTile)}</ol>
    {atlas.rows.some(row => !row.core) ? <div className="atlas-optional"><h3>附加探索 <small>单独计数，不抬高核心题完成量</small></h3>
      <ol className="atlas-tiles" aria-label="附加情景">{atlas.rows.filter(row => !row.core).map((row, index) => renderTile(row, index + atlas.coreTotal))}</ol></div> : null}
    <p className="atlas-footnote">作答包括“不确定”；跳过和未完成另列。这是回答状态，不是政治坐标或能力评分。</p>
  </section>;
}
