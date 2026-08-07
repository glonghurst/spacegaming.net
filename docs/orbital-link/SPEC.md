# ORBITAL LINK — window two of spacegaming.net

**Status:** SPEC — approved for structured-only v1 by Gavin, 2026-08-06 (no uploads in v1).
**Home:** window two of the lounge (`index.html`, `#win2`), next along from Falcon Slam.
**Ledger:** TO DO NEXT items `sgn20260806*` (Hub, project `spacegaming-net`).
**Drafted:** Claude session `GAVBEGIN-1bcea4ca343ceffe`, from Gavin's 2026-08-06 brief plus two
research passes (outage-site submission UX; data pipeline / anti-abuse / multilingual).

## 1. What it is

A one-click advice portal for videogamers on satellite internet — **Starlink, Amazon Leo,
and the EU entrant (IRIS²)** — carrying live service status and localized telemetry,
deals, and a consumer feedback wall whose parsed, aggregated output becomes a shapable
dataset for providers. Free wall and charts in public; granular shaped feedback is the
commercial feed. This is the Downdetector Explorer model applied to a vertical nobody
covers: **no site today crosses provider × game × platform**, and neither Amazon Leo nor
IRIS² has any community status tracker at all — that index position is currently vacant.

## 2. Page anatomy

1. **Core telemetry dashboard** — bars, graphs, highlighted lists per provider: uptime,
   latency, throughput, outage history, gamer-relevant cuts (jitter and packet loss vs
   the netcode needs of the top shooters).
2. **News banner** — major outages and service announcements scraped from vendor sources.
3. **Local coordinate system** — browser geolocation (permission-based, coarse) adjusts
   the upfront telemetry to the visitor's region; degrades to a region picker.
4. **Affiliate corner** — one contained corner: satellite gaming services, kits, apparel, VPNs.
5. **Donation underlay** — site maintenance support.
6. **Feedback portal + sentiment wall** — see §3. The centrepiece.
7. **Data product surface** — `/data/v1/` (§6).

## 3. The submission — super simple, structured only

Three taps and done, anonymous, no account (the pattern every outage site converges on):

    provider (X) → game (Y) → platform (Z) → criterion chip
    [+ optional short free text]  [geo: coarse, automatic]

- **Provider pre-selected by page context** where possible (universal best practice —
  Downdetector, Outage.Report, IsTheServiceDown). The picker is for the rest of the chain.
- **Per-vertical criterion vocabulary**, satellite-gamer specific: latency, jitter,
  packet loss, disconnects, throughput cap, CGNAT/NAT type, total outage, billing —
  not the generic ISP chips Downdetector shows on its Starlink page.
- **Instant gratification loop**: submitting updates the visible breakdown and chart
  immediately. The report is its own reward.
- **Every dimension is a controlled vocabulary** in one versioned `vocab.json` shared by
  the form, the validator, and the publisher. This is simultaneously the i18n layer
  (chip labels are lookup keys) and the cheapest spam filter (out-of-enum = instant reject).
