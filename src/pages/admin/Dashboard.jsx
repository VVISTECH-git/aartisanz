import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Users, Package, ShoppingBag, AlertTriangle, TrendingUp, RefreshCw, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import toast from 'react-hot-toast'

export default function AdminDashboard() {
  const [stats, setStats] = useState({ suppliers: 0, products: 0, orders: 0, pendingApprovals: 0, lowStock: 0, revenue: 0 })
  const [syncStats, setSyncStats] = useState({ synced: 0, failed: 0, total: 0 })
  const [syncing, setSyncing] = useState(false)
  const [recentOrders, setRecentOrders] = useState([])
  const [ordersByDay, setOrdersByDay] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    try {
      const [suppliersRes, productsRes, ordersRes] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact' }).eq('role', 'supplier'),
        supabase.from('products').select('*'),
        supabase.from('orders').select('*, products(name), profiles(full_name)').order('created_at', { ascending: false }),
      ])

      const products = productsRes.data || []
      const orders = ordersRes.data || []

      const pendingApprovals = products.filter(p => !p.is_approved).length
      const lowStock = products.filter(p => p.supplier_stock <= 10 && p.supplier_stock > 0).length
      const revenue = orders.filter(o => o.status === 'fulfilled').reduce((sum, o) => sum + (o.total_amount || 0), 0)

      // Orders by day (last 7 days)
      const last7 = Array.from({ length: 7 }, (_, i) => {
        const d = new Date()
        d.setDate(d.getDate() - (6 - i))
        return {
          date: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
          orders: orders.filter(o => new Date(o.created_at).toDateString() === d.toDateString()).length
        }
      })

      setStats({
        suppliers: suppliersRes.count || 0,
        products: products.length,
        orders: orders.length,
        pendingApprovals,
        lowStock,
        revenue
      })
      setRecentOrders(orders.slice(0, 8))

      // Sync stats
      const synced = products.filter(p => p.is_approved && p.shopify_product_id).length
      const failed = products.filter(p => p.is_approved && !p.shopify_product_id).length
      setSyncStats({ synced, failed, total: products.filter(p => p.is_approved).length })
      setOrdersByDay(last7)
    } catch (err) {
      toast.error('Failed to load dashboard')
    }
    setLoading(false)
  }

  const statCards = [
    { label: 'Total Suppliers', value: stats.suppliers, icon: Users, color: 'blue', link: '/admin/suppliers' },
    { label: 'Total Products', value: stats.products, icon: Package, color: 'brand', link: '/admin/products' },
    { label: 'Total Orders', value: stats.orders, icon: ShoppingBag, color: 'green', link: '/admin/orders' },
    { label: 'Pending Approvals', value: stats.pendingApprovals, icon: AlertTriangle, color: 'orange', link: '/admin/products' },
    { label: 'Low Stock Items', value: stats.lowStock, icon: AlertTriangle, color: 'red', link: '/admin/products' },
    { label: 'Total Revenue', value: `₹${stats.revenue.toLocaleString('en-IN')}`, icon: TrendingUp, color: 'green', link: '/admin/orders' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-500 text-sm font-body mt-1">Overview of aartisanz supplier network</p>
        </div>
        <button onClick={fetchData} className="btn-secondary flex items-center gap-2">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Shopify Sync Status */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-heading text-gray-900 font-semibold">Shopify Sync Status</h2>
          <button
            onClick={async () => {
              setSyncing(true)
              try {
                const { data: { session } } = await supabase.auth.getSession()
                const res = await fetch(import.meta.env.VITE_SUPABASE_URL + '/functions/v1/bulk-sync', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + session.access_token,
                    'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY
                  },
                  body: JSON.stringify({})
                })
                const data = await res.json()
                if (data.success) {
                  toast.success('Synced ' + data.synced + ' products to Shopify!')
                  fetchData()
                } else toast.error(data.error || 'Sync failed')
              } catch (err) { toast.error('Sync failed: ' + err.message) }
              setSyncing(false)
            }}
            disabled={syncing || syncStats.failed === 0}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            {syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            {syncing ? 'Syncing...' : 'Retry Failed (' + syncStats.failed + ')'}
          </button>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-green-50 rounded-lg p-3 text-center">
            <CheckCircle size={20} className="text-green-600 mx-auto mb-1" />
            <p className="text-xl font-heading font-bold text-green-700">{loading ? '...' : syncStats.synced}</p>
            <p className="text-xs text-gray-500 font-body">Synced to Shopify</p>
          </div>
          <div className="bg-red-50 rounded-lg p-3 text-center">
            <XCircle size={20} className="text-red-500 mx-auto mb-1" />
            <p className="text-xl font-heading font-bold text-red-600">{loading ? '...' : syncStats.failed}</p>
            <p className="text-xs text-gray-500 font-body">Not Synced</p>
          </div>
          <div className="bg-brand-50 rounded-lg p-3 text-center">
            <Package size={20} className="text-brand-800 mx-auto mb-1" />
            <p className="text-xl font-heading font-bold text-brand-800">{loading ? '...' : syncStats.total}</p>
            <p className="text-xs text-gray-500 font-body">Total Approved</p>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.map(({ label, value, icon: Icon, color, link }) => (
          <Link key={label} to={link} className="card p-4 hover:shadow-md transition-shadow">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${
              color === 'brand' ? 'bg-brand-100' :
              color === 'blue' ? 'bg-blue-100' :
              color === 'orange' ? 'bg-orange-100' :
              color === 'red' ? 'bg-red-100' : 'bg-green-100'
            }`}>
              <Icon size={16} className={
                color === 'brand' ? 'text-brand-800' :
                color === 'blue' ? 'text-blue-600' :
                color === 'orange' ? 'text-orange-600' :
                color === 'red' ? 'text-red-600' : 'text-green-600'
              } />
            </div>
            <p className="text-2xl font-heading font-bold text-gray-900">{loading ? '...' : value}</p>
            <p className="text-xs text-gray-500 font-body mt-0.5">{label}</p>
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Orders chart */}
        <div className="card p-5">
          <h2 className="font-heading text-gray-900 font-semibold mb-4">Orders — Last 7 Days</h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={ordersByDay}>
              <XAxis dataKey="date" tick={{ fontSize: 11, fontFamily: 'DM Sans' }} />
              <YAxis tick={{ fontSize: 11, fontFamily: 'DM Sans' }} allowDecimals={false} />
              <Tooltip contentStyle={{ fontFamily: 'DM Sans', fontSize: 12, borderRadius: 8, border: '1px solid #f5dbb0' }} />
              <Bar dataKey="orders" fill="#8B4513" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Recent orders */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading text-gray-900 font-semibold">Recent Orders</h2>
            <Link to="/admin/orders" className="text-xs text-brand-800 font-medium font-body hover:underline">View all</Link>
          </div>
          <div className="space-y-2">
            {recentOrders.map(order => (
              <div key={order.id} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-900 font-body">#{order.shopify_order_id}</p>
                  <p className="text-xs text-gray-400 font-body">{order.products?.name?.substring(0, 30)}...</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900 font-body">₹{order.total_amount}</p>
                  <span className={`badge-${order.status === 'fulfilled' ? 'green' : order.status === 'pending' ? 'orange' : 'blue'} text-xs`}>
                    {order.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
