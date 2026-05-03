import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { calculateShopifyStock } from '../../lib/bufferLogic'
import { Upload, FileSpreadsheet, CheckCircle, XCircle, Loader2, ArrowLeft, Download } from 'lucide-react'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'

const TEMPLATE_URL = 'https://pnpbakrzaadghhdiwjel.supabase.co/storage/v1/object/sign/templates/aartisanz-product-template-v3.xlsx?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV83OWY3ZjBmMi05NmQ2LTRhODMtYmI4MS03NmFhNjM3NWViZTIiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJ0ZW1wbGF0ZXMvYWFydGlzYW56LXByb2R1Y3QtdGVtcGxhdGUtdjMueGxzeCIsImlhdCI6MTc3Nzc5MDk2NywiZXhwIjo0ODk5ODU0OTY3fQ.8VzAqNn5s8Ih6R7QK04b0wLEOBM8eN-j-PdYPliAmXM'
  'Kalamkari Sarees', 'Pochampally Ikat', 'Silk Sarees',
  'Cotton Sarees', 'Kalamkari Fabrics', 'Kalamkari Accessories', 'Kurtis & Frocks'
]

export default function SupplierBulkUpload() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState([])
  const [errors, setErrors] = useState([])
  const [uploading, setUploading] = useState(false)
  const [uploaded, setUploaded] = useState(0)
  const [total, setTotal] = useState(0)
  const [done, setDone] = useState(false)

  function handleFileChange(e) {
    const f = e.target.files[0]
    if (!f) return
    setFile(f)
    setErrors([])
    setPreview([])
    setDone(false)

    const reader = new FileReader()
    reader.onload = (evt) => {
      const wb = XLSX.read(evt.target.result, { type: 'binary' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const data = XLSX.utils.sheet_to_json(ws, { defval: '' })

      // Validate
      const errs = []
      const valid = []

      data.forEach((row, i) => {
        const rowNum = i + 2
        const name = row['Name'] || row['name'] || ''
        const sku = row['SKU'] || row['sku'] || ''
        const category = row['Category'] || row['category'] || ''
        const price = parseFloat(row['Price (₹)'] || row['price'] || 0)
        const stock = parseInt(row['Stock'] || row['stock'] || 0)

        if (!name) errs.push(`Row ${rowNum}: Name is required`)
        else if (!sku) errs.push(`Row ${rowNum}: SKU is required`)
        else if (!VALID_CATEGORIES.includes(category)) errs.push(`Row ${rowNum}: Invalid category "${category}"`)
        else if (!price || price <= 0) errs.push(`Row ${rowNum}: Valid price required`)
        else if (stock < 0) errs.push(`Row ${rowNum}: Stock cannot be negative`)
        else {
          valid.push({
            name,
            sku,
            category,
            price,
            compare_price: parseFloat(row['Compare Price (₹)'] || row['compare_price'] || 0) || null,
            supplier_stock: stock,
            shopify_stock: calculateShopifyStock(stock),
            fabric: row['Fabric'] || row['fabric'] || '',
            color: row['Color'] || row['color'] || '',
            occasion: row['Occasion'] || row['occasion'] || '',
            description: row['Description'] || row['description'] || '',
          })
        }
      })

      setErrors(errs)
      setPreview(valid.slice(0, 5)) // show first 5 as preview
      setTotal(valid.length)

      if (errs.length === 0) toast.success(`${valid.length} products ready to upload!`)
      else toast.error(`${errs.length} errors found. Fix and re-upload.`)
    }
    reader.readAsBinaryString(f)
  }

  async function handleUpload() {
    if (!file || errors.length > 0) return
    setUploading(true)
    setUploaded(0)

    const reader = new FileReader()
    reader.onload = async (evt) => {
      const wb = XLSX.read(evt.target.result, { type: 'binary' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const data = XLSX.utils.sheet_to_json(ws, { defval: '' })

      const products = data.map(row => ({
        supplier_id: user.id,
        name: row['Name'] || row['name'] || '',
        sku: row['SKU'] || row['sku'] || '',
        category: row['Category'] || row['category'] || '',
        price: parseFloat(row['Price (₹)'] || row['price'] || 0),
        compare_price: parseFloat(row['Compare Price (₹)'] || row['compare_price'] || 0) || null,
        supplier_stock: parseInt(row['Stock'] || row['stock'] || 0),
        shopify_stock: calculateShopifyStock(parseInt(row['Stock'] || row['stock'] || 0)),
        fabric: row['Fabric'] || row['fabric'] || '',
        color: row['Color'] || row['color'] || '',
        tags: [row['Occasion'] || '', row['Color'] || '', row['Fabric'] || ''].filter(Boolean),
        description: row['Description'] || row['description'] || '',
        images: [],
        is_approved: false,
      }))

      // Upload in batches of 50
      const batchSize = 50
      let count = 0
      for (let i = 0; i < products.length; i += batchSize) {
        const batch = products.slice(i, i + batchSize)
        const { error } = await supabase.from('products').insert(batch)
        if (error) {
          toast.error(`Batch ${Math.floor(i/batchSize)+1} failed: ${error.message}`)
        } else {
          count += batch.length
          setUploaded(count)
        }
      }

      setDone(true)
      setUploading(false)
      toast.success(`${count} products uploaded successfully! Pending admin approval.`)
    }
    reader.readAsBinaryString(file)
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-brand-100 rounded-lg transition-colors">
          <ArrowLeft size={18} className="text-brand-800" />
        </button>
        <div>
          <h1 className="font-heading text-2xl text-gray-900">Bulk Upload Products</h1>
          <p className="text-gray-500 text-sm font-body">Upload Excel file to add multiple products at once</p>
        </div>
      </div>

      {/* Download template */}
      <div className="card p-5 mb-6 flex items-center justify-between">
        <div>
          <h2 className="font-heading font-semibold text-gray-900">Step 1 — Download Template</h2>
          <p className="text-sm text-gray-500 font-body mt-1">Use our Excel template to fill in your products</p>
        </div>
        <a
          href={TEMPLATE_URL}
          download="aartisanz-product-template.xlsx"
          className="btn-secondary flex items-center gap-2"
        >
          <Download size={14} /> Download Template
        </a>
      </div>

      {/* Upload area */}
      <div className="card p-5 mb-6">
        <h2 className="font-heading font-semibold text-gray-900 mb-4">Step 2 — Upload Your Excel File</h2>

        <label className={`
          block border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors
          ${file ? 'border-brand-400 bg-brand-50' : 'border-gray-200 hover:border-brand-400'}
        `}>
          <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileChange} />
          {file ? (
            <div>
              <FileSpreadsheet size={40} className="text-brand-800 mx-auto mb-3" />
              <p className="font-heading font-semibold text-gray-900">{file.name}</p>
              <p className="text-sm text-gray-500 font-body mt-1">{total} products found</p>
              <p className="text-xs text-brand-600 font-body mt-2">Click to change file</p>
            </div>
          ) : (
            <div>
              <Upload size={40} className="text-gray-300 mx-auto mb-3" />
              <p className="font-heading font-semibold text-gray-600">Drop your Excel file here</p>
              <p className="text-sm text-gray-400 font-body mt-1">or click to browse — .xlsx or .xls</p>
            </div>
          )}
        </label>
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="card p-5 mb-6 border-red-200">
          <div className="flex items-center gap-2 mb-3">
            <XCircle size={16} className="text-red-500" />
            <h2 className="font-heading font-semibold text-red-600">{errors.length} Errors Found</h2>
          </div>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {errors.map((err, i) => (
              <p key={i} className="text-xs text-red-600 font-body">{err}</p>
            ))}
          </div>
          <p className="text-xs text-gray-400 font-body mt-3">Fix these errors in your Excel file and re-upload.</p>
        </div>
      )}

      {/* Preview */}
      {preview.length > 0 && errors.length === 0 && (
        <div className="card p-5 mb-6">
          <h2 className="font-heading font-semibold text-gray-900 mb-4">
            Preview — First 5 of {total} products
          </h2>
          <div className="space-y-2">
            {preview.map((p, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-900 font-body">{p.name}</p>
                  <p className="text-xs text-gray-400 font-body">{p.sku} · {p.category} · {p.color}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900 font-body">₹{p.price}</p>
                  <p className="text-xs text-gray-400 font-body">Stock: {p.supplier_stock}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upload progress */}
      {uploading && (
        <div className="card p-5 mb-6">
          <div className="flex items-center gap-3 mb-3">
            <Loader2 size={18} className="animate-spin text-brand-800" />
            <p className="font-body font-medium text-gray-900">Uploading... {uploaded} of {total}</p>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div
              className="bg-brand-800 h-2 rounded-full transition-all"
              style={{ width: `${(uploaded/total)*100}%` }}
            />
          </div>
        </div>
      )}

      {/* Success */}
      {done && (
        <div className="card p-5 mb-6 border-green-200 bg-green-50">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle size={18} className="text-green-600" />
            <p className="font-heading font-semibold text-green-700">Upload Complete!</p>
          </div>
          <p className="text-sm text-green-600 font-body">{uploaded} products submitted for admin approval. They will appear on Shopify once approved.</p>
          <button onClick={() => navigate('/supplier/products')} className="btn-primary mt-3">
            View My Products
          </button>
        </div>
      )}

      {/* Upload button */}
      {file && errors.length === 0 && !done && (
        <div className="flex gap-3">
          <button onClick={() => navigate(-1)} className="btn-secondary flex-1">Cancel</button>
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="btn-primary flex-1 flex items-center justify-center gap-2"
          >
            {uploading ? <><Loader2 size={14} className="animate-spin" /> Uploading...</> : <><Upload size={14} /> Upload {total} Products</>}
          </button>
        </div>
      )}
    </div>
  )
}
