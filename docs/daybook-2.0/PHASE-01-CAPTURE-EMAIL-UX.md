# Daybook 2.0 - Phase 1: Capture, Email, Time, Layout, Categories, Default UX

**Phase ID:** `P1`  
**Suggested version label:** `1.2.0` or `2.0.0-alpha` (release manager decides)  
**Depends on:** nothing (first phase)  
**Blocks:** Phase 2

---

## 1. Purpose

Make daily logging **comfortable** and EOD email **low-friction**, while fixing time format, layout breakage from long URLs, category management, and Default theme polish.

**User outcome after Phase 1:**

> I open New Task → write freely in a large editor → save. At EOD I open email, Copy is in the header, Open Gmail puts my styled update into compose with almost no manual work. Categories are manageable. Times look like `9:15 AM`. Long Drive links don’t break the UI. Default theme feels professional.

---

## 2. In scope (exact)

1. Replace New Task / Edit Task **bullets UI** with a **single rich text editor** in a larger dialog.  
2. Persist editor content safely with **backward-compatible** day JSON.  
3. Remove status **emojis** from email body bullets; title-level status only.  
4. Relocate email draft **Copy** (and primary actions) to **panel header**.  
5. Improve **Open Gmail** so styled HTML lands in compose (see §8).  
6. **Indian 12h** time display everywhere user-facing (Global Rules).  
7. **Layout resilience** for long URLs / rich content (cards, drawers, email preview).  
8. **Category manager**: add, rename, delete (with reassign), reorder, default category.  
9. **Default theme** UX enhancement pass on surfaces touched by this phase + shared chrome.

---

## 3. Out of scope (do not implement in P1)

- Updater popup / quitAndInstall changes (Phase 2)  
- Changing Spider-Verse art direction  
- Cloud sync  

---

## 4. Current state (facts - do not assume otherwise)

| Item | Current reality |
|------|-----------------|
| New Task UI | `renderer/app/page.tsx` - composer with `composerSubItems: string[]`, line bullets, Enter adds lines |
| Edit drawer | Same file - `drawerSubItems` |
| Task shape | `shared/types.ts` - `title`, `subItems: SubItem[]` (`text`, optional `enhanced`) |
| Email | `shared/email.ts` - builds from tasks; uses `statusSuffix` / `statusSuffixHtml` with ✅ / ⏳ |
| Open Gmail | `electron/ipc/handlers.ts` `email:open` - writes clipboard HTML+text, `shell.openExternal(gmailUrl)` - **user must paste** |
| Copy email | Renderer calls clipboard IPC; button placement in drawer body (not header) |
| Categories | `AppSettings.categories: string[]` edited via Settings textarea (`settings/page.tsx` Projects tab) |
| Time | Mixed; some `HH:mm` display |
| Themes | `default` + `spider-verse` |

---

## 5. Data model changes

### 5.1 `Task` (`shared/types.ts`)

Add:

```ts
/** TipTap (or equivalent) HTML for task details. Empty string if none. */
detailsHtml?: string;
```

**Keep** `subItems: SubItem[]` for:

- Old days that never had `detailsHtml`  
- Email builder Phase 1 (still consumes structured list)  
- Card preview snippets  

### 5.2 Sync rules on every create/update task save

When saving from the editor:

1. Set `detailsHtml` = editor HTML (sanitized - see §6.3).  
2. Derive `subItems` from editor for email/card compatibility:

**Derivation algorithm (mandatory):**

```
Input: detailsHtml
1. Parse HTML in a deterministic way (DOMParser in renderer OR cheerio/linkedom in main - pick ONE place: prefer derive in renderer before IPC payload, send both detailsHtml + subItems).
2. Extract block-level items in order:
   - Each <li> → one subItem.text (plain text, trimmed)
   - Each <p> that is not empty → one subItem.text
   - Ignore empty blocks
3. If zero blocks but there is non-empty plain text → single subItem with that text
4. Preserve existing subItem.enhanced only if corresponding text unchanged; otherwise clear enhanced for changed/new lines
5. subItems = derived array (may be empty if editor empty)
```

**Example A - user types paragraphs**

Editor HTML:

