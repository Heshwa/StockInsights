import React, { useState, useEffect } from 'react';
import { Save, Plus, Trash2, Copy, Check, FileSpreadsheet } from 'lucide-react';
import { makeSheetId, extractSheetId } from '../config/sheets';

export function Msg({ msg }) {
  if (!msg) return null;
  const bad = msg.type === 'error';
  const st = {
    padding: '0.875rem 1rem', borderRadius: '8px', fontSize: '0.875rem',
    background: bad ? '#fef2f2' : '#ecfdf5',
    border: `1px solid ${bad ? '#fecaca' : '#a7f3d0'}`,
    color: bad ? '#991b1b' : '#065f46'
  };
  return <div style={st}>{msg.text}</div>;
}

export function CriticalTable({ items, onSave }) {
  const [rows, setRows] = useState(items || []);
  useEffect(() => { setRows(items || []); }, [items]);
  const upd = (i, f, v) => {
    const n = Math.max(0, parseInt(v || 0, 10));
    setRows((cur) => cur.map((it, k) => (k === i ? { ...it, [f]: n } : it)));
  };
  return (
    <React.Fragment>
      <div className="settings-table-wrapper">
        <table className="settings-table">
          <thead><tr><th>Product Name</th><th>Critical Stock</th><th>Expiry Alert Days</th></tr></thead>
          <tbody>
            {rows.map((item, index) => (
              <tr key={item.sku}>
                <td>{item.sku}</td>
                <td><input type="number" min="0" value={item.criticalLevel} onChange={(e) => upd(index, 'criticalLevel', e.target.value)} /></td>
                <td><input type="number" min="0" value={item.expiryThreshold} onChange={(e) => upd(index, 'expiryThreshold', e.target.value)} /></td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan="3" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No products yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="settings-actions">
        <button className="btn btn-primary" onClick={() => onSave(rows)} disabled={rows.length === 0}>
          <Save size={18} style={{ marginRight: '8px' }} />Save Critical Levels
        </button>
      </div>
    </React.Fragment>
  );
}

export function SheetsManager(p) {
  const { sheets, users, drafts, setDrafts, newName, setNewName } = p;
  const { newSheetInput, setNewSheetInput, showMsg, onSaveSheets, onRefreshSheet } = p;
  const upd = (id, patch) => setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  const toggle = (draftId, uname) => setDrafts((prev) => prev.map((d) => {
    if (d.id !== draftId) return d;
    const has = d.allowedUsers.includes(uname);
    return { ...d, allowedUsers: has ? d.allowedUsers.filter((u) => u !== uname) : [...d.allowedUsers, uname] };
  }));
  const clean = (d) => ({ id: d.id, name: d.name.trim(), sheetId: extractSheetId(d.sheetInput), allowedUsers: d.allowedUsers });
  const admins = users.filter((u) => u.role === 'admin').map((u) => u.username);
  const saveAll = () => {
    for (const d of drafts) {
      if (!d.name.trim()) { showMsg('error', 'Every sheet needs a name.'); return; }
      if (!extractSheetId(d.sheetInput)) { showMsg('error', 'Sheet "' + d.name + '" needs a valid ID or URL.'); return; }
    }
    const next = drafts.map((d) => {
      const c = clean(d);
      return { ...c, allowedUsers: [...new Set([...c.allowedUsers, ...admins])] };
    });
    onSaveSheets(next);
    next.forEach((s) => onRefreshSheet(s));
    showMsg('success', 'Saved ' + next.length + ' sheet(s) in this browser.');
  };
  const add = () => {
    if (!newName.trim() || !extractSheetId(newSheetInput)) { showMsg('error', 'Enter a tab name and valid Sheet ID / URL.'); return; }
    const entry = { id: makeSheetId(), name: newName.trim(), sheetId: extractSheetId(newSheetInput), allowedUsers: [...admins] };
    onSaveSheets([...drafts.map(clean), entry]);
    onRefreshSheet(entry);
    setNewName(''); setNewSheetInput('');
    showMsg('success', 'Added "' + entry.name + '". Tick viewers, then Save all sheets.');
  };
  const remove = (id) => {
    if (drafts.length <= 1) { showMsg('error', 'At least one sheet must remain.'); return; }
    const t = drafts.find((d) => d.id === id);
    if (!window.confirm('Remove sheet "' + (t && t.name) + '"?')) return;
    onSaveSheets(drafts.filter((d) => d.id !== id).map(clean));
  };
  return (
    <div className="card settings-card">
      <div className="form-group">
        <label><FileSpreadsheet size={14} style={{ verticalAlign: '-2px', marginRight: '6px' }} />Sheets</label>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
          Each sheet becomes a tab. Tick viewers per sheet. Admins always see all tabs. Paste URL or ID. Must be published to web.
        </p>
        {drafts.map((d) => (
          <div key={d.id} className="sheet-edit-card">
            <div className="sheet-edit-row">
              <input type="text" value={d.name} onChange={(e) => upd(d.id, { name: e.target.value })} style={{ maxWidth: '220px' }} />
              <input type="text" value={d.sheetInput} onChange={(e) => upd(d.id, { sheetInput: e.target.value })} style={{ flex: 1 }} />
              <button className="btn btn-danger-ghost" onClick={() => remove(d.id)}><Trash2 size={16} /></button>
            </div>
            <div className="viewer-picks">
              <span className="viewer-picks-label">Can view:</span>
              {users.map((u) => (
                <label key={u.username} className="viewer-check">
                  <input type="checkbox" checked={d.allowedUsers.includes(u.username)} disabled={u.role === 'admin'} onChange={() => toggle(d.id, u.username)} />
                  <span>{u.username}{u.role === 'admin' ? ' (admin)' : ''}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
        <div className="sheet-edit-row" style={{ marginTop: '0.75rem' }}>
          <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New tab name" style={{ maxWidth: '220px' }} />
          <input type="text" value={newSheetInput} onChange={(e) => setNewSheetInput(e.target.value)} placeholder="New Sheet ID or URL" style={{ flex: 1 }} />
          <button className="btn btn-secondary" onClick={add}><Plus size={16} style={{ marginRight: '6px' }} />Add sheet</button>
        </div>
        <div className="settings-actions">
          <button className="btn btn-primary" onClick={saveAll}><Save size={16} style={{ marginRight: '6px' }} />Save all sheets</button>
        </div>
      </div>
    </div>
  );
}

export function CopyConfigButton({ drafts, showMsg }) {
  const [copied, setCopied] = useState(false);
  const clean = (d) => ({ id: d.id, name: d.name.trim(), sheetId: extractSheetId(d.sheetInput), allowedUsers: d.allowedUsers });
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(drafts.map(clean), null, 2));
      setCopied(true); setTimeout(() => setCopied(false), 2000);
      showMsg('success', 'Config copied — send to developer to make permanent.');
    } catch { showMsg('error', 'Clipboard blocked.'); }
  };
  return (
    <button className="btn btn-secondary" onClick={copy}>
      {copied ? <Check size={16} style={{ marginRight: '6px' }} /> : <Copy size={16} style={{ marginRight: '6px' }} />}
      {copied ? 'Copied!' : 'Copy config for deploy'}
    </button>
  );
}

