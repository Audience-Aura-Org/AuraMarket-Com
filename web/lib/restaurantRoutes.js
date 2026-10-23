// A query route is available in both the web server and the packaged static app.
export const restaurantHref = (vendorId) => {
  const id = typeof vendorId === 'object' ? vendorId?._id : vendorId;
  return id ? '/dine/restaurant?vendor_id=' + encodeURIComponent(String(id)) : '/dine';
};
