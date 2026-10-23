const cell = (value) => {
  const text = String(value ?? '');
  // Names can be supplied by merchants. Keep them as spreadsheet text.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
};

export function earningsCsv(vendors = [], partners = []) {
  const rows = [
    ['Type', 'Name', 'Orders or shipments', 'Gross sales (XAF)', 'Shipping value (XAF)'],
    ...vendors.map((vendor) => ['Merchant', vendor.store_name || vendor._id?.store_name || 'Unknown merchant', vendor.total_orders || 0, vendor.gross_sales || 0, '']),
    ...partners.map((partner) => ['Logistics partner', partner.company_name || partner._id?.company_name || 'Unknown partner', partner.total_shipments || 0, '', partner.total_shipping_value || 0]),
  ];
  return '\uFEFF' + rows.map((row) => row.map(cell).join(',')).join('\r\n');
}
