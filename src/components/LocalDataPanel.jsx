import React, { useState } from 'react';
import { Download, HardDrive, KeyRound, Trash2, Upload, X } from 'lucide-react';
import useDialogFocus from '../hooks/useDialogFocus.js';

const downloadProgress = (state) => {
  const payload = {
    schema: 'argument-chain-local-progress-export',
    version: 1,
    progress: state,
  };
  const url = URL.createObjectURL(new Blob(
    [`${JSON.stringify(payload, null, 2)}\n`],
    { type: 'application/json;charset=utf-8' },
  ));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'argument-chain-local-progress.json';
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export default function LocalDataPanel({
  open,
  state,
  aiConfigured,
  bankVersion,
  onClear,
  onClose,
}) {
  const dialogRef = useDialogFocus(open, onClose);
  const [clearArmed, setClearArmed] = useState(false);
  if (!open) return null;
  const hasProgress = Boolean(state.startedAt);
  const close = () => {
    setClearArmed(false);
    onClose();
  };
  const clear = () => {
    if (!clearArmed) {
      setClearArmed(true);
      return;
    }
    setClearArmed(false);
    onClear();
  };
  return (
    <div className="side-panel-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) close();
    }}>
      <aside ref={dialogRef} className="side-panel local-data-panel" role="dialog" aria-modal="true" aria-labelledby="local-data-title">
        <header className="panel-header">
          <div><h2 id="local-data-title">本地数据</h2><p>正式题库版本 {bankVersion}</p></div>
          <button className="icon-button" type="button" onClick={close} title="关闭"><X /></button>
        </header>

        <div className="panel-scroll">
          <div className="data-boundary-row">
            <HardDrive size={22} />
            <div><strong>结构化论证进度</strong><p>保存在当前浏览器，刷新后可以继续。保存进度不等于同意公开贡献。</p></div>
            <span>{hasProgress ? '本地' : '空'}</span>
          </div>
          <div className="data-boundary-row">
            <KeyRound size={22} />
            <div><strong>AI 配置与对话</strong><p>配置只在当前页面内存中；完整 AI 消息不会写入浏览器持久存储。</p></div>
            <span>{aiConfigured ? '仅内存' : '未配置'}</span>
          </div>
          <div className="data-boundary-row">
            <Upload size={22} />
            <div><strong>公开候选区</strong><p>只有完整预览后的独立贡献确认，才会上传白名单结构并进入公开审核。</p></div>
            <span>未自动上传</span>
          </div>

          <div className="local-data-actions">
            <button className="button secondary full" type="button" onClick={() => downloadProgress(state)} disabled={!hasProgress}><Download size={17} />下载本地进度</button>
            {clearArmed ? <p className="destructive-warning" role="alert">这会清除当前浏览器中的结构化进度和临时草稿。</p> : null}
            <button className="button danger-outline full" type="button" onClick={clear}><Trash2 size={17} />{clearArmed ? '确认清除本地数据' : '清除本地数据'}</button>
            {clearArmed ? <button className="button quiet full" type="button" onClick={() => setClearArmed(false)}>取消</button> : null}
          </div>
        </div>
      </aside>
    </div>
  );
}
