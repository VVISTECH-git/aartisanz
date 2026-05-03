import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './hooks/useAuth'
import Login from './pages/Login'
import SupplierDashboard from './pages/supplier/Dashboard'
import SupplierProducts from './pages/supplier/Products'
import SupplierAddProduct from './pages/supplier/AddProduct'
import SupplierOrders from './pages/supplier/Orders'
import AdminDashboard from './pages/admin/Dashboard'
import AdminSuppliers from './pages/admin/Suppliers'
import AdminProducts from './pages/admin/Products'
import AdminOrders from './pages/admin/Orders'
import Layout from './components/Layout'

function ProtectedRoute({ children, role }) {
  const { user, profile, loading } = useAuth()
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-brand-50">
    <div className="text-center">
      <div className="w-12 h-12 border-4 border-brand-800 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
      <p className="font-body text-brand-800">Loading...</p>
    </div>
  </div>
  if (!user) return <Navigate to="/login" replace />
  if (role && profile?.role !== role) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" toastOptions={{
          style: { fontFamily: 'DM Sans, sans-serif', fontSize: '14px' },
          success: { iconTheme: { primary: '#8B4513', secondary: '#fdf8f0' } }
        }} />
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* Supplier Routes */}
          <Route path="/supplier" element={
            <ProtectedRoute role="supplier"><Layout role="supplier" /></ProtectedRoute>
          }>
            <Route index element={<SupplierDashboard />} />
            <Route path="products" element={<SupplierProducts />} />
            <Route path="products/add" element={<SupplierAddProduct />} />
            <Route path="orders" element={<SupplierOrders />} />
          </Route>

          {/* Admin Routes */}
          <Route path="/admin" element={
            <ProtectedRoute role="admin"><Layout role="admin" /></ProtectedRoute>
          }>
            <Route index element={<AdminDashboard />} />
            <Route path="suppliers" element={<AdminSuppliers />} />
            <Route path="products" element={<AdminProducts />} />
            <Route path="orders" element={<AdminOrders />} />
          </Route>

          <Route path="/" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
