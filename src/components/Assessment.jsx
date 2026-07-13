import React, { useEffect, useMemo, useState } from 'react';
import {
  argumentsById,
  claims,
  facts,
  getArgumentsForClaim,
  policies,
} from '../data/model.js';
import {
  PHASES,
  factResponseSummary,
  getCurrentArgument,
  getCurrentBridge,
  getCurrentFact,
  getCurrentPolicy,
  getCurrentTargetClaim,
} from '../lib/engine.js';
import { Alert, ArrowRight, Check, ChevronDown, Help, X } from './Icons.jsx';
import PolicyRailV2 from './PolicyRailV2.jsx';
import ProofView from './ProofView.jsx';

const truthLabels = {
  true: '我目前认为这句话是真的',
  false: '我目前认为这句话是假的',
  unknown: '我现在没有足够信息判断真假',
};

const responseLabels = {
  true: '认为是真的',
  false: '认为是假的',
  unknown: '目前不知道',
  accept: '接受',
  reject: '不接受',
  uncertain: '目前无法判断',
};

const chainStatus = {
  complete: {
    title: '这条理由目前已经说明完整',
    copy: '你确认了相关事实、每一层规范原则和当前基本价值，也完成了相似案例检查。',
    tone: 'success',
  },
  conditional: {
    title: '规范部分已经说明，但事实还没有确认',
    copy: '你接受了这条理由所需要的规范原则，但至少一个事实被你判断为假，或者你现在还不知道它是否为真。',
    tone: 'warning',
  },
  tension: {
    title: '你接受了原则，但它适用于哪些情况还不清楚',
    copy: '你把一条原则确认为当前基本价值，但在相关条件相同的另一个案例中没有继续适用，也暂时没有指出哪项事实差别造成了例外。',
    tone: 'warning',
  },
  unresolved: {
    title: '这条理由目前还没有说明完整',
    copy: '系统会保存具体停在了哪里，不会替你补上一项你没有接受的事实或价值判断。',
    tone: 'neutral',
  },
};

function Choice({ title, copy, onClick, tone = '', selected = false, icon = null, disabled = false }) {
  return (
    <button className={`choice ${tone} ${selected ? 'selected' : ''}`} type="button" onClick={onClick} disabled={disabled}>
      {icon ? <span className="choice-icon">{icon}</span> : null}
      <span><strong>{title}</strong>{copy ? <small>{copy}</small> : null}</span>
      <ArrowRight className="choice-arrow" size={18} />
    </button>
  );
}

function PhaseHeading({ kicker, title, copy }) {
  return (
    <header className="phase-heading">
      <span>{kicker}</span>
      <h1>{title}</h1>
      {copy ? <p>{copy}</p> : null}
    </header>
  );
}

function ConceptHelp({ title, children, example }) {
  return (
    <aside className="concept-help">
      <div className="concept-help-title">为什么要问这一题</div>
      <strong>{title}</strong>
      <div className="concept-help-copy">{children}</div>
      {example ? <div className="concept-help-example"><span>具体例子</span><p>{example}</p></div> : null}
    </aside>
  );
}

function PolicyContext({ policy }) {
  return (
    <div className="policy-context">
      <div className="policy-context-label">本题讨论的具体政策</div>
      <strong>{policy.proposition}</strong>
      <p><b>本题限定的条件：</b>{policy.scope}</p>
    </div>
  );
}

