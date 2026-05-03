import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { calculateShopifyStock, getStockStatus } from '../../lib/bufferLogic'
import { Plus, Trash2, RefreshCw, Package, Loader2, Upload } from 'lucide-react'
import toast from 'react-hot-toast'

export default function SupplierProducts() {
  const { user } = useAuth()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [updatingStock, setUpdatingStock] = useState({})
  const [editingStock, setEditingStock] = useState({})
  const [search, setSearch] = useState('')

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
    const { error } = await supabase.from('products').update({
      supplier_stock: stock, shopify_stock: shopifyStock, updated_at: new Date().toISOString()
    }).eq('id', productId)
    if (error) toast.error('Failed to update stock')
    else {
      toast.success('Stock updated!')
      await supabase.functions.invoke('shopify-sync', { body: { product_id: productId, action: 'update_stock' } })
      fetchProducts()
    }
    setUpdatingStock(prev => ({ ...prev, [productId]: false }))
    setEditingStock(prev => ({ ...prev, [productId]: false }))
  }

  async function deleteProduct(productId) {
    if (!confirm('Delete this product?')) return
    const { error } = await supabase.from('products').delete().eq('id', productId)
    if (error) toast.error('Failed to delete')
    else { toast.success('Deleted'); fetchProducts() }
  }

  const filtered = products.filter(p =>
    !search || p.name?.toLowerCase().includes(search.toLowerCase()) || p.sku?.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 size={32} className="animate-spin text-brand-800" />
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl text-gray-900">My Products</h1>
          <p className="text-gray-500 text-sm font-body mt-1">
            {products.filter(p => p.is_approved).length} live · {products.filter(p => !p.is_approved).length} pending · {products.length} total
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchProducts} className="btn-secondary flex items-center gap-2">
            <RefreshCw size={14} /> Refresh
          </button>
          <Link to="/supplier/products/bulk-upload" className="btn-secondary flex items-center gap-2">
            <Upload size={14} /> Bulk Upload
          </Link>
          <Link to="/supplier/products/add" className="btn-primary flex items-center gap-2">
            <Plus size={14} /> Add Product
          </Link>
        </div>
      </div>

      <div className="card p-4">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or SKU..."
          className="input"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <Package size={48} className="text-gray-300 mx-auto mb-4" />
          <h3 className="font-heading text-gray-600 text-lg mb-2">No products yet</h3>
          <p className="text-gray-400 text-sm font-body mb-4">Add your first product to get started</p>
          <Link to="/supplier/products/add" className="btn-primary inline-flex items-center gap-2">
            <Plus size={14} /> Add Product
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(product => {
            const shopifyStock = calculateShopifyStock(product.supplier_stock)
            const isEditing = editingStock[product.id]
            const isUpdating = updatingStock[product.id]

            return (
              <div key={product.id} className="card p-3">
                <div className="flex gap-3 items-center">
                  <div className="w-10 h-10 rounded-lg bg-brand-50 flex-shrink-0 flex items-center justify-center">
                    {product.images?.[0] ? (
                      <img src={product.images[0]} alt="" className="w-full h-full object-cover rounded-lg" />
                    ) : (
                      <Package size={16} className="text-brand-300" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-body font-semibold text-gray-900 text-sm truncate">{product.name}</p>
                        <p className="text-xs text-gray-400 font-body">{product.sku} · {product.category} · ₹{product.price}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs text-gray-500 font-body">
                          Stock: <b>{product.supplier_stock}</b> → Shopify: <b className={shopifyStock > 0 ? 'text-green-600' : 'text-red-600'}>{shopifyStock}</b>
                        </span>
                        <span className={product.is_approved ? 'badge-green' : 'badge-orange'}>
                          {product.is_approved ? 'Live' : 'Pending'}
                        </span>
                        {isEditing ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min="0"
                              defaultValue={product.supplier_stock}
                              className="input w-20 text-xs py-1"
                              id={`stock-${product.id}`}
                              autoFocus
                            />
                            <button
                              onClick={() => updateStock(product.id, document.getElementById(`stock-${product.id}`).value)}
                              disabled={isUpdating}
                              className="btn-primary text-xs py-1 px-2 flex items-center gap-1"
                            >
                              {isUpdating ? <Loader2 size={10} className="animate-spin" /> : null}
                              Save
                            </button>
                            <button
                              onClick={() => setEditingStock(prev => ({ ...prev, [product.id]: false }))}
                              className="btn-secondary text-xs py-1 px-2"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setEditingStock(prev => ({ ...prev, [product.id]: true }))}
                            className="btn-secondary text-xs py-1 px-2 flex items-center gap-1"
                          >
                            <RefreshCw size={10} /> Stock
                          </button>
                        )}
                        <button
                          onClick={() => deleteProduct(product.id)}
                          className="p-1 text-red-400 hover:text-red-600 rounded transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
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
