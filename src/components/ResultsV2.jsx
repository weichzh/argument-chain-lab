import React, { useMemo, useState } from 'react';
import {
  Check,
  Download,
  Info,
  ListChecks,
  LogOut,
  Send,
  ShieldCheck,
} from 'lucide-react';
import {
  argumentsById,
  assessmentModes,
  claims,
  dilemmas,
  facts,
  ideologyBenchmarks,
  getPolicyElements,
  policies,
} from '../data/model.js';
import {
  buildContributionPackage,
  contributionEligibility,
} from '../lib/contribution.js';
import { exportSession, sessionSummary } from '../lib/engine.js';
import {
  buildArgumentType,
  matchIdeologyProfiles,
  profilePositionForPolicy,
} from '../lib/ideology.js';

const statusCopy = {
  complete: '本条理由链已闭合',
  conditional: '条件性闭合',
  tension: '仍有张力',
  unresolved: '尚未完成',
};

const factResponseCopy = {
  true: '成立',
  false: '不成立',
  unknown: '不能判断',
};

const factResponseLabel = (response, assessmentMode) => (
  assessmentMode === 'conditional_scenario'
    ? { true: '作为题设采用', false: '不采用这项题设', unknown: '暂不采用' }[response]
    : factResponseCopy[response]
);

const bridgeResponseCopy = {
  accept: '接受',
  reject: '拒绝',
  uncertain: '暂时不能判断',
};

const fixedPointCopy = {
  confirmed: '已确认',
  rejected: '已拒绝',
  retracted: '压力测试后撤回',
  unconfirmed: '未确认',
};
const lifecycleCopy = {
  active: '当前有效',
  orphaned: '链条修订后已孤立',
  superseded: '已被后续事件取代',
};

const originCopy = (argument, modelVersion) => {
  if (argument?.origin === 'session_overlay') return '本轮 AI 会话扩展';
  if (argument?.origin === 'community') return '公开贡献题库';
  return `正式题库 ${modelVersion}`;
};

const formalStatusCopy = (check) => {
  if (!check || check.inferenceStatus === 'not_formalized') return '尚未形式化';
  if (check.errors?.length) return '推理结构需修正';
  if (check.openCriticalQuestions?.length) return '结构合格，仍有待核问题';
  return '推理结构合格';
};

