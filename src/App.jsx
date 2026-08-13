import React, { useState, useEffect, useCallback } from 'react';
import Papa from 'papaparse';
import { 
  LayoutDashboard, 
  Settings as SettingsIcon, 
  RefreshCcw, 
  AlertTriangle, 
  CheckCircle2, 
  Search,
  Package,
  Calendar,
  AlertCircle,
  Save,
  LogOut
} from 'lucide-react';
import { buildSkuMeta, normalizeSkuKey, processInventoryData } from './utils/dataProcessor';
import Login from './components/Login';
import { login as authLogin, logout as authLogout, isLoggedIn, getUserRole } from './utils/auth';

function App() {
  const [loggedIn, setLoggedIn] = useState(isLoggedIn);
  const [userRole, setUserRole] = useState(getUserRole);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sheetId, setSheetId] = useState(localStorage.getItem('sheetId') || '1PyCT1HTPvcGb_70eYPcrhCp-AgjGrLTi7tJ4gGIpVd8');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const [selectedStore, setSelectedStore] = useState(null);
  const [criticalItems, setCriticalItems] = useState([]);
  const isAdmin = userRole === 'admin';
  const [criticalSettings, setCriticalSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('criticalLevelSettings');
      const legacy = localStorage.getItem('criticalLevelOverrides');
      return JSON.parse(saved || legacy || '{}');
    } catch {
      return {};
    }
  });

  const fetchData = useCallback(async (nextSheetId = sheetId, settings = criticalSettings, skipCriticalRebuild = false) => {
    setLoading(true);
    try {
      // For now, load local files as fallback if sheetId is empty
      // In production, we'd use the sheetId to build the URL
      const responsesUrl = `https://docs.google.com/spreadsheets/d/${nextSheetId}/export?format=csv`;
      
      const [resp, stores] = await Promise.all([
        fetchCsv(responsesUrl),
        fetchCsv('/STORE_MASTER-Table 1.csv')
      ]);

      const processed = processInventoryData(resp, stores, settings);
      // Only rebuild critical items from settings when NOT called from saveCriticalLevels.
      // When called from saveCriticalLevels, the items are already set with user edits.
      if (!skipCriticalRebuild) {
        setCriticalItems(buildSkuMeta(resp, settings));
      }
      setData(processed);
      setSelectedStore(current => (
        current ? processed.find(store => store.storeId === current.storeId) || current : current
      ));
      setLastRefreshed(new Date().toLocaleString());
    } catch (err) {
      console.error('Fetch error:', err);
      alert('Error fetching data. Ensure the Google Sheet is published to web.');
    } finally {
      setLoading(false);
    }
  }, [sheetId, criticalSettings]);

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
  }, [fetchData]);

  const saveSettings = (id) => {
    setSheetId(id);
    localStorage.setItem('sheetId', id);
    alert('Settings saved. Refreshing data...');
    fetchData(id);
  };

  const saveCriticalLevels = (items) => {
    const nextSettings = items.reduce((acc, item) => {
      acc[normalizeSkuKey(item.sku)] = {
        criticalLevel: item.criticalLevel,
        expiryThreshold: item.expiryThreshold
      };
      return acc;
    }, {});

    setCriticalSettings(nextSettings);
    localStorage.setItem('criticalLevelSettings', JSON.stringify(nextSettings));
    setCriticalItems(items);
    alert('Critical levels saved. Refreshing data...');
    // Pass true for skipCriticalRebuild to prevent fetchData from overwriting
    // the items we just set with buildSkuMeta.
    fetchData(sheetId, nextSettings, true);
  };

  const handleLogin = (username, password) => {
    const result = authLogin(username, password);
    if (result.success) {
      setLoggedIn(true);
      setUserRole(result.role);
    }
    return result;
  };

  const handleLogout = () => {
    authLogout();
    setLoggedIn(false);
    setUserRole('viewer');
  };

  if (!loggedIn) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <Package size={20} color="var(--primary)" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: '1rem', lineHeight: 1.3, whiteSpace: 'normal', wordBreak: 'break-word' }}>Metro Cash & Carry Management</span>
        </div>
        <nav className="nav">
          <button 
            className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => { setActiveTab('dashboard'); setSelectedStore(null); }}
          >
            <LayoutDashboard size={20} />
            Dashboard
          </button>
          {isAdmin && (
            <button 
              className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => { setActiveTab('settings'); setSelectedStore(null); }}
            >
              <SettingsIcon size={20} />
              Settings
            </button>
          )}
        </nav>
        <div style={{ padding: '1rem' }}>
          <button 
            className="nav-item"
            onClick={handleLogout}
            style={{ color: '#94a3b8' }}
          >
            <LogOut size={20} />
            Logout
          </button>
        </div>
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
            <button className="btn btn-primary" onClick={() => fetchData()} disabled={loading}>
              <RefreshCcw size={18} style={{ marginRight: '8px', animation: loading ? 'spin 1s linear infinite' : 'none' }} />
              Refresh
            </button>
          </div>
        </header>

        <section className="content-area">
          {activeTab === 'dashboard' && !selectedStore && (
            <DashboardOverview data={data} onStoreClick={setSelectedStore} />
          )}
          {activeTab === 'dashboard' && selectedStore && (
            <StoreDetail store={selectedStore} />
          )}
          {activeTab === 'settings' && (
            <Settings
              sheetId={sheetId}
              onSave={saveSettings}
              criticalItems={criticalItems}
              onSaveCriticalLevels={saveCriticalLevels}
            />
          )}
        </section>
      </main>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .layout { display: flex; height: 100vh; }
        .sidebar { width: 260px; background: #1e293b; color: #f8fafc; display: flex; flex-direction: column; }
        .sidebar-header { padding: 2rem; font-size: 1.5rem; font-weight: 700; display: flex; align-items: flex-start; gap: 10px; font-family: var(--font-heading); }
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
        .store-detail-meta { display: flex; gap: 1rem; margin-bottom: 1rem; font-size: 0.875rem; color: var(--text-muted); }
        .table-controls { background: white; border: 1px solid var(--border); border-radius: 12px; box-shadow: var(--shadow); padding: 1rem; margin-bottom: 1rem; display: grid; grid-template-columns: minmax(280px, 1fr) auto minmax(160px, auto); gap: 1rem; align-items: end; }
        .control-field { display: flex; flex-direction: column; gap: 0.375rem; }
        .control-field label, .checkbox-field span { font-size: 0.75rem; font-weight: 600; text-transform: uppercase; color: var(--text-muted); }
        .search-field { position: relative; display: flex; align-items: center; }
        .search-field input { width: 100%; height: 42px; padding-left: 2.5rem; background: #f8fafc; }
        .search-field input:focus { background: white; }
        .checkbox-field { height: 42px; display: flex; align-items: center; gap: 0.5rem; }
        .checkbox-field input { width: 16px; height: 16px; accent-color: var(--primary); }
        select { height: 42px; padding: 0 2rem 0 0.75rem; border: 1px solid var(--border); border-radius: 8px; background: white; color: var(--text-main); font-size: 0.875rem; outline: none; }
        select:focus { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1); }

        .product-table-wrapper { background: white; border-radius: 12px; border: 1px solid var(--border); box-shadow: var(--shadow); overflow: hidden; }
        .product-table { width: 100%; border-collapse: collapse; text-align: left; }
        .product-table th { background: #f1f5f9; padding: 1rem; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; color: var(--text-muted); }
        .sort-heading { display: inline-flex; align-items: center; gap: 0.35rem; color: inherit; font-size: inherit; font-weight: inherit; text-transform: inherit; }
        .sort-heading.active { color: var(--primary); }
        .sort-arrow { min-width: 0.75rem; color: currentColor; }
        .product-table td { padding: 1rem; border-top: 1px solid var(--border); font-size: 0.875rem; }
        .product-table tr.critical-row { background: #fef2f2; }
        .product-table tr.warning-row { background: #fffbeb; }

        .settings-layout { display: grid; gap: 1.5rem; max-width: 980px; }
        .settings-card { width: 100%; }
        .form-group { margin-bottom: 1.5rem; }
        .form-group label { display: block; font-size: 0.875rem; font-weight: 500; margin-bottom: 0.5rem; color: var(--text-muted); }
        .input-group { display: flex; gap: 8px; }
        input[type="text"], input[type="number"] { padding: 0.75rem 1rem; border: 1px solid var(--border); border-radius: 8px; font-size: 0.875rem; outline: none; transition: border-color 0.2s; }
        input[type="text"] { flex: 1; }
        input[type="number"] { width: 120px; }
        input[type="text"]:focus, input[type="number"]:focus { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1); }
        .settings-table-wrapper { overflow-x: auto; border: 1px solid var(--border); border-radius: 8px; }
        .settings-table { width: 100%; border-collapse: collapse; text-align: left; }
        .settings-table th { background: #f1f5f9; padding: 0.75rem 1rem; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; color: var(--text-muted); white-space: nowrap; }
        .settings-table td { padding: 0.75rem 1rem; border-top: 1px solid var(--border); font-size: 0.875rem; vertical-align: middle; }
        .settings-actions { display: flex; justify-content: flex-end; margin-top: 1rem; }
        @media (max-width: 1100px) {
          .table-controls { grid-template-columns: 1fr 1fr; }
        }
        @media (max-width: 760px) {
          .layout { flex-direction: column; }
          .sidebar { width: 100%; flex-direction: row; align-items: center; }
          .sidebar-header { padding: 1rem; }
          .nav { flex-direction: row; padding: 1rem; }
          .topbar { height: auto; padding: 1rem; gap: 1rem; align-items: flex-start; flex-direction: column; }
          .content-area { padding: 1rem; }
          .table-controls { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}

function DashboardOverview({ data, onStoreClick }) {
  const totalCritical = data.reduce((acc, store) => acc + store.products.filter(p => p.isCritical).length, 0);
  const totalWarning = data.reduce((acc, store) => acc + store.products.filter(p => p.isExpiringSoon).length, 0);
  const totalExpired = data.reduce((acc, store) => acc + store.products.filter(p => p.isExpired).length, 0);

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
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [hideZeroStock, setHideZeroStock] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: 'default', direction: 'asc' });

  const lastVisit = store.lastUpdated && store.lastUpdated !== 'No data'
    ? new Date(store.lastUpdated).toLocaleString()
    : 'No visit data';

  const getStatus = (product) => {
    if (!product.hasData) return 'no-data';
    if (product.isExpired) return 'expired';
    if (product.isCritical) return 'low-stock';
    if (product.isExpiringSoon) return 'expiring';
    return 'good';
  };

  const statusWeight = {
    expired: 0,
    'low-stock': 1,
    expiring: 2,
    good: 3,
    'no-data': 4
  };

  const visibleProducts = [...store.products]
    .filter(product => product.sku.toLowerCase().includes(query.trim().toLowerCase()))
    .filter(product => !hideZeroStock || product.stock !== 0)
    .filter(product => statusFilter === 'all' || getStatus(product) === statusFilter)
    .sort((a, b) => {
      let result = 0;

      if (sortConfig.key === 'availability') {
        const aStock = typeof a.stock === 'number' ? a.stock : -1;
        const bStock = typeof b.stock === 'number' ? b.stock : -1;
        result = aStock - bStock;
      } else if (sortConfig.key === 'daysLeft') {
        const aDays = a.daysLeft ?? Number.MAX_SAFE_INTEGER;
        const bDays = b.daysLeft ?? Number.MAX_SAFE_INTEGER;
        result = aDays - bDays;
      } else if (sortConfig.key === 'status') {
        result = statusWeight[getStatus(a)] - statusWeight[getStatus(b)];
      } else if (sortConfig.key === 'product') {
        result = a.sku.localeCompare(b.sku);
      } else {
        result = 0;
      }

      return sortConfig.direction === 'asc' ? result : -result;
    });

  const toggleSort = (key) => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const SortHeading = ({ sortKey, children }) => {
    const active = sortConfig.key === sortKey;
    return (
      <button className={`sort-heading ${active ? 'active' : ''}`} onClick={() => toggleSort(sortKey)}>
        <span>{children}</span>
        <span className="sort-arrow">{active ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</span>
      </button>
    );
  };

  return (
    <div>
      <div className="store-detail-meta">
        <span>Store Code: <strong>{store.storeCode}</strong></span>
        <span>Last Visit: <strong>{lastVisit}</strong></span>
      </div>
      {!store.hasAnyData && (
        <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', padding: '1rem', borderRadius: '8px', marginBottom: '1rem', color: '#92400e' }}>
          ⚠️ No visit responses found for this store yet.
        </div>
      )}
      <div className="table-controls">
        <div className="control-field">
          <label>Product</label>
          <div className="search-field">
            <Search size={16} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none', zIndex: 1 }} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products"
              style={{ paddingLeft: '2.5rem' }}
            />
          </div>
        </div>
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={hideZeroStock}
            onChange={(e) => setHideZeroStock(e.target.checked)}
          />
          <span>Hide 0 Stock</span>
        </label>
        <div className="control-field">
          <label>Status</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All Statuses</option>
            <option value="low-stock">Low Stock</option>
            <option value="expiring">Expiring</option>
            <option value="expired">Expired</option>
            <option value="good">Good</option>
            <option value="no-data">No Data</option>
          </select>
        </div>
      </div>
      <div className="product-table-wrapper">
        <table className="product-table">
          <thead>
            <tr>
              <th><SortHeading sortKey="product">Product Name</SortHeading></th>
              <th><SortHeading sortKey="availability">Current Stock</SortHeading></th>
              <th>Min Level</th>
              <th>Expiry Date</th>
              <th><SortHeading sortKey="daysLeft">Days Left</SortHeading></th>
              <th><SortHeading sortKey="status">Status</SortHeading></th>
            </tr>
          </thead>
          <tbody>
            {visibleProducts.map((p) => (
              <tr key={p.sku} className={p.isCritical ? 'critical-row' : (p.isExpiringSoon ? 'warning-row' : '')}>
                <td style={{ fontWeight: 500 }}>{p.sku}</td>
                <td style={{ color: p.isCritical ? 'var(--danger)' : 'inherit', fontWeight: p.isCritical ? 700 : 400 }}>
                  {p.stock === 'N/A' ? <span style={{ color: 'var(--text-muted)' }}>—</span> : p.stock}
                </td>
                <td>{p.criticalLevel}</td>
                <td>
                  {p.expiryDate || (p.stock === 0 ? (
                    <span style={{ color: 'var(--text-muted)' }}>No stock</span>
                  ) : '—')}
                </td>
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
            {visibleProducts.length === 0 && (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                  No products match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Settings({ sheetId, onSave, criticalItems, onSaveCriticalLevels }) {
  const [val, setVal] = useState(sheetId);
  const [items, setItems] = useState(criticalItems);

  useEffect(() => {
    setItems(criticalItems);
  }, [criticalItems]);

  const updateItem = (index, field, value) => {
    const numericValue = Math.max(0, parseInt(value || 0, 10));
    setItems(current => current.map((item, i) => (
      i === index ? { ...item, [field]: numericValue } : item
    )));
  };

  return (
    <div className="settings-layout">
      <div className="card settings-card">
        <div className="form-group">
          <label>Google Sheet ID</label>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            {"Enter the ID from your browser's address bar. The sheet must be published to the web (File > Share > Publish to web)."}
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
      <div className="card settings-card">
        <div className="form-group">
          <label>Critical Levels</label>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Product names follow the response sheet. Edits are saved in this browser and applied on refresh.
          </p>
          <div className="settings-table-wrapper">
            <table className="settings-table">
              <thead>
                <tr>
                  <th>Product Name</th>
                  <th>Critical Stock</th>
                  <th>Expiry Alert Days</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={item.sku}>
                    <td>{item.sku}</td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        value={item.criticalLevel}
                        onChange={(e) => updateItem(index, 'criticalLevel', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        value={item.expiryThreshold}
                        onChange={(e) => updateItem(index, 'expiryThreshold', e.target.value)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="settings-actions">
            <button className="btn btn-primary" onClick={() => onSaveCriticalLevels(items)}>
              <Save size={18} style={{ marginRight: '8px' }} />
              Save Critical Levels
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