```html
<p>Fixed login redirect on staging</p>
<p>Verified OTP flow with QA</p>
```

Derived:

```json
"subItems": [
  { "text": "Fixed login redirect on staging" },
  { "text": "Verified OTP flow with QA" }
]
```

**Example B - user uses bullet list**

```html
<ul><li>Patched timeout</li><li>Added logging</li></ul>
```

→ two subItems as above.

**Example C - empty editor**

`detailsHtml = ""` or `<p></p>` → `subItems = []`. Title-only task is valid.

### 5.3 Load rules (edit existing task)

```
if detailsHtml is non-empty string:
  load editor from detailsHtml
else if subItems.length > 0:
  build HTML: <ul> + <li>escape(text)</li> for each subItem
  load that into editor
else:
  empty editor
```

### 5.4 `AppSettings` additions

```ts
/** Must exist in `categories`. Used as New Task default. */
defaultCategory: string;
```

**Migration on `readSettings`:**

```
if defaultCategory missing OR not in categories:
  defaultCategory = categories.includes('Other') ? 'Other' : categories[0]
write back only if you already write settings for other migrations; else fix on next settings save - preferred: normalize in readSettings without write, apply write when settings saved OR one-time migrate flag.
```

Prefer **normalize in `readSettings`** and persist when settings are next saved; optional immediate write is OK if idempotent.

### 5.5 Categories array

Remain `string[]` but **order is significant** (dropdown order = array order).

---

## 6. Composer / Edit UI specification

### 6.1 Dialog size

- New Task modal: min width **560px**, preferred **640px**, max **90vw**.  
- Min height body area **360px**; editor area min **220px** growing with dialog.  
- Edit drawer: widen content column similarly; editor min height **220px**.  
- Must fit 1366×768 laptop without clipping primary buttons (scroll body if needed; footer sticky).

### 6.2 Fields (exact order)

1. Project (Select) + affordance to add project (existing)  
2. Category (Select) - options from `settings.categories` **in array order**  
3. Status (Select)  
4. Priority (Select)  
5. Task title (text input) - required  
6. **Details editor** (full width) - label: `Details`  
7. Footer: Cancel · Save / Add Task  

**Remove completely:**

- “Add line (Enter)” bullet UI  
- Per-line bullet inputs  
- Any tip that says “switch to advanced editor”

### 6.3 Editor library

**Choice:** TipTap (ProseMirror) in renderer.

**Allowed extensions (whitelist):**

- Document, Paragraph, Text, HardBreak  
- Bold, Italic  
- BulletList, OrderedList, ListItem  
- Link (must have `https?://` or force https)  
- History (undo/redo)  

**Disallowed:** images, tables, YouTube, raw HTML paste of scripts, mention chips.

**Paste handling:**

- Strip unknown tags on paste.  
- Plain text paste → paragraphs split on blank lines; single newlines → hard break or spaces (pick TipTap default but sanitize).  

**Sanitize before save:**

- Allowlist tags: `p, br, strong, em, b, i, ul, ol, li, a`  
- `a` only `href` starting with `http://` or `https://`  
- Strip `style`, `onclick`, `script`, `iframe`

### 6.4 Defaults when opening New Task

- Project = `settings.defaultProject`  
- Category = `settings.defaultCategory`  
- Status = `wip`  
- Priority = `medium`  
- Title = empty  
- Editor = empty  

### 6.5 Card preview

- Show title.  
- Show up to 3 plain-text lines from `subItems` (derived), same as today.  
- Long lines: CSS wrap / ellipsis per §9.

---

## 7. Email content rules (Phase 1)

### 7.1 Remove emoji status suffixes

In `shared/email.ts`:

- Delete or empty `statusSuffix` / `statusSuffixHtml` emoji behavior.  
- Optional **text** title treatment: append ` (Done)` or ` (In progress)` in plain language **only on the task title line**, not on nested bullets.  
- Spec:  
  - `done` → title shown as `{title} (Done)`  
  - `wip` → `{title} (In progress)`  
  - `none` / backlog → title only (no suffix), and backlog still excluded from email unless `includeBacklogInEmail`.

### 7.2 Body still built from `subItems` in Phase 1

Do not invent AI sections yet. Nested bullets from derived `subItems` remain.

