import React, { useMemo, useState } from 'react';
import { argumentsById, claims, facts, getPolicy, policies } from '../data/model.js';
import { exportSession, sessionSummary } from '../lib/engine.js';
import { Alert, Check, Download, LinkIcon, Rotate, Scale } from './Icons.jsx';

const statusCopy = {
  complete: ['事实和原则都已确认', 'success'],
  conditional: ['原则已确认，事实未确认', 'warning'],
  tension: ['原则的适用条件还没说明清楚', 'warning'],
  unresolved: ['理由尚未说明完整', 'neutral'],
};

const responseCopy = {
  true: '目前认为是真的',
  false: '目前认为是假的',
  unknown: '目前不知道真假',
};

const tensionKindCopy = {
  conflict_revise_prior: '回答已经修订',
  conflict_keep_prior: '当前回答已经撤回',
  conflict_suspend: '同一命题目前未判断',
  conflict_scope_gap: '题目适用条件可能写得不够清楚',
  conflict_recorded: '相反回答记录',
  model_gap: '题库没有覆盖实际理由',
  empirical_conflict: '事实判断不一致',
  bridge_conflict: '规范原则判断不一致',
  empirical_break: '事实前提未确认',
  scope_tension: '原则适用条件未说明',
  unresolved: '理由尚未完成',
};

