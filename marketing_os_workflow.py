#!/usr/bin/env python3
"""
Marketing OS Workflow Orchestrator
==================================
Autonomous Python 3 orchestration script for Marketing OS production readiness.
Covers:
  1. Authentication reset (fix/reset-users.js) & seed account verification
  2. System health probe & n8n/local fallback resilience check
  3. Admin project creation, client attachment, and member project onboarding
  4. Task creation & execution across all 8 marketing pipelines
  5. Strict RBAC enforcement:
     - Member unauthorized deliver attempt (asserts HTTP 403)
     - Admin authorized deliver approval (asserts HTTP 200)
     - Client deliverable isolation verification (asserts client sees only delivered tasks)
     - Direct client unauthorized non-delivered task access check (asserts HTTP 403)
  6. Final execution evidence summary

Standard Library ONLY: urllib.request, json, subprocess, time, sys, os.
"""

import os
import sys
import time
import json
import subprocess
import urllib.request
import urllib.error

WORKSPACE_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_URL = os.environ.get("MARKETING_OS_URL", "http://127.0.0.1:3000")
N8N_URL = os.environ.get("N8N_BASE_URL", "http://127.0.0.1:5678")


def http_request(url, method="GET", data=None, token=None, timeout=15):
    """Executes HTTP request using only standard library urllib.request."""
    headers = {"Accept": "application/json"}
    body_bytes = None
    if data is not None:
        body_bytes = json.dumps(data).encode("utf-8")
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = f"Bearer {token}"

    req = urllib.request.Request(url, data=body_bytes, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8")
            parsed = json.loads(raw) if raw else {}
            return resp.status, parsed
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8")
        try:
            parsed = json.loads(raw) if raw else {}
        except Exception:
            parsed = {"raw": raw}
        return e.code, parsed
    except urllib.error.URLError as e:
        return 0, {"error": str(e.reason)}


def http_upload(url, field_name, filename, file_bytes, content_type="text/plain", token=None, timeout=15):
    """Executes multipart/form-data upload using only standard library urllib.request."""
    boundary = "----WebKitFormBoundary" + str(int(time.time() * 1000))
    lines = [
        f"--{boundary}".encode("utf-8"),
        f'Content-Disposition: form-data; name="{field_name}"; filename="{filename}"'.encode("utf-8"),
        f"Content-Type: {content_type}".encode("utf-8"),
        b"",
        file_bytes,
        f"--{boundary}--".encode("utf-8"),
        b""
    ]
    body_bytes = b"\r\n".join(lines)
    headers = {
        "Content-Type": f"multipart/form-data; boundary={boundary}",
        "Accept": "application/json",
        "Content-Length": str(len(body_bytes))
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, data=body_bytes, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8")
            return resp.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8")
        try:
            return e.code, json.loads(raw) if raw else {}
        except Exception:
            return e.code, {"raw": raw}
    except urllib.error.URLError as e:
        return 0, {"error": str(e.reason)}


def log_step(title):
    print(f"\n{'='*70}\n[WORKFLOW STEP] {title}\n{'='*70}")


def main():
    print("=" * 70)
    print("  MARKETING OS AUTONOMOUS WORKFLOW ORCHESTRATOR")
    print(f"  Target Server: {BASE_URL}")
    print(f"  Working Directory: {WORKSPACE_DIR}")
    print(f"  Timestamp: {time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}")
    print("=" * 70)

    # -------------------------------------------------------------------------
    # STAGE 1: Authentication Reset & Verification
    # -------------------------------------------------------------------------
    log_step("1. Authentication Reset & Seed Users Verification")
    reset_script = os.path.join(WORKSPACE_DIR, "fix", "reset-users.js")
    print(f"Executing auth reset: node {reset_script}")

    reset_proc = subprocess.run(
        ["node", reset_script],
        cwd=WORKSPACE_DIR,
        capture_output=True,
        text=True
    )
    if reset_proc.returncode != 0:
        print(f"❌ User reset failed (exit {reset_proc.returncode}):\n{reset_proc.stderr}")
        sys.exit(1)
    print("✅ fix/reset-users.js executed successfully.")

    seed_credentials = [
        {"email": "admin@marketingos.local", "password": "Admin123!", "expected_role": "super_admin"},
        {"email": "manager@marketingos.local", "password": "Manager123!", "expected_role": "manager"},
        {"email": "member@marketingos.local", "password": "Member123!", "expected_role": "member"},
        {"email": "client@marketingos.local", "password": "Client123!", "expected_role": "client"},
    ]

    tokens = {}
    users_data = {}

    for cred in seed_credentials:
        email = cred["email"]
        password = cred["password"]
        expected_role = cred["expected_role"]

        code, resp = http_request(
            f"{BASE_URL}/api/auth/login",
            method="POST",
            data={"email": email, "password": password}
        )
        assert code == 200, f"Login failed for {email}: HTTP {code} - {resp}"
        assert "token" in resp and resp["token"], f"No token returned for {email}"
        user_info = resp.get("user", {})
        assert user_info.get("role") == expected_role, f"Role mismatch for {email}: got {user_info.get('role')}, expected {expected_role}"

        tokens[expected_role] = resp["token"]
        users_data[expected_role] = user_info
        print(f"  ✅ Verified {email} [{expected_role}] (ID: {user_info.get('id')})")

    # -------------------------------------------------------------------------
    # STAGE 2: System Health & n8n / Local Fallback Probe
    # -------------------------------------------------------------------------
    log_step("2. System Health & Resilience Probe")
    code, health_resp = http_request(f"{BASE_URL}/api/health")
    assert code == 200, f"Health check failed: HTTP {code} - {health_resp}"
    assert health_resp.get("status") == "ok", f"Health status not ok: {health_resp}"
    print(f"  ✅ Marketing OS Health Probe OK: {health_resp}")

    # Check n8n status
    n8n_code, n8n_resp = http_request(f"{N8N_URL}/healthz", timeout=3)
    if n8n_code == 200:
        print(f"  ℹ️ n8n Service: Online ({N8N_URL})")
    else:
        print(f"  ℹ️ n8n Service: Offline ({N8N_URL} returned code {n8n_code})")
        print("     -> Marketing OS local fallback engine (server/localRunner.js) active.")

    # -------------------------------------------------------------------------
    # STAGE 3: Project Setup & Member Association
    # -------------------------------------------------------------------------
    log_step("3. Project Creation & Member Association")
    admin_token = tokens["super_admin"]
    client_id = users_data["client"]["id"]
    client_token = tokens["client"]
    member_id = users_data["member"]["id"]
    member_token = tokens["member"]

    proj_payload = {
        "name": "Python Orchestrated Growth Factory",
        "goal": "Generate 100 qualified enterprise B2B sales pipeline leads with verified marketing assets",
        "client_name": "Nile Enterprise Supplies",
        "type": "landing-page"
    }

    code, proj_resp = http_request(
        f"{BASE_URL}/api/projects",
        method="POST",
        data=proj_payload,
        token=admin_token
    )
    assert code == 200, f"Project creation failed: HTTP {code} - {proj_resp}"
    proj_id = proj_resp.get("id")
    assert proj_id, "Project ID missing in creation response"
    print(f"  ✅ Project created: '{proj_payload['name']}' (ID: {proj_id})")

    # Attach Client to project
    code, attach_client = http_request(
        f"{BASE_URL}/api/projects/{proj_id}/members",
        method="POST",
        data={"user_id": client_id, "role_in_project": "client"},
        token=admin_token
    )
    assert code == 200 and attach_client.get("ok") is True, f"Attaching client failed: HTTP {code} - {attach_client}"
    print(f"  ✅ Attached Client (ID: {client_id}) with role 'client'")

    # Attach Member to project (enables direct delivery role RBAC verification)
    code, attach_member = http_request(
        f"{BASE_URL}/api/projects/{proj_id}/members",
        method="POST",
        data={"user_id": member_id, "role_in_project": "member"},
        token=admin_token
    )
    assert code == 200 and attach_member.get("ok") is True, f"Attaching member failed: HTTP {code} - {attach_member}"
    print(f"  ✅ Attached Member (ID: {member_id}) with role 'member'")

    # 3b. Test Negative Boundary: Non-existent Project Task Creation -> HTTP 404
    print("  Testing Negative Boundary: Task creation on non-existent project...")
    code, ghost_task_resp = http_request(
        f"{BASE_URL}/api/projects/00000000-0000-0000-0000-000000000000/tasks",
        method="POST",
        data={"title": "Ghost Task", "pipeline": "content-seo"},
        token=admin_token
    )
    assert code == 404, f"Expected HTTP 404 for missing project task creation, got {code}: {ghost_task_resp}"
    assert ghost_task_resp.get("error") == "Project not found", f"Unexpected error message: {ghost_task_resp}"
    print(f"  🔒 PASSED: Task creation on non-existent project correctly rejected with HTTP 404: {ghost_task_resp}")

    # 3c. Upload Ground Truth Harness File -> HTTP 200
    print("  Testing Ground Truth Harness Upload (Multipart Form)...")
    harness_content = b"Brand Positioning & Product Brief: Nile Enterprise Supplies B2B Operations."
    code, harness_resp = http_upload(
        f"{BASE_URL}/api/projects/{proj_id}/harness",
        field_name="file",
        filename="nile_brand_brief.txt",
        file_bytes=harness_content,
        content_type="text/plain",
        token=admin_token
    )
    assert code == 200, f"Harness upload failed: HTTP {code} - {harness_resp}"
    assert "id" in harness_resp and (harness_resp.get("original_name") == "nile_brand_brief.txt" or "nile_brand_brief" in harness_resp.get("filename", "")), f"Invalid harness response: {harness_resp}"
    print(f"  ✅ PASSED: Harness file uploaded successfully (ID: {harness_resp['id']}, size: {harness_resp['size']} bytes)")

    # 3d. Non-existent Project Harness Upload -> HTTP 404
    code, ghost_harness_resp = http_upload(
        f"{BASE_URL}/api/projects/00000000-0000-0000-0000-000000000000/harness",
        field_name="file",
        filename="ghost_brief.txt",
        file_bytes=b"Ghost",
        token=admin_token
    )
    assert code == 404, f"Expected HTTP 404 for ghost harness upload, got {code}: {ghost_harness_resp}"
    print(f"  🔒 PASSED: Harness upload to non-existent project rejected with HTTP 404: {ghost_harness_resp}")

    # -------------------------------------------------------------------------
    # STAGE 4: Task Execution Across All 8 Marketing Pipelines
    # -------------------------------------------------------------------------
    log_step("4. Task Creation and Execution Across All 8 Pipelines")
    pipelines = [
        {
            "id": "landing-page",
            "title": "Enterprise Landing Page for Nile Supplies",
            "desc": "Responsive Tailwind CSS landing page with hero, value proposition, lead form, and footer."
        },
        {
            "id": "content-seo",
            "title": "SEO Authority Blueprint Article",
            "desc": "In-depth B2B SEO authority article with keyword mapping, search intent, and quality checklist."
        },
        {
            "id": "social-content",
            "title": "7-Day Multi-Channel Authority Social Calendar",
            "desc": "Weekly authority building calendar with hooks, value posts, and CTA copy for LinkedIn and X."
        },
        {
            "id": "ads-creative",
            "title": "Multi-Platform Search & Feed Ad Creative Variants",
            "desc": "Google Search headline variants plus Meta and LinkedIn high-converting ad copy."
        },
        {
            "id": "email-campaign",
            "title": "5-Step Automated Lead Nurture Sequence",
            "desc": "Comprehensive automated email sequence: welcome, teardown, case study, objection buster, close."
        },
        {
            "id": "lead-research",
            "title": "B2B ICP Account Research & Persona Enrichment Matrix",
            "desc": "Grounded lead list of target enterprise accounts and verified buyer personas."
        },
        {
            "id": "market-intel",
            "title": "GrillMe Competitive Teardown & Strategic Positioning",
            "desc": "Competitive intelligence teardown analyzing generic AI tools vs grounded agent orchestration."
        },
        {
            "id": "brand-kit",
            "title": "Comprehensive Visual Brand Kit & Tone Guidelines",
            "desc": "Brand color palette, typography hierarchy, UI tokens, and brand voice guidelines."
        }
    ]

    executed_tasks = {}

    for pl in pipelines:
        pl_id = pl["id"]
        pl_title = pl["title"]
        pl_desc = pl["desc"]

        # Create task
        task_payload = {
            "title": pl_title,
            "pipeline": pl_id,
            "description": pl_desc,
            "priority": "high"
        }
        code, task_resp = http_request(
            f"{BASE_URL}/api/projects/{proj_id}/tasks",
            method="POST",
            data=task_payload,
            token=admin_token
        )
        assert code == 200, f"Task creation failed for {pl_id}: HTTP {code} - {task_resp}"
        task_id = task_resp.get("id")
        assert task_id, f"No task_id returned for {pl_id}"

        # Run task
        code, run_resp = http_request(
            f"{BASE_URL}/api/tasks/{task_id}/run",
            method="POST",
            token=admin_token
        )
        assert code == 200, f"Task run failed for {pl_id}: HTTP {code} - {run_resp}"
        assert run_resp.get("ok") is True, f"Task run response not ok for {pl_id}: {run_resp}"

        # Verify task status
        code, check_resp = http_request(
            f"{BASE_URL}/api/tasks/{task_id}",
            method="GET",
            token=admin_token
        )
        assert code == 200, f"Task get failed for {pl_id}: HTTP {code}"
        task_obj = check_resp.get("task", {})
        status = task_obj.get("status")
        assert status in ("in_review", "delivered"), f"Task status unexpected ({status}) for {pl_id}"

        executed_tasks[pl_id] = {
            "id": task_id,
            "title": pl_title,
            "status": status,
            "mode": run_resp.get("mode"),
            "has_deliverable": bool(task_obj.get("output_json")),
            "has_report": bool(task_obj.get("report_md"))
        }

        print(f"  ✅ [{pl_id}] Task created ({task_id[:8]}...) -> Executed ({run_resp.get('mode')}) -> Status: {status}")

    # -------------------------------------------------------------------------
    # STAGE 5: RBAC Security Enforcement & Deliverable Verification
    # -------------------------------------------------------------------------
    log_step("5. Role-Based Access Control (RBAC) Security Verification")

    landing_task_id = executed_tasks["landing-page"]["id"]
    content_task_id = executed_tasks["content-seo"]["id"]

    # 5a0. Member attempts array type confusion exploit -> Expect HTTP 400 Bad Request
    print(f"5a0. Testing Member Array Type Confusion Exploit on task {landing_task_id[:8]}...")
    code, array_exploit_resp = http_request(
        f"{BASE_URL}/api/tasks/{landing_task_id}",
        method="PATCH",
        data={"status": ["delivered"]},
        token=member_token
    )
    assert code == 400, f"Array exploit breach! Expected HTTP 400, got {code}: {array_exploit_resp}"
    assert array_exploit_resp.get("error") == "Invalid status value", f"Unexpected error: {array_exploit_resp}"
    print(f"  🔒 PASSED: Member array exploit rejected with HTTP 400: '{array_exploit_resp.get('error')}'")

    # 5a0b. Admin attempts array status -> Expect HTTP 400 Bad Request
    print(f"5a0b. Testing Admin Array Status Validation on task {landing_task_id[:8]}...")
    code, admin_array_resp = http_request(
        f"{BASE_URL}/api/tasks/{landing_task_id}",
        method="PATCH",
        data={"status": ["delivered"]},
        token=admin_token
    )
    assert code == 400, f"Expected HTTP 400 for admin array status, got {code}: {admin_array_resp}"
    assert admin_array_resp.get("error") == "Invalid status value", f"Unexpected error: {admin_array_resp}"
    print(f"  🔒 PASSED: Admin array status rejected with HTTP 400: '{admin_array_resp.get('error')}'")

    # 5a. Member attempts unauthorized deliver -> Expect HTTP 403 Forbidden
    print(f"\n5a. Testing Member Delivery RBAC Gate on task {landing_task_id[:8]}...")
    code, member_patch_resp = http_request(
        f"{BASE_URL}/api/tasks/{landing_task_id}",
        method="PATCH",
        data={"status": "delivered"},
        token=member_token
    )
    assert code == 403, f"RBAC Breach! Member patch deliver did NOT return 403 (returned HTTP {code}: {member_patch_resp})"
    expected_error = member_patch_resp.get("error", "")
    assert "Only admin/manager can deliver" in expected_error or "Forbidden" in expected_error, \
        f"Unexpected error message for member delivery: {expected_error}"
    print(f"  🔒 PASSED: Member delivery rejected with HTTP 403 Forbidden: '{expected_error}'")

    # Verify task status remains in_review
    code, check_post_member = http_request(
        f"{BASE_URL}/api/tasks/{landing_task_id}",
        method="GET",
        token=admin_token
    )
    assert check_post_member.get("task", {}).get("status") == "in_review", "Task status was modified by member!"
    print("  🔒 Verified: Task status strictly remained 'in_review'")

    # 5b. Admin approves & delivers task -> Expect HTTP 200 OK
    print(f"\n5b. Testing Admin Authorized Delivery Approval on task {landing_task_id[:8]}...")
    code, admin_patch_resp = http_request(
        f"{BASE_URL}/api/tasks/{landing_task_id}",
        method="PATCH",
        data={"status": "delivered"},
        token=admin_token
    )
    assert code == 200, f"Admin deliver failed: HTTP {code} - {admin_patch_resp}"
    assert admin_patch_resp.get("ok") is True and admin_patch_resp.get("status") == "delivered", \
        f"Unexpected admin deliver response: {admin_patch_resp}"
    print(f"  ✅ PASSED: Admin approved deliverable with HTTP 200 OK: {admin_patch_resp}")

    # 5c. Client isolation verification -> Expect client to see ONLY delivered tasks
    print(f"\n5c. Testing Client Workbench Isolation on project {proj_id[:8]}...")
    code, client_proj_resp = http_request(
        f"{BASE_URL}/api/projects/{proj_id}",
        method="GET",
        token=client_token
    )
    assert code == 200, f"Client get project failed: HTTP {code} - {client_proj_resp}"
    client_tasks = client_proj_resp.get("tasks", [])
    print(f"  Client visible task count: {len(client_tasks)} (Total project tasks: {len(pipelines)})")

    assert len(client_tasks) == 1, f"Client saw unexpected number of tasks ({len(client_tasks)} instead of 1)"
    for t in client_tasks:
        assert t.get("status") == "delivered", f"Client leaked non-delivered task: {t}"
        print(f"  Client visible task: '{t.get('title')}' [Status: {t.get('status')}]")
    print("  🔒 PASSED: Client sees ONLY delivered tasks. Non-delivered drafts and reviews are isolated.")

    # 5d. Client direct access to non-delivered task -> Expect HTTP 403 Forbidden
    print(f"\n5d. Testing Client Direct Access to In-Review Task ({content_task_id[:8]}...)...")
    code, client_direct_resp = http_request(
        f"{BASE_URL}/api/tasks/{content_task_id}",
        method="GET",
        token=client_token
    )
    assert code == 403, f"Client leaked in-review task via direct GET: HTTP {code} - {client_direct_resp}"
    assert "Clients can only view delivered deliverables" in client_direct_resp.get("error", ""), \
        f"Unexpected client direct error: {client_direct_resp}"
    print(f"  🔒 PASSED: Client direct access blocked with HTTP 403: '{client_direct_resp.get('error')}'")

    # -------------------------------------------------------------------------
    # STAGE 6: Summary & Evidence Report
    # -------------------------------------------------------------------------
    log_step("6. Marketing OS Production Verification Summary")
    print(f"Project ID        : {proj_id}")
    print(f"Project Name      : {proj_payload['name']}")
    print(f"Admin Account     : admin@marketingos.local [super_admin]")
    print(f"Manager Account   : manager@marketingos.local [manager]")
    print(f"Member Account    : member@marketingos.local [member]")
    print(f"Client Account    : client@marketingos.local [client]")
    print("\nPipeline Execution Results:")
    print("-" * 75)
    print(f"{'Pipeline':<16} | {'Status':<10} | {'Mode':<8} | {'Deliverable':<12} | {'Report':<8}")
    print("-" * 75)
    for pl_id, info in executed_tasks.items():
        print(f"{pl_id:<16} | {info['status']:<10} | {info['mode']:<8} | {str(info['has_deliverable']):<12} | {str(info['has_report']):<8}")
    print("-" * 75)

    print("\nAdversarial Defense & RBAC Security Matrix Verification:")
    print("  [PASS] Missing Project Task Creation Guard -> HTTP 404 Not Found ('Project not found')")
    print("  [PASS] Ground Truth Harness Multipart Upload -> HTTP 200 OK")
    print("  [PASS] Missing Project Harness Upload Guard -> HTTP 404 Not Found ('Project not found')")
    print("  [PASS] Member Array Type Confusion Exploit   -> HTTP 400 Bad Request ('Invalid status value')")
    print("  [PASS] Admin Array Type Confusion Attempt    -> HTTP 400 Bad Request ('Invalid status value')")
    print("  [PASS] Member Unauthorized Deliver PATCH     -> HTTP 403 Forbidden ('Only admin/manager can deliver')")
    print("  [PASS] Admin Authorized Deliver PATCH        -> HTTP 200 OK ('delivered')")
    print("  [PASS] Client Project Task Filtering         -> 1 Delivered Task visible (7 in-review isolated)")
    print("  [PASS] Client Direct In-Review Task GET       -> HTTP 403 Forbidden ('Clients can only view delivered deliverables')")

    print("\n" + "=" * 70)
    print("🎉 ALL MARKETING OS ORCHESTRATION CHECKS PASSED WITH ZERO ERRORS.")
    print("=" * 70)
    sys.exit(0)


if __name__ == "__main__":
    main()