function StancePhase({ policy, dispatch }) {
  return (
    <>
      <PhaseHeading
        kicker={`政策 ${policy.number} · 先确定要说明的结论 V`}
        title={policy.question}
        copy="这一屏只记录你目前的判断。支持同一政策的人可能理由完全不同，反对同一政策的人也一样，所以系统暂时不会推测你的政治立场。"
      />
      <ConceptHelp
        title="先明确要解释哪一个结论，再讨论理由。"
        example="你可以先选择“我倾向反对保存全民通信元数据”。下一步系统才会问：你是因为担心任意权力、误判程序，还是因为正常交往会受到影响。"
      >
        <p><b>V</b> 是本轮需要说明的结论。政策表态本身还不能告诉我们，你相信哪些事实，也不能告诉我们你接受哪些价值原则。</p>
      </ConceptHelp>
      <PolicyContext policy={policy} />
      <div className="choice-stack">
        <Choice title="我目前倾向支持" copy="下一步分别检查：我相信哪些事实，以及我接受哪条规范原则。" tone="support" onClick={() => dispatch({ type: 'SET_STANCE', stance: 'support' })} />
        <Choice title="我目前倾向反对" copy="下一步分别检查：我相信哪些事实，以及我接受哪条规范原则。" tone="oppose" onClick={() => dispatch({ type: 'SET_STANCE', stance: 'oppose' })} />
        <Choice title="我现在还不能决定" copy="你可以临时选择一边检查理由，也可以暂时跳过这项政策。" onClick={() => dispatch({ type: 'SET_STANCE', stance: 'undecided' })} />
      </div>
    </>
  );
}

function DirectionPhase({ dispatch }) {
  return (
    <>
      <PhaseHeading
        kicker="暂时没有政策结论"
        title="你想先检查哪一边的理由？"
        copy="这只是选择检查方向，不表示你已经支持那一边。系统会把该结论临时当作 V，然后逐项检查事实 F 和规范原则 B。"
      />
      <ConceptHelp
        title="在还没有结论时，也可以先检验一种可能的理由。"
        example="你尚未决定是否支持碳费，可以先检验“它确实减少第三方损失，因此有理由采用”这条支持理由，看看自己究竟在哪一步接受或拒绝。"
      >
        <p>完成检查后，你仍可以保持没有结论。这里的目标不是强迫表态，而是找出你对具体理由的真实反应。</p>
      </ConceptHelp>
      <div className="choice-stack">
        <Choice title="先检查支持这项政策的理由" copy="临时把“国家应该采纳”当作 V，检查是否存在一条你愿意承担的完整理由。" tone="support" onClick={() => dispatch({ type: 'SET_DIRECTION', direction: 'support' })} />
        <Choice title="先检查反对这项政策的理由" copy="临时把“国家不应该采纳”当作 V，检查是否存在一条你愿意承担的完整理由。" tone="oppose" onClick={() => dispatch({ type: 'SET_DIRECTION', direction: 'oppose' })} />
        <Choice title="这一题先不继续" copy="记录为目前没有结论，然后进入下一项政策。" onClick={() => dispatch({ type: 'SKIP_POLICY', reason: '用户目前没有政策结论，也没有选择先检查其中一边的理由。' })} />
      </div>
    </>
  );
}

function ArgumentPhase({ state, dispatch }) {
  const target = getCurrentTargetClaim(state);
  const candidates = getArgumentsForClaim(state.currentTargetClaimId);
  const depth = state.currentChain?.steps.length || 0;
  return (
    <>
      <PhaseHeading
        kicker={depth === 0 ? '选择你实际采用的主要理由' : `继续追问 · 第 ${depth + 1} 层`}
        title={depth === 0 ? '下面哪一种说法最接近你的理由？' : '你刚才接受了一条规范原则。你为什么接受它？'}
        copy="每一种理由都明确列出两类前提：事实命题 F 说明世界是否如此；规范原则 B 说明这些事实为什么会给当前结论增加理由。"
      />
      <ConceptHelp
        title="不要只看结论相不相同，还要看中间理由是不是你的理由。"
        example="两个人都支持同一项安全政策：一人因为它确实能减少重伤；另一人因为它经过公平的民主程序。他们的政策结论相同，但论证链并不相同。"
      >
        <p>选择一项后，系统不会立即认定整条理由成立。它会先逐条询问其中的事实 F，再单独询问你是否接受规范原则 B（也就是最小桥接原则要求明确写出的那项价值判断）。</p>
      </ConceptHelp>
      <div className="target-claim"><span>当前需要说明的结论 V</span><p>{target?.text}</p>{target?.explanation ? <small>{target.explanation}</small> : null}</div>
      <div className="argument-grid">
        {candidates.map((argument, index) => (
          <button key={argument.id} className="argument-choice" type="button" onClick={() => dispatch({ type: 'SELECT_ARGUMENT', argumentId: argument.id })}>
            <div className="argument-choice-top"><span className="argument-index">{String(index + 1).padStart(2, '0')}</span><strong>{argument.title}</strong></div>
            <p className="argument-summary">{argument.summary}</p>
            <div className="argument-path-preview">
              <span>先判断 {argument.factIds.length} 个事实</span>
              <span>再判断原则：{claims[argument.bridgeClaimId]?.shortLabel}</span>
            </div>
            <div className="argument-anatomy" aria-label="事实加规范原则为结论提供理由">
              <span className="mini-token fact">{argument.factIds.length} × F</span><span>＋</span><span className="mini-token bridge">1 × B</span><span className="defeasible-mark" title="提供一项仍可被反驳的理由">⇝</span><span className="mini-token conclusion">V</span>
            </div>
          </button>
        ))}
      </div>
      <div className="argument-none">
        <Choice
          title="这些都不是我的实际理由"
          copy="系统会记录题库没有覆盖你的理由，并停止当前路径；它不会替你选一个勉强接近的答案。"
          onClick={() => dispatch({ type: 'NO_ARGUMENT' })}
        />
      </div>
      {!candidates.length ? (
        <div className="notice neutral"><Alert /><div><strong>题库目前没有为这条原则准备更深的理由</strong><p>这不表示它天然无需说明。你可以明确把它作为当前基本价值，也可以记录“我目前还不能说明为什么接受它”。</p></div></div>
      ) : null}
    </>
  );
}

