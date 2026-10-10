import React, { useEffect, useState } from 'react';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import Production from './pages/Production';
import Orders from './pages/Orders';
import Accounting from './pages/Accounting';
import RoleDashboard from './pages/RoleDashboard';
import Login from './pages/Login';
import Register from './pages/Register';
import { ROLE_HOME } from './authRoles';

const OWNER_DASHBOARD_ROLES = {
  'store-dashboard': 'store_keeper',
  'floor-dashboard': 'floor_supervisor',
  'dispatch-dashboard': 'dispatch',
  'buyer-dashboard': 'buyer',
};

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [authView, setAuthView] = useState(() => (
    typeof window !== 'undefined' && window.location.pathname === '/register' ? 'register' : 'login'
  ));
  const [selectedRole, setSelectedRole] = useState('owner');
  const [token, setToken] = useState(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('everest-token') || null;
  });
  const [user, setUser] = useState(() => {
    if (typeof window === 'undefined') return null;

    const savedUser = localStorage.getItem('everest-user');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const handleAuthSuccess = (payload) => {
    const nextUser = payload.user || payload;
    const nextToken = payload.token || null;

    localStorage.setItem('everest-user', JSON.stringify(nextUser));
    if (nextToken) {
      localStorage.setItem('everest-token', nextToken);
    } else {
      localStorage.removeItem('everest-token');
    }
    setUser(nextUser);
    setToken(nextToken);
    setActiveTab(ROLE_HOME[nextUser.role] || 'dashboard');
    window.history.replaceState({}, '', '/');
  };

  const switchAuthView = (view) => {
    setAuthView(view);
    const path = view === 'register' ? '/register' : '/login';
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path);
    }
  };

  useEffect(() => {
    const handlePopState = () => {
      setAuthView(window.location.pathname === '/register' ? 'register' : 'login');
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (user) {
      localStorage.setItem('everest-user', JSON.stringify(user));
    } else {
      localStorage.removeItem('everest-user');
    }
  }, [user]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (token) {
      localStorage.setItem('everest-token', token);
    } else {
      localStorage.removeItem('everest-token');
    }
  }, [token]);

  const handleLogout = () => {
    localStorage.removeItem('everest-user');
    localStorage.removeItem('everest-token');
    setUser(null);
    setToken(null);
    switchAuthView('login');
  };

  if (!user) {
    return authView === 'register' ? (
      <Register
        selectedRole={selectedRole}
        onRoleChange={setSelectedRole}
        onRegister={handleAuthSuccess}
        onSwitchToLogin={() => switchAuthView('login')}
        onSwitchToRegister={() => switchAuthView('register')}
      />
    ) : (
      <Login
        selectedRole={selectedRole}
        onRoleChange={setSelectedRole}
        onLogin={handleAuthSuccess}
        onSwitchToLogin={() => switchAuthView('login')}
        onSwitchToRegister={() => switchAuthView('register')}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F4EE] text-[#2A3528] flex flex-col font-sans selection:bg-[#DDD4C7] selection:text-[#2A3528]">
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} user={user} onLogout={handleLogout} />

      <main className="flex-1 pb-16">
        {activeTab === 'dashboard' && user.role === 'owner' && <Dashboard setActiveTab={setActiveTab} />}
        {activeTab === 'dashboard' && user.role !== 'owner' && <RoleDashboard user={user} setActiveTab={setActiveTab} />}
        {OWNER_DASHBOARD_ROLES[activeTab] && user.role === 'owner' && (
          <RoleDashboard user={user} dashboardRole={OWNER_DASHBOARD_ROLES[activeTab]} setActiveTab={setActiveTab} />
        )}
        {activeTab === 'inventory' && <Inventory />}
        {activeTab === 'production' && <Production />}
        {activeTab === 'orders' && <Orders user={user} />}
        {activeTab === 'accounting' && user.role === 'owner' && <Accounting />}
      </main>

      <footer className="bg-[#EFEAE0] border-t border-[#E3DDD3] py-8 px-4 text-center">
        <div className="max-w-4xl mx-auto space-y-3">
          <div className="flex items-center justify-center gap-2">
            <span className="font-editorial text-xl text-[#2A3528] lowercase font-normal">
              everest <span className="text-[#53634F]">mills</span>
            </span>
            <span className="text-[#53634F] text-xs">✦</span>
          </div>
          <p className="text-xs tracking-wider uppercase text-[#6C7B67]">
            Tiruppur District • Tamil Nadu • Certified Organic Combed Cotton & Luxury Flax Weavers
          </p>
          <div className="text-[11px] text-[#8E9F8A] font-mono">
            FastAPI • React 19 • Sage & Linen Editorial Theme • Complete Lot Traceability
          </div>
        </div>
      </footer>
    </div>
  );
}
