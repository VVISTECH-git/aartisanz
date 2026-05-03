// Supabase Edge Function: shopify-sync
// Called when admin approves a product — syncs to Shopify

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const SHOPIFY_STORE = (Deno.env.get('SHOPIFY_STORE_URL') || '').replace('https://', '').replace('http://', '').trim().replace(/\/$/, '')
    const SHOPIFY_TOKEN = (Deno.env.get('SHOPIFY_ACCESS_TOKEN') || '').trim()
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
    const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const body = await req.json()
    const { product_id, action } = body

    // Get product
    const { data: product, error } = await supabase
      .from('products')
      .select('id, name, sku, description, price, compare_price, shopify_stock, category, tags, fabric, color, images, shopify_product_id, shopify_inventory_item_id')
      .eq('id', product_id)
      .single()

    if (error || !product) {
      return respond({ error: 'Product not found' }, 404)
    }

    if (action === 'create') {
      // Get location ID
      const locRes = await fetch(`https://${SHOPIFY_STORE}/admin/api/2024-01/locations.json`, {
        headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN }
      })
      const locData = await locRes.json()
      const locationId = locData.locations?.[0]?.id

      if (!locRes.ok) return respond({ error: `Shopify auth failed: ${locRes.status}` }, 500)

      // Create product on Shopify
      const discountPercent = product.compare_price && product.compare_price > product.price
        ? Math.round((1 - product.price / product.compare_price) * 100) : 0

      const tags = [
        product.category, product.fabric, product.color,
        discountPercent > 0 ? `${discountPercent}% off` : null,
        ...(Array.isArray(product.tags) ? product.tags : [])
      ].filter(Boolean).join(', ')

      const shopifyBody = {
        product: {
          title: product.name,
          body_html: product.description || `<p>${product.name}</p>`,
          vendor: 'Aartisanz',
          product_type: product.category || 'Saree',
          tags,
          status: 'active',
          images: Array.isArray(product.images) && product.images.length > 0
            ? product.images.map((url: string, i: number) => ({ src: url, position: i + 1, alt: product.name }))
            : [],
          variants: [{
            price: (product.price || 0).toString(),
            compare_at_price: product.compare_price ? product.compare_price.toString() : null,
            inventory_management: 'shopify',
            inventory_policy: 'deny',
            fulfillment_service: 'manual',
            requires_shipping: true,
            sku: product.sku || '',
          }]
        }
      }

      const shopRes = await fetch(`https://${SHOPIFY_STORE}/admin/api/2024-01/products.json`, {
        method: 'POST',
        headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify(shopifyBody)
      })

      const shopData = await shopRes.json()
      if (!shopRes.ok) return respond({ error: `Shopify error: ${JSON.stringify(shopData.errors)}` }, 500)

      const shopifyProduct = shopData.product

      // Set inventory
      if (locationId && shopifyProduct.variants[0]?.inventory_item_id) {
        await fetch(`https://${SHOPIFY_STORE}/admin/api/2024-01/inventory_levels/set.json`, {
          method: 'POST',
          headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            location_id: locationId,
            inventory_item_id: shopifyProduct.variants[0].inventory_item_id,
            available: product.shopify_stock || 0
          })
        })
      }

      // Save Shopify IDs to Supabase
      await supabase.from('products').update({
        shopify_product_id: shopifyProduct.id.toString(),
        shopify_variant_id: shopifyProduct.variants[0].id.toString(),
        shopify_inventory_item_id: shopifyProduct.variants[0].inventory_item_id.toString(),
      }).eq('id', product_id)

      return respond({ success: true, shopify_product_id: shopifyProduct.id })

    } else if (action === 'update_stock') {
      // Update inventory on Shopify
      if (!product.shopify_inventory_item_id) {
        return respond({ success: false, reason: 'Product not on Shopify yet' })
      }

      const locRes = await fetch(`https://${SHOPIFY_STORE}/admin/api/2024-01/locations.json`, {
        headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN }
      })
      const locData = await locRes.json()
      const locationId = locData.locations?.[0]?.id

      await fetch(`https://${SHOPIFY_STORE}/admin/api/2024-01/inventory_levels/set.json`, {
        method: 'POST',
        headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location_id: locationId,
          inventory_item_id: parseInt(product.shopify_inventory_item_id),
          available: product.shopify_stock || 0
        })
      })

      return respond({ success: true, updated: true })
    }

    return respond({ error: 'Unknown action' }, 400)

  } catch (err) {
    return respond({ error: err.message }, 500)
  }
})

function respond(data: object, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...{ 'Access-Control-Allow-Origin': '*' }, 'Content-Type': 'application/json' }
  })
}