function ConflictPhase({ state, dispatch }) {
  const conflict = state.pendingConflict;
  if (!conflict) return null;
  const isFact = conflict.kind === 'fact';
  const proposition = isFact ? facts[conflict.propositionId]?.statement : claims[conflict.propositionId]?.text;
  const decisive = isFact ? ['true', 'false'] : ['accept', 'reject'];
  const priorDecisive = conflict.previousResponses.filter((response) => decisive.includes(response));
  const stablePrior = new Set(priorDecisive).size === 1 ? priorDecisive[0] : null;

  return (
    <>
      <PhaseHeading
        kicker="发现相反回答"
        title="你现在的回答，与之前对同一句话的回答相反。"
        copy="这不一定表示逻辑矛盾。你可能改变了看法，也可能是两次题目的实际条件不同。系统不会自动覆盖旧答案。"
      />
      <ConceptHelp
        title="先分清是观点改变，还是题目把两个不同条件写成了同一句话。"
        example="你可能在“没有司法批准”的监控案例中反对某项原则，在“有明确审批和复核”的案例中接受类似原则。若审批条件与判断相关，就应把两道题区分开，而不是简单记作矛盾。"
      >
        <p>只有在命题含义和适用条件相同、而你同时坚持相反答案时，才形成尚未解决的不一致。</p>
      </ConceptHelp>
      <div className="conflict-proposition">
        <span>{isFact ? 'F · 事实命题' : 'B · 规范原则（桥接原则）'}</span>
        <p>{proposition}</p>
      </div>
      <div className="conflict-comparison" aria-label="相反回答比较">
        <div><span>此前记录</span><strong>{conflict.previousResponses.map((response) => responseLabels[response]).join(' / ')}</strong></div>
        <b>≠</b>
        <div><span>当前回答</span><strong>{responseLabels[conflict.attemptedResponse]}</strong></div>
      </div>
      <div className="choice-stack compact">
        <Choice title="我改变了看法，以当前答案为准" copy="把以前对同一命题的答案改成当前答案，然后继续。" onClick={() => dispatch({ type: 'RESOLVE_CONFLICT', resolution: 'revise_prior' })} />
        {stablePrior ? <Choice title={`我这次点错了，沿用此前的“${responseLabels[stablePrior]}”`} copy="当前路径继续使用旧答案；系统仍保留这次修订记录。" onClick={() => dispatch({ type: 'RESOLVE_CONFLICT', resolution: 'keep_prior' })} /> : null}
        <Choice title="两次条件不同，但题目没有写清差别" copy="保留两个回答，并把这个位置记录为题库需要补充适用条件。" tone="warning" onClick={() => dispatch({ type: 'RESOLVE_CONFLICT', resolution: 'scope_gap' })} />
        <Choice title="我目前不能确定，先把这个命题记为未判断" copy={`把以前和当前回答都改成“${isFact ? '目前不知道' : '目前无法判断'}”。`} onClick={() => dispatch({ type: 'RESOLVE_CONFLICT', resolution: 'suspend' })} />
      </div>
    </>
  );
}

