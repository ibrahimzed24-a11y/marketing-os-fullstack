# Pipeline: lead-research (B2B Lead Research & Scoring)
- **Assigned Squad:** @coordinator, @browser-researcher, @master-reporting-agent
- **Standardized Input:**
  - Target account profile / Geography
  - Role titles & industry criteria
  - Ingested harness briefs
- **Standardized Output:**
  ```json
  {
    "deliverable": {
      "type": "lead_intelligence",
      "title": "Lead Research Dossier",
      "summary": "Enriched prospect target list with verified decision makers and ICP scoring.",
      "total_identified": 25,
      "leads": [
        { "company": "...", "contact": "...", "role": "...", "location": "...", "icp_score": 92 }
      ],
      "metadata": { "pipeline": "lead-research", "provider": "active", "model": "active" }
    },
    "report_md": "# Admin Report: Lead Research Dossier\n\n**Verdict:** Ready to Deliver\n- Grounded: Yes\n- Usable: Yes\n- Sellable: Yes\n..."
  }
  ```
