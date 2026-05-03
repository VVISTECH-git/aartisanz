import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { calculateShopifyStock, getStockStatus, getBufferAmount } from '../../lib/bufferLogic'
import { Plus, Edit2, Trash2, RefreshCw, Package, Eye, EyeOff, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

export default function SupplierProducts() {
  const { user } = useAuth()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [updatingStock, setUpdatingStock] = useState({})
  const [editingStock, setEditingStock] = useState({})

  useEffect(() => { if (user) fetchProducts() }, [user])

  async function fetchProducts() {
    setLoading(true)
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('supplier_id', user.id)
      .order('created_at', { ascending: false })
    if (error) toast.error('Failed to load products')
    else setProducts(data || [])
    setLoading(false)
  }

  async function updateStock(productId, newStock) {
    const stock = parseInt(newStock)
    if (isNaN(stock) || stock < 0) { toast.error('Invalid stock value'); return }

    setUpdatingStock(prev => ({ ...prev, [productId]: true }))
    const shopifyStock = calculateShopifyStock(stock)

    const { error } = await supabase
      .from('products')
      .update({
        supplier_stock: stock,
        shopify_stock: shopifyStock,
        updated_at: new Date().toISOString()
      })
      .eq('id', productId)

    if (error) {
      toast.error('Failed to update stock')
    } else {
      toast.success('Stock updated! Shopify will sync shortly.')
      // Trigger Shopify sync via edge function
      await supabase.functions.invoke('shopify-sync', {
        body: { product_id: productId, shopify_stock: shopifyStock }
      })
      fetchProducts()
    }
    setUpdatingStock(prev => ({ ...prev, [productId]: false }))
    setEditingStock(prev => ({ ...prev, [productId]: false }))
  }

  async function deleteProduct(productId) {
    if (!confirm('Are you sure? This will remove the product from Shopify too.')) return
    const { error } = await supabase.from('products').delete().eq('id', productId)
    if (error) toast.error('Failed to delete product')
    else { toast.success('Product deleted'); fetchProducts() }
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
          <h1 className="font-heading text-2xl text-gray-900">My Products</h1>
          <p className="text-gray-500 text-sm font-body mt-1">{products.length} products · Update stock levels daily</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchProducts} className="btn-secondary flex items-center gap-2">
            <RefreshCw size={14} /> Refresh
          </button>
          <Link to="/supplier/products/add" className="btn-primary flex items-center gap-2">
            <Plus size={14} /> Add Product
          </Link>
        </div>
      </div>

      {products.length === 0 ? (
        <div className="card p-12 text-center">
          <Package size={48} className="text-gray-300 mx-auto mb-4" />
          <h3 className="font-heading text-gray-600 text-lg mb-2">No products yet</h3>
          <p className="text-gray-400 text-sm font-body mb-4">Add your first product to get started</p>
          <Link to="/supplier/products/add" className="btn-primary inline-flex items-center gap-2">
            <Plus size={14} /> Add Product
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {products.map(product => {
            const status = getStockStatus(product.supplier_stock)
            const shopifyStock = calculateShopifyStock(product.supplier_stock)
            const buffer = getBufferAmount(product.supplier_stock)
            const isEditing = editingStock[product.id]
            const isUpdating = updatingStock[product.id]

            return (
              <div key={product.id} className="card p-4 lg:p-5">
                <div className="flex gap-4">
                  {/* Image */}
                  <div className="w-16 h-16 lg:w-20 lg:h-20 rounded-lg overflow-hidden bg-brand-50 flex-shrink-0">
                    {product.images?.[0] ? (
                      <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package size={24} className="text-brand-300" />
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-heading font-semibold text-gray-900">{product.name}</h3>
                        <p className="text-xs text-gray-400 font-body mt-0.5">SKU: {product.sku || 'N/A'} · ₹{product.price}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className={`badge-${status.color}`}>{status.label}</span>
                        <span className={product.is_approved ? 'badge-green' : 'badge-gray'}>
                          {product.is_approved ? 'Live' : 'Pending'}
                        </span>
                      </div>
                    </div>

                    {/* Stock info */}
                    <div className="mt-3 grid grid-cols-3 gap-3">
                      <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                        <p className="text-xs text-gray-400 font-body">Your Stock</p>
                        <p className="text-xl font-heading font-bold text-gray-900">{product.supplier_stock}</p>
                      </div>
                      <div className="bg-orange-50 rounded-lg p-2.5 text-center">
                        <p className="text-xs text-gray-400 font-body">Buffer</p>
                        <p className="text-xl font-heading font-bold text-orange-600">{buffer}</p>
                      </div>
                      <div className={`${shopifyStock > 0 ? 'bg-green-50' : 'bg-red-50'} rounded-lg p-2.5 text-center`}>
                        <p className="text-xs text-gray-400 font-body">On Shopify</p>
                        <p className={`text-xl font-heading font-bold ${shopifyStock > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {shopifyStock > 0 ? shopifyStock : <EyeOff size={18} className="mx-auto mt-1" />}
                        </p>
                      </div>
                    </div>

                    {/* Update stock */}
                    <div className="mt-3 flex items-center gap-2">
                      {isEditing ? (
                        <div className="flex items-center gap-2 flex-1">
                          <input
                            type="number"
                            min="0"
                            defaultValue={product.supplier_stock}
                            className="input w-24"
                            id={`stock-${product.id}`}
                            autoFocus
                          />
                          <button
                            onClick={() => updateStock(product.id, document.getElementById(`stock-${product.id}`).value)}
                            disabled={isUpdating}
                            className="btn-primary flex items-center gap-1.5 text-xs py-2"
                          >
                            {isUpdating ? <Loader2 size={12} className="animate-spin" /> : null}
                            Update
                          </button>
                          <button
                            onClick={() => setEditingStock(prev => ({ ...prev, [product.id]: false }))}
                            className="btn-secondary text-xs py-2"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setEditingStock(prev => ({ ...prev, [product.id]: true }))}
                          className="btn-secondary flex items-center gap-1.5 text-xs"
                        >
                          <RefreshCw size={12} /> Update Stock
                        </button>
                      )}
                      <button
                        onClick={() => deleteProduct(product.id)}
                        className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
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
