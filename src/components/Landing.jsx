import React from 'react';
import { ArrowRight, LockKeyhole } from 'lucide-react';

export default function Landing({ onStart, hasSavedProgress }) {
  return (
    <main className="landing simple-landing">
      <section className="landing-intro">
        <span className="landing-kicker">论证链实验室</span>
        <h1>从一个问题开始。</h1>
        <p>选择这次想回答的题目。系统会根据你的答案，只继续追问真正相关的内容。</p>
        <button className="button primary landing-start" type="button" onClick={onStart}>
          {hasSavedProgress ? '继续答题' : '开始答题'}<ArrowRight size={18} />
        </button>
      </section>

      <aside className="privacy-boundary">
        <LockKeyhole size={20} aria-hidden="true" />
        <p>回答默认只保存在这个浏览器中。</p>
      </aside>
    </main>
  );
}
