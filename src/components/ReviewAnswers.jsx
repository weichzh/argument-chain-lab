import React from 'react';

export default function ReviewAnswers({ entries, onRevisit }) {
  if (!entries.length) return null;
  return (
    <details className="v4-answer-review">
      <summary>查看已答（{entries.length}）</summary>
      <ol>
        {entries.map((entry) => (
          <li key={entry.id}>
            <div><span>{entry.question}</span><strong>{entry.answer}</strong></div>
            <button type="button" onClick={() => onRevisit(entry.id)} aria-label={`修改：${entry.answer}`}>修改</button>
          </li>
        ))}
      </ol>
    </details>
  );
}
