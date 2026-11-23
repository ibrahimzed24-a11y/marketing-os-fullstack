# System Architecture — AI-Powered Marketing Operating System

**Document Version:** 2.0.0  
**Target Release:** Marketing OS v2.0 Enterprise  
**Author:** Principal Software Architect & CTO  
**Date:** 2026-11-16  

---

## 1. Executive Overview

The **AI-Powered Marketing Operating System (Marketing OS)** is a unified, production-ready enterprise platform that automates, governs, and optimizes the complete marketing lifecycle:
$$\text{Research} \longrightarrow \text{Intelligence} \longrightarrow \text{Strategy} \longrightarrow \text{Planning} \longrightarrow \text{Execution} \longrightarrow \text{Automation} \longrightarrow \text{Measurement} \longrightarrow \text{Optimization}$$

The system operates across three synchronized execution tiers:
1. **Unified Command Center:** Responsive, accessible web application serving 12 specialized operational modules.
2. **Dual-Engine Execution Tier:** Bidirectional n8n visual automation workflows coupled with a resilient local AI agent fallback squad.
3. **Sovereign Relational Data Foundation:** High-performance SQLite engine operating in WAL mode with strict foreign key constraints and audit logging.

---

## 2. System Architecture Diagram

```mermaid
flowchart TD
    subgraph CLIENT ["Client Tier: Unified Command Center"]
        UI_DASH["01. Command Center & KPIs"]
        UI_INTEL["02. Market & Competitor Intel"]
        UI_SEO["03. SEO & GEO Intelligence"]
        UI_STRAT["04. Strategy & ICP Planning"]
        UI_CAMP["05. Multi-Channel Campaigns"]
        UI_LEADS["06. Lead Generation & Scoring"]
        UI_CRM["07. CRM & Deal Pipelines"]
        UI_EMAIL["08. Email Sequences & Outreach"]
        UI_CONTENT["09. Content Ops & Calendar"]
        UI_AGENTS["10. AI Workforce Hub"]
        UI_N8N["11. n8n Automation Console"]
        UI_ANALYTICS["12. Analytics & Executive Reports"]
    end

    subgraph API_GW ["Application Gateway & Express Core (:3000)"]
        AUTH_MW["JWT Authentication & RBAC Middleware"]
        CORR_MW["Correlation ID & Request Tracing Middleware"]
        ERR_MW["Centralized Error Handling & Logging Middleware"]
        ROUTERS["Modular Domain Routers (12 Modules)"]
        HARNESS_MGR["Core Data Harness Parser & Ingestion Engine"]
        DUAL_RUNNER["Dual-Engine Orchestrator (n8n + Local Fallback)"]
    end

    subgraph DATA_PLANE ["Centralized Database Tier (SQLite WAL / Supabase)"]
        DB_USERS[("users & project_members")]
        DB_PROJ[("projects & harness_files")]
        DB_TASKS[("tasks & reports")]
        DB_CRM[("companies, leads, contacts, deals")]
        DB_CAMPAIGNS[("campaigns, content_items, email_sequences")]
        DB_INTEL[("seo_keywords, geo_queries, competitor_records")]
        DB_AUDIT[("activity_log & error_log")]
    end

    subgraph AUTO_PLANE ["Automation & Workflow Tier (n8n Engine :5678)"]
        N8N_HOOK["Authenticated Webhook Ingress (/webhook/*)"]
        N8N_W1["01: Main Task Router Workflow"]
        N8N_W2["02: Landing Page Factory Workflow"]
        N8N_W3["03: Lead Research & Enrichment Workflow"]
        N8N_W4["04: Email Sequence Dispatcher Workflow"]
        N8N_W5["05: CRM Synchronization Workflow"]
    end

    subgraph AGENT_SQUAD ["Sovereign AI Workforce Tier (Antigravity Plugin)"]
        A_COORD["@coordinator (Task Decomposition & QA Governance)"]
        A_RESEARCH["@browser-researcher (Web & SERP Intelligence)"]
        A_BUILDER["@software-engineer (Code & HTML Generation)"]
        A_REPORT["@master-reporting-agent (Auditing & Verdicts)"]
        A_STRAT["@content-strategist (Messaging & SEO Copy)"]
    end

    CLIENT -->|HTTPS / JSON + JWT| AUTH_MW
    AUTH_MW --> CORR_MW
    CORR_MW --> ROUTERS
    ROUTERS --> ERR_MW
    ROUTERS --> DATA_PLANE
    ROUTERS --> HARNESS_MGR
    ROUTERS --> DUAL_RUNNER

    DUAL_RUNNER -->|Primary: HTTP Webhook| N8N_HOOK
    N8N_HOOK --> N8N_W1
    N8N_HOOK --> N8N_W2
    N8N_HOOK --> N8N_W3
    N8N_HOOK --> N8N_W4
    N8N_HOOK --> N8N_W5
    AUTO_PLANE -->|Callback: /api/webhooks/n8n| ROUTERS

    DUAL_RUNNER -->|Failover / Offline Fallback| AGENT_SQUAD
    AGENT_SQUAD -->|Deterministic Output + Report| DATA_PLANE
```

