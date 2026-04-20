const mongoose = require('mongoose');
require('dotenv').config({ path: '../.env' });
const { sendNotification } = require('../utils/notifier');

/**
 * Script to test the email notification templates for the Order Lifecycle.
 * Triggers Customer, Vendor, and Logistics notifications using a test recipient.
 */
async function testOrderNotifications() {
    try {
        // Ensure your .env has a valid MONGODB_URI and SMTP settings
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to DB');

        // CHANGE THIS: Target email for testing delivery
        const testRecipient = 'zeroxerxes8@gmail.com';
        console.log(`Testing Order Notifications for: ${testRecipient}`);

        const mockOrderId = new mongoose.Types.ObjectId();
        const mockOrder = {
            _id: mockOrderId,
            total_amount: 15500,
            subtotal: 14000,
            shipping_fee: 1500,
            products: [
                { name: 'Elite Leather Boots', quantity: 1, price: 14000 }
            ],
            shipping_address: {
                name: 'John Doe',
                street: 'Rue Maréchal Foch',
                quartier: 'Akwa',
                phone: '+237 600 000 000',
                email: testRecipient
            },
            vendor_id: {
                store_name: 'Aura Premium Store',
                phone: '+237 611 111 111',
                pickup_address: {
                    street: 'Boulevard de la Liberté',
                    quartier: 'Bonanjo',
                    city: 'Douala'
                }
            }
        };

        const mockApp = { get: () => null };

        // 1. CUSTOMER: Order Confirmed
        console.log('Dispatching Customer "Order Confirmed" Email...');
        await sendNotification(mockApp, new mongoose.Types.ObjectId(), {
            title: 'Order Confirmed',
            message: `Your order #${mockOrderId.toString().slice(-6).toUpperCase()} has been successfully processed and recorded.`,
            type: 'order_status',
            metadata: { order_id: mockOrderId, link: '/orders' },
            sendEmail: true,
            emailLink: `${process.env.WEB_CLIENT_URL}/orders`,
            orderDetails: mockOrder,
            role: 'customer',
            overrideEmail: testRecipient
        });

        // 2. VENDOR: New Order Received
        console.log('Dispatching Vendor "New Order Received" Email...');
        await sendNotification(mockApp, new mongoose.Types.ObjectId(), {
            title: 'New Order Received',
            message: `You have received a new order (#${mockOrderId.toString().slice(-6).toUpperCase()}) from John Doe.`,
            type: 'order_status',
            metadata: { order_id: mockOrderId, link: '/vendor/orders' },
            sendEmail: true,
            emailLink: `${process.env.WEB_CLIENT_URL}/vendor/orders`,
            orderDetails: mockOrder,
            role: 'vendor',
            overrideEmail: testRecipient
        });

        // 3. LOGISTICS: New Shipment Assigned
        console.log('Dispatching Logistics "New Shipment Assigned" Email...');
        await sendNotification(mockApp, new mongoose.Types.ObjectId(), {
            title: 'New Shipment Assigned',
            message: `You have new delivery work for Order #${mockOrderId.toString().slice(-6).toUpperCase()}.`,
            type: 'system_alert',
            sendEmail: true,
            orderDetails: mockOrder,
            role: 'logistics',
            overrideEmail: testRecipient
        });

        console.log('All test notifications dispatched successfully!');
    } catch (err) {
        console.error('Test Failed:', err);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from DB');
    }
}

testOrderNotifications();