# How to send the v1.1.1 announcement in Gmail

Gmail cannot paste raw HTML directly — you need a helper to insert **rendered** HTML.

---

## Method 1 — Local copy tool (no signup, works offline)

1. Open in **Chrome**:
   ```
   D:\daybook-desktop\docs\email-templates\copy-for-gmail.html
   ```
2. Click **Load template file** → choose **`v1.1.1-spider-verse-announcement.html`**
3. Check the **preview** looks correct
4. Click **Copy for Gmail**
5. Click **Open Gmail Compose** (or go to Gmail → Compose)
6. Click in the **message body** → **Ctrl+V**
7. Add **Subject:**
   ```
   Daybook v1.1.1 — The Spider-Verse theme is here. Switch today.
   ```
8. BCC your team → send a test to yourself first → send

---

## Method 2 — Chrome extension (best if you send HTML often)

Install **Gmail HTML Insert** (free, client-side, no server):

https://chromewebstore.google.com/detail/gmail-html-insert/fjkbmknehbnkhlbnjgenljdbnjbikhde

1. Gmail → **Compose**
2. Click **Insert HTML** in the toolbar (added by extension)
3. Paste the full contents of **`v1.1.1-spider-verse-announcement.html`**
4. Apply / Insert → add subject & recipients → Send

Alternatives:
- **Insert and Send HTML with Gmail** — https://chromewebstore.google.com/detail/insert-and-send-html-with/bcflbfdlpegakpncdgmejelcolhmfkjh
- **html2email** — https://sendhtml.email/ (Chrome extension + web)

---

## Method 3 — html2email web

If the site is up: https://sendhtml.email/ — paste HTML, insert into Gmail compose.

---

## Tips

| Tip | Detail |
|-----|--------|
| **Use Chrome** | Best clipboard support for rich HTML paste |
| **BCC** | Team sends — keeps addresses private |
| **Test first** | Send to yourself before the full blast |
| **Images in draft** | Gmail may hide remote images while composing; check **Sent** after sending |

---

## What NOT to do

| Wrong | Result |
|-------|--------|
| Paste HTML from Notepad into Gmail | Raw `<table>` code |
| Attach `.html` only | File download, not formatted email |

---

## Plain-text fallback

**`v1.1.1-spider-verse-announcement.txt`**
