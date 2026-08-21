# AuraMarket (Auradime) — Logistics Zone Unification

How geographic zones, logistics firms, vendors, and shipments all connect.

---

## 1. The Two-Tier Zone Hierarchy

Every delivery address on the platform resolves to one of two geographic levels stored in the `LogisticZone` collection.

```
LogisticZone (type = "region")         ← top level, parent_id = null
  e.g.  Douala, Yaounde, Bamenda

  └── LogisticZone (type = "quartier") ← leaf level, parent_id → region
        e.g.  Bonanjo, Akwa, Deido (children of Douala)
              Bastos, Mvan, Omnisports (children of Yaounde)
```

**Schema fields that matter:**

| Field | Role |
|-------|------|
| `name` | Human-readable zone name (indexed, case-sensitive stored) |
| `parent_id` | `ObjectId → LogisticZone` (null for regions) |
| `type` | `"region"` or `"quartier"` |
| `is_active` | Soft-delete; inactive zones are excluded from all lookups |

The `getZones` endpoint populates `parent_id.name` so the frontend can render the full `Region > Quartier` path in a single request.

---

## 2. How a Logistics Company Maps to Zones

A logistics firm self-configures two zone-related arrays on its `LogisticsCompany` document:

### 2.1 `quartier_prices[]` — delivery pricing matrix

```json
[
  { "quartier": "Bonanjo",  "price": 1500 },
  { "quartier": "Akwa",     "price": 1500 },
  { "quartier": "Douala",   "price": 2000 },
  { "quartier": "Yaounde",  "price": 3500 }
]
```

- Each entry maps a **zone name** (quartier or region) to a flat delivery fee in XAF.
- The name stored here is a free-text string, not an ObjectId, so the lookup uses a **case-insensitive regex** match at query time.
- A firm can enter a region name (e.g. `"Douala"`) to cover the entire region as a fallback when no quartier-level price exists.

### 2.2 `supported_pickup_regions[]` — where the firm collects from vendors

```json
["Douala", "Littoral"]
```

- Region-level strings listing where this firm can pick up goods from vendors.
- An empty array (`[]`) or absent field means the firm is treated as pickup-agnostic — it can pick up from anywhere.
- Used in the compatibility algorithm (see §4) to exclude firms that cannot reach a vendor's pickup city.

---

## 3. How a Vendor Declares Its Location

The `Vendor` document holds a `pickup_address` embedded object:

```json
{
  "street": "123 Rue de la Paix",
  "city":   "Douala",
  "region": "Littoral",
  "quartier": "Bonanjo"
}
```

The **`region`** field is the critical field for logistics matching. When a customer checks out, the system extracts `vendor.pickup_address.region` from every vendor in the cart to determine which logistics firms can physically reach those pickup points.

---

## 4. Zone Unification — The Compatibility Algorithm

**Entry point:** `GET /api/logistics/compatible-firms?quartier=Akwa&vendor_ids=xxx,yyy`

**Implemented in:** [backend/services/logistics.service.js](backend/services/logistics.service.js) → `getCompatibleFirms()`

### Step-by-step

```
Customer selects delivery quartier at checkout
              │
              ▼
1. Resolve vendors from cart
   → collect vendor.pickup_address.region for each vendor_id
   → pickupRegions = ["Douala", "Littoral"]

              │
              ▼
2. Resolve the target zone from LogisticZone collection
   → case-insensitive search: { name: /^Akwa$/i }
   → populate parent_id → gives us the parent region name
   → districtName = "Douala"

              │
              ▼
3. Build eligibility clause (firm must be visible to customers)
   → is_verified = true   (admin-approved)
   OR
   → user_id in [active logistics subscription user IDs]

              │
              ▼
4. Build delivery zone match (price table must cover this zone)
   → exact quartier match:   { quartier_prices.quartier: /^Akwa$/i }
   → parent district fallback: { quartier_prices.quartier: /^Douala$/i }
   → pickup region match:    { supported_pickup_regions: { $in: pickupRegions } }
   → pickup-agnostic fallback: { supported_pickup_regions: { $exists: false } }
                               { supported_pickup_regions: { $size: 0 } }

              │
              ▼
5. Final MongoDB query (AND of eligibility + OR of zone conditions)
   → returns all firms that are eligible AND can serve this zone

              │
              ▼
6. Response: [ { firm, quartier_prices, ... } ]
   Frontend renders each firm with their price for the selected quartier
```

