import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useState } from 'react'
import {
  LayoutDashboard, Package, ShoppingBag, Users,
  LogOut, Menu, X, ChevronRight, Bell
} from 'lucide-react'

const supplierNav = [
  { to: '/supplier', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/supplier/products', label: 'My Products', icon: Package },
  { to: '/supplier/orders', label: 'Orders', icon: ShoppingBag },
]

const adminNav = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/suppliers', label: 'Suppliers', icon: Users },
  { to: '/admin/products', label: 'All Products', icon: Package },
  { to: '/admin/orders', label: 'All Orders', icon: ShoppingBag },
]

export default function Layout({ role }) {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const nav = role === 'admin' ? adminNav : supplierNav

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-brand-50 flex">
      {/* Sidebar overlay mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 h-full w-64 bg-white border-r border-brand-100 z-30 flex flex-col
        transform transition-transform duration-200
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:static lg:z-auto
      `}>
        {/* Logo */}
        <div className="p-6 border-b border-brand-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-brand-800 rounded-lg flex items-center justify-center">
              <span className="text-white text-xs font-heading font-bold">A</span>
            </div>
            <div>
              <p className="font-heading font-bold text-brand-800 text-lg leading-none">aartisanz</p>
              <p className="text-xs text-gray-400 font-body mt-0.5">
                {role === 'admin' ? 'Admin Portal' : 'Supplier Portal'}
              </p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-4 space-y-1">
          {nav.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => `
                flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-body font-medium transition-colors
                ${isActive
                  ? 'bg-brand-800 text-white'
                  : 'text-gray-600 hover:bg-brand-50 hover:text-brand-800'}
              `}
            >
              <Icon size={16} />
              {label}
              {({ isActive }) => isActive && <ChevronRight size={14} className="ml-auto" />}
            </NavLink>
          ))}
        </nav>

        {/* Profile */}
        <div className="p-4 border-t border-brand-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-brand-100 rounded-full flex items-center justify-center">
              <span className="text-brand-800 text-xs font-heading font-bold">
                {profile?.full_name?.[0] || 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate font-body">{profile?.full_name || 'User'}</p>
              <p className="text-xs text-gray-400 truncate font-body capitalize">{profile?.role}</p>
            </div>
          </div>
          <button onClick={handleSignOut} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors font-body">
            <LogOut size={14} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="bg-white border-b border-brand-100 px-4 py-3 flex items-center justify-between lg:px-6">
          <button className="lg:hidden p-2 rounded-lg hover:bg-brand-50" onClick={() => setSidebarOpen(true)}>
            <Menu size={20} className="text-brand-800" />
          </button>
          <div className="flex-1 lg:flex-none">
            <h1 className="font-heading text-brand-800 text-lg hidden lg:block">
              {role === 'admin' ? 'Admin Dashboard' : 'Supplier Portal'}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 rounded-lg hover:bg-brand-50 relative">
              <Bell size={18} className="text-gray-500" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
