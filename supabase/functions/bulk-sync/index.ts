// Supabase Edge Function: bulk-sync v4
// Syncs products in batches of 20 to avoid timeout

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' } })
  }

  try {
    const SHOPIFY_STORE = (Deno.env.get('SHOPIFY_STORE_URL') || '').replace('https://', '').replace('http://', '').trim().replace(/\/$/, '')
    const SHOPIFY_TOKEN = (Deno.env.get('SHOPIFY_ACCESS_TOKEN') || '').trim()
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
    const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

    if (!SHOPIFY_STORE) return respond({ error: 'SHOPIFY_STORE_URL is missing' }, 500)
    if (!SHOPIFY_TOKEN) return respond({ error: 'SHOPIFY_ACCESS_TOKEN is missing' }, 500)

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // Get batch of 20 unsynced approved products
    const { data: products, error } = await supabase
      .from('products')
      .select('id, name, sku, description, price, compare_price, shopify_stock, category, tags, fabric, color, images')
      .eq('is_approved', true)
      .is('shopify_product_id', null)
      .order('created_at', { ascending: true })
      .limit(20)

    if (error) return respond({ error: `DB error: ${error.message}` }, 500)

    if (!products || products.length === 0) {
      return respond({ success: true, message: 'All products synced!', synced: 0, remaining: 0 })
    }

    // Get location ID
    const locRes = await fetch(`https://${SHOPIFY_STORE}/admin/api/2024-01/locations.json`, {
      headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN }
    })
    if (!locRes.ok) return respond({ error: `Shopify auth failed: ${locRes.status}` }, 500)
    const locData = await locRes.json()
    const locationId = locData.locations?.[0]?.id

    // Count remaining after this batch
    const { count: remaining } = await supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('is_approved', true)
      .is('shopify_product_id', null)

    const results = { success: 0, failed: 0, errors: [] as string[] }

    for (const product of products) {
      try {
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
        if (!shopRes.ok) throw new Error(`${shopRes.status}: ${JSON.stringify(shopData.errors || shopData)}`)

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

        await supabase.from('products').update({
          shopify_product_id: shopifyProduct.id.toString(),
          shopify_variant_id: shopifyProduct.variants[0].id.toString(),
          shopify_inventory_item_id: shopifyProduct.variants[0].inventory_item_id.toString(),
        }).eq('id', product.id)

        results.success++
        console.log(`✅ ${results.success}/${products.length}: ${product.name}`)

        // Small delay to respect rate limits
        await new Promise(r => setTimeout(r, 300))

      } catch (err) {
        results.failed++
        results.errors.push(`${product.name}: ${err.message}`)
      }
    }

    const totalRemaining = (remaining || 0) - results.success

    return respond({
      success: true,
      synced: results.success,
      failed: results.failed,
      remaining: totalRemaining,
      errors: results.errors,
      done: totalRemaining <= 0
    })

  } catch (err) {
    return respond({ error: err.message }, 500)
  }
})

function respond(data: object, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }
  })
}
