# Security Policy & Access Control Architecture

## 1. Principles of Least Privilege & Zero Trust
Marketing OS adheres to strict least-privilege security. Every endpoint validates caller identity, verifies role entitlement, and isolates tenant resources.

---

## 2. Authentication & Session Management
- **Token Format:** Signed JSON Web Tokens (JWT) using HMAC-SHA256.
- **Payload Contents:**
  - `id`: User unique UUID v4.
  - `email`: Normalized user email address.
  - `role`: Role string (`super_admin`, `admin`, `manager`, `member`, `client`).
  - `name`: User display name.
- **Expiration Policy:** Default `7d` configurable via `JWT_EXPIRES_IN`.
- **Revocation / Invalidation:** Client-side logout purges local storage; server-side middleware rejects malformed or unverified tokens with HTTP 401 Unauthorized.

---

## 3. Role-Based Access Control (RBAC) Matrix

| Action / Resource | Super Admin | Admin | Manager | Member | Client |
|---|:---:|:---:|:---:|:---:|:---:|
| View Dashboard & Metrics | All | All | Assigned | Assigned | Assigned (Delivered Only) |
| Manage Team Users (`/api/users`) | Yes | Yes | No | No | No |
| Create Projects (`POST /api/projects`) | Yes | Yes | Yes | No | No |
| Upload Harness Files | Yes | Yes | Yes | Yes | No |
| Create Tasks | Yes | Yes | Yes | Yes | No |
| Run Pipeline Tasks (`POST /api/tasks/:id/run`) | Yes | Yes | Yes | Yes | No |
| Approve & Deliver Tasks (`PATCH status='delivered'`) | **Yes** | **Yes** | **Yes** | **NO (403)** | **NO (403)** |
| View Unapproved In-Review Tasks | Yes | Yes | Yes | Yes | **NO (403)** |
| View Delivered Reports & Previews | Yes | Yes | Yes | Yes | **Yes** |

---

## 4. Adversarial Edge Case Defenses & Input Hardening
1. **Array / Object Type Confusion Prevention:** When processing `PATCH /api/tasks/:id`, requests must supply string values for status. Array wrapping (e.g. `{"status": ["delivered"]}`) is strictly sanitized and validated against explicit allowlists (`['draft', 'queued', 'running', 'in_review', 'needs_fix', 'delivered']`).
2. **Credential Sanitization:** All incoming login emails are sanitized via `.trim().toLowerCase()` to prevent whitespace or casing enumeration.
3. **Webhook Authentication:** Webhooks from n8n must deliver an `x-os-api-key` header matching the environment variable `OS_API_KEY`.
4. **Secret Storage:** Sensitive tokens (e.g., Mailgun/SendGrid keys, CRM tokens) are stored in `vault_items` using encrypted representations (`value_enc`). Plaintext API keys must never be logged or echoed in reports.

---

## 5. Security Incident Response & Rollback
- In the event of a compromised secret:
  1. Revoke the token at the upstream provider (e.g., SendGrid, GitHub).
  2. Rotate the local secret in `.env` and `vault_items`.
  3. Restart the background service: `npm run dev`.
  4. Perform an audit check on the `activity` table: `SELECT * FROM activity ORDER BY created_at DESC LIMIT 100;`.
