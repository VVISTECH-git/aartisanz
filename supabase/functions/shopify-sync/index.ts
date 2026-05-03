// Supabase Edge Function: shopify-sync
// Syncs product stock and creation with Shopify

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SHOPIFY_STORE = Deno.env.get('SHOPIFY_STORE_URL')!
const SHOPIFY_TOKEN = Deno.env.get('SHOPIFY_ACCESS_TOKEN')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { product_id, action, shopify_stock } = body

    // Get product from Supabase
    const { data: product, error } = await supabase
      .from('products')
      .select('*, profiles(full_name)')
      .eq('id', product_id)
      .single()

    if (error || !product) {
      return new Response(JSON.stringify({ error: 'Product not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    let result = {}

    if (action === 'create') {
      // Create product on Shopify
      const shopifyProduct = await createShopifyProduct(product)
      result = { shopify_product_id: shopifyProduct.id }

      // Update Supabase with Shopify IDs
      await supabase.from('products').update({
        shopify_product_id: shopifyProduct.id.toString(),
        shopify_variant_id: shopifyProduct.variants[0].id.toString(),
        shopify_inventory_item_id: shopifyProduct.variants[0].inventory_item_id.toString(),
        shopify_stock: shopify_stock || product.shopify_stock
      }).eq('id', product_id)

    } else if (action === 'update_stock' || shopify_stock !== undefined) {
      // Update existing product stock on Shopify
      if (product.shopify_inventory_item_id) {
        await updateShopifyStock(product.shopify_inventory_item_id, shopify_stock ?? product.shopify_stock)
        result = { updated: true, shopify_stock: shopify_stock ?? product.shopify_stock }
      } else {
        result = { skipped: true, reason: 'Product not yet on Shopify' }
      }
    }

    return new Response(JSON.stringify({ success: true, ...result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    console.error('Shopify sync error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

async function createShopifyProduct(product: any) {
  const discountPercent = product.compare_price
    ? Math.round((1 - product.price / product.compare_price) * 100)
    : 0

  const body = {
    product: {
      title: product.name,
      body_html: product.description || '',
      vendor: 'aartisanz',
      product_type: product.category || 'Saree',
      tags: [
        ...(product.tags || []),
        product.fabric,
        product.color,
        discountPercent > 0 ? `${discountPercent}% off` : null
      ].filter(Boolean).join(', '),
      status: 'active',
      images: (product.images || []).map((url: string, i: number) => ({
        src: url,
        position: i + 1,
        alt: product.name
      })),
      variants: [{
        price: product.price.toString(),
        compare_at_price: product.compare_price?.toString() || null,
        inventory_management: 'shopify',
        inventory_policy: 'deny',
        inventory_quantity: product.shopify_stock,
        fulfillment_service: 'manual',
        requires_shipping: true,
        sku: product.sku || ''
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
  if (!res.ok) throw new Error(`Shopify create failed: ${JSON.stringify(data)}`)
  return data.product
}

async function updateShopifyStock(inventoryItemId: string, quantity: number) {
  // First get location ID
  const locRes = await fetch(`https://${SHOPIFY_STORE}/admin/api/2024-01/locations.json`, {
    headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN }
  })
  const locData = await locRes.json()
  const locationId = locData.locations[0]?.id

  if (!locationId) throw new Error('No Shopify location found')

  const res = await fetch(`https://${SHOPIFY_STORE}/admin/api/2024-01/inventory_levels/set.json`, {
    method: 'POST',
    headers: {
      'X-Shopify-Access-Token': SHOPIFY_TOKEN,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      location_id: locationId,
      inventory_item_id: inventoryItemId,
      available: quantity
    })
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(`Shopify stock update failed: ${JSON.stringify(err)}`)
  }
}
