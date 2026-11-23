# VALIOZ — Browser Research & External Tools

## 17. When to use a real browser (browsing agent)
- Verifying a clinic's live Google Business Profile / website / review page.
- Forensic SERP/pricing/table scraping that the 5 API tools cannot reach (logged-out pages, behind-sign-in research, structured tables).
- Any "walk the client's live site" deliverable that must be grounded in a live URL, not a guess.

## 18. The browsing agent's capabilities
| Capability | What it does | Output artifact |
|---|---|---|
| `browser_navigate` | Open a URL in headless Chromium, record navigation trail, capture page content + DOM + screenshot | `browse_<task>_<n>.json` + `browse_<task>_<n>.txt` |
| `dom_extract` | Export the page's HTML/ARIA tree, ARIA role list, and heading outline | DOM report |
| `serp_forensic` | Capture search results (title, link, snippet, position) for a query set | SERP report |
| `pricing_table_scrape` | Extract pricing/features tables from publishable pages | pricing table |
| `tool_ping` | Live HTTP verification of the 5 assigned tools (GSC/GKP/GTM/Ahrefs/GEO) with latency | tool ping log |
| `page_screenshot` | Saved visual record (SSV/clip) for the deliverable | image asset |

## 19. Grounding rules (browsing agent)
- **No hallucinated live data.** Every quoted number must trace to the captured page snapshot or the tool response.
- **Do not scrape paywalled/signed-in-only content** without the operator's written credentials — log the access and flag it in the report.
- Record the **navigation trail** (URL + account + action + timestamp) in the report so the human can re-open the same session.

## 20. Anti-Slop for research
- Write the report with the `humanizer` + `context-engineering` skills: concrete, cite sources, no filler.
- Every deliverable ends with `**Verdict:** Ready to Deliver` and the KB citations it used.
