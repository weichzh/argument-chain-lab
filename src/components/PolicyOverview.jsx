import React from 'react';
import { ArrowRight, BarChart3, House } from 'lucide-react';
import { getModelV4, getPoliciesV4, getPolicyV4 } from '../lib/modelV4.js';
import { resultStatus } from '../lib/resultPresentation.js';

const answerCopy = {
  yes: '应当',
  no: '不应当',
  uncertain: '不确定',
  skipped: '已跳过',
};

export default function PolicyOverview({ state, dispatch, sessionControls }) {
  const defaultPolicyIds = new Set(getModelV4().product.defaultPolicyIds);
  const policies = getPoliciesV4().filter((policy) => defaultPolicyIds.has(policy.id));
  const next = getPolicyV4(sessionControls.nextPolicyId);
  return (
    <main className="policy-overview v4-policy-overview">
      <header className="overview-header">
        <div>
          <span>八个核心政策</span>
          <h1>从哪一道开始？</h1>
          <p>进行中的题目会从上次的位置继续；已完成的题目可以回看小结。重新回答需要另行确认。</p>
        </div>
        <div className="overview-actions">
          {next ? (
            <button className="button primary" type="button" onClick={() => dispatch({ type: 'OPEN_POLICY', policyId: next.id })}>
              {state.policyDrafts?.[next.id] || (state.startedAt && state.currentPolicyId === next.id) ? '继续未完成的题目' : defaultPolicyIds.has(next.id) ? '开始下一题' : '继续精度题'}<ArrowRight size={17} />
            </button>
          ) : null}
          {sessionControls.answeredCount ? <button className="button secondary" type="button" onClick={() => dispatch({ type: 'SHOW_RESULTS' })}><BarChart3 size={17} />查看结果</button> : null}
          <button className="icon-button" type="button" title="回到主页" aria-label="回到主页" onClick={() => dispatch({ type: 'EXIT_TO_LANDING' })}><House size={19} /></button>
        </div>
      </header>

      <ol className="policy-list">
        {policies.map((policy, index) => {
          const result = state.policyResults[policy.id];
          const ongoing = Boolean(state.policyDrafts?.[policy.id] || (state.currentPolicyId === policy.id && state.startedAt));
          const status = result ? resultStatus(result).label : ongoing ? '进行中' : '未开始';
          const actionLabel = result ? '查看小结' : ongoing ? '继续' : '从这里开始';
          return (
            <li className="policy-row" data-policy-id={policy.id} key={policy.id}>
              <span className="policy-number">{String(index + 1).padStart(2, '0')}</span>
              <div className="policy-row-title"><h2>{policy.shortTitle}</h2><small>{policy.title}</small></div>
              <span className={`policy-status ${result?.rootAnswer || 'not-started'}`}>{status}</span>
              <button className="button quiet" type="button" aria-label={`${actionLabel}：${policy.shortTitle}`} onClick={() => dispatch({ type: 'OPEN_POLICY', policyId: policy.id })}>
                <span>{actionLabel}</span><ArrowRight size={17} />
              </button>
            </li>
          );
        })}
      </ol>
    </main>
  );
}
