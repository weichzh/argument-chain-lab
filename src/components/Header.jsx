import React from 'react';
import { Database, Settings } from 'lucide-react';
import { getPolicyV4 } from '../lib/modelV4.js';
import { VIEWS } from '../hooks/useSession.js';

const utilityButton = (label, Icon, onClick, active = false) => (
  <button
    className={`header-tool${active ? ' active' : ''}`}
    type="button"
    onClick={onClick}
    title={label}
  >
    <Icon size={18} aria-hidden="true" />
    <span>{label}</span>
  </button>
);

export default function Header({
  state,
  aiConfigured,
  onConfig,
  onLocalData,
}) {
  const policy = getPolicyV4(state.currentPolicyId);
  const inProgress = state.view === VIEWS.QUESTIONNAIRE;
  return (
    <header className="app-header">
      <div className="header-brand">
        <span className="brand-wordmark">论证链实验室</span>
        {inProgress && policy ? <small title={policy.title}>{policy.shortTitle || policy.title}</small> : null}
      </div>
      <nav className="header-tools" aria-label="辅助工具">
        {utilityButton(aiConfigured ? 'AI 已配置' : 'AI 配置', Settings, onConfig, aiConfigured)}
        {utilityButton('本地数据', Database, onLocalData)}
      </nav>
    </header>
  );
}
