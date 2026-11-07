# Audit data format

Each audit lives in its own folder:

```
audits/<slug>/
  audit.json      all report content
  shots/          screenshots referenced by audit.json (jpg, png or webp)
```

Start a new one with `npm run new -- <slug>`. The template in `src/template-audit.json` shows every field.

## Highlights

Clients skim. Highlights make the important parts stand out, and the cover explains the color code. Wrap a phrase in a tag inside any text field:

| Tag | Color | Use for |
|---|---|---|
| `[risk:…]` | red | The problem, what is costing the client |
| `[fix:…]` | blue | The action to take |
| `[gain:…]` | green | An expected result or upside |
| `[key:…]` | yellow | A number or detail they must notice |
| `[mute:…]` | grey text | Only in `title`, for the muted second clause |

Rules:
- Highlight the decisive phrase, not the whole sentence. Aim for one highlight per bullet at most.
- In `found`, use mostly `risk` and `key`. In `recommendations`, use `fix`.
- A phrase cannot contain `]`.
- Some colors are added automatically, so don't tag these yourself: expected impact numbers and the impact table's "Expected change" column are always green, and severity colors come from `severity`.

## Fields

Top level:
- `exportName`: the file name used for export, without an extension. Example: `NortheastArc-UX-Audit-Report`.
- `agency`: `{ name, initial }`.
- `reportType`, `date`, `auditKind`, `site`: the text shown on the cover.
- `title`: the cover headline. Use `[mute:…]` for the second clause.
- `lede`: one or two sentences under the headline.
- `score`: `{ overall, areas: [{ label, score }] }`, with scores from 0 to 100. Scores under 50 show red, 50 to 69 amber, and 70 or more green.
- `meta`: `[{ label, value }]`. Four items fit one row.
- `footer`: the footer text.

Sections. Each section has a `heading` and an optional `intro`. Leave a section out to hide it; the remaining sections renumber automatically.
- `summary`: `kpis: [{ value, label, tone }]`, where `tone` is `critical`, `high`, `medium` or `gain`. Also `takeaways: [{ label, text }]`; three fit one row.
- `strengths`: `items: [{ title, text }]`. Use multiples of 3.
- `findings`: `items` is a list of findings. Order them by business impact. Each finding has:
  - `id`: `"01"`, `"02"` and so on. Anchors and impact rows refer to it.
  - `severity`: `critical`, `high`, `medium` or `low`.
  - `area`, `effort` (`S`, `M` or `L`) and `title`.
  - `layout`: `wide` (screenshots above the text) or `side` (phones beside the text). When left out, `side` is used if every shot is mobile.
  - `shots`: a list of shots, each `{ device: desktop|mobile, url, src, alt, caption, width, height, marks }`.
    - `marks`: `[{ n, x, y, w, h, pin }]`. `x`, `y`, `w` and `h` are percentages of the image. `pin` is the corner holding the number: `tl`, `tr`, `bl` or `br`.
  - `why`: one sentence on the business cost.
  - `found`: the evidence, as a list of short bullets.
  - `recommendations`: what to change, as bullets.
  - `impact`: `[{ value, label }]`.
- `impact`:
  - `rows: [{ metric, finding, change, measure }]`, where `finding` is one finding `id` ("01") or several separated by commas ("02, 03").
  - `scenario`: optional. `{ before, after, note }`, where `before` and `after` are each `{ label, headline, rows: [[label, value]] }`.
- `roadmap`: `phases: [{ when, title, items: [text] }]`. Item numbers are added automatically across phases.
- `method`: `blocks: [{ title, items: [text] }]`.

## Screenshots

- Save captures to `audits/<slug>/shots/` and name them `f<findingId>-<n>.jpg`.
- Desktop shots work best at 800px wide.
- Mobile shots work best at a 375×812 ratio.
- Measure marks as percentages of the image, so the marks still line up at any display size.

Run `npm run check` to validate the data before exporting. The dashboard shows the same checks.
