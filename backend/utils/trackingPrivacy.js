/**
 * What a shipment lookup may reveal.
 *
 * Parties to a shipment (booker, recipient account, the carrying agency, admins)
 * get the full record. Anyone else holding only a tracking code gets delivery
 * progress without personal data: first names, masked phones, district/city-level
 * addresses, no emails and no proof-of-delivery photo.
 */

const idOf = (value) => (value && typeof value === 'object' ? value._id || value.id : value)?.toString?.() || null;

const isShipmentParty = (user, shipment) => {
  if (!user || !shipment) return false;
  if (user.role === 'admin') return true;
  const uid = user._id?.toString();
  return [idOf(shipment.booked_by), idOf(shipment.other_party?.user_id), idOf(shipment.logistics_id?.user_id)]
    .filter(Boolean)
    .includes(uid);
};

const firstName = (name) => (typeof name === 'string' && name.trim() ? name.trim().split(/\s+/)[0] : null);

// "677123456" -> "6•• ••• 456": enough for a recipient to recognise, useless for harvesting.
const maskPhone = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length < 6) return null;
  return `${digits.slice(-9, -8) || digits[0]}•• ••• ${digits.slice(-3)}`;
};

const coarseAddress = (address) => {
  if (!address || typeof address !== 'object') return address || null;
  const { quartier, city, region, country } = address;
  return { quartier, city, region, country, phone: maskPhone(address.phone) };
};

const redactPerson = (person) => (person ? { name: firstName(person.name), phone: maskPhone(person.phone) } : null);

const redactShipmentForPublic = (shipment) => {
  if (!shipment) return shipment;
  const { booked_by, guest_booker, other_party, proof_of_delivery, logistics_id, pickup_address, delivery_address, package_details, ...rest } = shipment;
  return {
    ...rest,
    pickup_address: coarseAddress(pickup_address),
    delivery_address: coarseAddress(delivery_address),
    booked_by: redactPerson(booked_by),
    guest_booker: redactPerson(guest_booker),
    other_party: redactPerson(other_party),
    package_details: package_details ? { category: package_details.category, weight_tier: package_details.weight_tier } : null,
    proof_of_delivery: proof_of_delivery?.timestamp ? { timestamp: proof_of_delivery.timestamp } : null,
    logistics_id: logistics_id ? { company_name: logistics_id.company_name } : null,
    redacted: true,
  };
};

module.exports = { isShipmentParty, redactShipmentForPublic, maskPhone };
