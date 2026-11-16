# Pipeline: content-seo (Content Operations + SEO Intelligence)
- **Assigned Squad:** @coordinator, @browser-researcher, @software-engineer, @master-reporting-agent
- **Standardized Input:**
  - Topic / Keyword cluster
  - Target search intent & geography
  - Project harness files & guidelines
- **Standardized Output:**
  ```json
  {
    "deliverable": {
      "type": "article",
      "title": "Article Title",
      "summary": "High-intent SEO article optimized for target keyword clusters.",
      "content": "# Full SEO Markdown Body\n...",
      "sections": ["H1", "H2 Strategy", "H2 Implementation", "FAQ"],
      "metadata": { "pipeline": "content-seo", "word_count": 1200, "provider": "active", "model": "active" }
    },
    "report_md": "# Admin Report: Article Title\n\n**Verdict:** Ready to Deliver\n- Grounded: Yes\n- Usable: Yes\n- Sellable: Yes\n..."
  }
  ```
