# Pipeline: email-campaign (High-Yield Email Outreach & Nurture)
- **Assigned Squad:** @coordinator, @browser-researcher, @master-reporting-agent
- **Standardized Input:**
  - Audience segment & conversion objective
  - Sequence length & sending cadence
  - Harness files & compliance disclosures (Gate G2)
- **Standardized Output:**
  ```json
  {
    "deliverable": {
      "type": "sequence",
      "title": "Outbound Cold Outreach & Nurture Sequence",
      "summary": "Multi-step high-deliverability email campaign with personalized variables and pain-point hooks.",
      "sequence_steps": [
        { "step": 1, "day": 1, "subject": "...", "body": "...", "cta": "..." },
        { "step": 2, "day": 3, "subject": "...", "body": "...", "cta": "..." }
      ],
      "metadata": { "pipeline": "email-campaign", "provider": "active", "model": "active" }
    },
    "report_md": "# Admin Report: Email Outreach Sequence\n\n**Verdict:** Ready to Deliver\n- Grounded: Yes\n- Usable: Yes\n- Sellable: Yes\n..."
  }
  ```
