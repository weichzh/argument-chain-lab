import React from 'react';
import { RotateCcw } from 'lucide-react';

export default function RestartPolicyButton({ policyId, title, dispatch, label = '重新回答这题' }) {
  return <button className="button quiet" type="button" onClick={() => {
    if (window.confirm(`重新回答“${title}”将替换这道题的记录，其他题目不受影响。确定重新开始吗？`)) {
      dispatch({ type: 'RESTART_POLICY', policyId });
    }
  }}><RotateCcw size={16} aria-hidden="true" />{label}</button>;
}
