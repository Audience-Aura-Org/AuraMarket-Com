# WhatsApp notifications — setup

Auradime sends order, payment and delivery updates on WhatsApp to customers who
opt in (Account → Notifications → WhatsApp updates). It uses Meta's official
WhatsApp Business Platform (Cloud API). Until the token below is set, the backend
runs in **dry-run**: messages are logged and recorded, nothing is sent.

## 1. Webhook (Meta → Step 2 "Production setup" → Configure Webhooks)

Deploy the backend first (Meta calls the URL when you press *Verify and save*), and
set `WHATSAPP_VERIFY_TOKEN` in the **production** environment to the same value
you paste here.

| Field | Value |
|---|---|
| Callback URL | `https://api.auradime.com/api/v1/whatsapp/webhook` |
| Verify token | the value of `WHATSAPP_VERIFY_TOKEN` |

Leave "Attach a client certificate" off. After saving, subscribe the webhook to the
**messages** field (it carries both incoming messages and delivery statuses).

## 2. Credentials (production environment variables)

| Variable | Where to find it |
|---|---|
| `WHATSAPP_PHONE_NUMBER_ID` | WhatsApp Manager → API setup → *Phone number ID* (not the number) |
| `WHATSAPP_TOKEN` | Business Settings → System users → add an admin system user → *Generate token* for the app with `whatsapp_business_messaging` and `whatsapp_business_management` (choose "Never" expiry) |
| `WHATSAPP_APP_SECRET` | App dashboard → App settings → Basic → *App secret* |
| `WHATSAPP_API_VERSION` | `v23.0` unless Meta retires it |

The sending number must be registered to the Cloud API; it can no longer be used
in the normal WhatsApp or WhatsApp Business app.

## 3. Message templates (WhatsApp Manager → Message templates → Create)

Category **Utility**, languages **English (en)** and **French (fr)**, names exactly
as below. Paste the body; Meta asks for sample values for each `{{n}}`.

### `auradime_update` — order, payment and delivery updates

- en: `Auradime update: {{1}}` ↵↵ `{{2}}` ↵↵ `Open Auradime for the details: {{3}}`
- fr: `Mise à jour Auradime : {{1}}` ↵↵ `{{2}}` ↵↵ `Ouvrez Auradime pour les détails : {{3}}`
- samples: `Order #A6D79B78 is on its way` · `Your order from Mama Ngozi Boutique has left the store.` · `https://auradime.com/orders/123`

### `auradime_delivery_link` — agency package tracking link

- en: `{{1}} is delivering your package {{2}}. Follow it here: {{3}}` ↵↵ `Please keep your phone on so the rider can reach you.`
- fr: `{{1}} livre votre colis {{2}}. Suivez-le ici : {{3}}` ↵↵ `Gardez votre téléphone allumé pour que le livreur puisse vous joindre.`
- samples: `FastShip` · `AURA-K7Q2M9XP` · `https://auradime.com/delivery/track?t=abc`

(↵↵ = a blank line.) The template text lives in `backend/constants/whatsappTemplates.js`;
keep the two in sync.

## 4. Go live

1. Templates show **Active** in WhatsApp Manager.
2. Production env has the four variables above; restart the backend.
3. Admin → Settings → feature flag `whatsapp_notifications` → on.
4. Opt in from your own account and trigger an order update; check the
   `whatsappmessages` collection: status goes `accepted → sent → delivered → read`.

## Rules the code enforces

- Only opted-in users are messaged; replying **STOP** (or ARRÊT) opts them out.
- Chat messages and promotions are never sent on WhatsApp (cost and consent).
- Webhooks are rejected unless signed with `WHATSAPP_APP_SECRET` (production).
- Failed sends are recorded, never retried blindly (no duplicate messages).
