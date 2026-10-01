import React from 'react';
import { decisionJourney, reasonBranch } from '../lib/resultVisuals.js';

const marks = { confirmed: '✓', pending: '○', qualified: '≈', retracted: '×', uncertain: '?', disputed: '!', missing: '−' };

export default function ReasoningMap({ model, result }) {
  const branches = ['main', 'counter'].map(mode => reasonBranch(model, result, mode));
  const journey = decisionJourney(result);
  return <section className="reasoning-map" aria-label="主要理由与相反理由路径">
    <div className="reasoning-map-intro"><strong>这条判断是怎么走到这里的</strong><p>实线表示记录中已核对的连接，虚线表示尚未确认。核对记录不是政策正确的证明。</p></div>
    <div className="reason-branches">{branches.map(branch => <section className={`reason-branch branch-${branch.mode}`} key={branch.mode}>
      <h4><span aria-hidden="true">{branch.mode === 'main' ? '01' : '02'}</span>{branch.title}</h4>
      {branch.nodes.length ? <ol className="reason-nodes">{branch.nodes.map(node => <li className={`reason-node tone-${node.tone}`} data-connected={node.connected} key={node.id}>
        <div className="reason-node-heading"><span>{node.kind}</span><span className="reason-node-status"><i aria-hidden="true">{marks[node.tone]}</i>{node.label}</span></div>
        <strong>{node.title}</strong>
        {node.body && node.body !== node.label ? <p>{node.body}</p> : null}
      </li>)}</ol> : <p className="reason-empty">{branch.empty}</p>}
      {branch.mode === 'counter' ? <p className="reason-impact">{branch.impact}</p> : null}
    </section>)}</div>
    <div className="reasoning-outcome"><div><span>初始判断</span><strong>{journey.initial}</strong></div>
      <span className="outcome-arrow" aria-hidden="true">→</span>
      <div><span>{journey.changed ? '复核后的判断' : '当前记录'}</span><strong>{journey.final}</strong></div>
    </div>
    {result.sourceModelVersion && result.sourceModelVersion !== model.meta.version ? <p className="map-source-note">来自题库 {result.sourceModelVersion} 的历史记录；旧连接和案例不自动升级为新版已检验内容。</p> : null}
  </section>;
}
