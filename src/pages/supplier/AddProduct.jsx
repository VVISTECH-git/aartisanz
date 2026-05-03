import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { calculateShopifyStock } from '../../lib/bufferLogic'
import { Upload, X, Loader2, ArrowLeft } from 'lucide-react'
import toast from 'react-hot-toast'

const CATEGORIES = ['Kalamkari Sarees', 'Pochampally Ikat', 'Silk Sarees', 'Cotton Sarees', 'Kalamkari Fabrics', 'Kalamkari Accessories', 'Kurtis & Frocks']
const OCCASIONS = ['Festival', 'Wedding', 'Daily Wear', 'Office Wear', 'Casual']
const SAREE_TYPES = ['Kalamkari', 'Pochampally Ikat', 'Silk', 'Cotton', 'Mangalagiri', 'Gadwal']

export default function SupplierAddProduct() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [images, setImages] = useState([])
  const [uploadingImages, setUploadingImages] = useState(false)

  const [form, setForm] = useState({
    name: '',
    sku: '',
    description: '',
    price: '',
    compare_price: '',
    supplier_stock: '',
    category: '',
    saree_type: '',
    occasion: '',
    fabric: '',
    color: '',
    weight: '',
  })

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleImageUpload(e) {
    const files = Array.from(e.target.files)
    if (files.length + images.length > 5) { toast.error('Max 5 images allowed'); return }

    setUploadingImages(true)
    const uploaded = []

    for (const file of files) {
      const ext = file.name.split('.').pop()
      const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${ext}`

      const { data, error } = await supabase.storage
        .from('product-images')
        .upload(fileName, file)

      if (error) { toast.error(`Failed to upload ${file.name}`); continue }

      const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(fileName)
      uploaded.push(publicUrl)
    }

    setImages(prev => [...prev, ...uploaded])
    setUploadingImages(false)
  }

  function removeImage(index) {
    setImages(prev => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name || !form.price || !form.supplier_stock) {
      toast.error('Please fill in all required fields')
      return
    }

    setLoading(true)
    const supplierStock = parseInt(form.supplier_stock)
    const shopifyStock = calculateShopifyStock(supplierStock)

    const tags = [form.saree_type, form.occasion, form.category].filter(Boolean)

    const { error } = await supabase.from('products').insert({
      supplier_id: user.id,
      name: form.name,
      sku: form.sku,
      description: form.description,
      price: parseFloat(form.price),
      compare_price: form.compare_price ? parseFloat(form.compare_price) : null,
      supplier_stock: supplierStock,
      shopify_stock: shopifyStock,
      category: form.category,
      tags,
      fabric: form.fabric,
      color: form.color,
      images,
      is_approved: false,
      shopify_product_id: null,
    })

    if (error) {
      toast.error('Failed to add product: ' + error.message)
    } else {
      toast.success('Product submitted for approval!')
      navigate('/supplier/products')
    }
    setLoading(false)
  }

  const shopifyPreview = form.supplier_stock ? calculateShopifyStock(parseInt(form.supplier_stock) || 0) : 0

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-brand-100 rounded-lg transition-colors">
          <ArrowLeft size={18} className="text-brand-800" />
        </button>
        <div>
          <h1 className="font-heading text-2xl text-gray-900">Add New Product</h1>
          <p className="text-gray-500 text-sm font-body">Products require admin approval before going live on Shopify</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="card p-5 space-y-4">
          <h2 className="font-heading text-gray-900 font-semibold">Basic Information</h2>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Product Name *</label>
              <input name="name" value={form.name} onChange={handleChange} className="input" placeholder="e.g. Handblock Kalamkari Cotton Saree - Red" required />
            </div>
            <div>
              <label className="label">SKU</label>
              <input name="sku" value={form.sku} onChange={handleChange} className="input" placeholder="e.g. KAL-001" />
            </div>
            <div>
              <label className="label">Category *</label>
              <select name="category" value={form.category} onChange={handleChange} className="input" required>
                <option value="">Select category</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="label">Description</label>
              <textarea name="description" value={form.description} onChange={handleChange} className="input" rows={3} placeholder="Describe the product — fabric, print, blouse piece, etc." />
            </div>
          </div>
        </div>

        {/* Pricing */}
        <div className="card p-5 space-y-4">
          <h2 className="font-heading text-gray-900 font-semibold">Pricing</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Selling Price (₹) *</label>
              <input name="price" value={form.price} onChange={handleChange} type="number" min="0" className="input" placeholder="1200" required />
            </div>
            <div>
              <label className="label">Compare Price (₹)</label>
              <input name="compare_price" value={form.compare_price} onChange={handleChange} type="number" min="0" className="input" placeholder="1800 (original price)" />
            </div>
          </div>
          {form.price && form.compare_price && (
            <p className="text-xs text-green-600 font-body">
              Discount: {Math.round((1 - parseFloat(form.price) / parseFloat(form.compare_price)) * 100)}% off
            </p>
          )}
        </div>

        {/* Stock */}
        <div className="card p-5 space-y-4">
          <h2 className="font-heading text-gray-900 font-semibold">Stock</h2>
          <div>
            <label className="label">Your Current Stock *</label>
            <input name="supplier_stock" value={form.supplier_stock} onChange={handleChange} type="number" min="0" className="input" placeholder="e.g. 25" required />
          </div>
          {form.supplier_stock && (
            <div className="grid grid-cols-3 gap-3 mt-2">
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-400 font-body">Your Stock</p>
                <p className="text-xl font-heading font-bold text-gray-900">{form.supplier_stock}</p>
              </div>
              <div className="bg-orange-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-400 font-body">Buffer</p>
                <p className="text-xl font-heading font-bold text-orange-600">
                  {parseInt(form.supplier_stock) - shopifyPreview}
                </p>
              </div>
              <div className={`${shopifyPreview > 0 ? 'bg-green-50' : 'bg-red-50'} rounded-lg p-3 text-center`}>
                <p className="text-xs text-gray-400 font-body">On Shopify</p>
                <p className={`text-xl font-heading font-bold ${shopifyPreview > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {shopifyPreview}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Product Details */}
        <div className="card p-5 space-y-4">
          <h2 className="font-heading text-gray-900 font-semibold">Product Details</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Saree Type</label>
              <select name="saree_type" value={form.saree_type} onChange={handleChange} className="input">
                <option value="">Select type</option>
                {SAREE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Occasion</label>
              <select name="occasion" value={form.occasion} onChange={handleChange} className="input">
                <option value="">Select occasion</option>
                {OCCASIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Fabric</label>
              <input name="fabric" value={form.fabric} onChange={handleChange} className="input" placeholder="e.g. Pure Cotton" />
            </div>
            <div>
              <label className="label">Primary Color</label>
              <input name="color" value={form.color} onChange={handleChange} className="input" placeholder="e.g. Red, Blue" />
            </div>
          </div>
        </div>

        {/* Images */}
        <div className="card p-5 space-y-4">
          <h2 className="font-heading text-gray-900 font-semibold">Product Images</h2>
          <p className="text-xs text-gray-400 font-body">Upload up to 5 images. First image will be the main product image.</p>

          <div className="grid grid-cols-3 gap-3">
            {images.map((url, i) => (
              <div key={url} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
                <img src={url} alt="" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                >
                  <X size={12} />
                </button>
                {i === 0 && <span className="absolute bottom-1 left-1 bg-brand-800 text-white text-xs px-1.5 py-0.5 rounded font-body">Main</span>}
              </div>
            ))}

            {images.length < 5 && (
              <label className="aspect-square rounded-lg border-2 border-dashed border-gray-200 flex flex-col items-center justify-center cursor-pointer hover:border-brand-400 transition-colors">
                {uploadingImages ? (
                  <Loader2 size={20} className="animate-spin text-brand-800" />
                ) : (
                  <>
                    <Upload size={20} className="text-gray-400 mb-1" />
                    <span className="text-xs text-gray-400 font-body">Add photo</span>
                  </>
                )}
                <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} disabled={uploadingImages} />
              </label>
            )}
          </div>
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary flex-1">Cancel</button>
          <button type="submit" disabled={loading} className="btn-primary flex-1 flex items-center justify-center gap-2">
            {loading ? <><Loader2 size={14} className="animate-spin" /> Submitting...</> : 'Submit for Approval'}
          </button>
        </div>
      </form>
    </div>
  )
}
