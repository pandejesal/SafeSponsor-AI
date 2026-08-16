# SafeSponsor AI — Security Architecture & Hardening Specification

## Overview

SafeSponsor AI is an enterprise-grade AI brand safety and creator sponsorship intelligence platform. This document outlines the security architecture, threat model mitigations, authentication mechanisms, billing integrity controls, and secrets management implemented across the application.

---

## 1. Zero-Trust Access Control & Defense in Depth

The application enforces a zero-trust model where every client request is authenticated, authorized, and verified for authenticity before processing.

```
+------------------+         +--------------------------+         +-------------------------------+
|  Client Browser  | ------> | Next.js Edge API Route   | ------> | Firebase Admin SDK / Firestore |
|  (Auth + AppCheck)|        | (AppCheck & Bearer Verification)   | (Atomic Tx & Server-Only Writes)|
+------------------+         +--------------------------+         +-------------------------------+
```

### Key Controls
1. **Firebase Authentication**: Client requests carry a short-lived Firebase ID Token in the `Authorization: Bearer <token>` header. Edge routes verify token signature and claims via `adminAuth.verifyIdToken()`.
2. **Firebase App Check Integration**: Configured in `lib/firebase-admin.ts` to verify `X-Firebase-AppCheck` headers (opt-in enforcement — when `ENFORCE_APP_CHECK=true`, requests without a valid token are rejected; a present-but-invalid token is always rejected regardless of the flag), providing automated bot protection alongside mandatory Firebase Bearer ID Token authentication.
3. **No Client Write Privileges on Entitlements**: Client Firestore security rules strictly forbid write access to sensitive entitlement fields (`hasSubscription`, `freeAnalysisUsed`, `reportCredits`, `plan`, `paymentProvider`, `lastPaymentId`, `role`, `admin`, `credits`). All entitlement mutations occur strictly via server-side Admin SDK (`adminDb`).

---

## 2. Firestore Security Rules Architecture

Located in `/firestore.rules`, the database security schema follows the principle of least privilege with default-deny policies.

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    // Default Deny
    match /{document=**} {
      allow read, write: if false;
    }

    match /users/{userId} {
      allow read: if isOwner(userId);
      // Client writes are restricted to non-sensitive profile fields
      allow create, update: if isOwner(userId) && isNotTouchingSensitiveFields();
      allow delete: if false;

      match /history/{historyId} {
        allow read: if isOwner(userId);
        allow write: if false;
      }
    }

    match /global_audits/{auditId} {
      allow read: if isSignedIn();
      allow write: if false;
    }
  }
}
```

---

## 3. Payment System Architecture & Webhook Verification

Payment processing is handled via **Dodo Payments** with standard webhook verification to prevent payment forgery and replay attacks.

### Checkout Flow (`/api/checkout`)
1. Verifies Firebase App Check & Auth headers.
2. Creates a Dodo Payments link via authenticated API call.
3. **Zero Fail-Open Logic**: If payment creation fails or keys are missing, the route returns an explicit error (`502 Bad Gateway` / `500 Configuration Error`). Upgrades are **never** granted speculatively.

### Webhook Verification Flow (`/api/webhook`)
1. Reads raw binary payload body before parsing.
2. Verifies cryptographic signature using `standardwebhooks` (`Webhook.verify()`).
3. Rejects invalid or unverified webhooks with `401 Unauthorized`.
4. Updates user entitlements via atomic Admin SDK operations upon verified `payment.succeeded` or `subscription.active` events.

---

## 4. Anti-Abuse & Quota Reservation System

To eliminate Time-of-Check to Time-of-Use (TOCTOU) race conditions and double-spending of free analysis quotas or purchased credits:

1. **Atomic Transactions**: Quota checks and credit deductions in `/api/analyze` are executed inside a Firestore transaction (`adminDb.runTransaction`).
2. **Pre-Execution Deduction**: Quota is claimed **before** invoking long-running or expensive Gemini model calls.
3. **Input Bounds Enforcement**:
   - `target`: Max 500 chars.
   - `brand_name`: Max 100 chars.
   - `competitor_brands`: Max 5 items, 100 chars each.
   - `additional_urls`: Max 3 items, 300 chars each.
   - `creator_known_aliases`: Max 5 items, 100 chars each.

---

## 5. Secrets Management & Operational Security

1. **No Hardcoded Credentials**: All API keys, webhook secrets, and private credentials reside exclusively in environment variables (configured via `.env.example`).
2. **Server-Side API Proxies**: All Gemini and Groq API calls are proxied through Next.js server endpoints (`/api/analyze`). API keys are never exposed to browser context.
3. **Multi-Model Fallback Sequence**:
   `gemini-3.6-flash` $\rightarrow$ `gemini-3.5-flash` $\rightarrow$ `gemini-3.1-flash-lite` $\rightarrow$ `gemini-flash-latest` $\rightarrow$ `GROQ_API_KEY` backup.

---

## Summary Checklist

| Security Component | Implementation Status | Enforcement Mechanism |
|---|---|---|
| User Identity Verification | Verified | Firebase Admin SDK ID Token Validation |
| Anti-Bot Protection | Verified | Firebase App Check (Fail-Closed by Default in Production; reCAPTCHA Enterprise) |
| Database Security | Verified | Strict Firestore Rules + Admin SDK Isolation |
| Webhook Authenticity | Verified | `standardwebhooks` Signature Verification |
| Quota Concurrency Protection | Verified | Firestore Atomic Transactions |
| Secrets Protection | Verified | Zero Hardcoded Keys / Server Environment Variables |