---

## 3. Database Entity Relationship Diagram (ERD)

```mermaid
erDiagram
    USERS ||--o{ PROJECTS : "owns"
    USERS ||--o{ PROJECT_MEMBERS : "assigned_to"
    USERS ||--o{ TASKS : "creates_or_executes"
    USERS ||--o{ ACTIVITY_LOG : "triggers"

    PROJECTS ||--o{ PROJECT_MEMBERS : "includes"
    PROJECTS ||--o{ TASKS : "contains"
    PROJECTS ||--o{ HARNESS_FILES : "stores"
    PROJECTS ||--o{ CAMPAIGNS : "contains"
    PROJECTS ||--o{ COMPANIES : "manages"
    PROJECTS ||--o{ LEADS : "tracks"
    PROJECTS ||--o{ DEALS : "governs"
    PROJECTS ||--o{ CONTENT_ITEMS : "publishes"
    PROJECTS ||--o{ EMAIL_SEQUENCES : "runs"
    PROJECTS ||--o{ SEO_KEYWORDS : "monitors"
    PROJECTS ||--o{ REPORTS : "generates"

    COMPANIES ||--o{ CONTACTS : "employs"
    COMPANIES ||--o{ DEALS : "negotiates"

    LEADS ||--o{ CONTACTS : "converts_to"
    LEADS ||--o{ EMAIL_LOGS : "receives"

    CAMPAIGNS ||--o{ CONTENT_ITEMS : "schedules"
    CAMPAIGNS ||--o{ EMAIL_SEQUENCES : "broadcasts"
    CAMPAIGNS ||--o{ TASKS : "drives"

    EMAIL_SEQUENCES ||--o{ EMAIL_STEPS : "contains"
    EMAIL_STEPS ||--o{ EMAIL_LOGS : "generates"

    TASKS ||--o{ REPORTS : "produces"
```

---

## 4. Module Dependency Map

The 12 system modules are structured into clear hierarchical layers:

```mermaid
flowchart TD
    subgraph Foundation ["Layer 1: Foundational Intelligence"]
        M02["Module 02: Market Intelligence & Research"]
        M03["Module 03: SEO & GEO Intelligence"]
    end

    subgraph Strategy ["Layer 2: Strategic Planning"]
        M04["Module 04: Strategy & Planning"]
    end

    subgraph Execution ["Layer 3: Campaign & Revenue Execution"]
        M05["Module 05: Campaign Management"]
        M06["Module 06: Lead Generation & Intelligence"]
        M07["Module 07: CRM & Pipeline Management"]
        M08["Module 08: Email Marketing & Sequences"]
        M09["Module 09: Content Operations"]
    end

    subgraph Engines ["Layer 4: Automation & Workforce Engines"]
        M10["Module 10: AI Workforce Engine"]
        M11["Module 11: n8n Automation Engine"]
    end

    subgraph Governance ["Layer 5: Governance & Observability"]
        M01["Module 01: Marketing Command Center"]
        M12["Module 12: Analytics & Reporting"]
    end

    M02 --> M04
    M03 --> M04
    M04 --> M05
    M04 --> M06
    M05 --> M08
    M05 --> M09
    M06 --> M07
    M07 --> M08

    M10 -.-> M02
    M10 -.-> M03
    M10 -.-> M06
    M10 -.-> M08
    M10 -.-> M09

    M11 -.-> M05
    M11 -.-> M06
    M11 -.-> M07
    M11 -.-> M08

    M01 --> Governance
    M05 --> M12
    M07 --> M12
    M08 --> M12
    M09 --> M12
```

---

## 5. Security & Isolation Architecture

