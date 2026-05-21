# Security Specification - Documents & Profiles

This specification details the security rules, invariants, and test payloads designed to secure the CCHC & Pháp Chế Document Management Portal.

## 1. Data Invariants
- **Authentication**: All writes (create, update, delete) must be performed by an authenticated user whose email address has been verified under Google Authentication.
- **Ownership**: On creation, `ownerId` must equal `request.auth.uid`. On update, the existing `ownerId` must remain immutable and matches the authenticated user editing it.
- **Immutability**: `id`, `ownerId`, and `createdAt` are immutable after document creation.
- **Schema Conformity**: A document must match the precise layout including field counts, valid field types/bounds, and predefined enums (`loaiVanBan`, `donViBanHanh`, `linhVuc`).
- **Temporal Honesty**: `createdAt` and `updatedAt` must always match `request.time` exactly. Client-supplied timestamps must match.

---

## 2. The "Dirty Dozen" Attack Payloads
The following malicious client requests are designed to exploit potential vulnerabilities:

### Attack 1: User Profile Privilege Escalation (PII Isolation Leak)
An attacker attempts to read details of a profile database they do not own:
- **Operation**: `GET /users/victim-uid`
- **Identity**: UID `attacker-uid`

### Attack 2: Identity Spoofing (Owner Forgery)
An attacker attempts to create a document with someone else's UID as the owner:
- **Operation**: `CREATE /documents/doc-malicious`
- **Payload**:
  ```json
  {
    "id": "doc-malicious",
    "loaiVanBan": "Quyết định",
    "trichYeu": "Malicious payload",
    "ngayBanHanh": "2026-05-21",
    "ngayCoHieuLuc": "2026-06-01",
    "donViBanHanh": "Ủy ban nhân dân tỉnh",
    "donViThamMuu": "Sở Nội vụ",
    "soVanBanTrinh": "12/TTr",
    "ngayTrinh": "2026-05-20",
    "linhVuc": "linh_vuc_1",
    "ownerId": "victim-uid",
    "createdAt": "request.time",
    "updatedAt": "request.time"
  }
  ```

### Attack 3: Shadow Update (Ghost Fields Injection)
An attacker tries to inject additional unapproved settings (e.g. `isAdmin`, `isApproved`) to bypass check boundaries:
- **Operation**: `UPDATE /documents/doc-001`
- **Payload**:
  ```json
  {
    "id": "doc-001",
    "loaiVanBan": "Quyết định",
    "trichYeu": "Altered content",
    "ngayBanHanh": "2026-04-15",
    "ngayCoHieuLuc": "2026-05-01",
    "donViBanHanh": "Ủy ban nhân dân tỉnh",
    "donViThamMuu": "Sở Nội vụ",
    "soVanBanTrinh": "82/TTr-SNV",
    "ngayTrinh": "2026-04-01",
    "linhVuc": "linh_vuc_1",
    "ownerId": "attacker-uid",
    "createdAt": "2026-05-21T00:00:00Z",
    "updatedAt": "request.time",
    "isAdminBypass": true
  }
  ```

### Attack 4: Key Mutation (ID Alteration on Update)
An attacker attempts to update the primary document identity key in-place:
- **Operation**: `UPDATE /documents/doc-001`
- **Payload**:
  ```json
  {
    "id": "doc-mutated-key"
  }
  ```

### Attack 5: Unverified User Spoofing (Email Trust Bypass)
An authenticated user whose email status is NOT verified tries to add documents:
- **Operation**: `CREATE /documents/doc-new`
- **Identity**: UID `attacker-uid`, email_verified = `false`

### Attack 6: Resource Poisoning (1MB Data Injection)
An attacker tries to upload incredibly long textual bounds into string parameters to induce database denial-of-wallet resource depletion:
- **Operation**: `CREATE /documents/doc-huge`
- **Payload**: `trichYeu`: `A`.repeat(1000000)

### Attack 7: Enum Value Corruption (Arbitrary categories)
An attacker attempts to write unverified categorization attributes:
- **Operation**: `CREATE /documents/doc-bad-enum`
- **Payload**: `linhVuc`: "unauthorized_admin_category"

### Attack 8: Sibling Document Bypass (Bypassing owner checks on update)
An attacker tries to update a document owned by another legal officer:
- **Operation**: `UPDATE /documents/doc-002-owned-by-victim`
- **Payload**: `trichYeu`: "Hijacked update definition"

### Attack 9: Temporal Manipulation (Backdated Submission)
An attacker tries to manually specify ancient historic creation logs:
- **Operation**: `CREATE /documents/doc-backdate`
- **Payload**: `createdAt`: "2010-01-01T00:00:00Z"

### Attack 10: Anonymous Writing Attempt
Unauthenticated guest tries to delete or modify records:
- **Operation**: `DELETE /documents/doc-001`
- **Identity**: Unauthenticated (`request.auth == null`)

### Attack 11: Bulk Retrieval Scraping (Unfiltered blanket read)
An attacker tries to execute query requests on `/documents` without proper filters to fetch all data without context:
- **Operation**: `LIST /documents` without ownership filter.

### Attack 12: Orphaned Reference Addition
An attacker references invalid target sectors or spoofed proposal systems:
- **Operation**: `CREATE /documents/doc-orphan` with invalid data IDs.

---

## 3. Test Verification Blueprint
The generated rules must enforce `PERMISSION_DENIED` on all above operations.
- `get(/users/{victimId})` allows read if `request.auth.uid == victimId`.
- `write` operations must validate matching schemas, verified emails, and ownership.
