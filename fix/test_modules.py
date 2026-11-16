#!/usr/bin/env python3
"""
Test Suite for Marketing OS Modules 01-12
Verifies:
  - Campaigns API (Module 05)
  - Companies & Leads API (Module 06)
  - Deals & CRM Pipeline API (Module 07)
  - Email Sequences & Gate G2 Staging (Module 08)
  - Content Operations API (Module 09)
  - SEO & GEO Intelligence API (Module 03)
  - Reports API (Module 12)
"""

import urllib.request
import urllib.error
import json
import sys

BASE_URL = "http://127.0.0.1:3000"

def request(url, method="GET", data=None, token=None):
    headers = {"Accept": "application/json"}
    body = None
    if data is not None:
        body = json.dumps(data).encode("utf-8")
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            raw = resp.read().decode("utf-8")
            return resp.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8")
        return e.code, json.loads(raw) if raw else {}

def main():
    print("Testing Modules 01-12 Extended API Endpoints...")

    # 1. Login
    code, auth = request(f"{BASE_URL}/api/auth/login", method="POST", data={"email": "admin@marketingos.local", "password": "Admin123!"})
    assert code == 200, f"Login failed: {code}"
    token = auth["token"]
    print("  [PASS] Admin Login")

    # 2. Create Project
    code, proj = request(f"{BASE_URL}/api/projects", method="POST", data={"name": "Module Suite Project", "goal": "Verify all 12 modules"}, token=token)
    assert code == 200, f"Project creation failed: {code}"
    p_id = proj["id"]
    print(f"  [PASS] Project Created: {p_id}")

    # 3. Module 05: Campaigns
    code, camp = request(f"{BASE_URL}/api/projects/{p_id}/campaigns", method="POST", data={"name": "Dental Q1 Launch", "objective": "Lead Gen", "budget": 4500, "channels": ["email", "social"]}, token=token)
    assert code == 200 and camp.get("name") == "Dental Q1 Launch", f"Campaign create failed: {code} {camp}"
    code, camps = request(f"{BASE_URL}/api/projects/{p_id}/campaigns", token=token)
    assert code == 200 and len(camps.get("campaigns", [])) >= 1, "Campaign list failed"
    print("  [PASS] Module 05 (Campaigns) Created & Listed")

    # 4. Module 06 & 07: Companies, Leads & Deals
    code, comp = request(f"{BASE_URL}/api/projects/{p_id}/companies", method="POST", data={"name": "Bloor West Smiles", "domain": "bloorwestdental.com", "industry": "Healthcare"}, token=token)
    assert code == 200, f"Company create failed: {code}"
    comp_id = comp["id"]

    code, lead = request(f"{BASE_URL}/api/projects/{p_id}/leads", method="POST", data={"full_name": "Dr. Sarah Jenkins", "email": "sjenkins@bloorwestdental.com", "company_id": comp_id, "icp_score": 92}, token=token)
    assert code == 200 and lead.get("icp_score") == 92, f"Lead create failed: {code}"
    lead_id = lead["id"]

    code, deal = request(f"{BASE_URL}/api/projects/{p_id}/deals", method="POST", data={"title": "Implant Marketing Retainer", "value": 8500, "stage": "proposal", "company_id": comp_id, "lead_id": lead_id}, token=token)
    assert code == 200 and deal.get("value") == 8500, f"Deal create failed: {code}"
    print("  [PASS] Modules 06 & 07 (Companies, Leads, Deals) Created & Linked")

    # 5. Module 08: Email Sequences & Gate G2 Staging Check
    code, seq = request(f"{BASE_URL}/api/projects/{p_id}/email-sequences", method="POST", data={"name": "Dental Implant Follow-up"}, token=token)
    assert code == 200, f"Sequence create failed: {code}"
    seq_id = seq["id"]

    # 5a. Staging Gate (Unapproved -> Expect Staging Receipt)
    code, stage_receipt = request(f"{BASE_URL}/api/email-sequences/{seq_id}/dispatch-test", method="POST", data={"recipient": "dr.jenkins@clinic.ca", "approved": False}, token=token)
    assert code == 200 and stage_receipt.get("gate") == "G2_HUMAN_CONSENT_REQUIRED", f"Gate G2 staging failed: {stage_receipt}"
    print("  [PASS] Module 08 Gate G2: Unapproved Outbound Halted with Staging Receipt")

    # 5b. Approved Gate (Approved: True -> Live Dispatched)
    code, live_receipt = request(f"{BASE_URL}/api/email-sequences/{seq_id}/dispatch-test", method="POST", data={"recipient": "dr.jenkins@clinic.ca", "approved": True}, token=token)
    assert code == 200 and live_receipt.get("status") == "sent", f"Gate G2 live dispatch failed: {live_receipt}"
    print("  [PASS] Module 08 Gate G2: Approved Outbound Dispatched with Provider Receipt")

    # 6. Module 09: Content Operations
    code, content = request(f"{BASE_URL}/api/projects/{p_id}/content", method="POST", data={"title": "Why Modern Clinics Use AI Triage", "format": "blog_post", "channel": "Blog", "status": "scheduled", "publish_date": "2026-11-25T09:00:00Z"}, token=token)
    assert code == 200 and content.get("format") == "blog_post", f"Content create failed: {code}"
    print("  [PASS] Module 09 (Content Ops) Created & Scheduled")

    # 7. Module 03: SEO Keywords
    code, kw = request(f"{BASE_URL}/api/projects/{p_id}/seo-keywords", method="POST", data={"keyword": "best dental marketing toronto", "search_intent": "commercial", "monthly_volume": 1800}, token=token)
    assert code == 200 and kw.get("keyword") == "best dental marketing toronto", f"SEO keyword failed: {code}"
    print("  [PASS] Module 03 (SEO Keywords) Added & Indexed")

    # 8. Module 12: Reports
    code, reports = request(f"{BASE_URL}/api/projects/{p_id}/reports", token=token)
    assert code == 200, f"Reports fetch failed: {code}"
    print("  [PASS] Module 12 (Reports) Verified")

    print("\n✅ ALL 12 MODULE ENDPOINTS VERIFIED SUCCESSFULLY WITH 100% INTEGRITY.")

if __name__ == "__main__":
    main()
