# API Contracts & Integration Specifications

**Document Version:** 2.0.0  
**Base URL:** `http://localhost:3000` (or configured `PORT`)  
**Transport:** HTTP/1.1 REST + JSON (`Content-Type: application/json`)  
**Authentication:** Bearer JWT in `Authorization` header (`Authorization: Bearer <token>`)  
**Author:** Principal Software Architect & API Lead  
**Date:** 2026-11-16  

---

## 1. Global Standards & Error Envelope

All error responses strictly adhere to the **Global Engineering Rule** and return standard JSON with correlation IDs:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "category": "VALIDATION_ERROR",
    "message": "Project name cannot be empty.",
    "correlation_id": "req-98421-c7",
    "timestamp": "2026-11-16T05:25:00Z"
  }
}
```

Standard HTTP Status Codes:
- `200 OK`: Request succeeded.
- `201 Created`: Resource successfully created.
- `400 Bad Request`: Validation failure or malformed payload (`VALIDATION_ERROR`).
- `401 Unauthorized`: Missing or invalid JWT session token (`AUTHENTICATION_ERROR`).
- `403 Forbidden`: Insufficient role permissions (`AUTHORIZATION_ERROR`).
- `404 Not Found`: Target resource does not exist (`NOT_FOUND_ERROR`).
- `409 Conflict`: Unique constraint violation (`CONFLICT_ERROR`).
- `500 Internal Server Error`: Server exception with stack preserved in `error_log` (`INTERNAL_SERVER_ERROR`).
- `503 Service Unavailable`: Dependent service (n8n, LLM) unreachable (`EXTERNAL_SERVICE_ERROR`).

---

## 2. Authentication & User Management Endpoints

### `POST /api/auth/login`
- **Access:** Public
- **Request Body:**
  ```json
  { "email": "admin@marketingos.local", "password": "Admin123!" }
  ```
- **Response (200 OK):**
  ```json
  {
    "user": { "id": "uuid", "name": "Super Admin", "email": "admin@marketingos.local", "role": "super_admin", "department": "Leadership" },
    "token": "eyJhbGciOiJIUzI1Ni..."
  }
  ```

### `GET /api/auth/me`
- **Access:** Authenticated (Any role)
- **Response (200 OK):** User profile object.

### `POST /api/auth/reset-password-dev`
- **Access:** Developer utility (Requires matching email)
- **Request Body:** `{ "email": "...", "newPassword": "..." }`

---

## 3. Projects & Data Harness Endpoints

### `GET /api/projects`
- **Access:** Authenticated (Filtered by project membership for `client` role)
- **Response (200 OK):** `[ { "id": "...", "name": "...", "client_name": "...", "status": "draft", "progress": 25 } ]`

### `POST /api/projects`
- **Access:** `super_admin`, `admin`, `manager`
- **Request Body:**
  ```json
  { "name": "Nile Dental Launch", "client_name": "Nile Dental Group", "goal": "Generate 50 qualified dental implant leads" }
  ```

### `POST /api/projects/:id/harness`
- **Access:** Authenticated
- **Content-Type:** `multipart/form-data` (Field: `file`)
- **Supported File Types:** `.pdf`, `.csv`, `.xlsx`, `.html`, `.png`, `.txt`, `.json` (Max 20MB)
- **Response (200 OK):** `{ "file": { "id": "...", "original_name": "leads.csv", "size": 48210, "parsed_summary": "138 rows parsed" } }`

---

## 4. Tasks & Dual-Engine Execution Endpoints

### `POST /api/projects/:id/tasks`
- **Access:** Authenticated
- **Request Body:**
  ```json
  {
    "title": "Landing Page for Dental Clinic",
    "pipeline": "landing-page",
    "description": "High conversion hero and lead form grounded in dental harness.",
    "priority": "high",
    "input_json": { "offer": "Free First Consultation" }
  }
  ```

### `POST /api/tasks/:id/run`
- **Access:** Authenticated
- **Execution Flow:**
  1. Sets task status to `running`.
  2. Attempts primary webhook dispatch to n8n (`/webhook/marketing-os-task`).
  3. If n8n times out or is offline, automatically activates `server/localRunner.js`.
  4. Updates task to `in_review` with generated `output_json` and `report_md`.
- **Response (200 OK):**
  ```json
  {
    "status": "in_review",
    "task": { "id": "...", "pipeline": "landing-page", "status": "in_review", "output_json": {...}, "report_md": "..." },
    "execution_mode": "n8n" // or "local_fallback"
  }
  ```

### `PATCH /api/tasks/:id` (Approval Gate G2)
- **Access:** `super_admin`, `admin` (Role `member` receives HTTP 403)
- **Request Body:** `{ "status": "delivered" }`
- **Response (200 OK):** `{ "task": { "id": "...", "status": "delivered" } }`

---

## 5. Campaigns, CRM & Lead Intelligence Endpoints

### `GET /api/projects/:id/campaigns` & `POST /api/projects/:id/campaigns`
- **Access:** Authenticated
- **Payload:** `{ "name": "Spring Campaign", "objective": "Lead Gen", "budget": 5000, "channels": ["email","search"] }`

### `GET /api/projects/:id/leads` & `POST /api/projects/:id/leads`
- **Access:** Authenticated
- **Payload:**
  ```json
  { "full_name": "Dr. Sarah Jenkins", "email": "sjenkins@clinic.ca", "job_title": "Lead Dentist", "company_name": "Bloor West Dental", "icp_score": 92 }
  ```

### `GET /api/projects/:id/deals` & `POST /api/projects/:id/deals`
- **Access:** Authenticated
- **Payload:**
  ```json
  { "title": "Annual Marketing Retainer", "value": 12000, "stage": "proposal", "probability": 70 }
  ```

---

## 6. Email Marketing & Sequence Endpoints

### `GET /api/projects/:id/email-sequences` & `POST /api/projects/:id/email-sequences`
- **Access:** Authenticated
- **Payload:** `{ "name": "Dental Inbound Sequence", "trigger_event": "form_submit" }`

### `POST /api/email-sequences/:id/dispatch-test` (Gate G2 Consent)
- **Access:** `super_admin`, `admin`
- **Payload:** `{ "recipient": "operator@company.com", "approved": true }`
- **Response (200 OK):** Staged delivery receipt with Message-ID.

---

## 7. Content Operations & SEO/GEO Endpoints

### `GET /api/projects/:id/content` & `POST /api/projects/:id/content`
- **Access:** Authenticated
- **Payload:** `{ "title": "10 Dental AI Strategies", "format": "blog_post", "channel": "Blog", "status": "scheduled", "publish_date": "2026-11-20T10:00:00Z" }`

### `GET /api/projects/:id/seo-keywords` & `POST /api/projects/:id/seo-keywords`
- **Access:** Authenticated
- **Payload:** `{ "keyword": "dental marketing software", "search_intent": "commercial", "monthly_volume": 2400 }`

---

## 8. n8n Automation & Webhook Ingress Endpoints

### `POST /api/webhooks/n8n`
- **Access:** Authenticated via `x-os-api-key` header
- **Payload:**
  ```json
  {
    "task_id": "uuid",
    "status": "in_review",
    "output": { "result": "..." },
    "report_md": "# Admin Report..."
  }
  ```
- **Response (200 OK):** `{ "received": true, "task_id": "uuid" }`
