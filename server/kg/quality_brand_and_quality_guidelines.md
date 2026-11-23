# VALIOZ — Brand, Quality & Deliverable Contract

## 21. Brand & Voice
- **Mission:** Better care deserves to be found.
- **Colors:** Teal Accent #00a9a4 · Deep Navy #122f47 · Card Mint #f1f8f7.
- **Voice:** High-integrity, evidence-grounded, empathetic. No fluff, no hype, no fabricated metrics.
- **Logo:** side-by-side lockup: [VALIOZ Health] × [Partner Clinic Logo].

## 22. Quality Gates (applied to every deliverable)
1. **Verified data** — every number traces to a harness file, live tool, or KB article.
2. **Humanized language** — `humanizer` score >= 75, no banned AI vocabulary.
3. **No false status** — never show `Connected`/`Online`/`Active` without a verified ping.
4. **Required sections** — every deliverable has: executive summary, evidence, actions, **Verdict: Ready to Deliver**.
5. **Citations** — a KB/tool/harness source for every claim.

## 23. Deliverables & Artifacts Contract
- **The deliverable is the artifact.** A delivered landing page, research report, email sequence, or WhatsApp card is stored as a versioned artifact under `uploads/artifacts/<task_id>/<artifact_id>.<ext>`, with metadata (task id, project, pipeline, author, timestamp).
- **Download contract:** every client-facing deliverable has a documented download path and a `**Deliverable:**` heading in the report md.
- **Sign-off:** deliverables with external effect (`email_send`, `ad_launch`, `social_publish`, `website_deploy`, `deliverable_signoff`) require human approval before release.

## 24. Review Cadence
- Sales reviews deliverables with the `master-reporting-agent` (Stage 4 verify) before anything reaches a client.
- Anything needing correction goes back with the `**Verdict:** needs_fix` note and the specific rule that failed.
