/**
 * Buffer Logic Engine
 * Calculates how much stock to show on Shopify based on supplier stock
 */

export function calculateShopifyStock(supplierStock) {
  if (supplierStock <= 3) return 0        // Hide product
  if (supplierStock <= 10) return supplierStock - 3   // 3 piece buffer
  if (supplierStock <= 50) return supplierStock - 5   // 5 piece buffer
  if (supplierStock <= 100) return supplierStock - 10  // 10 piece buffer
  return supplierStock - 15               // 15 piece buffer for 100+
}

export function getBufferAmount(supplierStock) {
  if (supplierStock <= 3) return supplierStock
  if (supplierStock <= 10) return 3
  if (supplierStock <= 50) return 5
  if (supplierStock <= 100) return 10
  return 15
}

export function getStockStatus(supplierStock) {
  if (supplierStock === 0) return { label: 'Out of Stock', color: 'red' }
  if (supplierStock <= 3) return { label: 'Critical Low', color: 'red' }
  if (supplierStock <= 10) return { label: 'Low Stock', color: 'orange' }
  if (supplierStock <= 30) return { label: 'Medium Stock', color: 'yellow' }
  return { label: 'In Stock', color: 'green' }
}

export function shouldShowOnShopify(supplierStock) {
  return calculateShopifyStock(supplierStock) > 0
}