function FactPhase({ state, dispatch }) {
  const item = getCurrentFact(state);
  const argument = getCurrentArgument(state);
  const [open, setOpen] = useState(false);
  const position = state.currentFactIndex + 1;
  if (!item || !argument) return null;
  return (
    <>
      <PhaseHeading
        kicker={`F · 事实判断 ${position}/${argument.factIds.length}`}
        title="你目前认为下面这句话是真的还是假的？"
        copy="这一屏只问世界实际上是不是这样。请暂时不要考虑这件事好不好，也不要考虑政策最后应不应该通过。"
      />
      <ConceptHelp
        title="F 必须是一句能够由证据支持或推翻的话。"
        example="“这项制度使致命袭击减少了 15%”是事实命题；“为了减少袭击，国家应该采用这项制度”不是纯事实，因为它已经加入了‘应该’。"
      >
        <p>事实命题本身仍然只有真和假。“我现在没有足够信息”只是说明你的认识状态，不是第三种事实状态。</p>
      </ConceptHelp>
      <article className="fact-specimen">
        <div className="specimen-top">
          <span className={`type-label ${item.kind}`}>{item.kind === 'stipulated' ? '本题直接规定的条件' : item.kind === 'empirical' ? '需要现实证据判断' : '关于事实关系的描述'}</span>
          <button type="button" onClick={() => setOpen((value) => !value)}>{open ? '收起判断说明' : '怎样判断这句话'} <ChevronDown className={open ? 'rotate-180' : ''} size={17} /></button>
        </div>
        <blockquote>{item.statement}</blockquote>
        {item.plainExplanation ? <div className="fact-plain-explanation"><span>这句话具体在问什么</span><p>{item.plainExplanation}</p></div> : null}
        {item.note ? <p className="fact-note"><b>请只判断这一点：</b>{item.note}</p> : null}
        {open ? (
          <div className="truth-boxes">
            <div><span>什么证据或条件会支持它</span><p>{item.plainTruthConditions || item.truthConditions}</p><details><summary>查看题库采用的具体标准</summary><p>{item.truthConditions}</p></details></div>
            <div><span>什么证据或条件会否定它</span><p>{item.plainFalsifier || item.falsifier}</p><details><summary>查看题库采用的具体标准</summary><p>{item.falsifier}</p></details></div>
          </div>
        ) : null}
      </article>
      <div className="choice-stack compact">
        <Choice title={truthLabels.true} copy="系统把它记录为你当前接受的事实判断。" icon={<Check size={18} />} onClick={() => dispatch({ type: 'ANSWER_FACT', response: 'true' })} />
        <Choice title={truthLabels.false} copy="这条具体理由不能继续依靠这个事实；后面的规范原则仍可单独检查。" icon={<X size={18} />} onClick={() => dispatch({ type: 'ANSWER_FACT', response: 'false' })} />
        <Choice title={truthLabels.unknown} copy="系统保留这个问题，不强迫你在证据不足时猜测。" icon={<Help size={18} />} onClick={() => dispatch({ type: 'ANSWER_FACT', response: 'unknown' })} />
      </div>
    </>
  );
}

