import React, { useState } from 'react';
import { ChevronUp, ListTree } from 'lucide-react';
import { argumentsById, claims, facts } from '../data/model.js';
import { getSelectedChain } from '../lib/engine.js';

const responseCopy = {
  true: '成立',
  false: '不成立',
  unknown: '不能判断',
  accept: '接受',
  reject: '不接受',
  uncertain: '不能判断',
};

export default function ProofView({ state }) {
  const [open, setOpen] = useState(false);
  const chain = state.currentChain || getSelectedChain(state);
  const steps = chain?.steps || [];
  return (
    <aside className={`argument-ledger${open ? ' open' : ''}`} aria-label="论证记录">
      <button className="ledger-toggle" type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <ListTree size={20} />
        <strong>当前论证 · 已确认 {steps.length} 步</strong>
        <span>{chain?.status === 'complete' ? '严格完整' : '仅保存在本地'}</span>
        <ChevronUp className={open ? '' : 'collapsed'} />
      </button>
      {open ? (
        <div className="ledger-body">
          {steps.length ? steps.map((step, index) => {
            const argument = argumentsById[step.argumentId];
            return (
              <section className="ledger-step" key={step.id}>
                <div className="ledger-index">{String(index + 1).padStart(2, '0')}</div>
                <div className="ledger-chain">
                  <div className="ledger-node target"><span>V</span><p>{claims[step.targetClaimId]?.text}</p></div>
                  {(argument?.factIds || []).map((factId) => (
                    <div className="ledger-node fact" key={factId}><span>F</span><p>{facts[factId]?.statement}</p><em>{responseCopy[step.factResponses?.[factId]]}</em></div>
                  ))}
                  <div className="ledger-node bridge"><span>B</span><p>{claims[step.bridgeClaimId]?.text}</p><em>{responseCopy[step.bridgeResponse]}</em></div>
                </div>
              </section>
            );
          }) : <p className="ledger-empty">完成一次事实和原则确认后，这里会出现论证结构。</p>}
        </div>
      ) : null}
    </aside>
  );
}
