/**
 * Email Templates
 * 
 * Each template has:
 * - subject: Email subject line
 * - html: HTML email body with {{variable}} placeholders
 * 
 * Template variables are filled in by NotificationTemplateService
 */

export const EMAIL_TEMPLATES = {
  ORDER_CREATED_CUSTOMER: {
    subject: '✅ Order Confirmed - {{restaurantName}}',
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
    .order-section { background-color: #fff; border: 1px solid #dee2e6; padding: 15px; margin: 10px 0; border-radius: 4px; }
    .total { font-size: 24px; font-weight: bold; color: #28a745; margin-top: 10px; }
    .footer { text-align: center; color: #6c757d; font-size: 12px; margin-top: 30px; border-top: 1px solid #dee2e6; padding-top: 20px; }
    .button { display: inline-block; background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; margin-top: 15px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Hello {{customerName}}! 👋</h1>
      <p>Your order has been confirmed at <strong>{{restaurantName}}</strong></p>
    </div>

    <h2>Order Details</h2>
    <div class="order-section">
      <p><strong>Order ID:</strong> {{orderId}}</p>
      <p><strong>Time Placed:</strong> {{createdAt}}</p>
      <p><strong>Estimated Ready Time:</strong> {{estimatedReadyTime}}</p>
    </div>

    <h2>Items Ordered</h2>
    <div class="order-section">
      {{itemsHtml}}
      <div class="total">Total: RWF {{totalAmount}}</div>
    </div>

    <h2>What's Next?</h2>
    <div class="order-section">
      <p>✅ <strong>Order Confirmed</strong> - Restaurant has received your order</p>
      <p>🍳 <strong>Being Prepared</strong> - Kitchen is preparing your food</p>
      <p>🔔 <strong>Ready for Pickup</strong> - You'll receive a notification when ready</p>
      <p>🎉 <strong>Enjoy!</strong> - Pick up your order and enjoy!</p>
    </div>

    <a href="{{orderTrackingUrl}}" class="button">Track Order</a>

    <div class="footer">
      <p>{{restaurantName}}</p>
      <p>Thank you for your order! Questions? Contact support.</p>
    </div>
  </div>
</body>
</html>
    `,
  },

  ORDER_READY_CUSTOMER: {
    subject: '🎉 Your Order is Ready! - {{restaurantName}}',
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #d4edda; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #28a745; }
    .order-section { background-color: #fff; border: 1px solid #dee2e6; padding: 15px; margin: 10px 0; border-radius: 4px; }
    .footer { text-align: center; color: #6c757d; font-size: 12px; margin-top: 30px; }
    .button { display: inline-block; background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin-top: 15px; font-size: 16px; font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 Your Order is Ready!</h1>
      <p>Hi {{customerName}}, your order at <strong>{{restaurantName}}</strong> is ready for pickup!</p>
    </div>

    <div class="order-section">
      <h2>Order Information</h2>
      <p><strong>Order ID:</strong> {{orderId}}</p>
      <p><strong>Ready Since:</strong> {{readyTime}}</p>
      <p><strong>Location:</strong> {{restaurantAddress}}</p>
    </div>

    <div class="order-section">
      <h2>What To Do</h2>
      <ol>
        <li>Come to {{restaurantName}} as soon as you can</li>
        <li>Reference Order ID: <strong>{{orderId}}</strong></li>
        <li>Pick up your order from the counter</li>
        <li>Enjoy your meal! 😋</li>
      </ol>
    </div>

    <p style="color: #666; font-size: 14px;">⏰ <strong>Note:</strong> Your order will be held for 30 minutes. Please pick it up soon!</p>

    <a href="{{orderTrackingUrl}}" class="button">View Order</a>

    <div class="footer">
      <p>{{restaurantName}}</p>
      <p>Questions about your order? Contact us at {{restaurantPhone}}</p>
    </div>
  </div>
</body>
</html>
    `,
  },

  PAYMENT_COMPLETED_CUSTOMER: {
    subject: '💳 Payment Confirmed - {{restaurantName}}',
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #d4edda; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #28a745; }
    .receipt { background-color: #f8f9fa; padding: 20px; border-radius: 4px; margin: 20px 0; }
    .receipt-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #dee2e6; }
    .receipt-total { font-size: 18px; font-weight: bold; color: #28a745; padding: 10px 0; }
    .footer { text-align: center; color: #6c757d; font-size: 12px; margin-top: 30px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✅ Payment Confirmed</h1>
      <p>Hi {{customerName}}, your payment has been successfully processed!</p>
    </div>

    <div class="receipt">
      <h2>Payment Receipt</h2>
      <div class="receipt-row">
        <span>Order ID:</span>
        <strong>{{orderId}}</strong>
      </div>
      <div class="receipt-row">
        <span>Restaurant:</span>
        <strong>{{restaurantName}}</strong>
      </div>
      <div class="receipt-row">
        <span>Payment Method:</span>
        <strong>{{paymentMethod}}</strong>
      </div>
      <div class="receipt-row">
        <span>Transaction ID:</span>
        <strong>{{transactionId}}</strong>
      </div>
      <div class="receipt-row">
        <span>Amount Paid:</span>
        <span style="color: #28a745; font-weight: bold;">RWF {{amount}}</span>
      </div>
      <div class="receipt-row">
        <span>Time:</span>
        <strong>{{paymentTime}}</strong>
      </div>
    </div>

    <p>Your order has been confirmed with the restaurant. You'll receive another notification when your order is being prepared and when it's ready!</p>

    <div class="footer">
      <p>{{restaurantName}}</p>
      <p>Keep this receipt for your records. Thank you for your order!</p>
    </div>
  </div>
</body>
</html>
    `,
  },

  REFUND_APPROVED_CUSTOMER: {
    subject: '💰 Refund Approved - {{restaurantName}}',
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #d4edda; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #28a745; }
    .refund-box { background-color: #f8f9fa; padding: 20px; border-radius: 4px; margin: 20px 0; }
    .footer { text-align: center; color: #6c757d; font-size: 12px; margin-top: 30px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>💰 Refund Approved</h1>
      <p>Hi {{customerName}}, your refund has been approved!</p>
    </div>

    <div class="refund-box">
      <h2>Refund Details</h2>
      <p><strong>Order ID:</strong> {{orderId}}</p>
      <p><strong>Refund Amount:</strong> RWF {{refundAmount}}</p>
      <p><strong>Reason:</strong> {{refundReason}}</p>
      <p><strong>Status:</strong> Approved on {{approvalDate}}</p>
    </div>

    <div class="refund-box">
      <h2>When Will You See The Money?</h2>
      <p>The refund will be processed back to your original payment method within <strong>1-3 business days</strong>. Depending on your bank, it may take longer to appear in your account.</p>
      <p>📱 <strong>Refund ID for reference:</strong> {{refundId}}</p>
    </div>

    <p>We apologize for any inconvenience! If you have any questions, please don't hesitate to contact us.</p>

    <div class="footer">
      <p>{{restaurantName}}</p>
      <p>Thank you for your understanding.</p>
    </div>
  </div>
</body>
</html>
    `,
  },

  ORDER_CREATED_MERCHANT: {
    subject: '📋 New Order Received - {{customerCount}} Items',
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f5f5f5; }
    .container { max-width: 800px; margin: 0 auto; padding: 20px; background-color: white; border-radius: 8px; }
    .alert { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin-bottom: 20px; border-radius: 4px; }
    .order-details { background-color: #f8f9fa; padding: 20px; border-radius: 4px; margin: 20px 0; }
    .items-table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    .items-table th, .items-table td { padding: 10px; text-align: left; border-bottom: 1px solid #dee2e6; }
    .items-table th { background-color: #e9ecef; font-weight: bold; }
    .total-row { background-color: #e9ecef; font-weight: bold; }
    .button { display: inline-block; background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; margin-top: 15px; }
    .footer { text-align: center; color: #6c757d; font-size: 12px; margin-top: 30px; border-top: 1px solid #dee2e6; padding-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="alert">
      <h2 style="margin-top: 0;">🔔 New Order Just Came In!</h2>
    </div>

    <div class="order-details">
      <h3>Customer Information</h3>
      <p><strong>Name:</strong> {{customerName}}</p>
      <p><strong>Phone:</strong> {{customerPhone}}</p>
      <p><strong>Order Time:</strong> {{createdAt}}</p>
    </div>

    <h3>Order Items ({{customerCount}} items)</h3>
    <table class="items-table">
      <tr>
        <th>Item</th>
        <th>Qty</th>
        <th>Price</th>
        <th>Subtotal</th>
      </tr>
      {{itemsTableHtml}}
      <tr class="total-row">
        <td colspan="3" style="text-align: right;">Total:</td>
        <td>RWF {{totalAmount}}</td>
      </tr>
    </table>

    {{specialInstructionsHtml}}

    <h3>What To Do</h3>
    <ol>
      <li>Review the order items and special instructions</li>
      <li>Start preparing the items</li>
      <li>Update order status when ready</li>
      <li>Customer will pick up or await delivery</li>
    </ol>

    <a href="{{dashboardUrl}}" class="button">View In Dashboard</a>

    <div class="footer">
      <p>Order ID: {{orderId}}</p>
      <p>This is an automated notification from your DineFlow system</p>
    </div>
  </div>
</body>
</html>
    `,
  },

  SETTLEMENT_COMPLETED_MERCHANT: {
    subject: '💰 Settlement Completed - RWF {{amount}}',
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #d4edda; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #28a745; }
    .settlement-box { background-color: #f8f9fa; padding: 20px; border-radius: 4px; margin: 20px 0; }
    .amount { font-size: 28px; font-weight: bold; color: #28a745; }
    .footer { text-align: center; color: #6c757d; font-size: 12px; margin-top: 30px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✅ Payout Received!</h1>
      <p>Your settlement has been completed and funds are on their way to your account.</p>
    </div>

    <div class="settlement-box">
      <h2>Settlement Summary</h2>
      <div class="amount">RWF {{amount}}</div>
      
      <p><strong>Payment Method:</strong> {{paymentMethod}}</p>
      <p><strong>Account Destination:</strong> {{accountDestination}}</p>
      <p><strong>Transaction Date:</strong> {{completedDate}}</p>
      <p><strong>Reference Number:</strong> {{referenceNumber}}</p>
    </div>

    <div class="settlement-box">
      <h2>Timeline</h2>
      <p>✅ <strong>Orders Completed:</strong> {{orderCount}} orders</p>
      <p>✅ <strong>Payments Received:</strong> {{orderCount}} payments</p>
      <p>✅ <strong>Commission Deducted:</strong> -RWF {{commissionAmount}} ({{commissionRate}}%)</p>
      <p>✅ <strong>Settlement Processed:</strong> RWF {{netAmount}} to your account</p>
      <p>✅ <strong>Payout Initiated:</strong> {{completedDate}}</p>
    </div>

    <p>The funds should appear in your {{paymentMethod}} account within 1-3 business days depending on your bank.</p>

    <div class="footer">
      <p>DineFlow Platform</p>
      <p>Thank you for using DineFlow! Keep up the great service.</p>
    </div>
  </div>
</body>
</html>
    `,
  },

  PAYMENT_FAILED_MERCHANT: {
    subject: '⚠️ Payment Failed - Order {{orderId}}',
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .alert { background-color: #f8d7da; border-left: 4px solid #dc3545; padding: 15px; margin-bottom: 20px; border-radius: 4px; }
    .details-box { background-color: #f8f9fa; padding: 20px; border-radius: 4px; margin: 20px 0; }
    .footer { text-align: center; color: #6c757d; font-size: 12px; margin-top: 30px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="alert">
      <h2 style="margin-top: 0;">⚠️ Payment Failed</h2>
      <p>A payment for order {{orderId}} could not be processed.</p>
    </div>

    <div class="details-box">
      <h3>Order Information</h3>
      <p><strong>Order ID:</strong> {{orderId}}</p>
      <p><strong>Customer:</strong> {{customerName}}</p>
      <p><strong>Amount:</strong> RWF {{amount}}</p>
      <p><strong>Failure Reason:</strong> {{failureReason}}</p>
      <p><strong>Failed At:</strong> {{failureTime}}</p>
    </div>

    <div class="details-box">
      <h3>What Should You Do?</h3>
      <ol>
        <li>Contact the customer and ask them to retry payment</li>
        <li>Suggest they check their payment method</li>
        <li>If the problem persists, they can contact support</li>
      </ol>
    </div>

    <p style="color: #666; font-size: 14px;">Note: The system will automatically retry failed payments for 24 hours. You'll receive another notification when the payment is successful.</p>

    <div class="footer">
      <p>DineFlow Platform</p>
      <p>Questions? Check your dashboard or contact support</p>
    </div>
  </div>
</body>
</html>
    `,
  },

  SUPPORT_ESCALATED_ADMIN: {
    subject: '🆘 Support Ticket Escalated - {{issueSummary}}',
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 700px; margin: 0 auto; padding: 20px; }
    .alert { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin-bottom: 20px; border-radius: 4px; }
    .issue-box { background-color: #f8f9fa; padding: 20px; border-radius: 4px; margin: 20px 0; }
    .footer { text-align: center; color: #6c757d; font-size: 12px; margin-top: 30px; }
    .button { display: inline-block; background-color: #dc3545; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; margin-top: 15px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="alert">
      <h2 style="margin-top: 0;">🆘 Support Ticket Escalated</h2>
      <p>A support issue has been escalated and requires immediate attention.</p>
    </div>

    <div class="issue-box">
      <h3>Issue Details</h3>
      <p><strong>Ticket ID:</strong> {{ticketId}}</p>
      <p><strong>Priority:</strong> <span style="color: #dc3545; font-weight: bold;">{{priority}}</span></p>
      <p><strong>Category:</strong> {{category}}</p>
      <p><strong>Restaurant:</strong> {{restaurantName}}</p>
      <p><strong>Customer:</strong> {{customerName}}</p>
      <p><strong>Summary:</strong> {{issueSummary}}</p>
    </div>

    <div class="issue-box">
      <h3>Details</h3>
      <p>{{issueDescription}}</p>
    </div>

    <div class="issue-box">
      <h3>Action Required</h3>
      <p>⏱️ This issue requires your attention immediately</p>
      <p>📞 Contact the customer and begin resolution</p>
      <p>📝 Update the ticket with any progress</p>
    </div>

    <a href="{{ticketUrl}}" class="button">View Ticket</a>

    <div class="footer">
      <p>DineFlow Admin System</p>
      <p>This is an automated escalation notification</p>
    </div>
  </div>
</body>
</html>
    `,
  },
};
