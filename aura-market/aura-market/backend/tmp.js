
const { validateEnv } = require('./config/env');
validateEnv();
const connectDB = require('./config/database');
const Product = require('./models/Product.model.js');
const Cart = require('./models/Cart.model.js');
const Order = require('./models/Order.model.js');

connectDB().then(async () => {
    try {
        const p = await Product.findOne({ name: 'Crimson Evening Gown' });
        if (p) {
            console.log('Old Stock:', p.stock);
            p.stock = 10;
            await p.save();
            console.log('New Stock:', p.stock);
        } else {
            console.log('Product not found in DB');
        }
        
        const deleted = await Order.deleteMany({ payment_status: 'pending' });
        console.log('Deleted pending orders:', deleted.deletedCount);
        
        process.exit();
    } catch(e) {
        console.error(e);
        process.exit(1);
    }
});

