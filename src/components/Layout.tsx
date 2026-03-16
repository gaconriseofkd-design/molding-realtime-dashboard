import { Outlet, NavLink } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { LayoutDashboard, ScanBarcode, Database, Globe } from 'lucide-react';

export function Layout() {
  const { language, setLanguage, t } = useLanguage();

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: t('liveDashboard') },
    { to: '/scan', icon: ScanBarcode, label: t('scanInOut') },
    { to: '/database', icon: Database, label: t('moldDatabase') },
  ];

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans selection:bg-indigo-500/30 selection:text-indigo-200 flex flex-col">
      {/* Top Navbar */}
      <header className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center">
                <Database className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-xl tracking-tight hidden md:block">MES Operations</span>
            </div>
            
            <nav className="hidden md:flex items-center gap-1 bg-slate-800/50 p-1 rounded-xl border border-slate-700/50">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => 
                    `flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      isActive 
                        ? 'bg-slate-700/80 text-white shadow-sm' 
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                    }`
                  }
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <Globe className="w-4 h-4 text-slate-400 hidden sm:block" />
            <div className="flex bg-slate-800/80 rounded-lg p-1 border border-slate-700">
              <button 
                onClick={() => setLanguage('vi')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${language === 'vi' ? 'bg-indigo-500 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
              >
                VIE
              </button>
              <button 
                onClick={() => setLanguage('en')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${language === 'en' ? 'bg-indigo-500 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
              >
                ENG
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-8 space-y-8 pb-20">
        <Outlet />
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900/90 backdrop-blur-lg border-t border-slate-800 z-50 px-2 pb-safe pt-2">
        <div className="flex justify-around items-center h-16">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => 
                `flex flex-col items-center justify-center w-full h-full gap-1 rounded-xl transition-all ${
                  isActive 
                    ? 'text-indigo-400' 
                    : 'text-slate-500 hover:text-slate-300'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon className={`w-6 h-6 transition-transform ${isActive ? 'mb-0.5 scale-110' : ''}`} />
                  <span className="text-[10px] font-semibold">{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