### 7.3 Long URLs in email HTML

Wrap text nodes / link text with styles:

```css
word-break: break-word;
overflow-wrap: anywhere;
```

on the email root `div` and on `<a>` / `<li>`.

---

## 8. Email panel UX + Open Gmail

### 8.1 Header actions (exact)

Email drawer header must contain, left → right:

1. Title: `Daily email draft`  
2. Spacer  
3. **Copy** (copies HTML+plain via existing clipboard write)  
4. **Open Gmail** (primary button)  
5. Close (X)  

Remove duplicate Copy from lower body **or** keep a secondary “Copy plain text” only if labeled clearly - preferred: **one Copy** in header that copies HTML+text together (current `clipboard.write({html, text})`).

Polish / enhance controls (if present) stay in body near preview, not replacing header Copy/Open.

### 8.2 Open Gmail behavior (contract)

**Goal:** User sees styled content in Gmail compose with minimal friction.

**Implemented flow (mandatory sequence):**

1. Build draft (existing `email:draft`).  
2. Write clipboard: HTML fragment + plain text (existing pattern in `email:open`).  
3. Open Gmail compose URL with `to` + `su` (subject) - **do not** put body in URL.  
4. Attempt **auto-paste** into Gmail compose:  
   - **Preferred implementation:** After `openExternal`, wait ~1.5s, then send paste shortcut to the focused OS window:  
     - Windows: Ctrl+V  
     - macOS: Cmd+V  
   - Use a small trusted approach: Electron `BrowserWindow` is **not** Gmail’s window when using `openExternal`. Therefore auto-paste requires OS-level key send **or** opening Gmail inside an Electron window.  

**Decision for Phase 1 (pick and document in CHANGELOG which was shipped):**

| Option | Description | When to use |
|--------|-------------|-------------|
| **A (recommended first)** | `openExternal` + clipboard + OS paste simulation via `robotjs` / `@nut-tree/nut-js` / PowerShell SendKeys (Windows) + `osascript` keystroke (Mac) | Fastest to Gmail user’s real account session |
| **B** | Electron `BrowserWindow` loads Gmail compose; inject paste via `webContents.paste()` after load | More reliable paste; may hit Google login / session friction |

**Phase 1 must ship Option A or B.** If paste simulation fails (permissions), show toast:

- Windows: `Copied. In Gmail, press Ctrl+V once to paste your update.`  
- Mac: `Copied. In Gmail, press ⌘V once to paste your update.`  

Never fail silently with blank compose and no toast.

### 8.3 Example user journey

1. User clicks Email Draft.  
2. Header shows Copy + Open Gmail.  
3. Clicks Open Gmail → Gmail opens with To/Subject filled → body receives HTML (auto or one paste).  
4. Manager-looking Verdana HTML with projects and tasks, **no ✅ emojis on bullets**.

---

## 9. Layout resilience

Apply to: task cards, composer, edit drawer, email preview, settings text, projects/analytics tables.

**CSS requirements:**

```css
overflow-wrap: anywhere;
word-break: break-word;
max-width: 100%;
```

- Flex/grid children that hold text: `min-width: 0`.  
- Email preview pane: horizontal overflow hidden; content wraps.  

**Test URLs (must not expand layout):**

```
https://drive.google.com/file/d/1abcdefghijklmnopqrstuvwxyzABCDEFG/view?usp=sharing
https://company.atlassian.net/browse/PDFERP-12345-very-long-ticket-name-here
```

---

## 10. Category management

### 10.1 Settings UI location

Settings → **Projects** tab (same tab as today). Replace textarea with a **Category list manager**.

### 10.2 UI elements

For each category row:

- Drag handle **or** Up/Down buttons (either OK; drag preferred if already using dnd-kit)  
- Name (inline edit or edit button)  
- Delete button  

Below list:

- Text field + **Add category** button  
- Select **Default category** (`settings.defaultCategory`)

### 10.3 Validation

- Name trim; reject empty.  
- Reject duplicates case-insensitive.  
- Max length 60 chars.  
- Must keep **at least one** category.  

### 10.4 Delete behavior (resolved)

On delete category `X`:

1. Confirm modal text:  
   `Delete “X”? Tasks using this category will be moved to “Other”.`  
