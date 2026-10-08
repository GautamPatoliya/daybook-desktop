# Daybook 2.0 - Implementation Suite

**Codename:** Daybook 2.0  
**Baseline shipping version:** 1.1.1  
**Target major line:** 2.0.x (phases may ship as 1.2 → 1.6 or jump to 2.0.0 - version numbers are decided at release time; **phase order is fixed**)

This folder is the **source of truth** for building Daybook 2.0.  
Any developer or AI agent implementing work **must** follow these docs. Do **not** invent requirements, skip acceptance tests, or “improve” scope without updating the matching phase doc first.

---

## Documents in this suite

| File | Purpose |
|------|---------|
| [00-VISION.md](./00-VISION.md) | Product thesis, constraints, success criteria |
| [01-GLOBAL-RULES.md](./01-GLOBAL-RULES.md) | Cross-phase rules (compat, themes, time, QA gates) |
| [PHASE-01-CAPTURE-EMAIL-UX.md](./PHASE-01-CAPTURE-EMAIL-UX.md) | Editor, email handoff, 12h time, layout, categories, Default UX |
| [PHASE-02-UPDATES.md](./PHASE-02-UPDATES.md) | Start popup, Windows Cursor-like install, Mac assisted update |
Related (existing):

- [../PROJECT_OVERVIEW.md](../PROJECT_OVERVIEW.md) - current product overview (v1.x)  
- [../VERSION_MANAGEMENT.md](../VERSION_MANAGEMENT.md) - tagging / releases  
- [../PILOT.md](../PILOT.md) - office rollout  

---

## Phase order (mandatory)

```
Phase 1 → Phase 2
```

**Do not** start Phase N+1 until Phase N acceptance checklist is fully green, unless the phase doc explicitly lists an allowed parallel track.

**Why this order:**

1. Capture + email = daily value and less data-model thrash  
2. Updates = distribution trust before larger installs  

---

## How to implement a phase (required process)

1. Read **01-GLOBAL-RULES.md** fully.  
2. Read the **entire** target `PHASE-0X-*.md` end-to-end before coding.  
3. Implement only items in **In scope**.  
4. Never implement **Out of scope** items “while you’re there.”  
5. Run every item in **Acceptance checklist**.  
6. Run **Regression checklist** (must not break v1.1.1 core loops).  
7. Update `CHANGELOG.md` with user-facing bullets only.  
8. If a requirement is ambiguous: **stop** and ask - do not invent.

---

## Anti-hallucination rules for AI / developers

| Forbidden | Required instead |
|-----------|------------------|
| Inventing new IPC channels not listed | Use names in the phase doc; if missing, ask |
| Changing `Task` / `AppSettings` fields ad hoc | Follow **Data model** section exactly |
| Removing Spider-Verse to “simplify” | Both themes must keep working |
| Using 24h time in UI “temporarily” | Indian 12h always (see Global Rules) |
| Keeping bullets UI “as fallback” | Phase 1 removes bullets UI completely |
| Shipping Mac auto-update as if signed | Follow Phase 2 Mac honesty rules |
| Skipping migration for old `tasks.json` | Follow each phase **Migration** section |

---

## Definition of done (every phase)

A phase is done only when:

- [ ] All **In scope** items implemented  
- [ ] All **Acceptance checklist** items pass on Windows  
- [ ] Critical flows verified on macOS where noted  
- [ ] Default **and** Spider-Verse themes checked for that phase’s UI  
- [ ] No new TypeScript build errors (`npm run build`)  
- [ ] CHANGELOG updated  
- [ ] No silent data loss for existing user folders under `userData`

---

*Daybook 2.0 - do not deviate from phase specs without updating this suite first.*
