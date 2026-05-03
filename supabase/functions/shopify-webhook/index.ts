// Supabase Edge Function: shopify-webhook
// Receives order notifications from Shopify and stores them in Supabase

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { crypto } from 'https://deno.land/std@0.168.0/crypto/mod.ts'

const SHOPIFY_WEBHOOK_SECRET = Deno.env.get('SHOPIFY_WEBHOOK_SECRET')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

serve(async (req) => {
  const corsHeaders = { 'Access-Control-Allow-Origin': '*' }

  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    // Verify Shopify webhook signature
    const hmacHeader = req.headers.get('X-Shopify-Hmac-Sha256')
    const body = await req.text()

    if (SHOPIFY_WEBHOOK_SECRET && hmacHeader) {
      const key = await crypto.subtle.importKey(
        'raw', new TextEncoder().encode(SHOPIFY_WEBHOOK_SECRET),
        { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
      )
      const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))
      const expectedHmac = btoa(String.fromCharCode(...new Uint8Array(signature)))
      if (expectedHmac !== hmacHeader) {
        return new Response('Unauthorized', { status: 401 })
      }
    }

    const order = JSON.parse(body)
    const topic = req.headers.get('X-Shopify-Topic')

    if (topic === 'orders/create') {
      await handleNewOrder(order)
    } else if (topic === 'orders/cancelled') {
      await handleCancelledOrder(order)
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    console.error('Webhook error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

async function handleNewOrder(shopifyOrder: any) {
  for (const lineItem of shopifyOrder.line_items) {
    // Find product in Supabase by Shopify product ID
    const { data: product } = await supabase
      .from('products')
      .select('*, profiles(whatsapp_number)')
      .eq('shopify_product_id', lineItem.product_id.toString())
      .single()

    if (!product) {
      console.log(`Product ${lineItem.product_id} not found in portal`)
      continue
    }

    const shippingAddress = shopifyOrder.shipping_address
    const addressStr = shippingAddress
      ? `${shippingAddress.address1}, ${shippingAddress.city}, ${shippingAddress.province} - ${shippingAddress.zip}`
      : 'Address not provided'

    // Create order in Supabase
    const { data: newOrder } = await supabase.from('orders').insert({
      shopify_order_id: shopifyOrder.id.toString(),
      shopify_order_number: shopifyOrder.order_number?.toString(),
      supplier_id: product.supplier_id,
      product_id: product.id,
      quantity: lineItem.quantity,
      total_amount: parseFloat(lineItem.price) * lineItem.quantity,
      customer_name: `${shopifyOrder.customer?.first_name || ''} ${shopifyOrder.customer?.last_name || ''}`.trim(),
      customer_email: shopifyOrder.customer?.email,
      customer_phone: shopifyOrder.shipping_address?.phone || shopifyOrder.customer?.phone,
      shipping_address: addressStr,
      status: 'pending'
    }).select().single()

    if (newOrder) {
      // Send WhatsApp notification to supplier
      await supabase.functions.invoke('whatsapp-notify', {
        body: { order_id: newOrder.id, type: 'new_order' }
      })

      // Reduce stock in Supabase
      const newSupplierStock = Math.max(0, product.supplier_stock - lineItem.quantity)
      const newShopifyStock = Math.max(0, product.shopify_stock - lineItem.quantity)

      await supabase.from('products').update({
        supplier_stock: newSupplierStock,
        shopify_stock: newShopifyStock,
        updated_at: new Date().toISOString()
      }).eq('id', product.id)

      // Check if stock is critically low
      if (newSupplierStock <= 3 && newSupplierStock > 0) {
        await supabase.functions.invoke('whatsapp-notify', {
          body: { order_id: newOrder.id, type: 'stock_critical' }
        })
      }
    }
  }
}

async function handleCancelledOrder(shopifyOrder: any) {
  const { data: order } = await supabase
    .from('orders')
    .select('*, products(*)')
    .eq('shopify_order_id', shopifyOrder.id.toString())
    .single()

  if (order) {
    // Update order status
    await supabase.from('orders').update({ status: 'cancelled' }).eq('id', order.id)

    // Restore stock
    await supabase.from('products').update({
      supplier_stock: order.products.supplier_stock + order.quantity,
      shopify_stock: order.products.shopify_stock + order.quantity
    }).eq('id', order.product_id)
  }
}
