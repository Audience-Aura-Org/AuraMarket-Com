# Mobile Video Upload to Status Flow Analysis

## Root Cause Summary

The mobile video upload to status creation fails due to **subscription validation middleware rejection (HTTP 402)** combined with **vendor lookup failures**. The error occurs BEFORE the status creation endpoint logic runs, making it difficult to debug. There are 3 primary issues:

---

## Issues Identified

### Issue 1: Subscription Middleware Rejects Before Vendor Lookup (CRITICAL)
**Location**: [backend/routes/status.routes.js](backend/routes/status.routes.js#L8-L10)

```javascript
router.use(protect); // Verify JWT
router.use(requireActiveSubscription()); // ← Runs BEFORE createStatus handler
router.route('/').post(createStatus);
```

**Problem**: 
- The `requireActiveSubscription()` middleware executes for ALL POST requests to `/statuses`
- On mobile, if the subscription lookup fails OR the user has no active subscription, it returns **HTTP 402 Subscription Required**
- This happens BEFORE the `createStatus` handler runs, so vendor lookup never occurs
- The error message is buried in the response but StatusCreator.js may not properly extract it

**Evidence from subscription.service.js**:
```javascript
const getSubscriptionStatus = async (user, role = null) => {
  // ... if no active subscription, creates a 'limited' or 'grace' record
  // For vendor role, grace_days defaults to 7, but if subscription is genuinely missing:
  const required = Boolean(requirements.required?.[activeRole]); // Vendor = true
  if (!subscription) {
    return { required: true, active: false, ... }; // ← Returns 402
  }
};
```

---

### Issue 2: Vendor Lookup Uses Ambiguous User ID Field
**Location**: [backend/controllers/status.controller.js](backend/controllers/status.controller.js#L59)

```javascript
const vendor = await Vendor.findOne({ user_id: req.user._id || req.user.id });
if (!vendor) {
  return res.status(403).json({ success: false, message: 'Only vendors can post statuses' });
}
```

**Problem**:
- Assumes `req.user` has EITHER `_id` (MongoDB) OR `id` (some other ID format)
- On mobile with certain token formats, `req.user` may have neither properly set
- The auth middleware sets `req.user` from JWT decoded token's `id` field, but Mongoose may require `_id`
- Results in vendor lookup always failing → 403 response

**From auth.middleware.js**:
```javascript
const decoded = jwt.verify(token, JWT_SECRET);
const user = await User.findById(decoded.id); // Finds by ID correctly
req.user = user; // Should have _id from MongoDB
```

---

### Issue 3: Error Message Not Properly Surfaced to Mobile Client
**Location**: [web/components/status/StatusCreator.js](web/components/status/StatusCreator.js#L699)

```javascript
const publishStatus = async (payload) => {
  const res = await api.post('/statuses', payload);
  if (res.data.success) {
    createdStatuses.push(res.data.data);
  }
  // No error handling here! If POST fails, exception bubbles up
};
```

**Problem**:
- If the POST returns 402 or 403, no error is caught in `publishStatus`
- Exception bubbles to outer catch block which tries to extract message from `err.response?.data`
- Mobile network layer may not properly transmit headers/response bodies in Capacitor
- Generic "Failed to post story" message shown instead of actual error

**Current error extraction** (line 700):
```javascript
const msg = 
  err.response?.data?.message ||
  err.response?.data?.error ||
  err.message ||
  'Failed to post story';
```

This SHOULD work, but on mobile the response object might be malformed.

---

## Flow Diagram: Why Mobile Fails

```
Mobile Client
    ↓
[StatusCreator.js] handlePost() 
    ↓
api.post('/statuses', { content_url, type, category, ... })
    ↓
[Backend auth.middleware.js] protect()
    ✓ Token verified, req.user set
    ↓
[Backend subscription.middleware.js] requireActiveSubscription()
    ✗ FAILS on Mobile: No active subscription found OR lookup throws
    ↓ Returns HTTP 402 Subscription Required
Capacitor Response Handler
    ↓
Error caught in StatusCreator.js catch block
    ↓
Generic "Failed to post story" shown to user
```

---

## Specific Mobile vs Desktop Differences

| Aspect | Desktop | Mobile | Issue |
|--------|---------|--------|-------|
| **Request Path** | Direct to backend via Next.js proxy | Direct to backend (native API URL) | ✓ Same |
| **Auth Header** | Bearer token in Authorization header | Bearer token in Authorization header | ✓ Same (set by api.js interceptor) |
| **Request Body** | JSON stringified | JSON stringified | ✓ Same |
| **Subscription Lookup** | Works (user has active subscription) | Fails OR not triggered | ✗ **ISSUE** |
| **Error Response** | Fully parsed by Axios | May be truncated by Capacitor | ✗ **Potential ISSUE** |
| **Vendor Model** | User._id matches Vendor.user_id | Possible mismatch in ID format | ✗ **Potential ISSUE** |

---

## Recommended Fixes

### Fix 1: Create Status Route Without Subscription Middleware (HIGHEST PRIORITY)
**Status**: ✅ **IMPLEMENTED**

Move subscription validation to INSIDE the createStatus handler for better error messages:

**Changes**:
1. Updated [backend/routes/status.routes.js](backend/routes/status.routes.js) - Removed `requireActiveSubscription()` from createStatus POST route
2. Updated [backend/controllers/status.controller.js](backend/controllers/status.controller.js#L57-L82) - Added subscription validation with detailed error response

**Before**:
```javascript
// routes
router.use(protect);
router.use(requireActiveSubscription()); // ← Generic 402
router.route('/').post(createStatus);

// controller
const vendor = await Vendor.findOne({ user_id: req.user._id || req.user.id });
if (!vendor) {
  return res.status(403).json({ success: false, message: 'Only vendors can post statuses' });
}
```

**After**:
```javascript
// routes - subscription check now only on delete/react
router.use(protect);
router.route('/').post(createStatus);
router.use(requireActiveSubscription());
router.route('/:id').delete(deleteStatus);
router.post('/:id/react', reactToStatus);

// controller - explicit subscription check with detailed response
const subscriptionStatus = await getSubscriptionStatus(req.user, 'vendor');
if (!subscriptionStatus.active) {
  console.warn('[STATUS_CREATE] Subscription check failed', { /* context */ });
  return res.status(402).json({
    success: false,
    code: 'SUBSCRIPTION_REQUIRED',
    message: 'Vendors must have an active subscription to create statuses.',
    subscription: subscriptionStatus, // ← Full context now included
  });
}
```

---

### Fix 2: Ensure Vendor Lookup Uses Single User ID Format
**Status**: ✅ **IMPLEMENTED**

Standardized all vendor lookups to use only `_id` (MongoDB format):

**Changes**: Updated [backend/controllers/status.controller.js](backend/controllers/status.controller.js) - All vendor queries now use `req.user._id` only
- Line 79: `createStatus`
- Line 324: `getMyStatuses`
- Line 344: `deleteStatus`

**Before**:
```javascript
const vendor = await Vendor.findOne({ user_id: req.user._id || req.user.id });
```

**After**:
```javascript
const vendor = await Vendor.findOne({ user_id: req.user._id });
```

**Rationale**: Since `req.user` is always from MongoDB via `User.findById()`, it will ALWAYS have `_id`. The fallback removes ambiguity and makes debugging easier.

---

### Fix 3: Add Explicit Error Logging for Mobile Debugging
**Status**: ✅ **IMPLEMENTED**

Added comprehensive error context to help diagnose mobile-specific failures:

**Backend Changes** ([backend/controllers/status.controller.js](backend/controllers/status.controller.js#L57-L117)):
```javascript
try {
  const subscriptionStatus = await getSubscriptionStatus(req.user, 'vendor');
  if (!subscriptionStatus.active) {
    console.warn('[STATUS_CREATE] Subscription check failed', {
      userId: req.user._id,
      role: 'vendor',
      subscriptionState: subscriptionStatus.access_state,
    });
    return res.status(402).json({ /* detailed subscription context */ });
  }
  
  // ... vendor creation ...
  
} catch (error) {
  console.error('[STATUS_CREATE_ERROR]', {
    userId: req.user?._id,
    endpoint: 'POST /api/statuses',
    errorMessage: error.message,
    errorCode: error.code,
    timestamp: new Date().toISOString(),
  });
  
  res.status(500).json({
    success: false,
    message: error.message,
    code: 'INTERNAL_ERROR',
    timestamp: new Date().toISOString(),
  });
}
```

**Frontend Changes** ([web/components/status/StatusCreator.js](web/components/status/StatusCreator.js#L592-L615)):
```javascript
const publishStatus = async (payload) => {
  try {
    const res = await api.post('/statuses', payload);
    if (!res.data.success) {
      console.error('[STATUS_PUBLISH_ERROR] API returned failure', {
        status: res.status,
        code: res.data?.code,
        message: res.data?.message,
        fullResponse: res.data,
      });
      throw new Error(res.data.message || 'Status creation failed');
    }
    createdStatuses.push(res.data.data);
  } catch (err) {
    console.error('[STATUS_PUBLISH_ERROR] Request failed', {
      status: err.response?.status,
      code: err.response?.data?.code,
      message: err.response?.data?.message || err.message,
      errorType: err.response?.status === 402 ? 'SUBSCRIPTION_REQUIRED' : 
                err.response?.status === 403 ? 'VENDOR_NOT_FOUND' : 
                'UNKNOWN',
      fullResponse: err.response?.data,
      requestPayload: { type: payload.type, hasContent: !!payload.content_url },
    });
    throw err;
  }
};
```

---

## Recommended Fixes

### Fix 1: Create Status Route Without Subscription Middleware (HIGHEST PRIORITY)
Move subscription validation to INSIDE the createStatus handler for better error messages:

**Before**:
```javascript
router.use(protect);
router.use(requireActiveSubscription()); // ← Generic 402
router.route('/').post(createStatus);
```

**After**:
```javascript
router.use(protect);
router.route('/').post(createStatus); // Handle subscription inline
```

**In createStatus**:
```javascript
exports.createStatus = async (req, res) => {
  try {
    // 1. Check subscription EXPLICITLY with detailed error message
    const subStatus = await getSubscriptionStatus(req.user, 'vendor');
    if (!subStatus.active) {
      return res.status(402).json({
        success: false,
        code: 'SUBSCRIPTION_REQUIRED',
        message: 'Vendors must have an active subscription to create statuses.',
        subscription: subStatus,
      });
    }

    // 2. Look up vendor
    const vendor = await Vendor.findOne({ user_id: req.user._id });
    if (!vendor) {
      return res.status(403).json({ 
        success: false, 
        message: 'Vendor profile not found. Complete vendor onboarding first.' 
      });
    }

    // ... rest of createStatus
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
```

---

### Fix 2: Ensure Vendor Lookup Uses Single User ID Format
Standardize to use only `_id` (MongoDB format):

```javascript
// Before
const vendor = await Vendor.findOne({ user_id: req.user._id || req.user.id });

// After
const vendor = await Vendor.findOne({ user_id: req.user._id });
```

Since `req.user` is always populated from MongoDB via `User.findById()`, it will ALWAYS have `_id`. The fallback `req.user.id` is unnecessary and confuses debugging.

---

### Fix 3: Add Explicit Error Logging for Mobile Debugging
Add error context to the response and frontend console:

**Backend** (in createStatus):
```javascript
} catch (error) {
  console.error('[STATUS_CREATE]', {
    userId: req.user?._id,
    endpoint: 'POST /api/statuses',
    errorMessage: error.message,
    errorStack: error.stack,
  });
  
  res.status(500).json({ 
    success: false, 
    message: error.message,
    code: 'INTERNAL_ERROR',
    timestamp: new Date().toISOString()
  });
}
```

**Frontend** (in StatusCreator.js handlePost):
```javascript
const publishStatus = async (payload) => {
  try {
    const res = await api.post('/statuses', payload);
    if (!res.data.success) {
      throw new Error(res.data.message || 'Status creation failed');
    }
    createdStatuses.push(res.data.data);
  } catch (err) {
    console.error('[STATUS_PUBLISH_ERROR]', {
      status: err.response?.status,
      message: err.response?.data?.message || err.message,
      code: err.response?.data?.code,
      fullResponse: err.response?.data
    });
    throw err;
  }
};
```

---

## Testing Strategy

1. **Mobile**: Create status → watch browser console for full error (Fix 3)
2. **Verify subscription**: Check user record in database for active `UserSubscription`
3. **Check vendor**: Confirm `Vendor` record exists with matching `user_id`
4. **Apply fixes** in order: Fix 1 → Fix 2 → Fix 3
5. **Retry**: Post status again and verify success

---

## Quick Verification Commands

```bash
# Check if user has active subscription
db.users.findOne({ _id: ObjectId("user_id") })
db.usersubscriptions.findOne({ user_id: ObjectId("user_id"), role: "vendor", status: "active" })

# Check if vendor exists
db.vendors.findOne({ user_id: ObjectId("user_id") })
```
