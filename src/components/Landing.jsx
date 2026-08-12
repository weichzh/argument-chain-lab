import React, { useState } from 'react';
import { ArrowRight, ListChecks, LockKeyhole, RotateCcw } from 'lucide-react';

export default function Landing({ onStart, onBrowse, onReset, hasSavedProgress }) {
  const [resetArmed, setResetArmed] = useState(false);
  const reset = () => {
    if (!resetArmed) {
      setResetArmed(true);
      return;
    }
    setResetArmed(false);
    onReset();
  };
  return (
    <main className="landing simple-landing">
      <section className="landing-intro">
        <span className="landing-kicker">完整方案 · 逐题判断</span>
        <h1>论证链实验室</h1>
        <p>先判断一个完整政策方案，再逐步找出真正改变判断的条件与理由。</p>
        <div className="landing-actions">
          <button className="button primary landing-start" type="button" onClick={onStart}>
            {hasSavedProgress ? '继续答题' : '开始答题'}<ArrowRight size={18} />
          </button>
          <button className="button secondary" type="button" onClick={onBrowse}><ListChecks size={18} />题目列表</button>
        </div>
        {hasSavedProgress ? (
          <div className="landing-reset">
            {resetArmed ? <p role="alert">这会清除当前答题进度和临时草稿。</p> : null}
            <div>
              <button className={`button ${resetArmed ? 'danger-outline' : 'quiet'}`} type="button" onClick={reset}>
                <RotateCcw size={17} />{resetArmed ? '确认重新开始' : '重新开始'}
              </button>
              {resetArmed ? <button className="button quiet" type="button" onClick={() => setResetArmed(false)}>取消</button> : null}
            </div>
          </div>
        ) : null}
      </section>

      <aside className="privacy-boundary">
        <LockKeyhole size={20} aria-hidden="true" />
        <p>回答默认只保存在这个浏览器中。</p>
      </aside>
    </main>
  );
}
