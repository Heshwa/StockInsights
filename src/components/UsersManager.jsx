import React, { useState } from 'react';
import { Plus, Users } from 'lucide-react';
import { getAllUsers, createUser, resetUserPassword, deleteUser } from '../utils/auth';

export function UsersManager({ showMsg, currentUsername, onUsersChanged }) {
  const [users, setUsers] = useState(getAllUsers);
  const [nu, setNu] = useState('');
  const [np, setNp] = useState('');
  const [nr, setNr] = useState('viewer');
  const [pw, setPw] = useState({});
  const refresh = () => { setUsers(getAllUsers()); if (onUsersChanged) onUsersChanged(getAllUsers()); };
  const create = () => {
    const r = createUser(nu, np, nr);
    if (!r.success) { showMsg('error', r.error); return; }
    const clean = nu.trim();
    refresh(); setNu(''); setNp(''); setNr('viewer');
    showMsg('success', 'User "' + clean + '" created. Tick their sheets above and Save.');
  };
  const reset = (uname) => {
    const r = resetUserPassword(uname, pw[uname] || '');
    if (!r.success) { showMsg('error', uname + ': ' + r.error); return; }
    setPw((x) => ({ ...x, [uname]: '' }));
    showMsg('success', 'Password updated for ' + uname + '.');
  };
  const del = (uname) => {
    if (!window.confirm('Delete user "' + uname + '"?')) return;
    const r = deleteUser(uname, currentUsername);
    if (!r.success) { showMsg('error', r.error); return; }
    refresh();
    showMsg('success', 'User "' + uname + '" deleted in this browser.');
  };
  return (
    <div className="card settings-card">
      <div className="form-group">
        <label><Users size={14} style={{ verticalAlign: '-2px', marginRight: '6px' }} />Users</label>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>New users see no sheets until ticked above. Share passwords privately.</p>
        <div className="settings-table-wrapper" style={{ marginBottom: '1rem' }}>
          <table className="settings-table">
            <thead><tr><th>Username</th><th>Role</th><th>New password</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.username}>
                  <td style={{ fontWeight: 600 }}>{u.username}</td>
                  <td><span className={'badge ' + (u.role === 'admin' ? 'badge-warning' : 'badge-success')}>{u.role}</span></td>
                  <td><input type="text" placeholder="min 6 chars" value={pw[u.username] || ''} onChange={(e) => setPw((x) => ({ ...x, [u.username]: e.target.value }))} style={{ width: '150px' }} /></td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => reset(u.username)}>Set password</button>{' '}
                    <button className="btn btn-danger-ghost btn-sm" onClick={() => del(u.username)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="sheet-edit-row">
          <input type="text" value={nu} onChange={(e) => setNu(e.target.value)} placeholder="New username" style={{ maxWidth: '170px' }} />
          <input type="text" value={np} onChange={(e) => setNp(e.target.value)} placeholder="Password (min 6)" style={{ maxWidth: '170px' }} />
          <select value={nr} onChange={(e) => setNr(e.target.value)} style={{ maxWidth: '130px' }}>
            <option value="viewer">viewer</option>
            <option value="admin">admin</option>
          </select>
          <button className="btn btn-primary" onClick={create}><Plus size={16} style={{ marginRight: '6px' }} />Create user</button>
        </div>
      </div>
    </div>
  );
}
