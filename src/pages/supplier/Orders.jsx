import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { ShoppingBag, Loader2, CheckCircle, Clock, Truck } from 'lucide-react'
import toast from 'react-hot-toast'

export default function SupplierOrders() {
  const { user } = useAuth()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [fulfilling, setFulfilling] = useState({})

  useEffect(() => { if (user) fetchOrders() }, [user])

  async function fetchOrders() {
    setLoading(true)
    const { data, error } = await supabase
      .from('orders')
      .select('*, products(name, images, price)')
      .eq('supplier_id', user.id)
      .order('created_at', { ascending: false })
    if (error) toast.error('Failed to load orders')
    else setOrders(data || [])
    setLoading(false)
  }

  async function markFulfilled(orderId, trackingNumber) {
    if (!trackingNumber) { toast.error('Please enter tracking number'); return }
    setFulfilling(prev => ({ ...prev, [orderId]: true }))

    const { error } = await supabase
      .from('orders')
      .update({ status: 'fulfilled', tracking_number: trackingNumber, fulfilled_at: new Date().toISOString() })
      .eq('id', orderId)

    if (error) toast.error('Failed to update order')
    else {
      toast.success('Order marked as fulfilled!')
      // Notify via edge function
      await supabase.functions.invoke('whatsapp-notify', {
        body: { order_id: orderId, type: 'order_fulfilled', tracking: trackingNumber }
      })
      fetchOrders()
    }
    setFulfilling(prev => ({ ...prev, [orderId]: false }))
  }

  const filtered = filter === 'all' ? orders : orders.filter(o => o.status === filter)

  const statusIcon = {
    pending: <Clock size={14} className="text-orange-500" />,
    processing: <Truck size={14} className="text-blue-500" />,
    fulfilled: <CheckCircle size={14} className="text-green-500" />,
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 size={32} className="animate-spin text-brand-800" />
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl text-gray-900">My Orders</h1>
          <p className="text-gray-500 text-sm font-body mt-1">{orders.length} total orders</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        {['all', 'pending', 'processing', 'fulfilled'].map(status => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 text-sm font-body font-medium border-b-2 -mb-px transition-colors capitalize ${
              filter === status
                ? 'border-brand-800 text-brand-800'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            {status === 'all' ? 'All Orders' : status}
            {status !== 'all' && (
              <span className="ml-1.5 text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
                {orders.filter(o => o.status === status).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <ShoppingBag size={48} className="text-gray-300 mx-auto mb-4" />
          <h3 className="font-heading text-gray-600 text-lg mb-2">No orders found</h3>
          <p className="text-gray-400 text-sm font-body">Orders will appear here when customers purchase your products</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(order => {
            const [trackingInput, setTrackingInput] = useState('')
            return (
              <div key={order.id} className="card p-5">
                <div className="flex gap-4">
                  {/* Product image */}
                  <div className="w-16 h-16 rounded-lg overflow-hidden bg-brand-50 flex-shrink-0">
                    {order.products?.images?.[0] ? (
                      <img src={order.products.images[0]} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ShoppingBag size={20} className="text-brand-300" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-heading font-semibold text-gray-900">Order #{order.shopify_order_id}</p>
                        <p className="text-xs text-gray-400 font-body mt-0.5">
                          {new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {statusIcon[order.status]}
                        <span className={`badge-${order.status === 'fulfilled' ? 'green' : order.status === 'pending' ? 'orange' : 'blue'} capitalize`}>
                          {order.status}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 lg:grid-cols-4 gap-3">
                      <div>
                        <p className="text-xs text-gray-400 font-body">Product</p>
                        <p className="text-sm font-medium text-gray-900 font-body truncate">{order.products?.name}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 font-body">Quantity</p>
                        <p className="text-sm font-medium text-gray-900 font-body">{order.quantity} piece{order.quantity > 1 ? 's' : ''}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 font-body">Amount</p>
                        <p className="text-sm font-medium text-gray-900 font-body">₹{order.total_amount}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 font-body">Customer</p>
                        <p className="text-sm font-medium text-gray-900 font-body truncate">{order.customer_name}</p>
                      </div>
                    </div>

                    {/* Shipping address */}
                    <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-400 font-body mb-1">Ship to:</p>
                      <p className="text-sm text-gray-700 font-body">{order.shipping_address}</p>
                      <p className="text-sm text-gray-700 font-body">{order.customer_phone}</p>
                    </div>

                    {/* Tracking */}
                    {order.tracking_number && (
                      <div className="mt-2 flex items-center gap-2">
                        <Truck size={14} className="text-green-500" />
                        <p className="text-xs text-gray-500 font-body">Tracking: <span className="font-medium text-gray-900">{order.tracking_number}</span></p>
                      </div>
                    )}

                    {/* Fulfill action */}
                    {order.status === 'pending' && (
                      <div className="mt-3 flex gap-2">
                        <input
                          type="text"
                          placeholder="Enter tracking number"
                          className="input flex-1 text-xs"
                          onChange={e => setTrackingInput(e.target.value)}
                        />
                        <button
                          onClick={() => markFulfilled(order.id, trackingInput)}
                          disabled={fulfilling[order.id]}
                          className="btn-primary flex items-center gap-1.5 text-xs whitespace-nowrap"
                        >
                          {fulfilling[order.id] ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                          Mark Shipped
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
