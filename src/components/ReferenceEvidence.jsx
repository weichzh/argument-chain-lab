import React, { useState } from 'react';

export const EVIDENCE_STATES = Object.freeze({
  same: { mark: '=', label: '相同记录' },
  different: { mark: '≠', label: '不同记录' },
  overlap: { mark: '≈', label: '主题交集' },
  missing: { mark: '?', label: '资料不足' },
  incomparable: { mark: '−', label: '不能直接比较' },
});

export default function ReferenceEvidence({ candidate }) {
  const rows = candidate.evidenceRows || [];
  const [selection, setSelection] = useState(null);
  const selectedRow = rows.find(row => row.policyId === selection?.policyId) || rows[0];
  const selected = selectedRow?.cells.find(cell => cell.key === selection?.key) || selectedRow?.cells[0];
  const panelId = `evidence-${candidate.profileId.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
  if (!selected) return null;
  const counts = Object.fromEntries(Object.keys(EVIDENCE_STATES).map(key => [key, 0]));
  rows.flatMap(row => row.cells).forEach(cell => { counts[cell.status] += 1; });
  return <section className="reference-evidence" aria-label={`${candidate.labelZh}的逐项对照`}>
    <p className="evidence-help">点选一个格子，查看双方实际记录。格子表示字段，不是人群比例。</p>
    <div className="evidence-grid-scroll"><table className="evidence-table">
      <caption className="visually-hidden">{candidate.labelZh}：逐情景、逐字段的对照</caption>
      <thead><tr><th scope="col">情景</th>{rows[0].cells.map(cell => <th scope="col" key={cell.key}>{cell.label}</th>)}</tr></thead>
      <tbody>{rows.map(row => <tr key={row.policyId}>
        <th scope="row">{row.title}</th>{row.cells.map(cell => <td key={cell.key}>
          <button type="button" className={`evidence-cell evidence-${cell.status}`} aria-pressed={selectedRow.policyId === row.policyId && selected.key === cell.key}
            aria-controls={panelId} aria-label={`${row.title} · ${cell.label}：${EVIDENCE_STATES[cell.status].label}`}
            onClick={() => setSelection({ policyId: row.policyId, key: cell.key })}>
            <span aria-hidden="true">{EVIDENCE_STATES[cell.status].mark}</span>
          </button>
        </td>)}</tr>)}</tbody>
    </table></div>
    <dl className="evidence-legend">{Object.entries(EVIDENCE_STATES).map(([id, item]) => <div key={id} className={`evidence-${id}`}>
      <dt><i aria-hidden="true">{item.mark}</i>{item.label}</dt><dd>{counts[id]}</dd>
    </div>)}</dl>
    <div className="evidence-inspector" id={panelId} aria-live="polite" aria-atomic="true">
      <h5>{selectedRow.title} · {selected.label}<span className={`evidence-state evidence-${selected.status}`}>{EVIDENCE_STATES[selected.status].label}</span></h5>
      <dl><div><dt>你的记录</dt><dd>{selected.userText}</dd></div><div><dt>参考记录</dt><dd>{selected.referenceText}</dd></div></dl>
      <p>{selected.note}</p>
    </div>
  </section>;
}
