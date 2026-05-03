import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { calculateShopifyStock, getStockStatus } from '../../lib/bufferLogic'
import { Package, ShoppingBag, AlertTriangle, TrendingUp, Plus, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'

export default function SupplierDashboard() {
  const { user, profile } = useAuth()
  const [stats, setStats] = useState({ products: 0, orders: 0, lowStock: 0, pendingOrders: 0 })
  const [recentOrders, setRecentOrders] = useState([])
  const [lowStockProducts, setLowStockProducts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (user) fetchData() }, [user])

  async function fetchData() {
    setLoading(true)
    try {
      const [productsRes, ordersRes] = await Promise.all([
        supabase.from('products').select('*').eq('supplier_id', user.id),
        supabase.from('orders').select('*, products(name, images)').eq('supplier_id', user.id).order('created_at', { ascending: false }).limit(5)
      ])

      const products = productsRes.data || []
      const orders = ordersRes.data || []
      const lowStock = products.filter(p => p.supplier_stock <= 10 && p.supplier_stock > 0)
      const pending = orders.filter(o => o.status === 'pending')

      setStats({
        products: products.length,
        orders: orders.length,
        lowStock: lowStock.length,
        pendingOrders: pending.length
      })
      setRecentOrders(orders)
      setLowStockProducts(lowStock)
    } catch (err) {
      toast.error('Failed to load dashboard')
    }
    setLoading(false)
  }

  const statCards = [
    { label: 'Total Products', value: stats.products, icon: Package, color: 'brand', link: '/supplier/products' },
    { label: 'Total Orders', value: stats.orders, icon: ShoppingBag, color: 'blue', link: '/supplier/orders' },
    { label: 'Low Stock Items', value: stats.lowStock, icon: AlertTriangle, color: 'orange', link: '/supplier/products' },
    { label: 'Pending Orders', value: stats.pendingOrders, icon: TrendingUp, color: 'green', link: '/supplier/orders' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl text-gray-900">Good morning, {profile?.full_name?.split(' ')[0] || 'Supplier'}! 👋</h1>
          <p className="text-gray-500 text-sm font-body mt-1">Here's what's happening with your inventory today.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchData} className="btn-secondary flex items-center gap-2">
            <RefreshCw size={14} /> Refresh
          </button>
          <Link to="/supplier/products/add" className="btn-primary flex items-center gap-2">
            <Plus size={14} /> Add Product
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(({ label, value, icon: Icon, color, link }) => (
          <Link key={label} to={link} className="card p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                color === 'brand' ? 'bg-brand-100' :
                color === 'blue' ? 'bg-blue-100' :
                color === 'orange' ? 'bg-orange-100' : 'bg-green-100'
              }`}>
                <Icon size={16} className={
                  color === 'brand' ? 'text-brand-800' :
                  color === 'blue' ? 'text-blue-600' :
                  color === 'orange' ? 'text-orange-600' : 'text-green-600'
                } />
              </div>
            </div>
            <p className="text-2xl font-heading font-bold text-gray-900">{loading ? '...' : value}</p>
            <p className="text-xs text-gray-500 font-body mt-0.5">{label}</p>
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Low Stock Alert */}
        {lowStockProducts.length > 0 && (
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle size={16} className="text-orange-500" />
              <h2 className="font-heading text-gray-900 font-semibold">Low Stock Alert</h2>
            </div>
            <div className="space-y-3">
              {lowStockProducts.map(product => {
                const status = getStockStatus(product.supplier_stock)
                const shopifyStock = calculateShopifyStock(product.supplier_stock)
                return (
                  <div key={product.id} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-900 font-body">{product.name}</p>
                      <p className="text-xs text-gray-500 font-body">Shopify shows: {shopifyStock} pieces</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-heading font-bold text-orange-600">{product.supplier_stock}</p>
                      <span className={`badge-${status.color}`}>{status.label}</span>
                    </div>
                  </div>
                )
              })}
            </div>
            <Link to="/supplier/products" className="block mt-3 text-xs text-brand-800 font-medium font-body hover:underline">
              Update stock levels →
            </Link>
          </div>
        )}

        {/* Recent Orders */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading text-gray-900 font-semibold">Recent Orders</h2>
            <Link to="/supplier/orders" className="text-xs text-brand-800 font-medium font-body hover:underline">View all</Link>
          </div>
          {recentOrders.length === 0 ? (
            <div className="text-center py-8">
              <ShoppingBag size={32} className="text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400 font-body">No orders yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentOrders.map(order => (
                <div key={order.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-900 font-body">#{order.shopify_order_id}</p>
                    <p className="text-xs text-gray-500 font-body">{order.products?.name} × {order.quantity}</p>
                  </div>
                  <div className="text-right">
                    <span className={`badge-${
                      order.status === 'fulfilled' ? 'green' :
                      order.status === 'pending' ? 'orange' : 'blue'
                    }`}>{order.status}</span>
                    <p className="text-xs text-gray-400 font-body mt-1">
                      {new Date(order.created_at).toLocaleDateString('en-IN')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
