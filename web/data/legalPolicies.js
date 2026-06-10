export const legalPolicies = {
  terms: {
    title: 'AuraDime Marketplace Terms of Service',
    description:
      'The rules for using AuraDime as a customer, vendor, or logistics partner.',
    updated: 'June 5, 2026',
    jurisdiction: 'Cameroon',
    sections: [
      {
        heading: '1. Introduction',
        body: [
          'Welcome to AuraDime, also written as Auradime. AuraDime is an online marketplace that connects customers, vendors, and logistics partners for commerce across Cameroon and other supported markets.',
          'By accessing our website, mobile app, web app, APIs, or related services, you agree to these Terms of Service. If you do not agree, do not use AuraDime.',
        ],
      },
      {
        heading: '2. Eligibility',
        body: [
          'You must be at least 18 years old and legally able to enter a contract under the laws that apply to you.',
          'Vendors and logistics partners must complete any verification or KYC checks required by AuraDime before receiving full access to selling, fulfillment, or payout features.',
        ],
      },
      {
        heading: '3. AuraDime role as a marketplace',
        body: [
          'AuraDime provides the technology platform. We do not manufacture, own, store, or directly sell third-party products listed by vendors unless a listing clearly says otherwise.',
          'For vendor products, the sale is between the customer and the vendor. Delivery services are provided by the selected logistics partner or by the vendor when vendor-managed shipping is used.',
        ],
      },
      {
        heading: '4. User accounts and sessions',
        body: [
          'AuraDime uses email OTP verification instead of passwords. A verified user receives a long-lived session token so the account remains signed in unless the account is deleted, the token is invalidated, or security action is required.',
          'You must provide accurate name, email, phone, role, address, store, delivery, and verification information when requested. You are responsible for activity on your account.',
          'The main exit flow is permanent account deletion. Account deletion is irreversible and is explained in the Account Deletion Policy.',
        ],
      },
      {
        heading: '5. Customer terms',
        list: [
          'Customers may browse, order, pay for products, use wallet features, chat with vendors, and raise disputes where available.',
          'Customers must provide correct delivery details, including city, zone or quartier, phone number, and a useful landmark or address description.',
          'Paid orders may be cancelled within 30 minutes of placement if fulfillment has not started. Unpaid orders may be cancelled, failed, or expired when payment is not completed.',
          'Customers must not make fake orders, abusive disputes, false reviews, or attempt to bypass AuraDime payment flows.',
        ],
      },
      {
        heading: '6. Vendor terms',
        list: [
          'Vendors must complete verification when requested, keep store information accurate, and list only lawful products.',
          'Vendors are responsible for product quality, stock, prices, images, descriptions, variants, pickup details, warranty promises, and fulfillment timelines.',
          'Products may require admin approval before public sale. AuraDime may edit, hide, suspend, reject, or remove listings that break policy or create safety risk.',
          'Commission, service fees, and payout rules are shown in the dashboard, wallet, or admin configuration. Promotional or configured 0 percent commission may apply unless changed by AuraDime.',
        ],
      },
      {
        heading: '7. Logistics partner terms',
        list: [
          'Logistics partners must provide accurate business, rider, driver, address, and service zone information.',
          'They must update shipment status honestly, including picked up, in transit, delivered, failed, or returned where applicable.',
          'Failed deliveries must be reported with clear reasons. Delivery reliability may affect visibility, access, or future allocation.',
        ],
      },
      {
        heading: '8. Payments, wallet, escrow, and withdrawals',
        body: [
          'Supported payment methods may include AuraDime wallet, Eversend where available, pay on delivery where enabled, and other gateways added later.',
          'Funds may be held in escrow until delivery is confirmed, the configured review period passes without a dispute, or an admin resolves the order. If the product is not marked delivered, funds may remain in escrow.',
          'Approved refunds usually return to the customer AuraDime wallet unless the law, gateway rules, or an admin decision requires another method.',
          'Vendors and logistics partners may request withdrawals to supported mobile wallet or bank destinations. Current withdrawal fees and limits are displayed in the wallet before submission and may change for fraud, compliance, gateway, or operational reasons.',
        ],
      },
      {
        heading: '9. Prohibited conduct',
        list: [
          'Listing or buying illegal, stolen, counterfeit, unsafe, restricted, or infringing items.',
          'Bypassing AuraDime payments, escrow, fees, verification, or security systems.',
          'Creating fake accounts, fake orders, fake disputes, fake ratings, or fake reviews.',
          'Harassing users, publishing abusive content, scraping data, attacking APIs, or misusing platform features.',
        ],
      },
      {
        heading: '10. Disputes and admin decisions',
        body: [
          'Customers, vendors, and logistics partners should first provide clear evidence and attempt a good-faith resolution.',
          'AuraDime admins may review chat records, order data, shipment activity, payment status, delivery evidence, photos, videos, and account history. Admin decisions may include refund, release, partial release, account restriction, listing suspension, or other corrective action.',
          'Admin decisions are final for platform operations, but a user may appeal with new evidence through support.',
        ],
      },
      {
        heading: '11. Suspension and termination',
        body: [
          'AuraDime may restrict, suspend, or delete accounts that create fraud risk, safety risk, legal risk, or repeated policy violations. Pending balances may be held until refunds, disputes, chargebacks, and legal obligations are resolved.',
        ],
      },
      {
        heading: '12. Liability',
        body: [
          'To the maximum extent permitted by Cameroonian law, AuraDime is not liable for indirect, incidental, special, or consequential losses. Where liability cannot be excluded, our total liability is limited to the amount paid by you through AuraDime in the 6 months before the event giving rise to the claim.',
        ],
      },
      {
        heading: '13. Governing law',
        body: [
          'These terms are governed by the laws of Cameroon. Disputes should first be raised through AuraDime support. If not resolved internally, the parties should attempt mediation in Douala, Cameroon before court action, unless urgent legal relief is required.',
        ],
      },
      {
        heading: '14. Changes',
        body: [
          'We may update these terms as the marketplace grows. Material changes may be announced by app notice, web notice, email, or another reasonable method.',
        ],
      },
    ],
  },
  privacy: {
    title: 'AuraDime Privacy Policy',
    description:
      'How AuraDime collects, uses, shares, protects, and retains user data.',
    updated: 'June 5, 2026',
    jurisdiction: 'Cameroon',
    sections: [
      {
        heading: '1. Data we collect',
        rows: [
          ['Identity', 'Name, email, phone number, role, profile photo, account status, and verification state.'],
          ['Address', 'Delivery address, city, zone or quartier, pickup address, store address, and landmarks.'],
          ['Transactions', 'Orders, cart records, wallet transactions, escrow activity, refunds, deposits, withdrawals, and payment references.'],
          ['Verification', 'Vendor and logistics KYC data such as ID, business documents, proof of store or delivery operation, and admin review notes.'],
          ['Communications', 'Chats, status replies, support tickets, dispute messages, notifications, and email delivery records.'],
          ['Technical', 'IP address, device information, browser or app data, push tokens, cookies, local storage, Capacitor Preferences data, and security logs.'],
          ['Usage', 'Pages visited, products viewed, store visits, search activity, clicks, session events, and app performance data.'],
        ],
      },
      {
        heading: '2. How we use data',
        list: [
          'Provide account access through email OTP authentication.',
          'Process orders, checkout, delivery, wallet, escrow, refunds, and withdrawals.',
          'Verify vendors and logistics partners.',
          'Send order, payment, chat, status, shipment, dispute, and support notifications.',
          'Prevent fraud, abuse, unauthorized access, and policy violations.',
          'Improve performance, reliability, design, search, recommendations, and customer support.',
        ],
      },
      {
        heading: '3. Data sharing',
        body: [
          'We share personal data only when needed to provide AuraDime, comply with law, prevent fraud, or protect users.',
        ],
        list: [
          'Vendors receive customer and order details required to fulfill purchases.',
          'Customers can see vendor store names, product details, ratings, public reviews, and support information needed for orders.',
          'Logistics partners receive pickup and delivery details, customer phone number, and order information needed to complete delivery.',
          'Service providers may process data for hosting, database, storage, email, payments, caching, analytics, security, and notifications. These may include AWS, MongoDB, Redis or Upstash, Titan email, Eversend, and similar providers.',
          'We may disclose data if required by Cameroonian law, a court order, regulator request, or lawful investigation.',
        ],
      },
      {
        heading: '4. Storage and security',
        body: [
          'AuraDime uses TLS for network transfer, access controls for internal systems, and security monitoring for suspicious behavior. Media may be stored in AWS S3, application services may run on AWS infrastructure, and records may be stored in MongoDB and connected service providers.',
          'No system is perfectly secure. You should protect your device, email account, and OTP codes. Never share OTP codes with anyone.',
        ],
      },
      {
        heading: '5. Retention',
        list: [
          'Customer account data may be retained for up to 7 years after last activity where required for tax, accounting, fraud, or legal purposes.',
          'Vendor and logistics records may be retained for up to 10 years where required for business, tax, compliance, payout, or dispute records.',
          'KYC documents may be retained for up to 5 years after account closure unless a longer legal hold applies.',
          'Chat and support records may be retained for up to 2 years, or longer where needed for disputes, safety, fraud, or legal obligations.',
        ],
      },
      {
        heading: '6. Your rights',
        body: [
          'Subject to applicable law, you may request access, correction, deletion, objection to processing, or withdrawal of consent where consent is the basis for processing. Some deletion requests may be delayed or limited by legal, tax, fraud, dispute, or payment obligations.',
          'To exercise privacy rights, contact support@auradime.com. We aim to respond within 30 days.',
        ],
      },
      {
        heading: '7. Children',
        body: [
          'AuraDime is not intended for children under 16. We do not knowingly collect personal data from children.',
        ],
      },
      {
        heading: '8. International transfers',
        body: [
          'Your data may be processed outside Cameroon by our hosting, storage, payment, email, notification, and infrastructure providers. By using AuraDime, you consent to this processing where permitted by law.',
        ],
      },
    ],
  },
  cookies: {
    title: 'AuraDime Cookie Policy',
    description:
      'How AuraDime uses cookies, local storage, and app storage for login, cart, security, and preferences.',
    updated: 'June 5, 2026',
    jurisdiction: 'Cameroon',
    sections: [
      {
        heading: '1. What cookies are',
        body: [
          'Cookies are small files stored by your browser. AuraDime may also use local storage, session storage, secure cookies, and Capacitor Preferences or native app storage to keep the web app and Android app working.',
        ],
      },
      {
        heading: '2. Storage we use',
        rows: [
          ['Strictly necessary', 'Authentication, OTP session state, cart, checkout, wallet security, API requests, and fraud protection.'],
          ['Functional', 'Language, theme, saved addresses, selected zone, selected role, and browsing preferences.'],
          ['Analytics and performance', 'Page visits, app speed, errors, product views, and engagement events used to improve AuraDime.'],
          ['Offline app data', 'Temporary cached products, stores, chats, statuses, and navigation data so the app remains usable when network is unstable.'],
          ['Push notifications', 'Push subscription or token data used to deliver message, order, logistics, and marketplace notifications.'],
        ],
      },
      {
        heading: '3. Your choices',
        body: [
          'You can block or delete browser cookies in your browser settings. Blocking essential storage may break login, cart, checkout, wallet, and offline app behavior.',
          'On mobile, you can control push notifications from your device settings. Essential app storage is required for login, security, and reliable app use.',
        ],
      },
      {
        heading: '4. Changes',
        body: [
          'We may update this Cookie Policy when we add new storage, analytics, security, or notification features.',
        ],
      },
    ],
  },
  refundPolicy: {
    title: 'AuraDime Refund and Cancellation Policy',
    description:
      'How paid orders, unpaid orders, escrow releases, failed payments, and refunds are handled.',
    updated: 'June 5, 2026',
    jurisdiction: 'Cameroon',
    sections: [
      {
        heading: '1. Paid order cancellation',
        body: [
          'A customer may cancel a paid order within 30 minutes of placing it if fulfillment has not started. Fulfillment includes vendor approval, packing, pickup, shipment, or delivery activity.',
          'If cancellation is approved, the refund is normally credited to the customer AuraDime wallet unless a different method is required by law, gateway rule, or admin decision.',
        ],
      },
      {
        heading: '2. Unpaid and failed orders',
        body: [
          'Orders that are not paid, payment attempts that fail, or gateway collection requests that are stopped may be marked unpaid, failed, expired, or cancelled. Unpaid orders do not create a right to product fulfillment.',
        ],
      },
      {
        heading: '3. Refund eligibility',
        list: [
          'Payment was completed but the vendor cannot fulfill the order.',
          'The wrong item was delivered and the dispute evidence supports the customer.',
          'The item was damaged, materially different, or not delivered, based on evidence and admin review.',
          'A paid order is cancelled inside the allowed cancellation window before fulfillment starts.',
        ],
      },
      {
        heading: '4. Non-refundable situations',
        list: [
          'Customer provides incorrect delivery information and the order cannot be completed after reasonable attempts.',
          'Customer confirms delivery or releases escrow, then raises an unsupported claim without new evidence.',
          'Product damage is caused after delivery.',
          'The item is excluded from refund by law, hygiene, custom-order rules, or clear product listing terms, unless required by law.',
        ],
      },
      {
        heading: '5. Processing',
        body: [
          'Refund timing depends on wallet, gateway, banking, admin review, and dispute requirements. Wallet refunds may appear faster than external gateway reversals.',
        ],
      },
    ],
  },
  vendorPolicy: {
    title: 'AuraDime Vendor Policy',
    description:
      'Rules for stores, listings, pricing, fulfillment, KYC, payouts, and vendor conduct.',
    updated: 'June 5, 2026',
    jurisdiction: 'Cameroon',
    sections: [
      {
        heading: '1. Vendor verification',
        body: [
          'Vendors may be required to submit identity, business, store, payment, address, logo, banner, and pickup information before full selling access is enabled.',
          'AuraDime may request additional verification at any time. Accounts with required verification pending may be limited until approved.',
        ],
      },
      {
        heading: '2. Listings and pricing',
        list: [
          'Listings must include accurate title, description, category, price, stock, images, variants, delivery expectations, and product condition.',
          'Vendors must not list prohibited, counterfeit, unsafe, illegal, or misleading products.',
          'Prices shown to customers must be honored unless a clear platform error or admin correction applies.',
          'Admin may approve, edit, suspend, hide, or reject products where needed for safety, compliance, or marketplace quality.',
        ],
      },
      {
        heading: '3. Fulfillment',
        body: [
          'Vendors must process orders promptly and update shipment activity accurately. If the vendor manages delivery, the vendor is responsible for delivery status, proof, and customer coordination.',
        ],
      },
      {
        heading: '4. Wallet and payouts',
        body: [
          'Vendor funds may pass through escrow. Available balances can be withdrawn to supported mobile wallet or bank destinations subject to fees, limits, fraud checks, provider availability, and unresolved disputes.',
        ],
      },
      {
        heading: '5. Store standards',
        list: [
          'Use truthful branding, store logos, banners, and business names.',
          'Respond to customers respectfully.',
          'Do not inflate reviews, create fake orders, or pressure customers to bypass AuraDime.',
          'Keep pickup address descriptions and store information complete and current.',
        ],
      },
    ],
  },
  logisticsPolicy: {
    title: 'AuraDime Logistics Partner Policy',
    description:
      'Rules for delivery partners, service zones, shipment updates, proof of delivery, and payouts.',
    updated: 'June 5, 2026',
    jurisdiction: 'Cameroon',
    sections: [
      {
        heading: '1. Verification and service zones',
        body: [
          'Logistics partners must provide accurate business, rider, vehicle, contact, and operating zone details. AuraDime may restrict delivery visibility to zones the partner can serve.',
        ],
      },
      {
        heading: '2. Shipment handling',
        list: [
          'Accept only jobs that can be fulfilled within the stated area and timing.',
          'Update shipment status accurately, including picked up, in transit, delivered, failed, returned, or cancelled where applicable.',
          'Protect products from avoidable loss, damage, weather, theft, and mishandling.',
          'Collect or share proof of delivery when required.',
        ],
      },
      {
        heading: '3. Failed delivery',
        body: [
          'If delivery fails, the logistics partner must provide the reason and return the item to the vendor when required. Delivery fees may be reversed, withheld, or adjusted based on fault and evidence.',
        ],
      },
      {
        heading: '4. Payouts and conduct',
        body: [
          'Logistics earnings may be paid through supported wallet, bank, or mobile money methods. Fraud, fake status updates, harassment, or bypassing AuraDime may lead to suspension and withheld payouts while disputes are reviewed.',
        ],
      },
    ],
  },
  prohibitedItems: {
    title: 'AuraDime Prohibited Items Policy',
    description:
      'Products and services that cannot be listed, bought, or promoted on AuraDime.',
    updated: 'June 5, 2026',
    jurisdiction: 'Cameroon',
    sections: [
      {
        heading: '1. Prohibited products',
        list: [
          'Illegal goods or services under Cameroonian law or applicable international law.',
          'Counterfeit products, stolen goods, replicas presented as genuine, or products that infringe intellectual property rights.',
          'Weapons, ammunition, explosives, dangerous chemicals, and items designed to cause harm.',
          'Illegal drugs, controlled substances, prescription medicines sold without authorization, or unsafe health products.',
          'Adult sexual services, exploitative content, human trafficking, or content involving minors.',
          'Fraud tools, hacking tools, stolen credentials, fake documents, or financial crime services.',
          'Wildlife, endangered species products, or items restricted by environmental law.',
          'Any product AuraDime reasonably believes creates legal, safety, fraud, or reputational risk.',
        ],
      },
      {
        heading: '2. Restricted products',
        body: [
          'Some products may require additional approval, licenses, age checks, clear labeling, or shipping controls. AuraDime may request documents before allowing these listings.',
        ],
      },
      {
        heading: '3. Enforcement',
        body: [
          'AuraDime may remove listings, suspend products, hold payouts, cancel orders, report unlawful activity, or delete accounts involved in prohibited items.',
        ],
      },
    ],
  },
  disputePolicy: {
    title: 'AuraDime Dispute and Escrow Policy',
    description:
      'How AuraDime reviews order disputes, delivery issues, evidence, refunds, and escrow releases.',
    updated: 'June 5, 2026',
    jurisdiction: 'Cameroon',
    sections: [
      {
        heading: '1. When disputes can be raised',
        list: [
          'Product not delivered.',
          'Wrong item delivered.',
          'Item damaged before delivery or materially different from the listing.',
          'Payment or wallet issue.',
          'Delivery status, pickup, return, or logistics evidence issue.',
          'Vendor, logistics, or customer conduct issue connected to an order.',
        ],
      },
      {
        heading: '2. Escrow',
        body: [
          'AuraDime may hold paid order funds in escrow. Funds may be released when the customer confirms delivery, the order is marked delivered and the configured review period passes without dispute, or an admin resolves the case.',
          'If an order is not marked delivered, funds may remain in escrow until delivery, refund, cancellation, or admin decision.',
        ],
      },
      {
        heading: '3. Evidence',
        body: [
          'Users should provide photos, videos, chat records, receipt screenshots, delivery notes, tracking details, product condition evidence, and any other relevant information. False evidence may lead to account restriction.',
        ],
      },
      {
        heading: '4. Admin outcomes',
        list: [
          'Release escrow to the vendor.',
          'Refund the customer to wallet or another approved method.',
          'Partially release and partially refund.',
          'Request more evidence or verification.',
          'Suspend a listing, vendor, logistics partner, or user account.',
        ],
      },
      {
        heading: '5. Appeals',
        body: [
          'A party may appeal with new evidence by contacting support@auradime.com. Repeating the same evidence may not reopen a closed dispute.',
        ],
      },
    ],
  },
  accountDeletion: {
    title: 'AuraDime Account Deletion Policy',
    description:
      'What happens when a user permanently deletes an AuraDime account.',
    updated: 'June 5, 2026',
    jurisdiction: 'Cameroon',
    sections: [
      {
        heading: '1. Permanent deletion',
        body: [
          'AuraDime does not use a normal sign-out flow as the primary account exit. Users may leave by permanently deleting the account from the account or settings area.',
          'To confirm deletion, the user may be required to type DELETE. This action is intended to be irreversible.',
        ],
      },
      {
        heading: '2. What is deleted or disabled',
        list: [
          'Active session tokens are invalidated across devices.',
          'Login access is removed.',
          'Personal profile visibility is removed where possible.',
          'Wallet access is disabled after required financial handling.',
          'Vendor, logistics, or customer features are disabled.',
        ],
      },
      {
        heading: '3. What may be retained',
        body: [
          'Some records may be retained where required for tax, accounting, fraud prevention, legal claims, payment reconciliation, refunds, disputes, chargebacks, public safety, or regulatory obligations. This can include orders, invoices, payout records, dispute records, transaction references, and admin logs.',
        ],
      },
      {
        heading: '4. Wallet and pending orders',
        body: [
          'Users should withdraw eligible balances and resolve open orders, refunds, withdrawals, and disputes before deleting an account. AuraDime may hold or process remaining balances according to law, gateway rules, and dispute requirements.',
        ],
      },
      {
        heading: '5. Reviews and public content',
        body: [
          'Public reviews, ratings, dispute evidence, order references, or safety records may be anonymized or shown as deleted user where required to preserve marketplace integrity.',
        ],
      },
    ],
  },
};

export const legalPolicyLinks = [
  { name: 'Terms', href: '/terms', key: 'terms' },
  { name: 'Privacy', href: '/privacy', key: 'privacy' },
  { name: 'Cookies', href: '/cookies', key: 'cookies' },
  { name: 'Refunds', href: '/refund-policy', key: 'refundPolicy' },
  { name: 'Vendors', href: '/vendor-policy', key: 'vendorPolicy' },
  { name: 'Logistics', href: '/logistics-policy', key: 'logisticsPolicy' },
  { name: 'Prohibited Items', href: '/prohibited-items', key: 'prohibitedItems' },
  { name: 'Disputes', href: '/dispute-policy', key: 'disputePolicy' },
  { name: 'Account Deletion', href: '/account-deletion', key: 'accountDeletion' },
];

export const legalContact = {
  email: 'support@auradime.com',
  location: 'Douala, Cameroon',
};