const downloadJson = (filename, value) => {
  const url = URL.createObjectURL(new Blob(
    [`${JSON.stringify(value, null, 2)}\n`],
    { type: 'application/json;charset=utf-8' },
  ));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const stanceCopy = { support: '支持', oppose: '反对', undecided: '未定', conditional: '有条件' };
const componentCopy = { support: '赞成', oppose: '反对', conditional: '需调整', undecided: '未判断' };
const safeguardCopy = { required: '必须有', preferred: '最好有', not_required: '不需要', uncertain: '未判断' };
const parameterCopy = { accept: '接受', adjust: '需调整', reject: '不接受', uncertain: '未判断' };
const modeStanceCopy = (stance, mode) => `${mode === 'conditional_scenario' ? '题设内' : '现实判断'}：${stanceCopy[stance] || '未定'}`;
const policyElementResponse = (record, element) => {
  if (element.kind === 'policy_choice') return componentCopy[record.policyChoiceResponses?.[element.id]];
  if (element.kind === 'safeguard') return safeguardCopy[record.safeguardResponses?.[element.id]];
  if (element.kind === 'parameter') return parameterCopy[record.parameterResponses?.[element.id]];
  return '题设固定条件';
};
const relationFamily = (response) => response?.startsWith('left_') ? 'left' : response?.startsWith('right_') ? 'right' : response;
const stressCopy = {
  apply: '相似案例仍适用',
  qualified_exception: '范围待修订',
  unexplained_exception: '例外未解释',
  retract: '压力测试后撤回',
  uncertain: '边界未定',
};

function LineageGraph({ state, chains, selectedId, onSelect }) {
  return (
    <section className="lineage-section" aria-labelledby="lineage-title">
      <header>
        <span>正式结果</span>
        <h2 id="lineage-title">论证谱系</h2>
        <p>先显示政策包、首要理由与本轮暂定出发点；选择一行可展开完整 F + B ⇝ V。</p>
      </header>
      <div className="lineage-axis" aria-hidden="true"><span>政策拆分</span><span>首要理由</span><span>暂定出发点</span><span>反例边界</span></div>
      <div className="lineage-rows">
        {chains.map((chain) => {
          const policy = policies.find((item) => item.id === chain.policyId);
          const record = state.records[chain.policyId] || {};
          const firstArgument = argumentsById[chain.steps?.[0]?.argumentId];
          const reason = claims[firstArgument?.reasonFamilyId || firstArgument?.bridgeClaimId];
          const terminal = claims[chain.terminal?.claimId];
          const positions = Object.values(record.policyChoiceResponses || {});
          const before = record.packageStanceBeforeDefeater || record.direction || record.stance;
          const after = record.packageStanceAfterDefeater || record.stance;
          const effect = chain.defeaterReview?.effect || chain.defeaterReview?.impact;
          return (
            <button
              className={`lineage-row${selectedId === chain.id ? ' selected' : ''}`}
              type="button"
              key={chain.id}
              onClick={() => onSelect(chain.id)}
              aria-pressed={selectedId === chain.id}
            >
              <span className="lineage-node policy-node"><b className="node-shape policy">P</b><strong>{policy?.shortTitle || policy?.title}</strong><small>整包：{stanceCopy[before] || '未定'} → {stanceCopy[after] || '未定'} · {positions.filter((value) => value === 'support').length} 赞成 / {positions.filter((value) => value === 'oppose').length} 反对</small></span>
              <i aria-hidden="true">→</i>
              <span className="lineage-node reason-node"><b className="node-shape bridge">B</b><strong>{reason?.shortLabel || firstArgument?.title || '理由未闭合'}</strong><small>用户选择的首要理由</small></span>
              <i aria-hidden="true">→</i>
              <span className="lineage-node fixed-node"><b className="node-shape fixed">G</b><strong>{terminal?.shortLabel || '没有暂定出发点'}</strong><small>{statusCopy[chain.status] || chain.status}</small></span>
              <i className={chain.status === 'conditional' ? 'conditional' : chain.status === 'tension' ? 'tension' : ''} aria-hidden="true">→</i>
              <span className="lineage-node stress-node"><b className="node-shape stress">!</b><strong>{stressCopy[chain.stress?.response] || '尚未检验'}</strong><small>{chain.defeaterReview ? `反方：${({ supplement: '补充条件', weaken: '削弱但不改立场', offset: '抵消并转为未定', outweigh: '压过并反转', reject: '未接受', none_accepted: '无可接受项' })[effect] || '已复核'}` : '反方尚未复核'}</small></span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

const activeRecordChains = (record) => (record?.chains || []).filter((chain) => chain.matchingStatus === 'active');

const prototypeCell = (profile, variant, policy) => {
  const position = profilePositionForPolicy(profile, variant, policy);
  return {
    stance: position?.stance,
    reason: variant.primaryReasons?.[policy.id],
    fixedPoint: variant.fixedPoints?.[policy.id],
    stress: variant.stressBoundaries?.[policy.id],
    basis: position,
  };
};

function SameAnswerMatrix({ state, matching }) {
  const comparisons = matching.matches.slice(0, 2);
  const rows = policies.filter((policy) => policy.origin !== 'community' && policy.origin !== 'session_overlay' && activeRecordChains(state.records[policy.id]).length);
  if (!rows.length || comparisons.length < 2) return null;
  const userCell = (policy) => {
    const record = state.records[policy.id];
    const chain = activeRecordChains(record).at(-1);
    const argument = argumentsById[chain.steps?.[0]?.argumentId];
    return {
      stance: record.packageStanceAfterDefeater || record.stance,
      reason: argument?.reasonFamilyId || argument?.bridgeClaimId,
      fixedPoint: chain.terminal?.claimId,
      stress: chain.stress?.response,
      basis: { basis: 'user_confirmed', confidence: 'high' },
    };
  };
  const renderCell = (cell) => (
    <span className="matrix-cell-copy">
      <b>{stanceCopy[cell.stance] || '未回答'}</b>
      <span>{claims[cell.reason]?.shortLabel || '理由未覆盖'}</span>
      <span>{claims[cell.fixedPoint]?.shortLabel || '暂定出发点未覆盖'}</span>
      <small>{stressCopy[cell.stress] || '范围未记录'}</small>
      {cell.basis ? <small>依据：{({ explicit: '来源明确陈述', reconstruction: '保守重建', user_confirmed: '用户确认' })[cell.basis.basis] || cell.basis.basis} · {({ high: '高', medium: '中', low: '低' })[cell.basis.confidence] || cell.basis.confidence}</small> : null}
    </span>
  );
  return (
    <section className="reason-matrix" aria-labelledby="reason-matrix-title">
      <header><span>同答异因</span><h3 id="reason-matrix-title">相同政策答案，不等于相同论证</h3></header>
      <div className="matrix-scroll">
        <table>
          <thead><tr><th>政策</th><th>你的路径</th>{comparisons.map(({ profile }) => <th key={profile.id}>{profile.displayName}</th>)}</tr></thead>
          <tbody>
            {rows.map((policy) => {
              const user = userCell(policy);
              return (
                <tr key={policy.id}>
                  <th data-label="政策">{policy.shortTitle || policy.title}</th>
                  <td data-label="你的路径">{renderCell(user)}</td>
                  {comparisons.map(({ profile, variant }) => {
                    const cell = prototypeCell(profile, variant || {}, policy);
                    const sameAnswerDifferentReason = cell.stance === user.stance && cell.reason && user.reason && cell.reason !== user.reason;
                    return <td data-label={profile.displayName} className={sameAnswerDifferentReason ? 'same-answer-different-reason' : ''} key={profile.id}>{renderCell(cell)}</td>;
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PrototypeOverlay({ state }) {
  const [enabled, setEnabled] = useState(false);
  const matching = useMemo(() => matchIdeologyProfiles(state), [state]);
  const argumentType = useMemo(() => buildArgumentType(state, matching), [state, matching]);
  const top = matching.matches[0];
  const second = matching.matches[1];
  const answered = policies.filter((policy) => activeRecordChains(state.records[policy.id]).length);
  const sameStanceGroup = matching.matches.filter(({ profile, variant }) => answered.every((policy) => (
    profilePositionForPolicy(profile, variant || {}, policy)?.stance === (state.records[policy.id]?.packageStanceAfterDefeater || state.records[policy.id]?.stance)
  ))).length;
  const unique = matching.presentation === 'unique';
  const insufficient = matching.presentation === 'insufficient';
  return (
    <section className="prototype-overlay" aria-labelledby="prototype-title">
      <header>
        <div><span>可选娱乐层</span><h2 id="prototype-title">最近邻论证原型</h2></div>
        <label className="prototype-toggle"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} /><span>启用基准匹配</span></label>
      </header>
      {!enabled ? <p className="overlay-closed"><Info size={17} />正式报告不会把政策答案转换成政治身份；这里由你选择是否叠加可解释的最近邻基准。</p> : (
        <>
          <div className="prototype-summary">
            <div><small>{unique ? '基准库中唯一最近邻' : insufficient ? '当前结论' : '当前接近的原型家族'}</small><strong>{unique ? top?.profile.displayName : insufficient ? '覆盖不足，暂不生成历史标签' : '前三名仍需并列保留'}</strong><span>{unique ? `路径相似度 ${top?.similarity || 0}` : `已比较覆盖度 ${matching.coverage}`}</span></div>
            <dl>
              <dt>与第二名差距</dt><dd>{matching.gap}</dd>
              <dt>当前覆盖度</dt><dd>{matching.coverage}</dd>
              <dt>稳定性</dt><dd>{matching.stability}</dd>
            </dl>
          </div>
          <div className="reveal-layers">
            <div><b>1</b><span>政策外观</span><strong>只看已答政策，你与 {sameStanceGroup || '少量'} 个原型处于同一回答组。</strong></div>
            <div><b>2</b><span>理由内核</span><strong>{insufficient ? '有效理由链或有依据的基准项还不够，系统不会选出单一历史标签。' : `加入理由与暂定出发点后，当前前两名为 ${top?.profile.displayName}、${second?.profile.displayName}。`}</strong></div>
            <div><b>3</b><span>反例边界</span><strong>压力测试只比较已经完成且当前有效的路径；张力、撤回和题库缺口不增加覆盖度。</strong></div>
          </div>
          {!insufficient ? <div className="argument-type">
            <small>你的唯一化论证型</small><strong>{argumentType.label}</strong><code>{argumentType.code}</code>
          </div> : null}
          {!insufficient ? <ol className="prototype-list">
            {matching.matches.slice(0, unique ? 5 : 3).map((match, index) => (
              <li key={match.profile.id}><b>{index + 1}</b><span><strong>{match.profile.displayName}</strong><small>{match.variant?.source?.label}</small></span><em>{match.similarity}</em></li>
            ))}
          </ol> : <p className="overlay-closed"><Info size={17} />至少需要更多当前有效的理由链，以及基准库中有来源依据的可比较项目；标签启发式不会被拿来补分。</p>}
          {!insufficient ? <SameAnswerMatrix state={state} matching={matching} /> : null}
          <p className="benchmark-disclaimer">{ideologyBenchmarks.disclaimer}</p>
        </>
      )}
    </section>
  );
}

function ArgumentPreview({ chain }) {
  if (!chain) return <p className="empty-state">本轮还没有可预览的论证。</p>;
  return (
    <div className="argument-preview">
      {chain.steps.map((step, index) => {
        const argument = argumentsById[step.argumentId];
        return (
          <section className="preview-step" key={step.id}>
            <header><span>第 {index + 1} 层</span><h2>{claims[step.targetClaimId]?.text}</h2></header>
            <div className="preview-premises">
              {(argument?.factIds || []).map((factId) => (
                <div className="preview-node fact" key={factId}>
                  <span>F</span>
                  <p>{facts[factId]?.statement}</p>
                  <em>{factResponseLabel(step.factResponses?.[factId], step.assessmentMode)}</em>
                </div>
              ))}
              <div className="preview-operator">＋</div>
              <div className="preview-node bridge">
                <span>B</span>
                <p>{claims[step.bridgeClaimId]?.text}</p>
                <em>{step.bridgeResponse === 'accept' ? '接受' : '未接受'}</em>
              </div>
            </div>
            <div className="preview-support">这些前提为上面的结论增加一项可反驳的理由</div>
          </section>
        );
      })}
      {chain.terminal ? (
        <section className="preview-fixed-point">
          <span>G · 本轮暂定出发点</span>
          <h2>{claims[chain.terminal.claimId]?.text}</h2>
          <p>{claims[chain.terminal.claimId]?.explanation}</p>
          <div><strong>压力测试</strong><span>{chain.stress?.response === 'apply' ? '在结构相似案例中仍然适用' : chain.stress?.distinction || '已完成检验'}</span></div>
        </section>
      ) : null}
    </div>
  );
}

const terminalStatus = {
  provisional_fixed_point: 'confirmed',
  rejected_as_fixed_point: 'rejected',
  retracted_after_stress: 'retracted',
  unconfirmed: 'unconfirmed',
};

function MechanicalReport({ state, chains }) {
  const analysis = useMemo(() => sessionSummary(state), [state]);
  const events = state.fixedPointEvents || [];
  const eventKeys = new Set(events.map((event) => `${event.chainId}:${event.status}`));
  const fixedPoints = [
    ...events,
    ...chains.flatMap((chain) => {
      const status = terminalStatus[chain.terminal?.status];
      if (!status || eventKeys.has(`${chain.id}:${status}`)) return [];
      return [{
        id: `derived_${chain.id}_${status}`,
        policyId: chain.policyId,
        chainId: chain.id,
        claimId: chain.terminal.claimId,
        status,
        lifecycle: 'active',
      }];
    }),
  ];
  const relationRows = state.dilemmaQueue.map((id) => {
    const item = dilemmas.find((entry) => entry.id === id);
    if (!item) return null;
    const response = state.dilemmaResponses[id]?.response;
    const left = claims[item.left]?.shortLabel || claims[item.left]?.text || item.left;
    const right = claims[item.right]?.shortLabel || claims[item.right]?.text || item.right;
    const sensitivity = state.dilemmaResponses[id]?.sensitivity || {};
    const changed = Object.values(sensitivity).some((value) => relationFamily(value) !== relationFamily(response));
    if (response === 'left_strong') return { id, left, symbol: '≻', right, note: changed ? '明显优先 · 幅度变化时会翻转' : '明显优先' };
    if (response === 'left_slight') return { id, left, symbol: '→', right, note: changed ? '略微优先 · 幅度变化时会翻转' : '略微优先' };
    if (response === 'right_strong') return { id, left: right, symbol: '≻', right: left, note: changed ? '明显优先 · 幅度变化时会翻转' : '明显优先' };
    if (response === 'right_slight') return { id, left: right, symbol: '→', right: left, note: changed ? '略微优先 · 幅度变化时会翻转' : '略微优先' };
    if (response === 'equal') return { id, left, symbol: '≈', right, note: changed ? '同等重要 · 幅度变化时会翻转' : '本题中同等重要' };
    if (response === 'depends_on_context') return { id, left, symbol: '⋯', right, note: '取决于尚未说明的条件' };
    if (response === 'incomparable') return { id, left, symbol: '—', right, note: '本题中不可通约' };
    if (response === 'undecided') return { id, left, symbol: '?', right, note: '用户暂时无法判断' };
    return { id, left, symbol: '—', right, note: '未回答' };
  }).filter(Boolean);

  return (
    <section className="mechanical-report" aria-labelledby="mechanical-report-title">
      <header className="report-header">
        <span>协议输出</span>
        <h2 id="mechanical-report-title">本轮机械报告</h2>
        <p>只列出已记录的命题、回答、本轮暂定出发点和局部关系，不生成政治身份诊断或价值总分。</p>
      </header>

      <div className="report-summary" aria-label="论证状态汇总">
        {['complete', 'conditional', 'tension', 'unresolved'].map((status) => (
          <div key={status}><strong>{chains.filter((chain) => chain.status === status).length}</strong><span>{statusCopy[status]}</span></div>
        ))}
      </div>

      <section className="report-block">
        <h3>政策拆分、整包判断与取舍</h3>
        <div className="package-report-list">
          {policies.filter((policy) => state.records[policy.id]?.chains?.length).map((policy) => {
            const record = state.records[policy.id];
            const elements = getPolicyElements(policy);
            const before = record.packageStanceBeforeDefeater || record.direction || record.stance;
            const after = record.packageStanceAfterDefeater || record.stance;
            return (
              <details key={policy.id}>
                <summary><span>{policy.shortTitle || policy.title}</span><strong>{stanceCopy[before] || '未定'} → {stanceCopy[after] || '未定'}{record.packageConflict ? ' · 包内冲突' : ''}</strong></summary>
                {elements.length ? <dl>
                  {elements.map((element) => (
                    <React.Fragment key={element.id}>
                      <dt><span>{({ scenario_condition: '固定情景', policy_choice: '政策选择', safeguard: '保障', parameter: '参数' })[element.kind]}</span>{element.label}</dt>
                      <dd>{policyElementResponse(record, element) || '未回答'}{record.elementNotes?.[element.id] ? ` · ${record.elementNotes[element.id]}` : ''}{record.componentTradeoffs?.[element.id] ? ` · ${{ required: '必须保留', tradeable: '可交换', neutral: '不参与交换' }[record.componentTradeoffs[element.id]]}` : ''}</dd>
                    </React.Fragment>
                  ))}
                </dl> : <p className="empty-state">这份论证没有政策元素拆分；只展示其论证结构，不纳入意识形态匹配。</p>}
              </details>
            );
          })}
        </div>
      </section>

      <section className="report-block">
        <h3>F + B ⇝ V 与事实信条</h3>
        {chains.length ? chains.map((chain) => (
          <details className="report-chain" key={chain.id}>
            <summary>
              <span>{policies.find((policy) => policy.id === chain.policyId)?.title || chain.policyId}</span>
              <strong>{statusCopy[chain.status] || chain.status}</strong>
            </summary>
            {chain.steps.map((step, stepIndex) => {
              const argument = argumentsById[step.argumentId];
              return (
                <div className="report-step" key={step.id}>
                  <div className="report-step-heading">
                    <strong>第 {stepIndex + 1} 层</strong>
                    <span>来源：{originCopy(argument, state.modelVersion)}</span>
                  </div>
                  {(argument?.factIds || []).map((factId) => (
                    <div className="report-proposition" key={factId}>
                      <b>F</b>
                      <div>
                        <p>{facts[factId]?.statement}</p>
                        <dl>
                          <dt>回答</dt><dd>{factResponseLabel(step.factResponses?.[factId], step.assessmentMode) || '未回答'}</dd>
                          <dt>成立条件</dt><dd>{facts[factId]?.plainTruthConditions || facts[factId]?.truthConditions}</dd>
                          <dt>否定条件</dt><dd>{facts[factId]?.plainFalsifier || facts[factId]?.falsifier}</dd>
                          <dt>情景</dt><dd>{facts[factId]?.scenarioProfile || '未标注'}</dd>
                          <dt>证据状态</dt><dd>{facts[factId]?.sourceStatus === 'stipulated_scenario' ? '题设条件' : '现实证据待核实'}</dd>
                          {Object.keys(step.factSensitivity?.[factId] || {}).length ? <><dt>阈值测试</dt><dd>{Object.entries(step.factSensitivity[factId]).map(([scenario, response]) => `${scenario}：${{ sufficient: '仍足够', insufficient: '不足', uncertain: '未定' }[response]}`).join('；')}</dd></> : null}
                        </dl>
                      </div>
                    </div>
                  ))}
                  <div className="report-proposition">
                    <b>B</b>
                    <div><p>{claims[step.bridgeClaimId]?.text}</p><small>回答：{bridgeResponseCopy[step.bridgeResponse] || '未回答'}</small></div>
                  </div>
                  <div className="report-proposition">
                    <b>V</b>
                    <div><p>{claims[step.targetClaimId]?.text}</p><small>链条方向：{chain.direction === 'support' ? '支持' : chain.direction === 'oppose' ? '反对' : '未决定'}</small></div>
                  </div>
                  <details className="formal-check-details">
                    <summary>形式检查：{formalStatusCopy(step.formalCheck)}</summary>
                    <dl>
                      <dt>前提状态</dt><dd>{({ established: '当前回答已建立', rejected: '当前回答未建立', undetermined: '仍有未定回答', not_evaluated: '尚未检查' })[step.formalCheck?.evidenceStatus] || '尚未检查'}</dd>
                      <dt>辩证状态</dt><dd>{step.formalCheck?.dialecticalStatus === 'undecided' ? '竞争理由尚未裁定' : '尚未评估竞争理由'}</dd>
                    </dl>
                    {step.formalCheck?.errors?.length ? <ul>{step.formalCheck.errors.map((issue) => <li key={`${issue.code}-${issue.path}`}>{issue.message}</li>)}</ul> : null}
                    {step.formalCheck?.warnings?.length ? <ul>{step.formalCheck.warnings.map((issue) => <li key={`${issue.code}-${issue.path}`}>{issue.message}</li>)}</ul> : null}
                  </details>
                </div>
              );
            })}
            {chain.defeaterReview ? (
              <div className="report-defeater">
                <strong>最强反方复核</strong>
                <p>{chain.defeaterReview.argumentId ? argumentsById[chain.defeaterReview.argumentId]?.title : '题库中没有用户认为成立的反方理由'}</p>
                {Object.entries(chain.defeaterReview.factResponses || {}).length ? <ul>{Object.entries(chain.defeaterReview.factResponses).map(([factId, response]) => <li key={factId}>{facts[factId]?.statement || factId}：{factResponseCopy[response] || response}</li>)}</ul> : null}
                {chain.defeaterReview.bridgeClaimId ? <small>判断依据：{bridgeResponseCopy[chain.defeaterReview.bridgeResponse] || '未回答'} · {claims[chain.defeaterReview.bridgeClaimId]?.text}</small> : null}
                <small>影响：{({ supplement: '补充限制，立场不变', weaken: '削弱原理由，立场不变', offset: '正反抵消，整包立场转为未定', outweigh: '反方压过原理由，整包立场反转', reject: '核对后不接受', none_accepted: '没有可接受项' })[chain.defeaterReview.effect || chain.defeaterReview.impact] || '已复核'}；整包 {stanceCopy[chain.defeaterReview.stanceBefore] || '未定'} → {stanceCopy[chain.defeaterReview.stanceAfter] || '未定'}</small>
              </div>
            ) : null}
          </details>
        )) : <p className="empty-state">本轮没有形成论证链。</p>}
      </section>

      <section className="report-block">
        <h3>本轮暂定出发点与修订历史</h3>
        {fixedPoints.length ? (
          <ul className="report-list">
            {fixedPoints.map((event) => (
              <li key={event.id}>
                <strong>{fixedPointCopy[event.status] || event.status}</strong>
                <span>{claims[event.claimId]?.text || event.claimId}</span>
                <small>{policies.find((policy) => policy.id === event.policyId)?.title || event.policyId} · {lifecycleCopy[event.lifecycle] || event.lifecycle || '当前有效'}{event.invalidatedByConflictId ? ` · 冲突 ${event.invalidatedByConflictId}` : ''}</small>
              </li>
            ))}
          </ul>
        ) : <p className="empty-state">本轮没有提名或确认暂定出发点。</p>}
      </section>

      <section className="report-block">
        <h3>冲突、缺口、例外与条件</h3>
        {analysis.tensions.length ? (
          <ul className="report-list">
            {analysis.tensions.map((item) => <li key={item.id}><strong>{item.title}</strong><span>{item.detail}</span></li>)}
          </ul>
        ) : <p className="empty-state">本轮没有记录这些未解决项。</p>}
      </section>

      <section className="report-block">
        <h3>两难题的局部价值关系</h3>
        {relationRows.length ? (
          <div className="relation-graph">
            {relationRows.map((row) => <div key={row.id}><strong>{row.left}</strong><b>{row.symbol}</b><strong>{row.right}</strong><span>{row.note}</span></div>)}
          </div>
        ) : <p className="empty-state">本轮没有满足双端点条件的两难题。</p>}
        {analysis.priority.cycles.length ? <p className="cycle-note">检测到循环：{analysis.priority.cycles.map((cycle) => cycle.map((id) => claims[id]?.shortLabel || id).join(' → ')).join('；')}</p> : null}
      </section>
    </section>
  );
}

export default function ResultsV2({ state, dispatch, bankClient }) {
  const chains = useMemo(() => Object.values(state.records).flatMap((record) => record.chains || []), [state.records]);
  const [selectedId, setSelectedId] = useState(() => (
    state.selectedChainId || chains.find((chain) => chain.status === 'complete')?.id || chains[0]?.id || null
  ));
  const [consent, setConsent] = useState(false);
  const [submitState, setSubmitState] = useState({ loading: false, success: null, error: null });
  const selected = chains.find((chain) => chain.id === selectedId) || chains[0] || null;
  const eligibility = contributionEligibility(state, selected);
  const contribution = buildContributionPackage(state, selected);
  const selectedPolicy = policies.find((policy) => policy.id === selected?.policyId);
  const finishedPolicies = policies.filter((policy) => state.records[policy.id]?.chains?.length).length;
  const inProgressPolicies = policies.filter((policy) => state.records[policy.id]?.draft).length;

  const submit = async () => {
    if (!consent || !contribution.ok || !bankClient.configured) return;
    setSubmitState({ loading: true, success: null, error: null });
    try {
      const result = await bankClient.contribute(contribution.value);
      setSubmitState({
        loading: false,
        success: result.duplicate ? '这份论证已经在候选区中，无需重复提交。' : '已进入公开审核候选区。',
        error: null,
      });
      setConsent(false);
    } catch (error) {
      setSubmitState({ loading: false, success: null, error: error instanceof Error ? error.message : String(error) });
    }
  };

  return (
    <main className="results-page">
      <header className="results-header">
        <div>
          <span>阶段结果</span>
          <h1>只看已经结束的部分</h1>
          <p>未开始和进行中的题目不会计入；你可以随时返回题目列表继续。</p>
          <span className="mode-badge">回答方式：{assessmentModes[state.assessmentMode]?.label || state.assessmentMode}</span>
        </div>
        <div className="results-header-actions">
          <button className="button primary" type="button" onClick={() => dispatch({ type: 'OPEN_OVERVIEW' })}><ListChecks size={17} />返回题目列表</button>
          <button className="button secondary" type="button" onClick={() => downloadJson('argument-chain-session.json', exportSession(state))}><Download size={17} />导出正式报告</button>
          <button className="button quiet" type="button" onClick={() => dispatch({ type: 'EXIT_TO_LANDING' })}><LogOut size={17} />退出</button>
        </div>
      </header>

      <div className="results-progress">
        <strong>{finishedPolicies}</strong>
        <span>道题已结束 · 候选库共 {policies.length} 道，不要求全部完成{inProgressPolicies ? ` · ${inProgressPolicies} 道进行中未计入` : ''}</span>
      </div>

      {state.assessmentMode === 'conditional_scenario' ? <p className="mode-result-warning" role="note"><Info size={17} />本报告记录的是题设条件下的规范判断，不表示你确认这些经验描述在现实中成立；娱乐层也只比较这组条件性路径。</p> : null}

      <LineageGraph state={state} chains={chains} selectedId={selected?.id} onSelect={(chainId) => {
        setSelectedId(chainId);
        setConsent(false);
        setSubmitState({ loading: false, success: null, error: null });
      }} />

      {chains.length > 1 ? (
        <label className="chain-selector">
          <span>选择论证</span>
          <select value={selected?.id || ''} onChange={(event) => {
            setSelectedId(event.target.value);
            setConsent(false);
            setSubmitState({ loading: false, success: null, error: null });
          }}>
            {chains.map((chain, index) => (
              <option key={chain.id} value={chain.id}>论证 {index + 1} · {statusCopy[chain.status] || chain.status}</option>
            ))}
          </select>
        </label>
      ) : null}

      <div className="preview-status">
        <span className={`status-dot ${selected?.status || 'unresolved'}`} />
        <strong>{statusCopy[selected?.status] || '没有完整论证'}</strong>
        <p>{selectedPolicy?.title}</p>
      </div>

      {selected ? (
        <section className="policy-result-summary" aria-labelledby="policy-result-summary-title">
          <span>当前所选政策</span>
          <h2 id="policy-result-summary-title">{selectedPolicy?.shortTitle || selectedPolicy?.title}</h2>
          <p>这条路径从“{argumentsById[selected.steps?.[0]?.argumentId]?.title || '尚未命名的理由'}”出发，暂时停在“{claims[selected.terminal?.claimId]?.shortLabel || '未形成暂定出发点'}”。</p>
          <strong>理由链方向：{stanceCopy[selected.direction] || '未定'}；反方复核后的整包判断：{modeStanceCopy(state.records[selected.policyId]?.packageStanceAfterDefeater || state.records[selected.policyId]?.stance, state.assessmentMode)}</strong>
        </section>
      ) : null}

      <details className="results-disclosure">
        <summary>查看所选论证结构</summary>
        <ArgumentPreview chain={selected} />
      </details>

      <details className="results-disclosure">
        <summary>查看详细报告</summary>
        <MechanicalReport state={state} chains={chains} />
      </details>

      <PrototypeOverlay state={state} />

      <details className="results-disclosure">
        <summary>导出或贡献所选论证</summary>
        <section className="contribution-zone">
        <header>
          <ShieldCheck size={27} />
          <div><h2>贡献到公开题库</h2><p>这是独立于本地保存的公开动作。</p></div>
        </header>

        {eligibility.eligible ? (
          <>
            <p className="contribution-disclosure">
              确认后，这份<strong>规范化结构论证</strong>会离开浏览器，进入私有候选区；定期审核会把它放入公开 GitHub PR。
              人工合并后，它会成为公开正式题库的一部分。不会上传原始输入、AI 对话、API 配置、时间、设备或会话标识。
            </p>
            <label className="consent-check">
              <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
              <span>我已检查完整预览，并明确同意这份结构化论证进入公开审核记录和正式题库。</span>
            </label>
            <div className="contribution-actions">
              <button className="button primary" type="button" disabled={!consent || submitState.loading || !bankClient.configured} onClick={submit}>
                <Send size={17} /> {submitState.loading ? '正在提交…' : '贡献到公开题库'}
              </button>
              {contribution.ok ? <button className="button secondary" type="button" onClick={() => downloadJson('argument-chain-contribution.json', contribution.value)}><Download size={17} />下载贡献包</button> : null}
            </div>
            {!bankClient.configured ? <p className="service-note">这个部署尚未配置候选区服务地址，因此当前只能下载贡献包，不会上传。</p> : null}
            {submitState.success ? <p className="submit-success" role="status"><Check size={17} />{submitState.success}</p> : null}
            {submitState.error ? <p className="field-error" role="alert">{submitState.error}</p> : null}
            {contribution.ok ? (
              <details className="contribution-json">
                <summary>查看将要公开的全部结构化数据</summary>
                <pre>{JSON.stringify(contribution.value, null, 2)}</pre>
              </details>
            ) : null}
          </>
        ) : (
          <div className="ineligible-message">
            <h3>这条论证不会进入候选区</h3>
            <ul>{eligibility.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
          </div>
        )}
        </section>
      </details>
    </main>
  );
}