### Why the three-level OR matters

A single checkout request may involve:
- A delivery quartier (`Akwa`) that the firm priced exactly → **quartier match**
- A delivery quartier (`Deido`) that the firm only priced at the parent level (`Douala`) → **district fallback**
- Firms that serve the whole pickup region regardless of delivery zone → **pickup region match**

All three conditions are unioned so that no valid firm is excluded due to minor naming granularity differences.

---

## 5. Fee Calculation — The Same Fallback Logic

**Implemented in:** `logistics.service.js` → `calculateShipmentFees()`

```
firm.quartier_prices.find(p => p.quartier matches delivery quartier)
  → found?  use it directly
  → not found?
      → resolve quartier's parent region from LogisticZone (same populate pattern)
      → firm.quartier_prices.find(p => p.quartier matches parent region name)
        → found? use it as the district-level price
        → not found? throw "Zone not mapped" error
```

**Multi-vendor fee:**
```
perShipmentFee = matched price (one fee for the delivery zone)
totalFee       = perShipmentFee × number of vendors in the cart
```

Each vendor in a multi-vendor order generates one shipment ticket, each priced at `perShipmentFee`.

---

## 6. How All Pieces Connect at Checkout

```
Customer adds items from Vendor A (Douala) and Vendor B (Douala)
Customer selects delivery to quartier "Akwa"
Customer selects logistics firm "SpeedMoto"

                │
                ▼
POST /api/orders (checkout)
  → validate cart
  → for each vendor group → create one Order
  → call logisticsService.calculateShipmentFees(vendors, "Akwa", SpeedMoto._id)
      → quartier_prices lookup: SpeedMoto has { quartier: "Akwa", price: 1500 }
      → perShipmentFee = 1500 XAF
      → totalFee = 1500 × 2 vendors = 3000 XAF
  → each Order gets shipping_fee = 1500, shipping_method = "logistics_partner"
  → payment processed (escrow / wallet / gateway)
  → call logisticsService.createShipmentsForOrder(order, "Akwa", SpeedMoto._id)
      → creates Shipment for Vendor A:
          tracking_code = "AURA-482910"
          pickup_address ← vendor_A.pickup_address + vendor_A.phone
          delivery_address ← order.shipping_address + quartier: "Akwa"
          price = 1500
          status = "pending"
      → creates Shipment for Vendor B:
          tracking_code = "AURA-571234"
          (same pattern)
  → order.tracking_number = generated tracking code
```

---

## 7. Zone Data Flow Across All Models

```
LogisticZone                       (platform master list)
  ├── region: "Douala"             id: A
  │     └── quartier: "Akwa"      id: B, parent_id: A
  │     └── quartier: "Bonanjo"   id: C, parent_id: A
  └── region: "Yaounde"           id: D
        └── quartier: "Bastos"    id: E, parent_id: D

LogisticsCompany "SpeedMoto"
  ├── quartier_prices: [
  │     { quartier: "Akwa",    price: 1500 },  ← matches zone B by name
  │     { quartier: "Douala",  price: 2000 }   ← district fallback for zone A children
  │   ]
  └── supported_pickup_regions: ["Douala"]     ← can pick up from Douala vendors

Vendor "TechStore"
  └── pickup_address.region: "Douala"          ← within SpeedMoto's pickup range

Order (customer buys from TechStore, delivers to Akwa)
  ├── shipping_method: "logistics_partner"
  ├── logistics_company_id → SpeedMoto
  ├── shipping_fee: 1500
  └── shipping_address.quartier: "Akwa"

Shipment (one per vendor per order)
  ├── logistics_id → SpeedMoto
  ├── vendor_id    → TechStore
  ├── pickup_address  ← vendor.pickup_address
  ├── delivery_address.quartier: "Akwa"
  ├── price: 1500
  └── tracking_code: "AURA-482910"
```

---

## 8. Shipment Status Machine

Each `Shipment` document has its own independent state machine. All parties (vendor, customer, logistics firm) receive notifications at every transition.

```
pending          → SpeedMoto accepts the job
  │
  ▼
assigned         → driver assigned internally
  │
  ▼
picked_up        → driver collected goods from TechStore pickup address
  │               ┌─ Order.order_status → "shipped" (all in-flight statuses trigger this)
  ▼
in_transit       → en route to hub or destination
  │
  ▼
out_for_delivery → final-mile (driver heading to Akwa)
  │
  ├──▶ delivered → proof captured (image + receiver name + note)
  │               └─ All shipments for this order delivered?
  │                    YES → Order.order_status = "delivered"
  │                    NO  → wait for remaining shipments
  │
  └──▶ failed    → failure_reason required (unreachable / wrong address / other)
                   Vendor + customer notified; re-delivery can be created manually

cancelled        → can be set by vendor or admin before pickup
```

