import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

interface InvoiceItem {
  product_name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total: number;
}

interface InvoiceData {
  invoice_number: string;
  order_date: string;
  customer_name: string;
  customer_phone?: string;
  customer_address?: string;
  items: InvoiceItem[];
  subtotal: number;
  discount_amount: number;
  total_amount: number;
  payment_type: string;
}

export async function generateInvoicePDF(invoiceData: InvoiceData) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: 'Helvetica', 'Arial', sans-serif;
          padding: 40px;
          color: #111827;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: start;
          margin-bottom: 40px;
          border-bottom: 3px solid #6366F1;
          padding-bottom: 20px;
        }
        .company-info h1 {
          color: #6366F1;
          font-size: 32px;
          margin-bottom: 5px;
        }
        .company-info p {
          color: #6B7280;
          font-size: 14px;
        }
        .invoice-info {
          text-align: right;
        }
        .invoice-info h2 {
          color: #111827;
          font-size: 24px;
          margin-bottom: 10px;
        }
        .invoice-info p {
          color: #6B7280;
          font-size: 14px;
          margin: 5px 0;
        }
        .customer-section {
          background: #F9FAFB;
          padding: 20px;
          border-radius: 8px;
          margin-bottom: 30px;
        }
        .customer-section h3 {
          color: #111827;
          font-size: 16px;
          margin-bottom: 10px;
        }
        .customer-section p {
          color: #6B7280;
          font-size: 14px;
          margin: 5px 0;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 30px;
        }
        thead {
          background: #6366F1;
          color: white;
        }
        th {
          padding: 12px;
          text-align: left;
          font-size: 14px;
          font-weight: 600;
        }
        td {
          padding: 12px;
          border-bottom: 1px solid #E5E7EB;
          font-size: 14px;
        }
        .text-right {
          text-align: right;
        }
        .totals {
          margin-left: auto;
          width: 300px;
        }
        .totals-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          font-size: 14px;
        }
        .totals-row.subtotal {
          color: #6B7280;
        }
        .totals-row.discount {
          color: #10B981;
        }
        .totals-row.total {
          border-top: 2px solid #E5E7EB;
          padding-top: 12px;
          margin-top: 8px;
          font-size: 18px;
          font-weight: bold;
          color: #111827;
        }
        .footer {
          margin-top: 60px;
          text-align: center;
          color: #9CA3AF;
          font-size: 12px;
          border-top: 1px solid #E5E7EB;
          padding-top: 20px;
        }
        .payment-badge {
          display: inline-block;
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          margin-top: 10px;
        }
        .payment-cash {
          background: #D1FAE5;
          color: #065F46;
        }
        .payment-credit {
          background: #FEF3C7;
          color: #92400E;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="company-info">
          <h1>Factory Management</h1>
          <p>Your Factory Address Here</p>
          <p>Phone: +91 XXXXXXXXXX</p>
        </div>
        <div class="invoice-info">
          <h2>INVOICE</h2>
          <p><strong>${invoiceData.invoice_number}</strong></p>
          <p>Date: ${new Date(invoiceData.order_date).toLocaleDateString('en-IN')}</p>
          <span class="payment-badge payment-${invoiceData.payment_type}">
            ${invoiceData.payment_type.toUpperCase()}
          </span>
        </div>
      </div>

      <div class="customer-section">
        <h3>Bill To:</h3>
        <p><strong>${invoiceData.customer_name}</strong></p>
        ${invoiceData.customer_phone ? `<p>Phone: ${invoiceData.customer_phone}</p>` : ''}
        ${invoiceData.customer_address ? `<p>${invoiceData.customer_address}</p>` : ''}
      </div>

      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th>Quantity</th>
            <th class="text-right">Unit Price</th>
            <th class="text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          ${invoiceData.items.map(item => `
            <tr>
              <td>${item.product_name}</td>
              <td>${item.quantity} ${item.unit}</td>
              <td class="text-right">₹${item.unit_price.toFixed(2)}</td>
              <td class="text-right">₹${item.total.toFixed(2)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="totals">
        <div class="totals-row subtotal">
          <span>Subtotal:</span>
          <span>₹${invoiceData.subtotal.toFixed(2)}</span>
        </div>
        ${invoiceData.discount_amount > 0 ? `
          <div class="totals-row discount">
            <span>Discount:</span>
            <span>- ₹${invoiceData.discount_amount.toFixed(2)}</span>
          </div>
        ` : ''}
        <div class="totals-row total">
          <span>Total Amount:</span>
          <span>₹${invoiceData.total_amount.toFixed(2)}</span>
        </div>
      </div>

      <div class="footer">
        <p>Thank you for your business!</p>
        <p>This is a computer-generated invoice.</p>
      </div>
    </body>
    </html>
  `;

  try {
    const { uri } = await Print.printToFileAsync({ html });
    return uri;
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
}

export async function shareInvoicePDF(pdfUri: string) {
  try {
    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(pdfUri);
    } else {
      throw new Error('Sharing is not available on this device');
    }
  } catch (error) {
    console.error('Error sharing PDF:', error);
    throw error;
  }
}
