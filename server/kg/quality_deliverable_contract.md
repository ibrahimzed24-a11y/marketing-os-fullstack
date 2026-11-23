# VALIOZ — Deliverables & Artifacts Contract

## 25. The Deliverable Is the Artifact
- Every client-facing deliverable is stored as a versioned artifact in `uploads/artifacts/<task_id>/<artifact_id>.<ext>`.
- Artifacts are created at Stage 5 (report) and are downloadable via the project deliverable/artifacts panel.
- Artifact metadata: task id, project, pipeline, agent, author, timestamp, source (output_json/report_md/harness).

## 26. Delivery Checklist
- [ ] Output JSON present and machine-ready (no placeholders, no `TODO`, no `{{...}}` left behind).
- [ ] Report md present, ending with `**Verdict:** Ready to Deliver`.
- [ ] Artifacts uploaded + download link published in the project deliverable panel.
- [ ] External actions (`email_send`, `ad_launch`, `social_publish`, `website_deploy`) gated behind `deliverable_signoff`.

## 27. What "Access a Knowledge Base to Act Upon" Means
- Agents do not write from memory: before drafting any deliverable they `searchChunks` the KB (helm global + this project + this task), and the report lists the KB sources used `[KB]`.
- Sales calls and research are grounded in the KB articles the agent found: ICP, offers, research playbook, verification rules, deliverable contract.
- When the KB lacks an answer, the agent flags the gap explicitly rather than extrapolating, and records the open question in the task.
