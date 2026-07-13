import React from 'react';
import { Book, Rotate } from './Icons.jsx';
import { policies } from '../data/model.js';
import { PHASES } from '../lib/engine.js';

export default function Header({ state, onMethod, onReset }) {
  const assessmentPhases = new Set([
    PHASES.STANCE,
    PHASES.DIRECTION,
    PHASES.ARGUMENT,
    PHASES.FACT,
    PHASES.BRIDGE,
    PHASES.DEPTH,
    PHASES.TERMINAL_CONFIRM,
    PHASES.STRESS,
    PHASES.BROKEN,
    PHASES.POLICY_COMPLETE,
  ]);
  const showProgress = assessmentPhases.has(state.phase);
  const progress = Math.min(100, Math.max(0, ((state.policyIndex + (state.phase === PHASES.POLICY_COMPLETE ? 1 : 0)) / policies.length) * 100));

  return (
    <header className="app-header">
      <div className="header-inner">
        <button className="brand-button" type="button" onClick={onMethod} aria-label="打开关键概念与方法说明">
          <span className="brand-mark" aria-hidden="true">∴</span>
          <span className="brand-copy">
            <strong>论证链实验室</strong>
            <small>Minimal Bridge Dialogue</small>
          </span>
        </button>

        {showProgress ? (
          <div className="header-progress" aria-label={`政策进度 ${state.policyIndex + 1} / ${policies.length}`}>
            <span>政策 {Math.min(state.policyIndex + 1, policies.length)} / {policies.length}</span>
            <div className="progress-track"><div className="progress-fill" style={{ width: `${progress}%` }} /></div>
          </div>
        ) : <div className="header-progress-spacer" />}

        <nav className="header-actions" aria-label="工具">
          <button className="icon-text-button" type="button" onClick={onMethod}><Book size={18} />概念说明</button>
          {state.phase !== PHASES.LANDING ? (
            <button className="icon-text-button subtle" type="button" onClick={onReset}><Rotate size={18} />重置</button>
          ) : null}
        </nav>
      </div>
    </header>
  );
}
