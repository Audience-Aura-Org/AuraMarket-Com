const fs = require('fs');
const path = require('path');
const templates = require('./utils/emailTemplates');

function generateAllPreviews() {
  const targetEmail = 'brandonasah11@gmail.com';
  
  const mockUser = { name: 'Brandon', email: targetEmail, role: 'customer' };
  const mockVendor = { store_name: 'Aura Premium Store' };
  const mockLogistics = { company_name: 'Aura Express' };
  const mockOrder = { 
    _id: '64a7c9f8e4b0c1a2d3e4f5g6', 
    total_amount: 15000, 
    payment_method: 'card',
    products: [
      { name: 'Premium Theme', quantity: 1, price: 10000 },
      { name: 'Support Package', quantity: 1, price: 5000 }
    ]
  };
  const mockShipment = { tracking_code: 'AURA-TRACK-9921' };
  const mockQrCode = 'https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=AURA-TRACK-9921';

  const emailPayloads = [
    { name: 'Welcome Email', ...templates.welcomeEmail({ user: mockUser }) },
    { name: 'Password Reset', ...templates.passwordReset({ user: mockUser, resetLink: 'https://auradime.com/reset-password?token=123' }) },
    { name: 'Order Placed (Customer)', ...templates.orderPlaced({ order: mockOrder, customer: mockUser, qrCode: mockQrCode }) },
    { name: 'Payment Confirmed (Customer)', ...templates.paymentConfirmed({ order: mockOrder, customer: mockUser, qrCode: mockQrCode }) },
    { name: 'Shipment Status (Customer)', ...templates.shipmentStatusChanged({ shipment: mockShipment, order: mockOrder, recipient: mockUser, status: 'in_transit' }) },
    { name: 'Refund Approved (Customer)', ...templates.refundApproved({ order: mockOrder, customer: mockUser }) },
    { name: 'Order Completed (Vendor)', ...templates.orderCompleted({ order: mockOrder, vendor: mockVendor }) },
    { name: 'New Order (Vendor)', ...templates.newOrderForVendor({ order: mockOrder, vendor: mockVendor }) },
    { name: 'Shipment Assigned (Logistics)', ...templates.shipmentAssigned({ shipment: mockShipment, order: mockOrder, logistics: mockLogistics }) },
    { name: 'Refund Requested (Vendor)', ...templates.refundRequested({ order: mockOrder, vendor: mockVendor, reason: 'Item defective' }) },
    { name: 'Order Status Updated (Customer)', ...templates.orderStatusUpdated({ order: mockOrder, customer: mockUser, qrCode: mockQrCode }) }
  ];

  let combinedHtml = `
    <html>
      <head>
        <title>Aura Email Previews</title>
        <style>
          body { font-family: sans-serif; background: #e0e0e0; padding: 40px; margin: 0; }
          .preview-section { margin-bottom: 60px; background: #fff; padding: 20px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
          .preview-header { border-bottom: 2px solid #f20df2; padding-bottom: 10px; margin-bottom: 20px; }
          .preview-header h2 { margin: 0; color: #333; }
          .preview-header p { margin: 5px 0 0 0; color: #666; font-size: 14px; }
          iframe { width: 100%; height: 800px; border: 1px solid #ccc; border-radius: 4px; }
        </style>
      </head>
      <body>
        <h1>Aura Market — All Email Templates</h1>
        <p>Because the local network is blocking outbound SMTP traffic, all templates have been rendered below for instant preview.</p>
  `;

  emailPayloads.forEach(payload => {
    // Escape HTML to put it inside an iframe srcdoc safely
    const escapedHtml = payload.html.replace(/"/g, '&quot;').replace(/'/g, '&apos;');
    
    combinedHtml += `
      <div class="preview-section">
        <div class="preview-header">
          <h2>${payload.name}</h2>
          <p><strong>Subject:</strong> ${payload.subject}</p>
        </div>
        <iframe srcdoc="${escapedHtml}"></iframe>
      </div>
    `;
  });

  combinedHtml += `
      </body>
    </html>
  `;

  const outputPath = path.resolve(__dirname, '../web/public/test-email.html');
  fs.writeFileSync(outputPath, combinedHtml);
  
  console.log(`Generated preview gallery with ${emailPayloads.length} templates.`);
  console.log(`Email HTML saved to ${outputPath}`);
  console.log('You can preview all of them at: http://localhost:3000/test-email.html');
}

generateAllPreviews();
