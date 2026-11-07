# Audit Studio

This app holds Cognixlab's UX audit reports. Each audit is a data file plus a folder of screenshots. The app renders every audit in the same design and exports a self-contained HTML file and a PDF for the client.

You need Node 18 or later and Chrome or Edge, which prints the PDFs. The app has no npm dependencies, so there is nothing to install.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Opens the dashboard at http://localhost:4710, with a live preview that reloads when you edit an audit. Use `PORT=<n> npm run dev` if 4710 is taken |
| `npm run new -- <slug>` | Creates `audits/<slug>/audit.json` from the template |
| `npm run check` | Validates every audit: required fields, screenshots, marks and highlight tags |
| `npm run export -- <slug>` | Writes `exports/<slug>/<exportName>.html` and `.pdf` |
| `npm run export -- --all` | Exports every audit |

On the dashboard, each audit's **Download PDF** button downloads the PDF. It rebuilds the PDF first only when the audit data or the templates changed since the last export. The status column shows "PDF ready" or "Changed since export".

If Chrome or Edge is installed somewhere unusual, set `CHROME_PATH` to the browser's executable.

## Layout

```
audits/<slug>/audit.json   report content (see AUDIT-FORMAT.md)
audits/<slug>/shots/       screenshots
exports/<slug>/            finished HTML + PDF to send to the client
src/render.js              report and dashboard templates
src/styles/                tokens.css (colors, highlights, severity), report.css, dashboard.css
src/fonts/                 Inter, Bricolage Grotesque, IBM Plex Mono (embedded on export)
```

Exported HTML files are fully self-contained: fonts and screenshots are embedded, so you can email the file or upload it anywhere.

## Navigation

The HTML report has:
- A sticky top bar with a link to each section. The current section is highlighted, and a thin line shows reading progress.
- A findings menu in the bar, available from anywhere in the report. It lists every finding with its severity and marks the one you are reading. Open it by clicking it or pressing `f`; close it with `Esc`.
- Previous and next buttons beside the menu. The `j` and `k` keys do the same.
- A floating **↑ Top** button, which appears once you have scrolled one screen down.
- In the dev preview only, a **← Audits** button that returns to the dashboard. Exported files leave it out, because the client has no dashboard.
- Filter buttons above the findings index that narrow the list by severity.
- Previous, Next and All findings links at the end of each finding.

The PDF has a bookmark outline: sections, every finding and the roadmap phases. Print hides the navigation controls.

## Design

- The design direction is Clean Conversion: a light page, dark ink text and hairline structure.
- Color carries meaning, and the cover explains the color code to the client:
  - **Red** marks a problem.
  - **Blue** marks an action.
  - **Green** marks an expected gain.
  - **Yellow** marks a key fact.
- Severity uses a 4-pip meter: Critical is red, High orange, Medium amber and Low grey.
- Critical and High findings also get a colored top rule.
- Orange is reserved for the problem boxes on screenshots.
- All text colors pass WCAG AA contrast. The tokens are in `src/styles/tokens.css`.