function downloadJson(state) {
  const payload = exportSession(state);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `argument-chain-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function ChainFormula({ step, index }) {
  const argument = argumentsById[step.argumentId];
  const bridge = claims[step.bridgeClaimId];
  const target = claims[step.targetClaimId];
  return (
    <div className="result-proof-step">
      <div className="result-proof-level">第 {index + 1} 层 · {argument?.title}</div>
      <div className="result-formula">
        <div className="result-premises">
          {argument?.factIds.map((factId) => (
            <div key={factId} className="result-fact">
              <span>F</span>
              <p>{facts[factId]?.statement}</p>
              <em data-state={step.factResponses?.[factId]}>{responseCopy[step.factResponses?.[factId]]}</em>
            </div>
          ))}
        </div>
        <b>＋</b>
        <div className="result-bridge"><span>B</span><p>{bridge?.text}</p><small>{bridge?.explanation}</small></div>
        <b className="result-support-symbol" title="这些前提给结论增加一项仍可能被反驳的理由">⇝<small>增加一项理由</small></b>
        <div className="result-conclusion"><span>V</span><p>{target?.text}</p></div>
      </div>
    </div>
  );
}

const terminalStatusCopy = {
  provisional_fixed_point: 'G · 本轮已经确认的当前基本价值',
  terminal_candidate: 'G? · 等待再次确认的基本价值候选',
  unconfirmed: 'G? · 尚未确认的基本价值候选',
  rejected_as_fixed_point: 'G? · 你不愿直接接受它作为基本价值',
  retracted_after_stress: 'G× · 在相似案例检查后撤回',
};

function ChainsTab({ state }) {
  return (
    <div className="results-list">
      <div className="results-explainer">
        <strong>这里逐层展示每条理由，而不是只重复政策结论。</strong>
        <p>F 是你对事实的判断，B 是你接受或拒绝的规范原则，V 是本层需要说明的结论。符号 ⇝ 只表示“增加一项理由”，不表示结论已经被严格证明。</p>
      </div>
      {policies.map((policy) => {
        const record = state.records[policy.id];
        return (
          <section key={policy.id} className="policy-result-section">
            <div className="policy-result-head">
              <span>{policy.number}</span>
              <div><h3>{policy.title}</h3><p>{policy.proposition}</p></div>
              <em className={`status-chip ${record?.status || 'neutral'}`}>{statusCopy[record?.status]?.[0] || '没有作答'}</em>
            </div>
            {!record?.chains.length ? <p className="empty-copy">这项政策没有保存可以展开的理由。</p> : record.chains.map((chain, chainIndex) => (
              <article key={chain.id} className="saved-chain">
                <div className="saved-chain-head">
                  <strong>理由 {chainIndex + 1}</strong>
                  <span>{chain.direction === 'support' ? '用于支持政策' : chain.direction === 'oppose' ? '用于反对政策' : '没有确定方向'}</span>
                  <em className={`status-chip ${chain.status}`}>{statusCopy[chain.status]?.[0]}</em>
                </div>
                {chain.steps.map((step, index) => <ChainFormula key={step.id} step={step} index={index} />)}
                {chain.terminal ? (
                  <div className={`saved-terminal ${chain.terminal.status !== 'provisional_fixed_point' ? 'unconfirmed' : ''}`}>
                    <span>{terminalStatusCopy[chain.terminal.status] || 'G? · 基本价值候选记录'}</span>
                    <p>{claims[chain.terminal.claimId]?.text}</p>
                    {claims[chain.terminal.claimId]?.explanation ? <small>{claims[chain.terminal.claimId].explanation}</small> : null}
                    {chain.stress?.distinction ? <small>你为它补充的适用条件：{chain.stress.distinction}</small> : null}
                  </div>
                ) : null}
                {chain.unresolvedReason ? <div className="saved-break"><Alert size={18} /><p>{chain.unresolvedReason}</p></div> : null}
              </article>
            ))}
          </section>
        );
      })}
    </div>
  );
}

function FoundationsTab({ summary }) {
  return (
    <div className="foundation-results">
      <div className="results-explainer">
        <strong>这里的 G 不是系统预先设置的政治价值轴。</strong>
        <p>只有当你在具体政策理由中明确表示“即使没有更深的规范前提，我现在仍直接接受它”，并完成相似案例检查后，这条原则才会出现在这里。</p>
      </div>
      {summary.uniqueCommitments.length ? summary.uniqueCommitments.map((item, index) => {
        const claim = claims[item.claimId];
        const occurrences = summary.commitments.filter((entry) => entry.claimId === item.claimId);
        return (
          <article key={item.claimId} className="foundation-result-card">
            <span className="foundation-rank">G{String(index + 1).padStart(2, '0')}</span>
            <div>
              <h3>{claim?.shortLabel || '没有名称的基本价值'}</h3>
              <p>{claim?.text}</p>
              {claim?.explanation ? <small className="foundation-explanation"><b>这句话具体表示：</b>{claim.explanation}</small> : null}
              {claim?.example ? <small className="foundation-explanation"><b>例子：</b>{claim.example}</small> : null}
              <small>它在这些政策理由中出现过：{occurrences.map((entry) => getPolicy(entry.policyId)?.title).filter(Boolean).join('、')}</small>
            </div>
          </article>
        );
      }) : (
        <div className="empty-panel"><Alert /><h3>本轮没有确认当前基本价值</h3><p>这可能是因为追问停在事实、规范原则或适用条件上。它不表示你没有价值观，只表示本轮对话还没有得到你明确确认的 G。</p></div>
      )}
    </div>
  );
}

function FactsTab({ state }) {
  const rows = useMemo(() => {
    const map = new Map();
    Object.values(state.records).forEach((record) => record.chains.forEach((chain) => chain.steps.forEach((step) => {
      Object.entries(step.factResponses || {}).forEach(([factId, response]) => {
        const entry = map.get(factId) || { factId, responses: new Set(), policies: new Set() };
        entry.responses.add(response);
        entry.policies.add(chain.policyId);
        map.set(factId, entry);
      });
    })));
    return [...map.values()];
  }, [state]);
  return (
    <div className="fact-ledger">
      <div className="results-explainer">
        <strong>这里单独记录你目前对事实的判断。</strong>
        <p>事实 F 只回答“世界是不是这样”。“目前不知道”表示你缺少足够信息，并不把命题变成第三种真值；政策应不应该通过，也不能由这些事实单独决定。</p>
      </div>
      {rows.length ? rows.map((row) => {
        const item = facts[row.factId];
        const conflict = row.responses.has('true') && row.responses.has('false');
        return (
          <article key={row.factId} className={`fact-ledger-row ${conflict ? 'conflict' : ''}`}>
            <div className="fact-ledger-top"><span>F</span><em>{item?.kind === 'empirical' ? '需要现实证据判断' : item?.kind === 'stipulated' ? '本题直接规定的条件' : '关于事实关系的描述'}</em><strong>{[...row.responses].map((response) => responseCopy[response]).join(' / ')}</strong></div>
            <p>{item?.statement}</p>
            {item?.plainExplanation ? <small className="fact-ledger-explanation">{item.plainExplanation}</small> : null}
            <details><summary>查看支持或否定这句话的条件</summary><div><span>什么会支持它</span><p>{item?.plainTruthConditions || item?.truthConditions}</p><span>什么会否定它</span><p>{item?.plainFalsifier || item?.falsifier}</p><span>题库采用的具体标准</span><p>{item?.truthConditions}；否定条件：{item?.falsifier}</p></div></details>
            {conflict ? <div className="inline-conflict"><Alert size={16} />你在不同理由中对同一句事实给过相反判断；请结合“未解决问题”页面查看你如何处理了这次差异。</div> : null}
          </article>
        );
      }) : <div className="empty-panel"><p>本轮没有保存事实判断。</p></div>}
    </div>
  );
}

function TensionsTab({ summary }) {
  return (
    <div className="tension-results">
      <div className="results-explainer">
        <strong>这一页只列出仍需说明、修订或补充条件的地方。</strong>
        <p>它不会把回答困难解释成人格问题，也不会把“目前不知道”算作错误。每一项都说明问题发生在哪一句事实、哪条原则或哪一步理由中。</p>
      </div>
      {summary.tensions.length ? summary.tensions.map((item) => (
        <article key={item.id} className={`tension-row ${item.severity}`}>
          <Alert />
          <div><span>{tensionKindCopy[item.kind] || '需要继续检查'}</span><h3>{item.title}</h3><p>{item.detail}</p></div>
        </article>
      )) : (
        <div className="empty-panel"><Check /><h3>本轮已经回答的部分没有发现明显结构问题</h3><p>这里只表示没有检测到未处理的相反回答、没有说明的例外或未完成步骤；它不证明你所有未被询问的信念都完整一致。</p></div>
      )}
    </div>
  );
}

function PriorityTab({ summary }) {
  const { ranking, edges, cycles, unanswered } = summary.priority;
  const maxAbs = Math.max(1, ...ranking.map((item) => Math.abs(item.net)));
  return (
    <div className="priority-results">
      <div className="results-explainer">
        <strong>这里汇总的是具体两难题中的选择，不是永久价值排行榜。</strong>
        <p>“净选择”只是把本轮已经回答的题目合在一起查看。没有在同一道题中比较过的价值，系统不会擅自判断谁更重要；不同情境下的选择也可以形成循环。</p>
      </div>
      {ranking.length ? (
        <section className="priority-ranking">
          {ranking.map((item, index) => (
            <div key={item.id} className="priority-row">
              <span>{index + 1}</span>
              <div><strong>{claims[item.id]?.shortLabel || item.id}</strong><small>{item.comparisons} 次具体比较 · 本轮净选择 {item.net > 0 ? `+${item.net}` : item.net}</small><div className="priority-track"><i style={{ width: `${(Math.abs(item.net) / maxAbs) * 100}%` }} data-direction={item.net >= 0 ? 'positive' : 'negative'} /></div></div>
            </div>
          ))}
        </section>
      ) : <div className="empty-panel"><Scale /><h3>本轮没有形成明确的价值取舍关系</h3><p>你跳过了两难题，或者在所有题中都选择了“本题无法比较”。这也是有效结果。</p></div>}

      {edges.length ? <section className="preference-edges"><h3>每一道题实际记录的选择</h3>{edges.map((edge, index) => <div key={`${edge.winner}-${edge.loser}-${index}`}><strong>{claims[edge.winner]?.shortLabel}</strong><span>{edge.weight === 2 ? '在该题中明显优先于' : '在该题中略微优先于'}</span><strong>{claims[edge.loser]?.shortLabel}</strong></div>)}</section> : null}
      {cycles.length ? <section className="cycle-box"><Alert /><div><h3>不同情境中的选择形成了循环</h3><p>{cycles.map((cycle) => cycle.map((id) => claims[id]?.shortLabel).join(' → ')).join('；')}</p><small>循环不一定是错误。它可能说明不同事实条件改变了取舍，也可能说明题目还需要加入更精确的区别条件。</small></div></section> : null}
      {unanswered > 0 ? <p className="results-footnote">有 {unanswered} 道题没有形成明确方向，因此没有进入汇总。</p> : null}
    </div>
  );
}

export default function ResultsV2({ state, dispatch }) {
  const [tab, setTab] = useState('chains');
  const summary = useMemo(() => sessionSummary(state), [state]);
  const completedPolicies = Object.values(state.records).filter((record) => record.status === 'complete').length;
  const tabs = [
    ['chains', '理由链条'],
    ['foundations', '当前基本价值'],
    ['facts', '事实判断'],
    ['tensions', `未解决问题${summary.tensions.length ? ` ${summary.tensions.length}` : ''}`],
    ['priority', '具体情境中的价值取舍'],
  ];

  return (
    <main className="results-page page-shell wide">
      <header className="results-hero">
        <span className="page-kicker">本轮论证分析报告</span>
        <h1>报告不判断“你是哪一派”。<br />它说明你的每条理由目前走到了哪里。</h1>
        <p>你可以查看：哪些事实被接受，哪些规范原则被接受，为什么继续追问，哪些原则被确认为当前基本价值，以及哪些问题仍然没有解决。</p>
        <div className="results-actions"><button className="primary-button" type="button" onClick={() => downloadJson(state)}><Download />导出完整 JSON</button><button className="secondary-button" type="button" onClick={() => dispatch({ type: 'RESET' })}><Rotate />重新开始</button></div>
      </header>

      <section className="result-metrics" aria-label="本轮摘要">
        <div><strong>{completedPolicies}/{policies.length}</strong><span>事实和原则都已确认的政策理由</span></div>
        <div><strong>{summary.uniqueCommitments.length}</strong><span>已经确认的不同基本价值</span></div>
        <div><strong>{summary.conditionalChains.length}</strong><span>原则已确认、事实未确认的理由</span></div>
        <div><strong>{summary.tensions.length}</strong><span>仍需说明或修订的问题</span></div>
      </section>

      <nav className="result-tabs" aria-label="报告页面">
        {tabs.map(([id, label]) => <button key={id} className={tab === id ? 'active' : ''} type="button" onClick={() => setTab(id)}>{label}</button>)}
      </nav>

      <section className="result-tab-panel">
        {tab === 'chains' ? <ChainsTab state={state} /> : null}
        {tab === 'foundations' ? <FoundationsTab summary={summary} /> : null}
        {tab === 'facts' ? <FactsTab state={state} /> : null}
        {tab === 'tensions' ? <TensionsTab summary={summary} /> : null}
        {tab === 'priority' ? <PriorityTab summary={summary} /> : null}
      </section>

      <footer className="results-disclaimer"><LinkIcon /><p><strong>解释边界：</strong>系统只检查本题库和本轮回答中你明确接受、拒绝或保留的问题。它不裁决哪项终极价值客观为真，也不能证明你在所有未询问的情境中都会作出同样判断。不得用于就业、执法、教育录取、信贷或政治审查。</p></footer>
    </main>
  );
}