function BridgePhase({ state, dispatch }) {
  const target = getCurrentTargetClaim(state);
  const argument = getCurrentArgument(state);
  const bridge = getCurrentBridge(state);
  const summary = factResponseSummary(state.pendingFactResponses);
  if (!argument || !bridge) return null;
  return (
    <>
      <PhaseHeading
        kicker="B · 规范原则（最小桥接原则要求明确写出的价值前提）"
        title="即使前面的事实都成立，你也接受下面这条“应该”原则吗？"
        copy="现在不再判断事实真假。这里要判断的是：这些事实为什么会给当前政策结论增加一项支持或反对理由。"
      />
      <ConceptHelp
        title="事实 F 与政策结论 V 之间，至少需要一条含有价值判断的 B。"
        example="F：措施能明显减少重伤，而且没有同样有效的较温和办法。V：国家应该采用它。中间还需要 B：满足这些条件时，减少重伤至少构成国家采用措施的一项理由。"
      >
        <p>接受 B 只表示它给 V 增加一项理由，不表示 V 已经得到最终证明。成本、权利、程序或其他价值仍可能提供更强的反对理由。</p>
      </ConceptHelp>
      <div className="inference-board">
        <div className="inference-column">
          <span className="inference-label fact">F · 事实</span>
          {argument.factIds.map((factId) => (
            <div key={factId} className="inference-item"><p>{facts[factId]?.statement}</p><em data-state={state.pendingFactResponses[factId]}>{truthLabels[state.pendingFactResponses[factId]]}</em></div>
          ))}
        </div>
        <div className="inference-symbol">＋</div>
        <div className="inference-column bridge-col">
          <span className="inference-label bridge">B · 规范原则</span>
          <div className="inference-item"><p>{bridge.text}</p></div>
        </div>
        <div className="inference-symbol support-arrow"><span>若前提成立，并且没有更强反对理由</span><b>⇝</b></div>
        <div className="inference-column"><span className="inference-label conclusion">V · 当前结论</span><div className="inference-item"><p>{target?.text}</p></div></div>
      </div>
      <div className="bridge-explanation-card">
        <span>这条原则具体增加了什么价值判断</span>
        <p>{bridge.explanation}</p>
        {bridge.example ? <div><b>具体例子：</b>{bridge.example}</div> : null}
      </div>
      {!summary.allTrue ? (
        <div className="notice warning"><Alert /><div><strong>这条理由的事实部分目前没有全部成立</strong><p>{summary.hasFalse ? '你认为至少一项事实是假的。' : ''}{summary.hasUnknown ? '你对至少一项事实目前不知道真假。' : ''} 你仍可以判断 B 本身是否可接受，但当前这条理由还不能实际支持政策结论。</p></div></div>
      ) : null}
      <div className="choice-stack compact">
        <Choice title="接受：这些事实确实给结论增加了一项理由" copy="这里只确认一项理由，不表示政策已经得到最终证明。" tone="support" onClick={() => dispatch({ type: 'ANSWER_BRIDGE', response: 'accept' })} />
        <Choice title="不接受：即使事实成立，也不能得到这项理由" copy="你可以承认事实是真的，但拒绝从这些事实走到这里写出的‘有理由’或‘应该’。" tone="oppose" onClick={() => dispatch({ type: 'ANSWER_BRIDGE', response: 'reject' })} />
        <Choice title="我现在无法判断是否接受这条原则" copy="系统把这一步记为未确定，不替你补上价值判断。" onClick={() => dispatch({ type: 'ANSWER_BRIDGE', response: 'uncertain' })} />
      </div>
    </>
  );
}

