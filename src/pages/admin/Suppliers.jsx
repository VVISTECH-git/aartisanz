import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Users, Plus, Loader2, Package, ShoppingBag, Phone, Mail } from 'lucide-react'
import toast from 'react-hot-toast'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SERVICE_KEY = import.meta.env.VITE_SUPABASE_SERVICE_KEY

export default function AdminSuppliers() {
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', whatsapp: '', password: '' })

  useEffect(() => { fetchSuppliers() }, [])

  async function fetchSuppliers() {
    setLoading(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('*, products(count), orders(count)')
      .eq('role', 'supplier')
      .order('created_at', { ascending: false })
    if (error) toast.error('Failed to load suppliers')
    else setSuppliers(data || [])
    setLoading(false)
  }

  async function addSupplier(e) {
    e.preventDefault()
    setAdding(true)
    try {
      // Use Supabase Admin API directly
      const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SERVICE_KEY,
          'Authorization': `Bearer ${SERVICE_KEY}`
        },
        body: JSON.stringify({
          email: form.email,
          password: form.password,
          email_confirm: true,
          user_metadata: {
            full_name: form.full_name,
            role: 'supplier'
          }
        })
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.message || data.error || 'Failed to create user')

      // Update profile with additional info
      await supabase.from('profiles').update({
        full_name: form.full_name,
        phone: form.phone,
        whatsapp_number: form.whatsapp,
        role: 'supplier'
      }).eq('email', form.email)

      toast.success('Supplier added! They can now login.')
      setShowAddForm(false)
      setForm({ full_name: '', email: '', phone: '', whatsapp: '', password: '' })
      fetchSuppliers()
    } catch (err) {
      toast.error(err.message || 'Failed to add supplier')
    }
    setAdding(false)
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 size={32} className="animate-spin text-brand-800" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl text-gray-900">Suppliers</h1>
          <p className="text-gray-500 text-sm font-body mt-1">{suppliers.length} suppliers in network</p>
        </div>
        <button onClick={() => setShowAddForm(!showAddForm)} className="btn-primary flex items-center gap-2">
          <Plus size={14} /> Add Supplier
        </button>
      </div>

      {showAddForm && (
        <div className="card p-5">
          <h2 className="font-heading text-gray-900 font-semibold mb-4">Add New Supplier</h2>
          <form onSubmit={addSupplier} className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Full Name *</label>
              <input value={form.full_name} onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} className="input" placeholder="Supplier name" required />
            </div>
            <div>
              <label className="label">Email *</label>
              <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} className="input" placeholder="supplier@example.com" required />
            </div>
            <div>
              <label className="label">Phone</label>
              <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} className="input" placeholder="+91 98765 43210" />
            </div>
            <div>
              <label className="label">WhatsApp Number *</label>
              <input value={form.whatsapp} onChange={e => setForm(p => ({ ...p, whatsapp: e.target.value }))} className="input" placeholder="919876543210" required />
            </div>
            <div>
              <label className="label">Temporary Password *</label>
              <input type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} className="input" placeholder="Min 8 characters" required minLength={8} />
            </div>
            <div className="flex items-end gap-2">
              <button type="submit" disabled={adding} className="btn-primary flex items-center gap-2 flex-1">
                {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                Add Supplier
              </button>
              <button type="button" onClick={() => setShowAddForm(false)} className="btn-secondary">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {suppliers.length === 0 ? (
        <div className="card p-12 text-center">
          <Users size={48} className="text-gray-300 mx-auto mb-4" />
          <h3 className="font-heading text-gray-600 text-lg mb-2">No suppliers yet</h3>
          <p className="text-gray-400 text-sm font-body">Add your first supplier to get started</p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-4">
          {suppliers.map(supplier => (
            <div key={supplier.id} className="card p-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-brand-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-brand-800 font-heading font-bold text-sm">
                    {supplier.full_name?.[0] || 'S'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-heading font-semibold text-gray-900">{supplier.full_name}</h3>
                  <div className="flex items-center gap-3 mt-1">
                    <div className="flex items-center gap-1 text-xs text-gray-400 font-body">
                      <Mail size={11} /> {supplier.email}
                    </div>
                  </div>
                  {supplier.phone && (
                    <div className="flex items-center gap-1 text-xs text-gray-400 font-body mt-0.5">
                      <Phone size={11} /> {supplier.phone}
                    </div>
                  )}
                  <div className="flex gap-4 mt-3">
                    <div className="flex items-center gap-1.5">
                      <Package size={13} className="text-brand-600" />
                      <span className="text-xs text-gray-500 font-body">{supplier.products?.[0]?.count || 0} products</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <ShoppingBag size={13} className="text-green-600" />
                      <span className="text-xs text-gray-500 font-body">{supplier.orders?.[0]?.count || 0} orders</span>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <span className="badge-green">Active</span>
                    <span className="text-xs text-gray-400 font-body ml-2">
                      Joined {new Date(supplier.created_at).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}