import { describe, expect, it } from 'vitest';
import { earningsCsv } from './financeCsv';

describe('earnings CSV export', () => {
  it('keeps merchant sales and carrier earnings in their correct columns', () => {
    const csv = earningsCsv([{ store_name: 'Asah Studio', total_orders: 2, gross_sales: 3500 }], [{ company_name: 'City Couriers', total_shipments: 3, total_shipping_value: 900 }]);
    expect(csv).toContain('"Merchant","Asah Studio","2","3500",""');
    expect(csv).toContain('"Logistics partner","City Couriers","3","","900"');
  });
  it('escapes names and prevents spreadsheet formulas from merchant-provided text', () => {
    const csv = earningsCsv([{ store_name: '=SUM(1,2)' }, { store_name: 'Shop "A", Main\nStreet' }]);
    expect(csv).toContain('"\'=SUM(1,2)"');
    expect(csv).toContain('"Shop ""A"", Main\nStreet"');
  });
  it('exports a valid header-only file when no earnings exist', () => {
    const csv = earningsCsv();
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv.split('\r\n')).toHaveLength(1);
  });
});