function DepthPhase({ state, dispatch }) {
  const last = state.currentChain?.steps.at(-1);
  const bridge = claims[last?.bridgeClaimId];
  const deeper = getArgumentsForClaim(last?.bridgeClaimId);
  return (
    <>
      <PhaseHeading
        kicker="继续追问刚才接受的规范原则 B"
        title="你为什么接受这条原则本身？"
        copy="B 不是事实，而是另一条含有‘应该’或‘有理由’的价值判断。因此它现在成为下一层需要说明的结论 V。"
      />
      <ConceptHelp
        title="每接受一条规范原则，都可以继续问一次“为什么”。"
        example="你接受“无害的个人选择应由本人决定”后，系统还会问：为什么个人应当决定自己的生活？你可能进一步回答“每个人都具有平等的个人决定资格”。"
      >
        <p>你也可以停止继续追问，但必须明确表示：你现在愿意直接接受这条原则，而不只是暂时想不到更深理由。</p>
      </ConceptHelp>
      <div className="bridge-focus"><span>B</span><div><strong>{bridge?.shortLabel}</strong><p>{bridge?.text}</p>{bridge?.explanation ? <small>{bridge.explanation}</small> : null}</div></div>
      <div className="epistemic-caution"><strong>“当前基本价值 G”只是本轮对话中的停止位置，不是客观公理。</strong><p>它表示：你现在愿意直接承担这条价值原则，不再用另一条价值判断支持它。以后出现新的理由或反例，你仍然可以修改。</p></div>
      <div className="choice-stack">
        <Choice title="我愿意把它作为本轮当前基本价值" copy="系统会再确认一次，并用相关条件相同、政治对象不同的案例检查它。" tone="support" onClick={() => dispatch({ type: 'SET_DEPTH', decision: 'fixed_point' })} />
        <Choice title="继续追问：它还依靠一条更深的价值原则" copy={deeper.length ? `题库准备了 ${deeper.length} 种更一般的说明方式。` : '题库目前没有更深路径，但你仍可以拒绝把它当作基础价值。'} onClick={() => dispatch({ type: 'SET_DEPTH', decision: 'deeper' })} />
        <Choice title="我还不能确定它是不是我的基本价值" copy="系统记录为未确定，不把‘目前说不出来’误写成价值基础。" onClick={() => dispatch({ type: 'SET_DEPTH', decision: 'uncertain' })} />
      </div>
    </>
  );
}

function TerminalConfirmPhase({ state, dispatch }) {
  const last = state.currentChain?.steps.at(-1);
  const candidateId = state.currentChain?.terminal?.claimId || last?.bridgeClaimId;
  const terminalClaim = claims[candidateId];
  const deeper = getArgumentsForClaim(candidateId);
  return (
    <>
      <PhaseHeading
        kicker="确认当前基本价值 G"
        title="你是真的直接接受这条原则，还是只是暂时想不到更深理由？"
        copy={deeper.length
          ? `题库仍有 ${deeper.length} 种更深的说明方式。只有你明确愿意直接承担这条原则，系统才把它记录为当前基本价值。`
          : '题库没有准备更深路径，不等于你的理由已经到达最基础处。请明确区分“我直接接受”和“我暂时回答不出来”。'}
      />
      <ConceptHelp
        title="基础价值必须由你明确确认，不能由系统根据答题困难自动推断。"
        example="“我不知道为什么反对任意权力”与“即使没有更深原则，我仍直接接受任意权力应受限制”是两种不同状态。只有后一种才会被记录为 G。"
      >
        <p>这里确认的是你当前愿意承担的规范起点，不是永远不能改变的真理，也不是系统替你发现的客观价值。</p>
      </ConceptHelp>
      <div className="terminal-focus candidate"><span>G?</span><div><strong>{terminalClaim?.shortLabel}</strong><p>{terminalClaim?.text}</p>{terminalClaim?.explanation ? <small>{terminalClaim.explanation}</small> : null}</div></div>
      <div className="choice-stack compact">
        <Choice title="确认：即使没有更深的规范原则，我现在仍接受它" copy="把它记录为本轮当前基本价值，然后检查它在相似案例中是否仍然适用。" tone="support" onClick={() => dispatch({ type: 'CONFIRM_TERMINAL', response: 'accept' })} />
        {deeper.length ? <Choice title="不停止，继续追问更深理由" copy="让这条 B 成为下一层需要说明的 V。" onClick={() => dispatch({ type: 'CONFIRM_TERMINAL', response: 'continue' })} /> : null}
        <Choice title="不确认：我不愿直接接受这条原则" copy="保留前面的回答，但把这条理由记录为目前没有说明完整。" tone="oppose" onClick={() => dispatch({ type: 'CONFIRM_TERMINAL', response: 'reject' })} />
        <Choice title="我只是暂时想不到更深理由" copy="记录为未确定，不把回答困难误写成基本价值。" onClick={() => dispatch({ type: 'CONFIRM_TERMINAL', response: 'uncertain' })} />
      </div>
    </>
  );
}

