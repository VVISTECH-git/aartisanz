// Supabase Edge Function: whatsapp-notify
// Sends WhatsApp notifications to suppliers when orders are placed

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const WHATSAPP_TOKEN = Deno.env.get('WHATSAPP_API_TOKEN')!
const WHATSAPP_PHONE_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ADMIN_WHATSAPP = Deno.env.get('ADMIN_WHATSAPP_NUMBER')!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { order_id, type, tracking } = await req.json()

    const { data: order } = await supabase
      .from('orders')
      .select('*, products(name, price), profiles(full_name, whatsapp_number)')
      .eq('id', order_id)
      .single()

    if (!order) throw new Error('Order not found')

    let message = ''
    let recipient = ''

    if (type === 'new_order') {
      // Notify supplier about new order
      recipient = order.profiles.whatsapp_number
      message = `🛍️ *New Order — aartisanz*\n\n` +
        `Order #${order.shopify_order_id}\n` +
        `Product: ${order.products.name}\n` +
        `Quantity: ${order.quantity} piece(s)\n` +
        `Amount: ₹${order.total_amount}\n\n` +
        `📦 *Ship to:*\n${order.customer_name}\n${order.shipping_address}\n📞 ${order.customer_phone}\n\n` +
        `Please ship within 24 hours and update tracking on the portal.\n` +
        `Portal: https://portal.aartisanz.com`

    } else if (type === 'low_stock') {
      // Notify admin about low stock
      recipient = ADMIN_WHATSAPP
      const { data: product } = await supabase.from('products').select('*, profiles(full_name)').eq('id', order_id).single()
      message = `⚠️ *Low Stock Alert — aartisanz*\n\n` +
        `Product: ${product?.name}\n` +
        `Supplier: ${product?.profiles?.full_name}\n` +
        `Current Stock: ${product?.supplier_stock} pieces\n\n` +
        `Please contact supplier to restock.`

    } else if (type === 'order_fulfilled') {
      // Notify admin that supplier shipped
      recipient = ADMIN_WHATSAPP
      message = `✅ *Order Fulfilled — aartisanz*\n\n` +
        `Order #${order.shopify_order_id}\n` +
        `Product: ${order.products.name}\n` +
        `Supplier: ${order.profiles.full_name}\n` +
        `Tracking: ${tracking}\n\n` +
        `Customer: ${order.customer_name} (${order.customer_phone})`

    } else if (type === 'stock_critical') {
      // Notify supplier to update stock
      recipient = order.profiles.whatsapp_number
      message = `⚠️ *Stock Alert — aartisanz*\n\n` +
        `Your product "${order.products.name}" has critically low stock (${order.products.supplier_stock} left).\n\n` +
        `Please update your stock on the supplier portal:\nhttps://portal.aartisanz.com`
    }

    if (!recipient || !message) throw new Error('Invalid notification type')

    // Send WhatsApp message
    await sendWhatsApp(recipient, message)

    // Update notification timestamp
    if (type === 'new_order') {
      await supabase.from('orders').update({ notified_at: new Date().toISOString() }).eq('id', order_id)
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    console.error('WhatsApp notify error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

async function sendWhatsApp(to: string, message: string) {
  const res = await fetch(
    `https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_ID}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: message }
      })
    }
  )

  if (!res.ok) {
    const err = await res.json()
    throw new Error(`WhatsApp send failed: ${JSON.stringify(err)}`)
  }
}
