const baseUrl = 'https://auradime.com';
const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.auradime.com/api/v1';

// High-priority public pages
const corePages = [
  { path: '', changeFrequency: 'daily', priority: 1.0 },
  { path: '/shop', changeFrequency: 'daily', priority: 0.9 },
  { path: '/dine', changeFrequency: 'daily', priority: 0.9 },
  { path: '/stores', changeFrequency: 'daily', priority: 0.8 },
  { path: '/collections', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/brands', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/discovery', changeFrequency: 'daily', priority: 0.7 },
  { path: '/signature-drops', changeFrequency: 'weekly', priority: 0.7 },
  { path: '/logistics', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/subscribe', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/help-center', changeFrequency: 'monthly', priority: 0.5 },
];

// Auth & utility pages (lower priority)
const utilityPages = [
  { path: '/login', changeFrequency: 'monthly', priority: 0.4 },
  { path: '/signup', changeFrequency: 'monthly', priority: 0.4 },
  { path: '/contact', changeFrequency: 'monthly', priority: 0.5 },
  { path: '/help', changeFrequency: 'monthly', priority: 0.5 },
  { path: '/install', changeFrequency: 'monthly', priority: 0.4 },
];

// Legal/policy pages
const legalPages = [
  '/privacy',
  '/privacy-policy',
  '/terms',
  '/terms-of-service',
  '/cookies',
  '/refund-policy',
  '/vendor-policy',
  '/logistics-policy',
  '/prohibited-items',
  '/dispute-policy',
  '/dispute-resolution',
  '/account-deletion',
  '/rules',
];

async function fetchJSON(url) {
  try {
    const res = await fetch(url, { next: { revalidate: 86400 } });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function sitemap() {
  const now = new Date().toISOString();

  // Static core pages
  const staticEntries = corePages.map(({ path, changeFrequency, priority }) => ({
    url: `${baseUrl}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
  }));

  // Utility pages
  const utilityEntries = utilityPages.map(({ path, changeFrequency, priority }) => ({
    url: `${baseUrl}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
  }));

  // Legal pages
  const legalEntries = legalPages.map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified: now,
    changeFrequency: 'yearly',
    priority: 0.3,
  }));

  // Dynamic pages — fetch products & stores in parallel
  let productEntries = [];
  let storeEntries = [];
  let restaurantEntries = [];

  try {
    const [productsData, storesData] = await Promise.all([
      fetchJSON(`${apiUrl}/products?limit=500&status=active`),
      fetchJSON(`${apiUrl}/vendors?limit=500`),
    ]);

    // Products: response shape is { success, data: { products: [...] } }
    const products = productsData?.data?.products || [];
    for (const product of products) {
      productEntries.push({
        url: `${baseUrl}/products/${product._id}`,
        lastModified: product.updatedAt || now,
        changeFrequency: 'weekly',
        priority: 0.6,
      });
    }

    // Vendors/stores: response shape is { success, data: { stores: [...] } }
    const vendors = storesData?.data?.stores || storesData?.data?.vendors || [];
    for (const vendor of vendors) {
      const id = vendor._id;
      storeEntries.push({
        url: `${baseUrl}/stores/${id}`,
        lastModified: vendor.updatedAt || now,
        changeFrequency: 'weekly',
        priority: 0.6,
      });
      if (vendor.vendor_type === 'restaurant') {
        restaurantEntries.push({
          url: `${baseUrl}/dine/restaurant/${id}`,
          lastModified: vendor.updatedAt || now,
          changeFrequency: 'daily',
          priority: 0.7,
        });
      }
    }
  } catch {
    // API unavailable during build — dynamic entries will be empty
  }

  return [
    ...staticEntries,
    ...utilityEntries,
    ...legalEntries,
    ...productEntries,
    ...storeEntries,
    ...restaurantEntries,
  ];
}
