import React, { useState } from 'react';
import { ChevronUp, ListChecks } from 'lucide-react';

export default function ProofView({ entries, onRevisit }) {
  const [open, setOpen] = useState(false);
  return (
    <aside className={`answer-history${open ? ' open' : ''}`} aria-label="已答内容">
      <button className="history-toggle" type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <ListChecks size={19} aria-hidden="true" />
        <strong>查看已答</strong>
        <span>{entries.length ? `${entries.length} 条` : '暂无'}</span>
        <ChevronUp className={open ? '' : 'collapsed'} size={18} aria-hidden="true" />
      </button>
      {open ? (
        <ol className="answer-history-list">
          {entries.length ? entries.map((entry) => (
            <li key={entry.id}>
              <button type="button" onClick={() => onRevisit(entry.id)} aria-label={`修改：${entry.label}`}>
                <span>{entry.label}</span>
                <strong>修改</strong>
              </button>
            </li>
          )) : <li className="history-empty">还没有已答内容</li>}
        </ol>
      ) : null}
    </aside>
  );
}