- **No uploads in v1** — explicit scope decision. Screen-capture evidence is a v2 lane
  behind its own ingress-pattern decision. A telemetry-backed instrumented tier
  (starlinkstatus.space's client-script model) is a credibility leapfrog for later, noting
  its lesson: instrumentation collapses participation ~4 orders of magnitude vs one tap.

## 4. Aggregation and honesty rules

- **Never publish raw counts as an outage.** Industry standard is reports-vs-historical-
  baseline (per service, time-of-day, location). v1 starts with Outage.Report's simple
  30-day rolling baseline and **draws the baseline line on the public 24h chart**
  (IsTheServiceDown's transparency touch — the chart doubles as methodology disclosure).
- **Surge shaping**: per (provider × criterion × geo) cell, an EWMA volume baseline; a
  cell far above baseline publishes with `surge:true` and capped weight in sentiment
  means. A real outage still shows (the spike is the signal, honestly labelled); a
  brigading campaign cannot drag a provider's monthly score beyond the cap.
- **Small-cell suppression**: cells with n<3 are suppressed in public aggregates —
  statistical honesty, and no reverse-engineering individual reports from tiny cells.
- **Signal fusion (v1.5)**: cross-check chip reports against scraped official status
  feeds — StatusGator beat Shopify's own acknowledgment by 16 minutes with this.

## 5. Architecture (all existing estate patterns; composition, not invention)

    public form → Funnel-fronted gateway → JSONL journal → SQLite (system of record)
      → gemma3:12b moderation/translation/topics (5-min timer)
      → publisher (15–30 min, delta only) emits /data/v1/ JSON+CSV → push to this repo
      → monthly Parquet + sha256 sidecar → NAS archive

- **Store**: JSONL ingest journal (crash-proof raw capture, MAW-ledger pattern) →
  **SQLite WAL** as the append-only canonical store (append-only enforced by triggers;
  moderation verdicts in a separate append-only table — full provenance of what the
  model said and when) → **DuckDB attaches SQLite + Parquet** as the query engine.
  Keep raw forever: even at 1,000 reports/day a decade fits in RAM. Rollups are
  published views and accelerators, never retention. Junk/held is the one thing that
  deletes (90 days).
- **Schema tuple**: `(id ULID, ts UTC, provider, game, platform, geo_coarse ≤ country+
  region, criterion, sentiment −2..+2, lang, text_orig, text_en, meta)` + child
  `report_topics` table. Geo never finer than first-level region — enforced at the
  validator; caps GDPR exposure by construction.
- **Ingress**: Caddy on localhost as the HTTPS terminator behind **Tailscale Funnel in
  TCP-forward + PROXY-protocol mode** (plain Funnel proxying hides the client IP —
  tailscale/tailscale#12972 — and without the IP there is no per-IP rate limiting).
  **Runtime/network mutation: needs explicit operator approval at build time.**
- **Anti-abuse, layered, PII-free** (each layer strictly reduces what reaches the next):
  L0 gateway rate limits + global daily circuit-breaker cap; L1 honeypot field,
  minimum-time check, **ALTCHA** self-hosted proof-of-work (MIT, no third parties, no
  cookies); L2 enum whitelist + normalized-hash dedup + per-tuple caps; L3
  `HMAC(daily-rotating-key, ip)` — never raw IPs — plus local GeoLite2 **ASN scoring**
  (score, don't block: satellite gamers are disproportionately VPN/CGNAT users);
  L4 the surge shaping of §4; L5 the LLM junk classifier (`ok / gibberish / off-topic /
  ad-spam / abuse / astroturf`), whose verdict gates publication only — the raw record
  always lands first. Submission text is untrusted data in the prompt; instruction-like
  content in it is itself a junk signal.
- **Multilingual**: dimensions are language-neutral by construction; only free text needs
  handling. Detection: **lingua-py** primary + fastText `lid.176.ftz` cross-check
  (disagreement = junk signal). One gemma3:12b call per report returns translation to
  the English pivot + moderation + topics + sentiment-check as strict JSON. Original
  text is ground truth and never overwritten; translation is derived, re-generatable,
  version-stamped. When the model's sentiment read and the user's chip disagree, the
  chip wins and the disagreement is logged. UI localization = translating ~40 vocab
  strings per language, once; UI language from `navigator.language`, never from IP.

## 6. The data product

    /data/v1/  index.json  schema.json  vocab.json
               wall/latest.json           agg/daily/latest.json  agg/daily/<year>.json
               agg/hourly/latest.json     exports/daily_agg.csv  exports/reports.jsonl
               datapackage.json

- Static tree designed as an API: stable versioned URLs (breaking change ⇒ `/data/v2/`
  alongside), every payload self-describing (`schema_version`, `generated_at`,
  `row_count`, `license`), `latest.json` + immutable dated snapshots, JSONL for bulk,
  **CSV for the daily aggregate** (the artifact a vendor's analyst drags into Excel),
  Frictionless `datapackage.json`. GitHub Pages gives ETag/Last-Modified and CORS free;
  its fixed `max-age=600` matches the publish cadence.
- **Licensing split**: public aggregates **CC BY 4.0** (attribution is marketing);
  raw per-report data, free text, and sub-daily granularity withheld — that margin is
  the paid feed, and it is also exactly where the privacy risk lives.
- **State the deal in the submission UI from day one** — "aggregates are public forever
  under an open license; providers pay for detailed analysis." The ADS-B Exchange
  backlash came from terms changing under contributors, not from monetization existing.
- Monetization ladder observed in the wild: ads → being the number journalists quote →
  enterprise feed (Downdetector Explorer ≈ $2k/mo; StatusGator B2B). Nobody gives away
  a public API; the enterprise feed is the moat.

## 7. Build order (v1)

1. `vocab.json` + submission JSON Schema — everything keys off it.
2. Caddy gateway behind Funnel (TCP-forward + PROXY protocol) with L0/L1 — **the one
   runtime/network mutation; separate explicit approval required.**
3. Queue worker: journal append + sidecar → validate/dedup/caps → SQLite.
4. Moderation worker timer (gemma3:12b, one call per report).
5. Publisher timer → `/data/v1/` → batch push. 6. Monthly Parquet archival timer.
7. Surge shaping ships a week post-launch (needs a baseline to exist).
8. W2 page itself: dashboard, wall, banner, corners; wake `#win2` in `index.html`.
- **Every timer gets a TEST UNITS smoke test in the same pass** (mandatory rule).
- Deferred by decision, not gap: simhash near-dup, dynamic PoW difficulty, IP
  reputation feeds, accounts, uploads/evidence lane, instrumented telemetry tier.

## 8. Operator decisions — all four answered by Gavin, 2026-08-06

1. **Ingress: PRE-APPROVED.** The build session may make §5's Funnel/Caddy change
   (TCP-forward + PROXY protocol, Caddy on localhost) without a second approval stop.
   Reversible via funnel off + service stop. Also recorded on `sgn20260806ingress`.
2. **Money corners: placeholders in v1.** Both corners ship as styled slots with house
   content; real affiliate programs and the donation rail are enrolled later at Gavin's
   pace and swap in as content changes, never build changes.
3. **Name: ORBITAL LINK ships.** On the glass (W2 hologram label), page title,
   `/data/v1/` branding, vocab file — not a working title.
4. **Providers: all three lanes, honest labels.** Starlink live; Amazon Leo
   "limited service — tracking begins now"; IRIS² "pre-service — watching".
   Claims the vacant index positions (§1) while the labels keep empty charts from
   reading as a dead site.