---

## 9. Financial Settlement on Delivery

When the **last shipment** on an order transitions to `delivered`, the controller runs a three-path settlement inside a MongoDB transaction:

```
Path A — Escrow order (escrow.status = "held")
  ├── SpeedMoto wallet += order.shipping_fee
  ├── escrow.logistics_settled = true  (prevents double-payment)
  ├── escrow.vendor_confirmed = true   (delivery acts as vendor confirmation)
  ├── markEscrowDelivered() → sets auto_release_at = now + 6 hours
  └── Customer notified: "Confirm delivery to release vendor funds"
      → Customer clicks confirm → escrow released to vendor (normal escrow flow)
      → or 6-hour auto-release fires if no action

Path B — Pay-on-delivery (COD)
  ├── SpeedMoto wallet += order.shipping_fee
  ├── Vendor wallet    += order.subtotal   (customer paid SpeedMoto in cash)
  ├── order.payment_status = "paid"
  └── order.order_status  = "completed"

Path C — Non-escrow digital payment
  ├── SpeedMoto wallet  += order.shipping_fee
  ├── Calculate platform commission from order.subtotal
  ├── Vendor wallet     += (order.subtotal - platform_fee)
  ├── PlatformSettings.platform_wallet_balance += platform_fee
  └── order.order_status = "completed"
```

The `logistics_settled` guard on the `Escrow` document ensures SpeedMoto is only paid once, even if both `modifyShipmentStatus` and `escrow.releaseFunds` run in close succession.

---

## 10. Admin Zone Management

Admins manage the canonical zone list via the `LogisticZone` collection:

| Operation | Effect |
|-----------|--------|
| Create region | Adds a top-level delivery city/province |
| Create quartier with parent_id | Adds a neighbourhood under a city |
| Set `is_active = false` | Hides zone from checkout and compatible-firms endpoint |
| Rename zone | Only affects `LogisticZone.name`; firm `quartier_prices` use free-text so must be updated separately |

---

## 11. Firm Eligibility Gate

A logistics company appears at checkout only if it passes **both** conditions:

```
ELIGIBLE = (is_verified = true) OR (user_id has an active logistics subscription)
         AND
COVERS   = (quartier_prices contains the delivery zone or its parent region)
         OR (supported_pickup_regions covers the vendor's pickup region)
         OR (supported_pickup_regions is empty / unset → pickup-agnostic)
```

This dual gate means:
- Firms that paid a subscription before admin manually verified them still appear.
- A firm priced at the district level (`Douala`) covers all its child quartiers without needing individual entries.
- A firm with no pickup region restriction can serve vendors in any city they service.

---

## 12. API Reference

| Method | Endpoint | Who | What |
|--------|----------|-----|------|
| `GET` | `/api/logistics/zones` | Public | Full zone tree (regions + quartiers with parent names) |
| `GET` | `/api/logistics/compatible-firms?quartier=X&vendor_ids=Y` | Public | Eligible firms for this delivery + vendor combination |
| `GET` | `/api/logistics` | Public | All verified logistics firms (no zone filter) |
| `POST` | `/api/logistics/onboard` | Logistics user | Register / update firm profile |
| `GET` | `/api/logistics/profile` | Logistics | Own profile + pricing matrix |
| `PATCH` | `/api/logistics/profile` | Logistics | Update company name, contact, logo, banner |
| `PATCH` | `/api/logistics/pricing` | Logistics | Update `quartier_prices[]` + `supported_pickup_regions[]` |
| `GET` | `/api/logistics/shipments` | Vendor or Logistics | Shipment list (smart-routed by role) |
| `GET` | `/api/logistics/shipments/firm` | Logistics / Admin | All shipments assigned to this firm |
| `GET` | `/api/logistics/shipments/vendor` | Vendor / Admin | All shipments for this vendor's orders |
| `GET` | `/api/logistics/shipments/:id` | Logistics / Admin | Single shipment detail |
| `PATCH` | `/api/logistics/shipments/:id/status` | Logistics / Admin | Advance shipment status + trigger settlement |
