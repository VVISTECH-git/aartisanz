import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { calculateShopifyStock, getStockStatus } from '../../lib/bufferLogic'
import { CheckCircle, XCircle, Package, Loader2, RefreshCw, Eye, Filter } from 'lucide-react'
import toast from 'react-hot-toast'

export default function AdminProducts() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pending')
  const [approving, setApproving] = useState({})

  useEffect(() => { fetchProducts() }, [])

  async function fetchProducts() {
    setLoading(true)
    const { data, error } = await supabase
      .from('products')
      .select('*, profiles(full_name, email)')
      .order('created_at', { ascending: false })
    if (error) toast.error('Failed to load products')
    else setProducts(data || [])
    setLoading(false)
  }

  async function approveProduct(productId) {
    setApproving(prev => ({ ...prev, [productId]: 'approving' }))
    const product = products.find(p => p.id === productId)
    const shopifyStock = calculateShopifyStock(product.supplier_stock)

    // Update in Supabase
    const { error } = await supabase
      .from('products')
      .update({ is_approved: true, shopify_stock: shopifyStock })
      .eq('id', productId)

    if (error) {
      toast.error('Failed to approve product')
    } else {
      // Push to Shopify via edge function
      const { error: syncError } = await supabase.functions.invoke('shopify-sync', {
        body: { product_id: productId, action: 'create' }
      })
      if (syncError) toast.error('Approved but Shopify sync failed — retry manually')
      else toast.success('Product approved and published to Shopify!')
      fetchProducts()
    }
    setApproving(prev => ({ ...prev, [productId]: null }))
  }

  async function rejectProduct(productId) {
    const reason = prompt('Reason for rejection (optional):')
    const { error } = await supabase
      .from('products')
      .update({ is_approved: false, rejection_reason: reason })
      .eq('id', productId)
    if (error) toast.error('Failed to reject')
    else { toast.success('Product rejected'); fetchProducts() }
  }

  async function updateShopifyStock(productId, supplierStock) {
    const shopifyStock = calculateShopifyStock(supplierStock)
    await supabase.from('products').update({ shopify_stock: shopifyStock }).eq('id', productId)
    await supabase.functions.invoke('shopify-sync', {
      body: { product_id: productId, shopify_stock: shopifyStock, action: 'update_stock' }
    })
    toast.success('Stock synced to Shopify')
    fetchProducts()
  }

  const filtered = filter === 'all' ? products :
    filter === 'pending' ? products.filter(p => !p.is_approved) :
    products.filter(p => p.is_approved)

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 size={32} className="animate-spin text-brand-800" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl text-gray-900">All Products</h1>
          <p className="text-gray-500 text-sm font-body mt-1">
            {products.filter(p => !p.is_approved).length} pending approval · {products.filter(p => p.is_approved).length} live
          </p>
        </div>
        <button onClick={fetchProducts} className="btn-secondary flex items-center gap-2">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        {[
          { key: 'pending', label: 'Pending Approval' },
          { key: 'approved', label: 'Live on Shopify' },
          { key: 'all', label: 'All Products' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-4 py-2 text-sm font-body font-medium border-b-2 -mb-px transition-colors ${
              filter === key ? 'border-brand-800 text-brand-800' : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            {label}
            <span className="ml-1.5 text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
              {key === 'all' ? products.length : key === 'pending' ? products.filter(p => !p.is_approved).length : products.filter(p => p.is_approved).length}
            </span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <Package size={48} className="text-gray-300 mx-auto mb-4" />
          <h3 className="font-heading text-gray-600 text-lg">No products here</h3>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(product => {
            const status = getStockStatus(product.supplier_stock)
            const shopifyStock = calculateShopifyStock(product.supplier_stock)
            return (
              <div key={product.id} className={`card p-4 ${!product.is_approved ? 'border-orange-200 bg-orange-50/30' : ''}`}>
                <div className="flex gap-4">
                  <div className="w-16 h-16 rounded-lg overflow-hidden bg-brand-50 flex-shrink-0">
                    {product.images?.[0] ? (
                      <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package size={20} className="text-brand-300" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-heading font-semibold text-gray-900">{product.name}</h3>
                        <p className="text-xs text-gray-400 font-body">
                          by {product.profiles?.full_name} · ₹{product.price} · {product.category}
                        </p>
                      </div>
                      <div className="flex gap-1.5">
                        <span className={`badge-${status.color}`}>{status.label}</span>
                        <span className={product.is_approved ? 'badge-green' : 'badge-orange'}>
                          {product.is_approved ? 'Live' : 'Pending'}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <div className="bg-gray-50 rounded-lg p-2 text-center">
                        <p className="text-xs text-gray-400 font-body">Supplier Stock</p>
                        <p className="text-lg font-heading font-bold text-gray-900">{product.supplier_stock}</p>
                      </div>
                      <div className="bg-orange-50 rounded-lg p-2 text-center">
                        <p className="text-xs text-gray-400 font-body">Buffer</p>
                        <p className="text-lg font-heading font-bold text-orange-600">{product.supplier_stock - shopifyStock}</p>
                      </div>
                      <div className={`${shopifyStock > 0 ? 'bg-green-50' : 'bg-red-50'} rounded-lg p-2 text-center`}>
                        <p className="text-xs text-gray-400 font-body">Shopify Stock</p>
                        <p className={`text-lg font-heading font-bold ${shopifyStock > 0 ? 'text-green-600' : 'text-red-600'}`}>{shopifyStock}</p>
                      </div>
                    </div>

                    <div className="mt-3 flex gap-2 flex-wrap">
                      {!product.is_approved ? (
                        <>
                          <button
                            onClick={() => approveProduct(product.id)}
                            disabled={approving[product.id] === 'approving'}
                            className="btn-primary flex items-center gap-1.5 text-xs"
                          >
                            {approving[product.id] === 'approving' ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                            Approve & Publish
                          </button>
                          <button
                            onClick={() => rejectProduct(product.id)}
                            className="btn-danger flex items-center gap-1.5 text-xs"
                          >
                            <XCircle size={12} /> Reject
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => updateShopifyStock(product.id, product.supplier_stock)}
                          className="btn-secondary flex items-center gap-1.5 text-xs"
                        >
                          <RefreshCw size={12} /> Sync Stock to Shopify
                        </button>
                      )}
                    </div>
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
