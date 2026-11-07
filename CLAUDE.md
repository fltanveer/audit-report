# Audit Studio

This app renders UX audit reports from data. To write a new audit:

1. Run `npm run new -- <slug>`.
2. Fill in `audits/<slug>/audit.json` and save screenshots to `audits/<slug>/shots/`.
3. Run `npm run check`.
4. Run `npm run export -- <slug>`.

Rules:
- Follow `AUDIT-FORMAT.md` for fields and highlight tags (`[risk:]`, `[fix:]`, `[gain:]`, `[key:]`). Highlight the decisive phrase only, with at most one highlight per bullet.
- Never invent data. Impact ranges are estimates and must be labelled as such, and the illustrative scenario must say that its traffic is assumed.
- Put content changes in `audit.json`. Change the shared design in `src/render.js` and `src/styles/` only, because every audit uses that design.
- Before sending an export to a client, render it and look at it. The export is in `exports/<slug>/`.
