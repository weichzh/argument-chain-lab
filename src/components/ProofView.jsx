import React, { useEffect, useRef, useState } from 'react';
import { argumentsById, claims, facts } from '../data/model.js';
import { ChevronDown, LinkIcon } from './Icons.jsx';

const responseLabel = {
  true: '认为是真的',
  false: '认为是假的',
  unknown: '目前不知道',
  accept: '接受',
  reject: '不接受',
  uncertain: '目前无法判断',
};

const terminalMeta = {
  provisional_fixed_point: ['G', '本轮已经确认的当前基本价值'],
  terminal_candidate: ['G?', '等待你再次确认的基本价值候选'],
  unconfirmed: ['G?', '尚未确认的基本价值候选'],
  rejected_as_fixed_point: ['G?', '你不愿直接接受它作为基本价值'],
  retracted_after_stress: ['G×', '在相似案例检查后撤回'],
};

function FactNode({ factId, response, pending = false }) {
  const item = facts[factId];
  if (!item) return null;
  return (
    <div className={`proof-node fact-node ${pending ? 'pending' : ''}`}>
      <div className="proof-node-meta">
        <span className="node-symbol">F</span>
        <span>{item.kind === 'stipulated' ? '本题直接规定的条件' : item.kind === 'empirical' ? '需要现实证据判断' : '关于事实关系的描述'}</span>
        {response ? <em data-state={response}>{responseLabel[response]}</em> : null}
      </div>
      <p>{item.statement}</p>
    </div>
  );
}

function BridgeNode({ claimId, response, terminalStatus = null }) {
  const claim = claims[claimId];
  if (!claim) return null;
  const terminal = Boolean(terminalStatus);
  const [symbol, label] = terminalMeta[terminalStatus] || ['G?', '当前基本价值候选'];
  return (
    <div className={`proof-node ${terminal ? 'terminal-node' : 'bridge-node'}`}>
      <div className="proof-node-meta">
        <span className="node-symbol">{terminal ? symbol : 'B'}</span>
        <span>{terminal ? label : '规范原则：说明事实为什么会产生理由'}</span>
        {response ? <em data-state={response}>{responseLabel[response]}</em> : null}
      </div>
      <p>{claim.text}</p>
    </div>
  );
}

function ConclusionNode({ claimId }) {
  const claim = claims[claimId];
  if (!claim) return null;
  return (
    <div className={`proof-node conclusion-node ${claim.kind === 'policy' ? 'policy-conclusion' : ''}`}>
      <div className="proof-node-meta">
        <span className="node-symbol">V</span>
        <span>{claim.kind === 'policy' ? '当前要说明的政策结论' : '下一层要继续说明的规范结论'}</span>
      </div>
      <p>{claim.text}</p>
    </div>
  );
}

function SupportArrow({ pending = false }) {
  return (
    <div className={`proof-support-arrow ${pending ? 'pending' : ''}`}>
      <span>{pending ? '正在分别检查事实 F 和规范原则 B' : '如果事实和原则都被接受，而且没有更强的反对理由'}</span>
      <b aria-label="为结论增加一项仍可被反驳的理由">⇝</b>
    </div>
  );
}

function Step({ step, index, continues }) {
  const argument = argumentsById[step.argumentId];
  return (
    <div className="proof-step">
      <div className="proof-step-heading">
        <span>第 {index + 1} 层</span>
        <strong>{argument?.title || '已经记录的理由'}</strong>
      </div>
      <div className="premise-group">
        {argument?.factIds.map((factId) => (
          <FactNode key={factId} factId={factId} response={step.factResponses?.[factId]} />
        ))}
        <div className="proof-plus"><span>＋</span><small>再加入规范原则 B</small></div>
        <BridgeNode claimId={step.bridgeClaimId} response={step.bridgeResponse} />
      </div>
      <SupportArrow />
      <ConclusionNode claimId={step.targetClaimId} />
      {continues ? (
        <div className="proof-recurse-link">
          <span>刚接受的 B 自己也是价值判断，下一层继续说明为什么接受它</span>
          <b>↓</b>
        </div>
      ) : null}
    </div>
  );
}

function PendingStep({ state, argument }) {
  return (
    <div className="pending-step">
      <div className="proof-step-heading">
        <span>正在检查</span>
        <strong>{argument.title}</strong>
      </div>
      <div className="premise-group">
        {argument.factIds.map((factId) => (
          <FactNode key={factId} factId={factId} response={state.pendingFactResponses[factId]} pending />
        ))}
        <div className="proof-plus"><span>＋</span><small>还要判断的规范原则 B</small></div>
        <BridgeNode claimId={argument.bridgeClaimId} />
      </div>
      <SupportArrow pending />
      <ConclusionNode claimId={state.currentTargetClaimId} />
    </div>
  );
}

export default function ProofView({ state, compact = false }) {
  const [open, setOpen] = useState(!compact);
  const scrollRef = useRef(null);
  const chain = state.currentChain;
  const currentArgument = argumentsById[state.currentArgumentId];
  const implicitTerminalCandidate = state.phase === 'terminal_confirm' && !chain?.terminal && chain?.steps.length
    ? {
        claimId: chain.steps.at(-1).bridgeClaimId,
        status: 'terminal_candidate',
      }
    : null;
  const terminalAnchor = chain?.terminal || implicitTerminalCandidate;
  const hasContent = Boolean(chain?.steps.length || currentArgument || state.currentTargetClaimId);

  useEffect(() => {
    if (!open || !scrollRef.current) return undefined;
    const frame = window.requestAnimationFrame(() => {
      const element = scrollRef.current;
      element.scrollTo({ top: element.scrollHeight, behavior: 'auto' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [
    open,
    chain?.steps.length,
    terminalAnchor?.status,
    state.currentArgumentId,
    state.currentFactIndex,
    state.phase,
  ]);

  return (
    <aside className={`proof-view ${compact ? 'compact' : ''}`} aria-label="当前理由结构">
      <button className="proof-view-header" type="button" onClick={() => compact && setOpen((value) => !value)} aria-expanded={open}>
        <div><LinkIcon size={18} /><span><strong>当前理由结构</strong><small>{chain?.steps.length || 0} 层已经记录</small></span></div>
        {compact ? <ChevronDown className={open ? 'rotate-180' : ''} /> : null}
      </button>
      {open ? (
        <div className="proof-scroll" ref={scrollRef}>
          {!hasContent ? (
            <div className="proof-empty">
              选择政策和理由后，这里会依次显示：事实 F、规范原则 B，以及它们正在支持的结论 V。
            </div>
          ) : null}
          {chain?.steps.map((step, index) => (
            <Step key={step.id} step={step} index={index} continues={index < chain.steps.length - 1} />
          ))}
          {terminalAnchor ? (
            <div className="terminal-anchor">
              <div className="proof-terminal-link"><span>本轮追问暂时停在这里；这只是当前承诺，不是客观公理</span><b>↓</b></div>
              <BridgeNode claimId={terminalAnchor.claimId} terminalStatus={terminalAnchor.status} />
            </div>
          ) : null}
          {currentArgument && !chain?.steps.some((step) => step.argumentId === currentArgument.id) ? (
            <PendingStep state={state} argument={currentArgument} />
          ) : null}
        </div>
      ) : null}
    </aside>
  );
}
