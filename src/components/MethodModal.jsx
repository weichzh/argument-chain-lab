import React from 'react';
import { X } from 'lucide-react';
import { sources } from '../data/model.js';
import useDialogFocus from '../hooks/useDialogFocus.js';

export default function MethodModal({ open, onClose }) {
  const dialogRef = useDialogFocus(open, onClose);

  if (!open) return null;
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section ref={dialogRef} className="modal-sheet method-sheet" role="dialog" aria-modal="true" aria-labelledby="method-title">
        <header className="panel-header">
          <div><h2 id="method-title">方法与边界</h2><p>论证协议，不是政治人格测试。</p></div>
          <button className="icon-button" type="button" onClick={onClose} title="关闭"><X /></button>
        </header>
        <div className="method-body">
          <section className="method-lead">
            <h3>一条论证怎样走完整</h3>
            <p>每一步都把事实、规范原则和待说明的结论分开。系统只记录你明确确认的结构，不从回答推断身份标签。</p>
          </section>
          <dl className="method-terms">
            <div><dt>F</dt><dd><strong>事实</strong><span>世界是否确实如此。</span></dd></div>
            <div><dt>B</dt><dd><strong>桥接原则</strong><span>为什么这些事实能为结论增加一项理由。</span></dd></div>
            <div><dt>V</dt><dd><strong>待说明的结论</strong><span>当前这一步正在支持或反对什么。</span></dd></div>
            <div><dt>G</dt><dd><strong>当前基本价值</strong><span>经过独立确认和相似案例检验后，本轮暂时停下追问的位置。</span></dd></div>
          </dl>
          <details>
            <summary>题库与 AI 的关系</summary>
            <p>正式题库是只读的版本化 JSON。AI 只提出结构化候选；候选经你检查和确认后，才进入当前会话扩展。两种来源共用同一套确认流程。</p>
          </details>
          <details>
            <summary>保存、AI 与公开贡献</summary>
            <p>结构化进度保存在当前浏览器；AI 配置和对话只在当前页面内。公开贡献是最后单独发生的动作，只包含经过白名单规范化的完整论证。</p>
          </details>
          <details>
            <summary>解释限制</summary>
            <p>系统不能证明某项终极价值客观为真，也不能代表你在所有未询问情境中的判断。不得用于就业、执法、录取、信贷或政治审查。</p>
          </details>
          <details>
            <summary>方法来源（{sources.length}）</summary>
            <ul className="source-list">
              {sources.map((source) => (
                <li key={source.id}><strong>{source.author} · {source.year}</strong><span>{source.title}</span></li>
              ))}
            </ul>
          </details>
        </div>
      </section>
    </div>
  );
}
