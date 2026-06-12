import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { 
  LayoutDashboard, 
  Settings as SettingsIcon, 
  RefreshCcw, 
  AlertTriangle, 
  CheckCircle2, 
  Store as StoreIcon,
  Search,
  Package,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { processInventoryData } from './utils/dataProcessor';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sheetId, setSheetId] = useState(localStorage.getItem('sheetId') || '1PyCT1HTPvcGb_70eYPcrhCp-AgjGrLTi7tJ4gGIpVd8');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const [selectedStore, setSelectedStore] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      // For now, load local files as fallback if sheetId is empty
      // In production, we'd use the sheetId to build the URL
      const responsesUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
      
      const [resp, crit, stores] = await Promise.all([
        fetchCsv(responsesUrl),
        fetchCsv('/CRITICAL_LEVELS-Table 1.csv'),
        fetchCsv('/STORE_MASTER-Table 1.csv')
      ]);

      const processed = processInventoryData(resp, crit, stores);
      setData(processed);
      setLastRefreshed(new Date().toLocaleString());
    } catch (err) {
      console.error('Fetch error:', err);
      alert('Error fetching data. Ensure the Google Sheet is published to web.');
    } finally {
      setLoading(false);
    }
  };

  const fetchCsv = (url) => {
    return new Promise((resolve, reject) => {
      Papa.parse(url, {
        download: true,
        header: true,
        complete: (results) => resolve(results.data),
        error: (err) => reject(err)
      });
    });
  };

  useEffect(() => {
    fetchData();
  }, []);

  const saveSettings = (id) => {
    setSheetId(id);
    localStorage.setItem('sheetId', id);
    alert('Settings saved. Refreshing data...');
    fetchData();
  };

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <Package size={24} color="var(--primary)" />
          <span>StockInsight</span>
        </div>
        <nav className="nav">
          <button 
            className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => { setActiveTab('dashboard'); setSelectedStore(null); }}
          >
            <LayoutDashboard size={20} />
            Dashboard
          </button>
          <button 
            className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <SettingsIcon size={20} />
            Settings
          </button>
        </nav>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="topbar-left">
            <h2>{selectedStore ? selectedStore.storeName : activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</h2>
            {selectedStore && (
              <button className="breadcrumb-back" onClick={() => setSelectedStore(null)}>
                &lsaquo; Back to Overview
              </button>
            )}
          </div>
          <div className="topbar-right">
            <span className="last-refresh">Last Refreshed: {lastRefreshed}</span>
            <button className="btn btn-primary" onClick={fetchData} disabled={loading}>
              <RefreshCcw size={18} style={{ marginRight: '8px', animation: loading ? 'spin 1s linear infinite' : 'none' }} />
              Refresh
            </button>
          </div>
        </header>

        <section className="content-area">
          {activeTab === 'dashboard' && !selectedStore && (
            <DashboardOverview data={data} onStoreClick={setSelectedStore} />
          )}
          {selectedStore && (
            <StoreDetail store={selectedStore} />
          )}
          {activeTab === 'settings' && (
            <Settings sheetId={sheetId} onSave={saveSettings} />
          )}
        </section>
      </main>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .layout { display: flex; height: 100vh; }
        .sidebar { width: 260px; background: #1e293b; color: #f8fafc; display: flex; flex-direction: column; }
        .sidebar-header { padding: 2rem; font-size: 1.5rem; font-weight: 700; display: flex; align-items: center; gap: 12px; font-family: var(--font-heading); }
        .nav { flex: 1; padding: 1rem; display: flex; flex-direction: column; gap: 8px; }
        .nav-item { display: flex; align-items: center; gap: 12px; padding: 0.75rem 1rem; border-radius: 8px; color: #94a3b8; transition: all 0.2s; text-align: left; width: 100%; }
        .nav-item:hover { background: #334155; color: #f8fafc; }
        .nav-item.active { background: var(--primary); color: white; }
        .main-content { flex: 1; display: flex; flex-direction: column; overflow: hidden; background: #f8fafc; }
        .topbar { height: 72px; padding: 0 2rem; border-bottom: 1px solid var(--border); background: white; display: flex; align-items: center; justify-content: space-between; }
        .topbar-left h2 { font-size: 1.5rem; color: var(--text-main); }
        .breadcrumb-back { font-size: 0.875rem; color: var(--primary); margin-top: 4px; border: none; background: none; padding: 0; }
        .last-refresh { font-size: 0.875rem; color: var(--text-muted); margin-right: 1.5rem; }
        .content-area { flex: 1; overflow-y: auto; padding: 2rem; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1.5rem; margin-bottom: 2.5rem; }
        .stat-card { background: white; padding: 1.5rem; border-radius: 12px; display: flex; align-items: center; gap: 1rem; box-shadow: var(--shadow); border: 1px solid var(--border); }
        .stat-icon { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
        .stat-info h4 { font-size: 0.875rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
        .stat-info .value { font-size: 1.75rem; font-weight: 700; color: var(--text-main); }
        .store-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1.5rem; }
        .store-card { cursor: pointer; transition: transform 0.2s, box-shadow 0.2s; }
        .store-card:hover { transform: translateY(-4px); box-shadow: var(--shadow-lg); }
        .store-card-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; }
        .store-card h3 { font-size: 1.25rem; margin-bottom: 4px; }
        .store-card .code { font-size: 0.875rem; color: var(--text-muted); }
        .store-stats { display: flex; gap: 1.5rem; }
        .store-stat-item { display: flex; flex-direction: column; }
        .store-stat-item .label { font-size: 0.75rem; color: var(--text-muted); }
        .store-stat-item .count { font-size: 1.125rem; font-weight: 600; }
        .store-stat-item.danger .count { color: var(--danger); }
        .store-stat-item.warning .count { color: var(--warning); }
        
        .product-table-wrapper { background: white; border-radius: 12px; border: 1px solid var(--border); box-shadow: var(--shadow); overflow: hidden; }
        .product-table { width: 100%; border-collapse: collapse; text-align: left; }
        .product-table th { background: #f1f5f9; padding: 1rem; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; color: var(--text-muted); }
        .product-table td { padding: 1rem; border-top: 1px solid var(--border); font-size: 0.875rem; }
        .product-table tr.critical-row { background: #fef2f2; }
        .product-table tr.warning-row { background: #fffbeb; }
        
        .settings-card { max-width: 600px; }
        .form-group { margin-bottom: 1.5rem; }
        .form-group label { display: block; font-size: 0.875rem; font-weight: 500; margin-bottom: 0.5rem; color: var(--text-muted); }
        .input-group { display: flex; gap: 8px; }
        input[type="text"] { flex: 1; padding: 0.75rem 1rem; border: 1px solid var(--border); border-radius: 8px; font-size: 0.875rem; outline: none; transition: border-color 0.2s; }
        input[type="text"]:focus { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1); }
      `}</style>
    </div>
  );
}

function DashboardOverview({ data, onStoreClick }) {
  const totalCritical = data.reduce((acc, store) => acc + store.products.filter(p => p.isCritical).length, 0);
  const totalWarning = data.reduce((acc, store) => acc + store.products.filter(p => p.isExpiringSoon).length, 0);
  const totalExpired = data.reduce((acc, store) => acc + store.products.filter(p => p.isExpired).length, 0);
  const totalActive = data.reduce((acc, store) => acc + store.products.filter(p => p.hasData && typeof p.stock === 'number' && p.stock > 0).length, 0);

  return (
    <>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#ecfdf5', color: '#059669' }}><CheckCircle2 /></div>
          <div className="stat-info">
            <h4>Active Stores</h4>
            <div className="value">{data.length}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#eff6ff', color: '#2563eb' }}><Package /></div>
          <div className="stat-info">
            <h4>Active SKUs</h4>
            <div className="value">{totalActive}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#fef2f2', color: '#dc2626' }}><AlertTriangle /></div>
          <div className="stat-info">
            <h4>Critical Stock</h4>
            <div className="value">{totalCritical}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#fffbeb', color: '#d97706' }}><AlertCircle /></div>
          <div className="stat-info">
            <h4>Expiring Soon</h4>
            <div className="value">{totalWarning}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#fef2f2', color: '#991b1b' }}><Calendar /></div>
          <div className="stat-info">
            <h4>Already Expired</h4>
            <div className="value">{totalExpired}</div>
          </div>
        </div>
      </div>

      <div className="store-grid">
        {data.map(store => (
          <div key={store.storeId} className="card store-card" onClick={() => onStoreClick(store)}>
            <div className="store-card-header">
              <div>
                <h3>{store.storeName}</h3>
                <span className="code">{store.storeCode}</span>
              </div>
              <span className={`badge badge-${
                store.status === 'critical' ? 'danger' :
                store.status === 'warning' ? 'warning' :
                store.status === 'no-data' ? 'warning' : 'success'}`}>
                {store.status === 'no-data' ? 'No Data' : store.status.charAt(0).toUpperCase() + store.status.slice(1)}
              </span>
            </div>
            <div className="store-stats">
              <div className="store-stat-item">
                <span className="label">Active SKUs</span>
                <span className="count" style={{ color: 'var(--primary)' }}>
                  {store.products.filter(p => p.hasData && typeof p.stock === 'number' && p.stock > 0).length}
                  <span style={{ fontWeight: 400, fontSize: '0.75rem', color: 'var(--text-muted)' }}> / {store.products.length}</span>
                </span>
              </div>
              <div className="store-stat-item danger">
                <span className="label">Critical</span>
                <span className="count">{store.products.filter(p => p.isCritical).length}</span>
              </div>
              <div className="store-stat-item warning">
                <span className="label">Expiring</span>
                <span className="count">{store.products.filter(p => p.isExpiringSoon).length}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function StoreDetail({ store }) {
  const lastVisit = store.lastUpdated && store.lastUpdated !== 'No data'
    ? new Date(store.lastUpdated).toLocaleString()
    : 'No visit data';

  return (
    <div>
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
        <span>Store Code: <strong>{store.storeCode}</strong></span>
        <span>Last Visit: <strong>{lastVisit}</strong></span>
      </div>
      {!store.hasAnyData && (
        <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', padding: '1rem', borderRadius: '8px', marginBottom: '1rem', color: '#92400e' }}>
          ⚠️ No visit responses found for this store yet.
        </div>
      )}
      <div className="product-table-wrapper">
        <table className="product-table">
          <thead>
            <tr>
              <th>Product Name</th>
              <th>Current Stock</th>
              <th>Min Level</th>
              <th>Expiry Date</th>
              <th>Days Left</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {store.products.map((p, idx) => (
              <tr key={idx} className={p.isCritical ? 'critical-row' : (p.isExpiringSoon ? 'warning-row' : '')}>
                <td style={{ fontWeight: 500 }}>{p.sku}</td>
                <td style={{ color: p.isCritical ? 'var(--danger)' : 'inherit', fontWeight: p.isCritical ? 700 : 400 }}>
                  {p.stock === 'N/A' ? <span style={{ color: 'var(--text-muted)' }}>—</span> : p.stock}
                </td>
                <td>{p.criticalLevel}</td>
                <td>{p.expiryDate || '—'}</td>
                <td style={{ color: p.isExpired ? 'var(--danger)' : (p.isExpiringSoon ? 'var(--warning)' : 'inherit') }}>
                  {p.daysLeft !== null ? `${p.daysLeft}d` : '—'}
                </td>
                <td>
                  {!p.hasData ? (
                    <span className="badge" style={{ background: '#f1f5f9', color: '#64748b' }}>No Data</span>
                  ) : p.isExpired ? (
                    <span className="badge badge-danger">Expired</span>
                  ) : p.isCritical ? (
                    <span className="badge badge-danger">Low Stock</span>
                  ) : p.isExpiringSoon ? (
                    <span className="badge badge-warning">Expiring</span>
                  ) : (
                    <span className="badge badge-success">Good</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Settings({ sheetId, onSave }) {
  const [val, setVal] = useState(sheetId);
  return (
    <div className="card settings-card">
      <div className="form-group">
        <label>Google Sheet ID</label>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
          Enter the ID from your browser's address bar. The sheet must be published to the web (File &gt; Share &gt; Publish to web).
        </p>
        <div className="input-group">
          <input 
            type="text" 
            value={val} 
            onChange={(e) => setVal(e.target.value)} 
            placeholder="e.g. 1a2b3c4d5e6f7g8h9i0j..."
          />
          <button className="btn btn-primary" onClick={() => onSave(val)}>Save & Update</button>
        </div>
      </div>
    </div>
  );
}

export default App;
