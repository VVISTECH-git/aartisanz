import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { calculateShopifyStock, getStockStatus } from '../../lib/bufferLogic'
import { CheckCircle, XCircle, Package, Loader2, RefreshCw, Search, ChevronLeft, ChevronRight, CheckSquare } from 'lucide-react'
import toast from 'react-hot-toast'

const PAGE_SIZE = 20

export default function AdminProducts() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pending')
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [approving, setApproving] = useState({})
  const [selected, setSelected] = useState([])
  const [bulkApproving, setBulkApproving] = useState(false)

  const CATEGORIES = ['all', 'Kalamkari Sarees', 'Pochampally Ikat', 'Silk Sarees', 'Cotton Sarees', 'Kalamkari Fabrics', 'Kalamkari Accessories', 'Kurtis & Frocks']

  useEffect(() => { fetchProducts() }, [])
  useEffect(() => { setPage(1); setSelected([]) }, [filter, search, categoryFilter])

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
    setApproving(prev => ({ ...prev, [productId]: true }))
    const product = products.find(p => p.id === productId)
    const shopifyStock = calculateShopifyStock(product.supplier_stock)
    const { error } = await supabase.from('products')
      .update({ is_approved: true, shopify_stock: shopifyStock })
      .eq('id', productId)
    if (error) { toast.error('Failed to approve'); setApproving(prev => ({ ...prev, [productId]: false })); return }
    toast.success('Approved! Syncing to Shopify...')
    setProducts(prev => prev.map(p => p.id === productId ? { ...p, is_approved: true, shopify_stock: shopifyStock } : p))
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(import.meta.env.VITE_SUPABASE_URL + '/functions/v1/shopify-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + session.access_token,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY
        },
        body: JSON.stringify({ product_id: productId, action: 'create' })
      })
      const data = await res.json()
      if (data.success) toast.success('Synced to Shopify!')
      else toast.error('Approved but sync failed: ' + (data.error || 'Unknown'))
    } catch (err) {
      toast.error('Approved but sync failed: ' + err.message)
    }
    setApproving(prev => ({ ...prev, [productId]: false }))
  }

  async function rejectProduct(productId) {
    const reason = prompt('Reason for rejection (optional):')
    const { error } = await supabase.from('products')
      .update({ is_approved: false, rejection_reason: reason })
      .eq('id', productId)
    if (error) toast.error('Failed to reject')
    else {
      toast.success('Rejected')
      setProducts(prev => prev.map(p => p.id === productId ? { ...p, is_approved: false } : p))
    }
  }

  async function bulkApprove() {
    if (selected.length === 0) return
    setBulkApproving(true)
    const batchSize = 50
    let count = 0
    for (let i = 0; i < selected.length; i += batchSize) {
      const batch = selected.slice(i, i + batchSize)
      const { error } = await supabase.from('products').update({ is_approved: true }).in('id', batch)
      if (!error) count += batch.length
    }
    toast.success(count + ' products approved!')
    setSelected([])
    fetchProducts()
    setBulkApproving(false)
  }

  async function approveAll() {
    const pendingCount = products.filter(p => !p.is_approved).length
    if (!confirm('Approve ALL ' + pendingCount + ' pending products?')) return
    setBulkApproving(true)
    const pending = products.filter(p => !p.is_approved).map(p => p.id)
    const batchSize = 50
    let count = 0
    for (let i = 0; i < pending.length; i += batchSize) {
      const batch = pending.slice(i, i + batchSize)
      const { error } = await supabase.from('products').update({ is_approved: true }).in('id', batch)
      if (!error) count += batch.length
    }
    toast.success(count + ' products approved!')
    fetchProducts()
    setBulkApproving(false)
  }

  function toggleSelect(id) {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function toggleSelectAll() {
    const pageIds = paginated.map(p => p.id)
    const allSelected = pageIds.every(id => selected.includes(id))
    if (allSelected) setSelected(prev => prev.filter(id => !pageIds.includes(id)))
    else setSelected(prev => [...new Set([...prev, ...pageIds])])
  }

  const filtered = products.filter(p => {
    const matchFilter = filter === 'all' ? true : filter === 'pending' ? !p.is_approved : p.is_approved
    const matchSearch = !search || p.name?.toLowerCase().includes(search.toLowerCase()) || p.sku?.toLowerCase().includes(search.toLowerCase())
    const matchCategory = categoryFilter === 'all' || p.category === categoryFilter
    return matchFilter && matchSearch && matchCategory
  })

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const pageIds = paginated.map(p => p.id)
  const allPageSelected = pageIds.length > 0 && pageIds.every(id => selected.includes(id))

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 size={32} className="animate-spin text-brand-800" />
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl text-gray-900">All Products</h1>
          <p className="text-gray-500 text-sm font-body mt-1">
            {products.filter(p => !p.is_approved).length} pending · {products.filter(p => p.is_approved).length} live · {products.length} total
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchProducts} className="btn-secondary flex items-center gap-2">
            <RefreshCw size={14} /> Refresh
          </button>
          {products.filter(p => !p.is_approved).length > 0 && (
            <button onClick={approveAll} disabled={bulkApproving} className="btn-primary flex items-center gap-2">
              {bulkApproving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
              Approve All ({products.filter(p => !p.is_approved).length})
            </button>
          )}
        </div>
      </div>

      <div className="card p-4 space-y-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or SKU..." className="input pl-8" />
        </div>

        <div className="flex gap-1 border-b border-gray-200">
          {[
            { key: 'pending', label: 'Pending', count: products.filter(p => !p.is_approved).length },
            { key: 'approved', label: 'Live', count: products.filter(p => p.is_approved).length },
            { key: 'all', label: 'All', count: products.length },
          ].map(({ key, label, count }) => (
            <button key={key} onClick={() => setFilter(key)}
              className={'px-3 py-2 text-sm font-body font-medium border-b-2 -mb-px transition-colors ' + (filter === key ? 'border-brand-800 text-brand-800' : 'border-transparent text-gray-400 hover:text-gray-600')}>
              {label} <span className="ml-1 text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">{count}</span>
            </button>
          ))}
        </div>

        <div className="flex gap-2 flex-wrap">
          {CATEGORIES.map(cat => (
            <button key={cat} onClick={() => setCategoryFilter(cat)}
              className={'px-3 py-1 text-xs font-body rounded-full border transition-colors ' + (categoryFilter === cat ? 'bg-brand-800 text-white border-brand-800' : 'border-gray-200 text-gray-600 hover:border-brand-400')}>
              {cat === 'all' ? 'All Categories' : cat}
            </button>
          ))}
        </div>
      </div>

      {selected.length > 0 && (
        <div className="card p-3 flex items-center justify-between bg-brand-50 border-brand-200">
          <p className="text-sm font-body text-brand-800">{selected.length} products selected</p>
          <div className="flex gap-2">
            <button onClick={() => setSelected([])} className="btn-secondary text-xs py-1.5">Clear</button>
            <button onClick={bulkApprove} disabled={bulkApproving} className="btn-primary flex items-center gap-1.5 text-xs py-1.5">
              {bulkApproving ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
              Approve Selected ({selected.length})
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 font-body">
          Showing {Math.min((page-1)*PAGE_SIZE+1, filtered.length)}–{Math.min(page*PAGE_SIZE, filtered.length)} of {filtered.length}
        </p>
        {filter !== 'approved' && paginated.some(p => !p.is_approved) && (
          <button onClick={toggleSelectAll} className="flex items-center gap-1.5 text-xs text-brand-800 font-body hover:underline">
            <CheckSquare size={13} />
            {allPageSelected ? 'Deselect page' : 'Select this page'}
          </button>
        )}
      </div>

      {paginated.length === 0 ? (
        <div className="card p-12 text-center">
          <Package size={48} className="text-gray-300 mx-auto mb-4" />
          <h3 className="font-heading text-gray-600 text-lg">No products found</h3>
        </div>
      ) : (
        <div className="space-y-2">
          {paginated.map(product => {
            const status = getStockStatus(product.supplier_stock)
            const shopifyStock = calculateShopifyStock(product.supplier_stock)
            const isSelected = selected.includes(product.id)
            return (
              <div key={product.id} className={'card p-3 transition-colors ' + (isSelected ? 'border-brand-400 bg-brand-50/50' : !product.is_approved ? 'border-orange-100' : '')}>
                <div className="flex gap-3 items-center">
                  {!product.is_approved && (
                    <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(product.id)}
                      className="w-4 h-4 accent-brand-800 flex-shrink-0 cursor-pointer" />
                  )}
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
                        {!product.is_approved ? (
                          <>
                            <button onClick={() => approveProduct(product.id)} disabled={approving[product.id]}
                              className="btn-primary text-xs py-1 px-2 flex items-center gap-1">
                              {approving[product.id] ? <Loader2 size={10} className="animate-spin" /> : <CheckCircle size={10} />}
                              Approve
                            </button>
                            <button onClick={() => rejectProduct(product.id)} className="btn-danger text-xs py-1 px-2">
                              Reject
                            </button>
                          </>
                        ) : (
                          <CheckCircle size={14} className="text-green-500" />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between card p-3">
          <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1}
            className="btn-secondary flex items-center gap-1 text-sm py-1.5 disabled:opacity-40">
            <ChevronLeft size={14} /> Previous
          </button>
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let pageNum = totalPages <= 7 ? i + 1 : page <= 4 ? i + 1 : page >= totalPages - 3 ? totalPages - 6 + i : page - 3 + i
              return (
                <button key={pageNum} onClick={() => setPage(pageNum)}
                  className={'w-8 h-8 text-xs font-body rounded-lg transition-colors ' + (page === pageNum ? 'bg-brand-800 text-white' : 'text-gray-600 hover:bg-brand-50')}>
                  {pageNum}
                </button>
              )
            })}
          </div>
          <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page === totalPages}
            className="btn-secondary flex items-center gap-1 text-sm py-1.5 disabled:opacity-40">
            Next <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  )
}
