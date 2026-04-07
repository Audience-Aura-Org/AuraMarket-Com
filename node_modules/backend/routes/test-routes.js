const routes = [
  './auth.routes',
  './cart.routes',
  './vendor.routes',
  './product.routes',
  './order.routes',
  './wallet.routes',
  './escrow.routes',
  './chat.routes',
  './logistics.routes',
  './admin.routes',
  './upload.routes',
  './users.routes',
  './address.routes',
  './notification.routes',
  './security.routes',
  './dispute.routes',
  './report.routes',
  './payment.routes',
  './coupon.routes',
  './review.routes',
  './wishlist.routes',
  './qa.routes',
  './legal.routes',
  './category.routes',
  './debug.routes',
  './homepage.routes',
  './discovery.routes',
  './tracking.routes'
];

routes.forEach(path => {
  try {
    const route = require(path);
    if (!route || typeof route !== 'function') {
      console.error(`ERROR: Route at ${path} is not a function/router:`, typeof route);
    } else {
      console.log(`OK: ${path}`);
    }
  } catch (err) {
    console.error(`CRASH: Route at ${path} failed to load:`, err.message);
  }
});
