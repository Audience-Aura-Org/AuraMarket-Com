const PDFDocument = require('pdfkit');

/**
 * utils/invoiceGenerator.js
 * Generates a PDF invoice for an order.
 */

const generateInvoice = (order, callback) => {
  const doc = new PDFDocument({ margin: 50 });

  // Buffering the PDF into memory
  let buffers = [];
  doc.on('data', buffers.push.bind(buffers));
  doc.on('end', () => {
    let pdfData = Buffer.concat(buffers);
    callback(pdfData);
  });

  // Header
  doc
    .fillColor('#444444')
    .fontSize(20)
    .text('Aura Market', 50, 50)
    .fontSize(10)
    .text('Digital Marketplace', 50, 75)
    .text('Yaoundé, Cameroon', 50, 90)
    .moveDown();

  // Invoice Details
  doc
    .fillColor('#000000')
    .fontSize(12)
    .text(`Invoice Number: INV-${order._id.toString().slice(-6).toUpperCase()}`, 50, 130)
    .text(`Order Date: ${new Date(order.createdAt).toLocaleDateString()}`, 50, 145)
    .text(`Customer: ${order.customer_id.name}`, 50, 160)
    .moveDown();

  // Table Header
  const tableTop = 200;
  doc.fontSize(10).font('Helvetica-Bold');
  doc.text('Product', 50, tableTop);
  doc.text('Qty', 300, tableTop);
  doc.text('Price', 350, tableTop);
  doc.text('Total', 450, tableTop);
  doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

  // Table Body
  let position = tableTop + 30;
  doc.font('Helvetica');
  order.products.forEach((item) => {
    doc.text(item.name, 50, position);
    doc.text(item.quantity.toString(), 300, position);
    doc.text(item.price.toFixed(2), 350, position);
    doc.text((item.price * item.quantity).toFixed(2), 450, position);
    position += 20;
  });

  // Totals
  doc.moveTo(50, position + 5).lineTo(550, position + 5).stroke();
  doc
    .fontSize(12)
    .font('Helvetica-Bold')
    .text(`Subtotal: ${order.subtotal.toFixed(2)}`, 350, position + 20)
    .text(`Shipping: ${order.shipping_fee.toFixed(2)}`, 350, position + 40)
    .text(`Total amount: ${order.total_amount.toFixed(2)}`, 350, position + 60);

  // Footer
  doc
    .fontSize(10)
    .fillColor('#888888')
    .text('Thank you for shopping at Aura Market!', 50, 700, { align: 'center', width: 500 });

  doc.end();
};

module.exports = { generateInvoice };