function StressPhase({ state, dispatch }) {
  const claimId = state.currentChain?.terminal?.claimId;
  const claim = claims[claimId];
  const generic = {
    scenario: '把原政策中的人物或群体换成一个你通常持不同态度的对象，同时保持这条原则提到的相关事实条件不变。',
    question: '在这些相关条件不变时，你仍愿意使用同一条原则吗？',
    distinctions: ['风险程度实际不同', '存在限制更小的替代办法', '受影响的人或同意条件不同'],
  };
  const stress = claim?.stressTest || generic;
  return (
    <>
      <PhaseHeading
        kicker="检查原则在相似条件下是否仍适用"
        title="换一个你可能更喜欢或更不喜欢的对象，你还会使用同一条原则吗？"
        copy="这不是要求你在所有案例中机械地给出同一答案。你可以提出例外，但需要说明：新案例在哪一项与原则有关的事实条件上不同。"
      />
      <ConceptHelp
        title="这一步检查你接受的是一般原则，还是只接受它在原对象上的结论。"
        example="如果你接受“没有明确规则和独立监督的权力应受限制”，系统会把掌权者换成你更信任的人。若你不再要求限制，就需要说明：信任之外，究竟是哪项与原则有关的事实发生了变化。"
      >
        <p>人物身份、党派或个人好恶本身不自动构成相关差别。风险程度、是否同意、是否有替代方案、是否存在独立监督等条件，才可能真正改变原则的适用。</p>
      </ConceptHelp>
      <div className="stress-layout">
        <div className="stress-principle"><span>你刚确认的暂定基础价值 G</span><p>{claim?.text}</p></div>
        <div className="stress-case"><span>新案例</span><p>{stress.scenario}</p><strong>{stress.question}</strong></div>
      </div>
      <div className="choice-stack compact">
        <Choice title="仍然适用这条原则" copy="对象改变了，但与原则有关的事实条件没有改变。" tone="support" onClick={() => dispatch({ type: 'ANSWER_STRESS', response: 'apply' })} />
        {stress.distinctions.map((distinction) => (
          <Choice key={distinction} title={`需要补充条件：${distinction}`} copy="你认为这项事实差别会改变原则是否适用，系统会把它写入适用范围。" onClick={() => dispatch({ type: 'ANSWER_STRESS', response: 'qualified_exception', distinction })} />
        ))}
        <Choice title="我不愿适用，但目前说不出哪项相关条件不同" copy="系统会记录：这条原则的适用范围目前没有说明清楚。" tone="warning" onClick={() => dispatch({ type: 'ANSWER_STRESS', response: 'unexplained_exception' })} />
        <Choice title="这个案例使我撤回这条原则" copy="它不再作为当前基本价值，这条政策理由也不再算作完整。" tone="oppose" onClick={() => dispatch({ type: 'ANSWER_STRESS', response: 'retract' })} />
        <Choice title="我目前无法判断是否适用" copy="记录为适用范围尚未确定。" onClick={() => dispatch({ type: 'ANSWER_STRESS', response: 'uncertain' })} />
      </div>
    </>
  );
}

function BrokenPhase({ state, dispatch }) {
  const candidates = getArgumentsForClaim(state.currentTargetClaimId);
  return (
    <>
      <PhaseHeading
        kicker="这条理由在这里停止"
        title="当前选择的理由还不能继续支持结论。"
        copy="系统不会因为你已经选择了政策立场，就替你补上一项你没有接受的事实或规范原则。"
      />
      <div className="notice danger"><X /><div><strong>{state.breakReason}</strong><p>你可以改用另一条实际理由，重新考虑政策立场，或者把这里保存为尚未解决。</p></div></div>
      <div className="choice-stack compact">
        {candidates.length > 1 ? <Choice title="换一条不同的理由重新检查" copy="保留这次停止记录，再选择另一组事实和规范原则。" onClick={() => dispatch({ type: 'RESOLVE_BREAK', resolution: 'alternate_argument' })} /> : null}
        <Choice title="回到最初，重新考虑政策立场" copy="你可以改为支持、反对或目前没有结论。" onClick={() => dispatch({ type: 'RESOLVE_BREAK', resolution: 'revise_stance' })} />
        <Choice title="承认这条理由目前没有说明完整，然后继续" copy="保存停止位置，不强迫你得到一个完整答案。" onClick={() => dispatch({ type: 'RESOLVE_BREAK', resolution: 'unresolved' })} />
      </div>
    </>
  );
}

