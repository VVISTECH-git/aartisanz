// Supabase Edge Function: bulk-sync v3 - debug version
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const SHOPIFY_STORE = (Deno.env.get('SHOPIFY_STORE_URL') || '').replace('https://', '').replace('http://', '').trim().replace(/\/$/, '')
    const SHOPIFY_TOKEN = (Deno.env.get('SHOPIFY_ACCESS_TOKEN') || '').trim()
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
    const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

    // Step 1: Check env vars
    if (!SHOPIFY_STORE) return respond({ error: 'SHOPIFY_STORE_URL is missing' }, 500)
    if (!SHOPIFY_TOKEN) return respond({ error: 'SHOPIFY_ACCESS_TOKEN is missing' }, 500)
    if (!SUPABASE_URL) return respond({ error: 'SUPABASE_URL is missing' }, 500)
    if (!SUPABASE_SERVICE_KEY) return respond({ error: 'SUPABASE_SERVICE_ROLE_KEY is missing' }, 500)

    // Step 2: Test Shopify connection
    let locationId: string | null = null
    try {
      const locRes = await fetch(`https://${SHOPIFY_STORE}/admin/api/2024-01/locations.json`, {
        headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN }
      })
      const locText = await locRes.text()
      if (!locRes.ok) return respond({ error: `Shopify auth failed: ${locRes.status}`, body: locText }, 500)
      const locData = JSON.parse(locText)
      locationId = locData.locations?.[0]?.id?.toString() || null
    } catch (e) {
      return respond({ error: `Shopify connection failed: ${e.message}` }, 500)
    }

    // Step 3: Fetch products from Supabase
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const { data: products, error: dbError } = await supabase
      .from('products')
      .select('id, name, sku, description, price, compare_price, shopify_stock, category, tags, fabric, color, images')
      .eq('is_approved', true)
      .is('shopify_product_id', null)
      .order('created_at', { ascending: true })
      .limit(999999)

    if (dbError) return respond({ error: `DB error: ${dbError.message}` }, 500)
    if (!products || products.length === 0) return respond({ success: true, message: 'No products to sync', synced: 0 })

    // Step 4: Sync products
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
          headers: {
            'X-Shopify-Access-Token': SHOPIFY_TOKEN,
            'Content-Type': 'application/json'
          },
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
              location_id: parseInt(locationId),
              inventory_item_id: shopifyProduct.variants[0].inventory_item_id,
              available: product.shopify_stock || 0
            })
          })
        }

        // Save Shopify IDs back to Supabase
        await supabase.from('products').update({
          shopify_product_id: shopifyProduct.id.toString(),
          shopify_variant_id: shopifyProduct.variants[0].id.toString(),
          shopify_inventory_item_id: shopifyProduct.variants[0].inventory_item_id.toString(),
        }).eq('id', product.id)

        results.success++
        console.log(`✅ ${results.success}/${products.length}: ${product.name}`)
        await new Promise(r => setTimeout(r, 600))

      } catch (err) {
        results.failed++
        results.errors.push(`${product.name}: ${err.message}`)
        console.error(`❌ ${product.name}: ${err.message}`)
      }
    }

    return respond({
      success: true,
      total: products.length,
      synced: results.success,
      failed: results.failed,
      errors: results.errors.slice(0, 20)
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
