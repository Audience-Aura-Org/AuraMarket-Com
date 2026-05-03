const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const { sendEmail } = require('./utils/emailService');
const templates = require('./utils/emailTemplates');

async function testAllEmails() {
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
    templates.welcomeEmail({ user: mockUser }),
    templates.passwordReset({ user: mockUser, resetLink: 'https://aura-market-com.vercel.app/reset-password?token=123' }),
    templates.orderPlaced({ order: mockOrder, customer: mockUser, qrCode: mockQrCode }),
    templates.paymentConfirmed({ order: mockOrder, customer: mockUser, qrCode: mockQrCode }),
    templates.shipmentStatusChanged({ shipment: mockShipment, order: mockOrder, recipient: mockUser, status: 'in_transit' }),
    templates.refundApproved({ order: mockOrder, customer: mockUser }),
    templates.orderCompleted({ order: mockOrder, vendor: mockVendor }),
    templates.newOrderForVendor({ order: mockOrder, vendor: mockVendor }),
    templates.shipmentAssigned({ shipment: mockShipment, order: mockOrder, logistics: mockLogistics }),
    templates.refundRequested({ order: mockOrder, vendor: mockVendor, reason: 'Item defective' }),
    templates.orderStatusUpdated({ order: mockOrder, customer: mockUser, qrCode: mockQrCode })
  ];

  console.log(`Attempting to send ${emailPayloads.length} test emails to ${targetEmail}...`);

  for (let i = 0; i < emailPayloads.length; i++) {
    const payload = emailPayloads[i];
    console.log(`[${i + 1}/${emailPayloads.length}] Sending: ${payload.subject}...`);
    
    const success = await sendEmail({
      to: targetEmail,
      subject: `[TEST] ${payload.subject}`,
      html: payload.html,
      text: payload.text
    });

    if (success) {
      console.log(`✅ Sent: ${payload.subject}`);
    } else {
      console.error(`❌ Failed: ${payload.subject}`);
    }
    
    // Add a small delay between sends to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('Finished processing all emails.');
  process.exit(0);
}

testAllEmails();
