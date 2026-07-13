import React from 'react';
import { policies } from '../data/model.js';
import { Alert, Check } from './Icons.jsx';

const statusText = {
  not_started: '尚未开始',
  in_progress: '正在逐层追问理由',
  complete: '事实和原则都已确认',
  conditional: '原则已确认，事实未确认',
  tension: '适用条件还没说明清楚',
  unresolved: '理由还没有说明完整',
};

export default function PolicyRailV2({ state }) {
  return (
    <aside className="policy-rail" aria-label="政策议题进度">
      <div className="rail-title"><span>政策问题</span><small>每项政策只用来启动一条理由链，不会直接换算成政治分数。</small></div>
      <ol>
        {policies.map((policy, index) => {
          const record = state.records[policy.id];
          const status = record?.status || 'not_started';
          const active = index === state.policyIndex;
          const done = ['complete', 'conditional', 'tension', 'unresolved'].includes(status);
          return (
            <li key={policy.id} className={`${active ? 'active' : ''} ${done ? 'done' : ''}`}>
              <span className="rail-index">
                {status === 'complete' ? <Check size={15} /> : ['conditional', 'tension', 'unresolved'].includes(status) ? <Alert size={15} /> : policy.number}
              </span>
              <div><strong>{policy.title}</strong><small>{statusText[status]}</small></div>
            </li>
          );
        })}
      </ol>
      <div className="rail-legend">
        <span><i className="legend-dot fact" />F 事实判断</span>
        <span><i className="legend-dot bridge" />B 规范原则</span>
        <span><i className="legend-dot terminal" />G 当前基本价值</span>
      </div>
    </aside>
  );
}
