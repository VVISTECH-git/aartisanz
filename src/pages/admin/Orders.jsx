import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { ShoppingBag, Loader2, RefreshCw, Search } from 'lucide-react'
import toast from 'react-hot-toast'

export default function AdminOrders() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')

  useEffect(() => { fetchOrders() }, [])

  async function fetchOrders() {
    setLoading(true)
    const { data, error } = await supabase
      .from('orders')
      .select('*, products(name, images), profiles(full_name)')
      .order('created_at', { ascending: false })
    if (error) toast.error('Failed to load orders')
    else setOrders(data || [])
    setLoading(false)
  }

  const filtered = orders.filter(o => {
    const matchesFilter = filter === 'all' || o.status === filter
    const matchesSearch = !search ||
      o.shopify_order_id?.toString().includes(search) ||
      o.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
      o.products?.name?.toLowerCase().includes(search.toLowerCase())
    return matchesFilter && matchesSearch
  })

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 size={32} className="animate-spin text-brand-800" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl text-gray-900">All Orders</h1>
          <p className="text-gray-500 text-sm font-body mt-1">{orders.length} total orders</p>
        </div>
        <button onClick={fetchOrders} className="btn-secondary flex items-center gap-2">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by order ID, customer, product..."
            className="input pl-8"
          />
        </div>
        <select value={filter} onChange={e => setFilter(e.target.value)} className="input w-40">
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="fulfilled">Fulfilled</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <ShoppingBag size={48} className="text-gray-300 mx-auto mb-4" />
          <h3 className="font-heading text-gray-600 text-lg">No orders found</h3>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Order ID', 'Product', 'Supplier', 'Customer', 'Amount', 'Status', 'Date'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 font-body">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(order => (
                <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium font-body text-brand-800">#{order.shopify_order_id}</td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-gray-900 font-body truncate max-w-32">{order.products?.name}</p>
                    <p className="text-xs text-gray-400 font-body">×{order.quantity}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 font-body">{order.profiles?.full_name}</td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-gray-900 font-body">{order.customer_name}</p>
                    <p className="text-xs text-gray-400 font-body">{order.customer_phone}</p>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 font-body">₹{order.total_amount}</td>
                  <td className="px-4 py-3">
                    <span className={`badge-${order.status === 'fulfilled' ? 'green' : order.status === 'pending' ? 'orange' : 'blue'} capitalize`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400 font-body">
                    {new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