1. **Role-Based Access Control (RBAC):**
   - `super_admin`: Global platform configuration, user provisioning, database maintenance.
   - `admin`: Full project lifecycle, task creation, delivery approvals (Gate G2), campaign management.
   - `manager`: Project creation, squad assignments, review and edits.
   - `member`: Task execution, data inspection, drafting deliverables. (Blocked from final delivery via HTTP 403).
   - `client`: External stakeholder view; strictly restricted to `delivered` deliverables for assigned projects.
2. **Outbound Approval Gate G2:**
   - Real email dispatch, external CMS publishing, and paid advertising operations cannot occur automatically.
   - The engine generates a `DRY-RUN / STAGING RECEIPT` and transitions the task to `in_review`.
   - Dispatch executes only when an authorized operator clicks **Approve & Deliver** or issues an approved token.
3. **Secrets Management:**
   - External credentials (API keys, SMTP passwords) are encrypted using AES-256 in the vault.
   - Raw credentials are never transmitted over unencrypted channels or displayed in public logs.
4. **Network & CORS Protection:**
   - CORS is restricted to explicit trusted origins: `http://localhost:3000`, `http://127.0.0.1:3000`, and authorized staging/production domains.

---

## 6. Error Handling & Fault Tolerance Architecture

Adhering strictly to the **Global Engineering Rule**:

1. **Centralized Error Hierarchy (`server/errors.js`):**
   - `AppError` base class with `statusCode`, `category`, `code`, `isOperational`, and `correlationId`.
   - Specific subclasses: `ValidationError`, `AuthenticationError`, `AuthorizationError`, `NotFoundError`, `ConflictError`, `ExternalServiceError`, `DatabaseError`, `TimeoutError`.
2. **Defensive Try/Catch/Finally Enforcement:**
   - Every database query, API route, file upload, n8n webhook, and AI agent execution is wrapped in defensive try/catch blocks.
   - Database operations execute inside atomic SQLite transactions (`db.transaction()`) with automatic rollback on error.
   - Server errors preserve the full stack trace in `error_log` while returning a clean, sanitized JSON envelope to the client:
     ```json
     {
       "error": {
         "code": "VALIDATION_ERROR",
         "category": "VALIDATION_ERROR",
         "message": "Invalid email address format.",
         "correlation_id": "req-98421-c7",
         "timestamp": "2026-11-16T05:22:00Z"
       }
     }
     ```
3. **Resilient Dual-Engine Failover:**
   - When n8n is offline or unreachable, the system automatically routes tasks to the local Antigravity agent runner (`server/localRunner.js`) without dropping the task or crashing the process.

---

## 7. Deployment & Infrastructure Architecture

```mermaid
graph LR
    subgraph LocalWorkstation ["Tier 1: Sovereign Workstation (Local Node)"]
        NodeServer["Node.js Express API (:3000)"]
        SQLiteDB["SQLite 3 WAL Engine"]
        WorkerDaemon["Hybrid Worker Daemon (:8765)"]
    end

    subgraph AutomationInfra ["Tier 2: Workflow Automation (n8n)"]
        N8NDaemon["n8n Automation Engine (:5678)"]
        N8NStore["Workflow Definitions & Credential Vault"]
    end

    subgraph CloudBackup ["Tier 3: Cloud Replication & Production Edge"]
        VercelEdge["Vercel Production Gateway"]
        SupabaseSync["Supabase Managed PostgreSQL"]
    end

    NodeServer -->|Local IPC / HTTP| SQLiteDB
    NodeServer -->|Local HTTP Webhook| N8NDaemon
    NodeServer -.->|Scheduled Backup / Sync| SupabaseSync
    VercelEdge -.->|Cloud Routing| SupabaseSync
```

---

## 8. Implementation Roadmap

```mermaid
flowchart TD
    P1["Phase 1: Architecture & Complete Documentation (12 Specs)"]
    P2["Phase 2: Database Schema Upgrade (CRM, Campaigns, Sequences)"]
    P3["Phase 3: Centralized Error Handling & Fault Tolerance Framework"]
    P4["Phase 4: Backend API Expansion for 12 Modules"]
    P5["Phase 5: n8n Production Workflow Completion & Validation"]
    P6["Phase 6: Frontend Command Center Workspace Expansion"]
    P7["Phase 7: End-to-End Test Suite Execution & Production Verification"]

    P1 --> P2 --> P3 --> P4 --> P5 --> P6 --> P7
```