2. Ensure `Other` exists in `categories` (append if missing).  
3. Scan **all** day `tasks.json` files; for each task with `category === X`, set `category = 'Other'`.  
4. Remove `X` from `categories`.  
5. If `defaultCategory === X`, set `defaultCategory = 'Other'`.  
6. Save settings + rewritten day files.  

**Performance:** Acceptable for office-scale local data; show busy state on confirm.

### 10.5 Reorder

Persist new array order on drop/save. New Task category dropdown must reflect order immediately after settings save.

### 10.6 Example

Before: `['Deployment', 'Bug Fix / Issue', 'Other']`  
User adds `Client Call`, moves it to index 1, sets default to `Client Call`.  
After: `['Deployment', 'Client Call', 'Bug Fix / Issue', 'Other']`, `defaultCategory = 'Client Call'`.

---

## 11. Default theme UX enhancement (Phase 1 scope)

### 11.1 Surfaces to polish in Default theme

- Board header / columns / cards  
- Composer + edit drawer (new sizes)  
- Email drawer header actions  
- Settings category manager  
- Shared buttons, inputs, selects, dialogs used above  

### 11.2 Goals (measurable)

- Clear primary vs secondary buttons  
- Consistent 8px spacing rhythm  
- Readable contrast for body text  
- No clipped buttons on 1366×768  
- Spider-Verse still OK for same components  

### 11.3 Do not

- Copy Spider-Verse pixel fonts into Default  
- Add novelty decorations to Default  

---

## 12. Files likely touched (guide, not exclusive)

- `shared/types.ts`  
- `shared/store.ts` (category reassignment scan helpers)  
- `shared/email.ts`  
- `electron/ipc/handlers.ts` (`email:open`, possible new `categories:*` if logic moves to main)  
- `renderer/app/page.tsx`  
- `renderer/app/settings/page.tsx`  
- `renderer/app/globals.css`  
- `renderer/lib/format.ts` / new `formatTime.ts`  
- New: `renderer/components/TaskDetailsEditor.tsx`  
- New: `renderer/components/CategoryManager.tsx`  
- `package.json` - add TipTap dependencies  

Category delete scan **must** run in Electron main (Node `fs`), not renderer.

Suggested IPC:

```
categories:reorder
categories:add
categories:rename
categories:delete  // performs reassignment across days
settings:setDefaultCategory
```

Alternatively extend existing `settings:save` **but** delete-with-reassign must be an explicit main-process operation so renderer cannot forget the scan.

---

## 13. Acceptance checklist (Phase 1)

### Editor

- [ ] New Task has **no** bullet line UI  
- [ ] Large editor visible; can bold/italic/list/link  
- [ ] Save stores `detailsHtml` + derived `subItems`  
- [ ] Reopen task restores editor from `detailsHtml` or legacy `subItems`  
- [ ] Title-only task still allowed  

### Email

- [ ] No ✅/⏳ on bullet lines in HTML or plain  
- [ ] Done/WIP indicated only on title text if at all  
- [ ] Copy button in **header**  
- [ ] Open Gmail copies HTML and opens compose; paste auto **or** clear one-key toast  
- [ ] Long GDrive URL in a task does not break email preview width  

### Time

- [ ] No user-facing 24h times remain in board/settings labels touched by app chrome (audit)  

### Categories

- [ ] Add / rename / reorder / delete works  
- [ ] Delete reassigns to Other across days  
- [ ] Default category used in New Task  
- [ ] Cannot delete last category  

### Themes

- [ ] Default looks improved on board + composer + email header  
- [ ] Spider-Verse composer/email still usable  

### Regression

- [ ] Global Rules §7 core regression list passes  

---

## 14. Explicit non-assumptions

- Do **not** assume TipTap JSON storage - store **HTML string** in `detailsHtml`.  
- Do **not** keep bullets UI “hidden behind a flag.”  
- Do **not** put email body in Gmail URL.  
- Do **not** skip day-file scan on category delete.  
- Do **not** use emoji status “because old email looked that way.”

---

## 15. Done definition

Phase 1 complete when §13 all checked, CHANGELOG updated, and `npm run build` succeeds.
