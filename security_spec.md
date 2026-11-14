# Security Specification — AsunciónTech Firestore Rules

## 1. Data Invariants
1. **Identity Integrity**: Every client-created `serviceOrders/{orderId}`, `publicTracking/{trackingCode}`, and `invoices/{invoiceId}` must have `ownerUid == request.auth.uid` and require `request.auth.token.email_verified == true`.
2. **PII Isolation**: `serviceOrders`, `invoices`, `notifications`, and `customers` contain PII (`customerEmail`, `customerPhone`, `customerRuc`). Non-owners and unauthenticated users must NEVER read or list these documents. Only `publicTracking/{trackingCode}` (strictly stripped of all PII) allows single-document `get` by valid `trackingCode`, and forbids `list` by non-admins.
3. **Immutable Ownership & Creation Time**: `orderId`, `trackingCode`, `ownerUid`, and `createdAt` cannot change after creation (`incoming().createdAt == existing().createdAt`).
4. **Temporal Integrity**: `createdAt` on create and `updatedAt` on update must equal `request.time`.
5. **Action-Based Client Updates & Terminal Locking**:
   - Customers can only update `serviceOrders/{orderId}` to mark payment (`paymentStatus: 'pagado'`, `paymentMethod`, `invoiceNumber`, `updatedAt`) when `existing().paymentStatus == 'pendiente'`, and only if `existing().status != 'entregado'` (or while payment is pending).
   - Customers cannot self-approve `status`, `assignedTechnician`, `estimatedCostPyg`, or `estimatedHours` after creation.
   - Only verified Admins (`isAdmin()`) can manage `customers/{customerId}`, assign technicians, advance repair statuses, update estimated hours/cost, or create notifications for customers.
6. **Master Gate on Subcollections**: `/serviceOrders/{orderId}/timeline/{eventId}` checks `get(/databases/$(database)/documents/serviceOrders/$(orderId)).data.ownerUid == request.auth.uid || isAdmin()`.
7. **Strict Key Allowlists**: Every `isValid*` helper uses both `keys().hasAll(...)` and `keys().hasOnly(...)` to block shadow fields (`isAdmin`, `isVerified`, etc.).
8. **Admin RBAC**: Only `request.auth.token.email == 'ovelargonzalezj@gmail.com' && request.auth.token.email_verified == true` or an entry in `/admins/{uid}` is recognized as Admin.

## 2. The "Dirty Dozen" Attack Payloads (All Must Return PERMISSION_DENIED)
1. **Unverified Email Create**: Creating `/serviceOrders/ord_1` with `email_verified: false`.
2. **Identity Spoofing**: Creating `/serviceOrders/ord_2` with `ownerUid: "victim_uid"` while authenticated as `"attacker_uid"`.
3. **Shadow Field Injection**: Creating `/serviceOrders/ord_3` with extra field `isAdmin: true`.
4. **Oversized ID Poisoning**: Creating `/serviceOrders/` with a 200-char ID or invalid characters (`../bad`).
5. **Client Timestamp Forgery**: Creating `/serviceOrders/ord_4` with `createdAt` set to a past client timestamp instead of `request.time`.
6. **Privilege Escalation on Order Update**: Customer updating `status` from `recibido` to `listo` or changing `estimatedCostPyg` from `350000` to `1`.
7. **Blanket List Scraping**: Non-admin user running `list` on `/serviceOrders` without `where('ownerUid', '==', auth.uid)` or running `list` on `/publicTracking` or `/customers`.
8. **Cross-Tenant PII Read**: Authenticated user B attempting `get` on `/serviceOrders/order_of_A` or `/invoices/inv_of_A`.
9. **Timeline Orphan / Spoof**: Attacker creating `/serviceOrders/order_of_A/timeline/ev_1` without owning parent `order_of_A`.
10. **Double-Payment / Terminal Replay**: Customer updating `paymentStatus` again after `existing().paymentStatus == 'pagado'`.
11. **Customer Directory Tampering**: Non-admin attempting to read or write `/customers/cust_1`.
12. **Email Spoofing Admin Bypass**: User with `email: 'ovelargonzalezj@gmail.com'` and `email_verified: false` attempting admin list on `/serviceOrders`.