function CompletePhase({ state, dispatch }) {
  const policy = getCurrentPolicy(state);
  const status = state.currentChain?.status || 'unresolved';
  const meta = chainStatus[status];
  const isLast = state.policyIndex === policies.length - 1;
  const terminal = state.currentChain?.terminal;
  const terminalConfirmed = terminal?.status === 'provisional_fixed_point';
  return (
    <>
      <PhaseHeading kicker="这项政策的本轮检查结束" title={meta.title} copy={meta.copy} />
      <div className={`completion-mark ${meta.tone}`}>
        <span>{status === 'complete' ? <Check size={30} /> : <Alert size={30} />}</span>
        <div><strong>{policy.title}</strong><p>{claims[state.currentChain?.targetClaimId]?.text || policy.proposition}</p></div>
      </div>
      {state.currentChain?.unresolvedReason ? (
        <div className="notice neutral completion-reason"><Alert /><div><strong>这次具体停在这里</strong><p>{state.currentChain.unresolvedReason}</p></div></div>
      ) : null}
      {terminal ? (
        <div className={`terminal-summary ${terminalConfirmed ? '' : 'unconfirmed'}`}>
          <span>{terminalConfirmed ? '这条理由确认的当前基本价值 G' : '这条理由停下时尚未确认的规范原则'}</span>
          <p>{claims[terminal.claimId]?.text}</p>
        </div>
      ) : null}
      <div className="choice-stack compact">
        <Choice title={isLast ? '进入不同价值之间的两难选择' : '继续下一项政策'} copy={isLast ? '系统只会比较你已经明确确认的基本价值，并且只记录具体情境中的取舍。' : '从另一个具体政策开始一条新的理由链。'} tone="support" onClick={() => dispatch({ type: 'NEXT_POLICY' })} />
        <Choice title="用同一政策立场再检查一条不同理由" copy="保留本次记录，再检查另一种事实和价值组合。" onClick={() => dispatch({ type: 'RETRY_POLICY' })} />
      </div>
    </>
  );
}

function QuestionSurface({ state, dispatch }) {
  const policy = getCurrentPolicy(state);
  switch (state.phase) {
    case PHASES.STANCE: return <StancePhase policy={policy} dispatch={dispatch} />;
    case PHASES.DIRECTION: return <DirectionPhase dispatch={dispatch} />;
    case PHASES.ARGUMENT: return <ArgumentPhase state={state} dispatch={dispatch} />;
    case PHASES.FACT: return <FactPhase state={state} dispatch={dispatch} />;
    case PHASES.BRIDGE: return <BridgePhase state={state} dispatch={dispatch} />;
    case PHASES.DEPTH: return <DepthPhase state={state} dispatch={dispatch} />;
    case PHASES.TERMINAL_CONFIRM: return <TerminalConfirmPhase state={state} dispatch={dispatch} />;
    case PHASES.STRESS: return <StressPhase state={state} dispatch={dispatch} />;
    case PHASES.CONFLICT: return <ConflictPhase state={state} dispatch={dispatch} />;
    case PHASES.BROKEN: return <BrokenPhase state={state} dispatch={dispatch} />;
    case PHASES.POLICY_COMPLETE: return <CompletePhase state={state} dispatch={dispatch} />;
    default: return null;
  }
}

export default function Assessment({ state, dispatch }) {
  const policy = getCurrentPolicy(state);
  const phaseKey = useMemo(() => `${state.policyIndex}:${state.phase}:${state.currentArgumentId || ''}:${state.currentFactIndex}`, [state.policyIndex, state.phase, state.currentArgumentId, state.currentFactIndex]);
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [phaseKey]);
  return (
    <main className="assessment-shell">
      <PolicyRailV2 state={state} />
      <section key={phaseKey} className="question-surface">
        <div className="mobile-policy-name">{policy?.number} · {policy?.title}</div>
        <QuestionSurface state={state} dispatch={dispatch} />
        <ProofView state={state} compact />
      </section>
      <ProofView state={state} />
    </main>
  );
}
