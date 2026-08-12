import React, { useEffect, useState } from 'react';
import { Check, CircleAlert, X } from 'lucide-react';
import { getArgumentSchemesV4 } from '../lib/modelV4.js';
import useDialogFocus from '../hooks/useDialogFocus.js';

export default function CandidateReview({ review, onConfirm, onClose }) {
  const [candidate, setCandidate] = useState(null);

  useEffect(() => {
    setCandidate(review?.candidate ? structuredClone(review.candidate) : null);
  }, [review]);

  const dialogRef = useDialogFocus(Boolean(review && candidate), onClose);

  if (!review || !candidate) return null;
  const schemes = getArgumentSchemesV4();
  const selectedScheme = schemes.find((scheme) => scheme.id === candidate.schemeId);

  const update = (path, value) => {
    setCandidate((current) => {
      const next = structuredClone(current);
      let target = next;
      for (let index = 0; index < path.length - 1; index += 1) target = target[path[index]];
      target[path.at(-1)] = value;
      return next;
    });
  };

  return (
    <div className="modal-backdrop candidate-backdrop" role="presentation">
      <section ref={dialogRef} className="modal-sheet candidate-sheet" role="dialog" aria-modal="true" aria-labelledby="candidate-title">
        <header className="panel-header">
          <div><h2 id="candidate-title">检查 AI 整理结果</h2><p>确认前，这些内容不会改变你的回答。</p></div>
          <button className="icon-button" type="button" onClick={onClose} title="关闭"><X /></button>
        </header>

        <div className="candidate-scroll">
          <div className="candidate-notice"><CircleAlert size={19} /><p>请检查每句话是否准确表达你的想法。确认后只保存下面这份结构，不保存你刚才的原始输入或 AI 对话。</p></div>

          <div className="candidate-section">
            <div className="candidate-symbol target">判断</div>
            <div className="candidate-fields">
              <label className="field"><span>简短名称</span><input value={candidate.target.shortLabel} readOnly={review.scope === 'current_target'} onChange={(event) => update(['target', 'shortLabel'], event.target.value)} /></label>
              <label className="field"><span>你的判断</span><textarea rows={3} value={candidate.target.text} readOnly={review.scope === 'current_target'} onChange={(event) => update(['target', 'text'], event.target.value)} /></label>
              {review.scope === 'new_root' ? <label className="field"><span>判断方向</span><select value={candidate.direction} onChange={(event) => update(['direction'], event.target.value)}><option value="support">支持</option><option value="oppose">反对</option></select></label> : null}
              <label className="field"><span>理由标题</span><input value={candidate.argument.title} onChange={(event) => update(['argument', 'title'], event.target.value)} /></label>
              <label className="field"><span>理由摘要</span><textarea rows={3} value={candidate.argument.summary} onChange={(event) => update(['argument', 'summary'], event.target.value)} /></label>
              <label className="field"><span>理由类型</span><select value={candidate.schemeId} onChange={(event) => update(['schemeId'], event.target.value)}>{schemes.map((scheme) => <option value={scheme.id} key={scheme.id}>{scheme.label}</option>)}</select></label>
            </div>
          </div>

          {candidate.facts.map((fact, index) => (
            <div className="candidate-section" key={`fact-${index}`}>
              <div className="candidate-symbol fact">情况 {index + 1}</div>
              <div className="candidate-fields">
                <label className="field"><span>需要暂时采用的情况</span><textarea rows={3} value={fact.statement} onChange={(event) => update(['facts', index, 'statement'], event.target.value)} /></label>
                <label className="field"><span>这句话是什么意思</span><textarea rows={2} value={fact.plainExplanation} onChange={(event) => update(['facts', index, 'plainExplanation'], event.target.value)} /></label>
                <details><summary>支持与否定条件</summary>
                  <label className="field"><span>什么会支持它</span><textarea rows={2} value={fact.truthConditions} onChange={(event) => update(['facts', index, 'truthConditions'], event.target.value)} /></label>
                  <label className="field"><span>什么会否定它</span><textarea rows={2} value={fact.falsifier} onChange={(event) => update(['facts', index, 'falsifier'], event.target.value)} /></label>
                </details>
              </div>
            </div>
          ))}

          <div className="candidate-section">
            <div className="candidate-symbol bridge">理由</div>
            <div className="candidate-fields">
              <label className="field"><span>理由名称</span><input value={candidate.bridge.shortLabel} onChange={(event) => update(['bridge', 'shortLabel'], event.target.value)} /></label>
              <label className="field"><span>为什么这足以支持判断</span><textarea rows={3} value={candidate.bridge.text} onChange={(event) => update(['bridge', 'text'], event.target.value)} /></label>
              <label className="field"><span>解释</span><textarea rows={3} value={candidate.bridge.explanation} onChange={(event) => update(['bridge', 'explanation'], event.target.value)} /></label>
              <label className="field"><span>例子</span><textarea rows={3} value={candidate.bridge.example} onChange={(event) => update(['bridge', 'example'], event.target.value)} /></label>
              <label className="field"><span>接下来怎么处理这个理由</span><select value={candidate.bridge.kind} onChange={(event) => update(['bridge', 'kind'], event.target.value)}><option value="bridge">继续追问为什么</option><option value="terminal">作为目前最根本的理由</option></select></label>
            </div>
          </div>

          <div className="candidate-section">
            <div className="candidate-symbol stress">换对象</div>
            <div className="candidate-fields">
              <label className="field"><span>具体相似案例</span><textarea rows={3} value={candidate.stressTest.scenario} onChange={(event) => update(['stressTest', 'scenario'], event.target.value)} /></label>
              <label className="field"><span>要问的问题</span><textarea rows={2} value={candidate.stressTest.question} onChange={(event) => update(['stressTest', 'question'], event.target.value)} /></label>
            </div>
          </div>

          <details className="candidate-ast-review">
            <summary>查看技术结构</summary>
            <p>这是尚未绑定具体实体的方案槽位对照，不是“有效”证书。</p>
            <dl>
              <dt>方案</dt><dd>{selectedScheme?.label || candidate.schemeId}</dd>
              {(selectedScheme?.requiredRoles || []).map((role, index) => (
                <React.Fragment key={role}>
                  <dt>前提 {index + 1}</dt>
                  <dd><span>{candidate.facts[index]?.statement || '尚未映射中文前提'}</span><code>{role}</code></dd>
                </React.Fragment>
              ))}
              <dt>桥接规则</dt><dd>{candidate.bridge.text}</dd>
              <dt>结论</dt><dd><span>{candidate.target.text}</span><code>{selectedScheme?.inferenceKind || 'defeasible'}</code></dd>
            </dl>
          </details>
        </div>

        <footer className="panel-footer">
          <button className="button quiet" type="button" onClick={onClose}>暂不使用</button>
          <button className="button primary" type="button" onClick={() => onConfirm(candidate)}><Check size={18} />确认并继续答题</button>
        </footer>
      </section>
    </div>
  );
}
