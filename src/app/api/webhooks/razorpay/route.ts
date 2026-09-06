import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendOrderConfirmationEmail } from '@/lib/brevo'
import { revalidatePath } from 'next/cache'

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text()
    const signature = req.headers.get('x-razorpay-signature')

    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET

    // 1. Signature Verification
    if (!webhookSecret) {
      console.warn('⚠️ [Razorpay Webhook] RAZORPAY_WEBHOOK_SECRET is not configured in environment variables.')
      return NextResponse.json(
        { error: 'Webhook secret not configured on server' },
        { status: 500 }
      )
    }

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing x-razorpay-signature header' },
        { status: 400 }
      )
    }

    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex')

    // Constant-time buffer comparison to prevent timing attacks
    const isSignatureValid =
      signature.length === expectedSignature.length &&
      crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))

    if (!isSignatureValid) {
      console.error('❌ [Razorpay Webhook] Invalid signature detected.')
      return NextResponse.json(
        { error: 'Invalid webhook signature' },
        { status: 400 }
      )
    }

    // 2. Parse Event Payload
    const event = JSON.parse(rawBody)
    const eventType = event.event
    console.log(`🔔 [Razorpay Webhook] Received event: ${eventType}`)

    const adminClient = createAdminClient()

    // 3. Handle Successful Payment Events
    if (eventType === 'order.paid' || eventType === 'payment.captured') {
      const paymentEntity = event.payload?.payment?.entity
      const orderEntity = event.payload?.order?.entity

      const rzpOrderId = paymentEntity?.order_id || orderEntity?.id
      const rzpPaymentId = paymentEntity?.id
      const receiptId = orderEntity?.receipt || paymentEntity?.notes?.receipt

      if (!rzpOrderId && !receiptId) {
        console.warn('⚠️ [Razorpay Webhook] No order ID or receipt found in payload.')
        return NextResponse.json({ received: true, note: 'No identifier found' })
      }

      // Find order by razorpay_order_id or fallback to internal order id (receipt)
      let order: any = null

      if (rzpOrderId) {
        const { data } = await adminClient
          .from('orders')
          .select('*')
          .eq('razorpay_order_id', rzpOrderId)
          .single()
        order = data
      }

      if (!order && receiptId) {
        const { data } = await adminClient
          .from('orders')
          .select('*')
          .eq('id', receiptId)
          .single()
        order = data
      }

      if (!order) {
        console.error(`❌ [Razorpay Webhook] Order not found for Razorpay Order: ${rzpOrderId}, Receipt: ${receiptId}`)
        return NextResponse.json({ received: true, note: 'Order not found' }, { status: 200 })
      }

      // Idempotency Check: Don't process or email twice
      if (order.payment_status === 'paid') {
        console.log(`ℹ️ [Razorpay Webhook] Order #${order.order_number} is already marked as paid. Skipping redundant processing.`)
        return NextResponse.json({ received: true, already_processed: true })
      }

      // 4. Update Database Order
      const { error: updateError } = await adminClient
        .from('orders')
        .update({
          payment_status: 'paid',
          order_status: 'processing',
          razorpay_payment_id: rzpPaymentId || order.razorpay_payment_id,
          razorpay_order_id: rzpOrderId || order.razorpay_order_id,
        })
        .eq('id', order.id)

      if (updateError) {
        console.error('❌ [Razorpay Webhook] Failed to update order status:', updateError)
        return NextResponse.json({ error: 'Database update failed' }, { status: 500 })
      }

      console.log(`✅ [Razorpay Webhook] Order #${order.order_number} marked as paid and processing.`)

      // 5. Clear User Cart (if authenticated order)
      if (order.user_id) {
        try {
          await adminClient.from('cart_items').delete().eq('user_id', order.user_id)
        } catch (cartErr) {
          console.warn('Could not clear cart items for user:', cartErr)
        }
      }

      // 6. Fetch Order Items for Invoice Email
      const { data: orderItems } = await adminClient
        .from('order_items')
        .select('*')
        .eq('order_id', order.id)

      // 7. Resolve Customer Email & Name
      let customerEmail = order.shipping_address?.email
      let customerName = order.shipping_address?.full_name || 'Customer'

      if (!customerEmail && order.user_id) {
        const { data: authUser } = await adminClient.auth.admin.getUserById(order.user_id)
        if (authUser?.user?.email) {
          customerEmail = authUser.user.email
          customerName = authUser.user.user_metadata?.full_name || customerName
        }
      }

      // 8. Dispatch Brevo Confirmation Email
      if (customerEmail) {
        try {
          const emailRes = await sendOrderConfirmationEmail({
            orderNumber: order.order_number,
            customerName,
            customerEmail,
            customerPhone: order.shipping_address?.phone,
            shippingAddress: order.shipping_address || {
              address_line_1: '',
              city: '',
              state: '',
              postal_code: '',
            },
            items: (orderItems || []).map((item: any) => ({
              product_name: item.product_name,
              variant_name: item.variant_name,
              quantity: item.quantity,
              price_at_purchase: item.price_at_purchase,
              line_total: item.line_total,
            })),
            subtotal: Number(order.subtotal),
            shippingCost: Number(order.shipping_cost),
            totalAmount: Number(order.total_amount),
            paymentMethod: 'Online Payment (Razorpay)',
            paymentStatus: 'paid',
          })

          console.log(`📩 [Razorpay Webhook] Brevo order invoice dispatched to ${customerEmail}:`, emailRes)
        } catch (emailErr) {
          console.error('❌ [Razorpay Webhook] Failed to send Brevo order confirmation email:', emailErr)
        }
      }

      revalidatePath('/admin/orders')
      revalidatePath('/account/orders')

      return NextResponse.json({ received: true, success: true })
    }

    if (eventType === 'payment.failed') {
      const paymentEntity = event.payload?.payment?.entity
      console.warn(`⚠️ [Razorpay Webhook] Payment failed for Razorpay Order: ${paymentEntity?.order_id}, Reason: ${paymentEntity?.error_description}`)
      return NextResponse.json({ received: true, note: 'Payment failed logged' })
    }

    return NextResponse.json({ received: true, ignored: true })
  } catch (error: any) {
    console.error('❌ [Razorpay Webhook Error]:', error)
    return NextResponse.json({ error: error.message || 'Webhook handler error' }, { status: 500 })
  }
}
