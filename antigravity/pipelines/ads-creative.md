# Pipeline: ads-creative (High-Conversion Paid Advertising Suite)
- **Assigned Squad:** @coordinator, @software-engineer, @master-reporting-agent
- **Standardized Input:**
  - Product offer & target ad platforms (Meta, Google Search, LinkedIn Ads)
  - Target CPA / Budget parameters
  - Brand harness guidelines
- **Standardized Output:**
  ```json
  {
    "deliverable": {
      "type": "ad_suite",
      "title": "Paid Ads Creative Suite",
      "summary": "Multi-variant ad copy, hooks, display headlines, and high-CTR CTA variants.",
      "platforms": ["Meta Ads", "Google Search", "LinkedIn Ads"],
      "variants": [
        { "platform": "Meta", "angle": "Pain-Point", "primary_text": "...", "headline": "...", "cta": "Learn More" },
        { "platform": "Google", "intent": "High-Intent Search", "headlines": [], "descriptions": [] }
      ],
      "metadata": { "pipeline": "ads-creative", "provider": "active", "model": "active" }
    },
    "report_md": "# Admin Report: Paid Ads Creative Suite\n\n**Verdict:** Ready to Deliver\n- Grounded: Yes\n- Usable: Yes\n- Sellable: Yes\n..."
  }
  ```
