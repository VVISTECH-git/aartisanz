// Supabase Edge Function: bulk-sync
// Syncs all approved/live products from Supabase to Shopify

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SHOPIFY_STORE = Deno.env.get('SHOPIFY_STORE_URL')!
const SHOPIFY_TOKEN = Deno.env.get('SHOPIFY_ACCESS_TOKEN')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const limit = body.limit || 999999 // sync all by default

    // Fetch all live products not yet on Shopify
    const { data: products, error } = await supabase
      .from('products')
      .select('*')
      .eq('status', 'live')
      .is('shopify_product_id', null)
      .order('created_at', { ascending: true })
      .limit(limit)

    if (error) throw error

    if (!products || products.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No products to sync — all live products are already on Shopify!',
        synced: 0
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    console.log(`Starting bulk sync of ${products.length} products...`)

    const results = { success: 0, failed: 0, errors: [] as string[] }

    // Get Shopify location ID once
    const locationId = await getShopifyLocationId()

    for (const product of products) {
      try {
        // Create product on Shopify
        const shopifyProduct = await createShopifyProduct(product)

        // Set inventory level
        if (locationId && shopifyProduct.variants[0]?.inventory_item_id) {
          await setInventory(
            shopifyProduct.variants[0].inventory_item_id,
            locationId,
            product.shopify_stock || 0
          )
        }

        // Update Supabase with Shopify IDs
        await supabase.from('products').update({
          shopify_product_id: shopifyProduct.id.toString(),
          shopify_variant_id: shopifyProduct.variants[0].id.toString(),
          shopify_inventory_item_id: shopifyProduct.variants[0].inventory_item_id.toString(),
        }).eq('id', product.id)

        results.success++
        console.log(`✅ Synced: ${product.name} (${results.success}/${products.length})`)

        // Rate limit: Shopify allows 2 requests/sec on Basic plan
        await delay(600)

      } catch (err) {
        results.failed++
        const msg = `❌ Failed: ${product.name} — ${err.message}`
        results.errors.push(msg)
        console.error(msg)
      }
    }

    return new Response(JSON.stringify({
      success: true,
      total: products.length,
      synced: results.success,
      failed: results.failed,
      errors: results.errors.slice(0, 20) // return first 20 errors max
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (err) {
    console.error('Bulk sync error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

async function getShopifyLocationId(): Promise<string | null> {
  const res = await fetch(`https://${SHOPIFY_STORE}/admin/api/2024-01/locations.json`, {
    headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN }
  })
  const data = await res.json()
  return data.locations?.[0]?.id?.toString() || null
}

async function createShopifyProduct(product: any) {
  // Map category to Shopify collection handle
  const categoryMap: Record<string, string> = {
    'Kalamkari Sarees': 'kalamkari',
    'Pochampally Ikat': 'pochampally',
    'Silk Sarees': 'silk',
    'Cotton Sarees': 'cotton',
    'Kalamkari Fabrics': 'kalamkari-fabrics',
    'Kalamkari Accessories': 'kalamkari-accessories',
    'Kurtis & Frocks': 'kurtis-frocks',
  }

  const discountPercent = product.compare_price && product.compare_price > product.price
    ? Math.round((1 - product.price / product.compare_price) * 100)
    : 0

  const tags = [
    product.category,
    product.fabric,
    product.color,
    product.occasion,
    categoryMap[product.category] || '',
    discountPercent > 0 ? `${discountPercent}% off` : null,
    ...(product.tags || [])
  ].filter(Boolean).join(', ')

  const body = {
    product: {
      title: product.name,
      body_html: product.description || `<p>${product.name}</p>`,
      vendor: 'Aartisanz',
      product_type: product.category || 'Saree',
      tags,
      status: 'active',
      images: (product.images || []).map((url: string, i: number) => ({
        src: url,
        position: i + 1,
        alt: product.name
      })),
      variants: [{
        price: product.price?.toString() || '0',
        compare_at_price: product.compare_price?.toString() || null,
        inventory_management: 'shopify',
        inventory_policy: 'deny',
        fulfillment_service: 'manual',
        requires_shipping: true,
        sku: product.sku || '',
        weight: 0.5,
        weight_unit: 'kg'
      }]
    }
  }

  const res = await fetch(`https://${SHOPIFY_STORE}/admin/api/2024-01/products.json`, {
    method: 'POST',
    headers: {
      'X-Shopify-Access-Token': SHOPIFY_TOKEN,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })

  const data = await res.json()
  if (!res.ok) throw new Error(`Shopify error: ${JSON.stringify(data.errors || data)}`)
  return data.product
}

async function setInventory(inventoryItemId: string, locationId: string, quantity: number) {
  await fetch(`https://${SHOPIFY_STORE}/admin/api/2024-01/inventory_levels/set.json`, {
    method: 'POST',
    headers: {
      'X-Shopify-Access-Token': SHOPIFY_TOKEN,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      location_id: parseInt(locationId),
      inventory_item_id: parseInt(inventoryItemId),
      available: quantity
    })
  })
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
