# Linear Simple Web Clipper

A Chrome extension that clips any web page into a Linear issue with a single click.

## Features

- **One-click clipping** — extracts the page title and content automatically
- **Smart content extraction** — uses [Readability](https://github.com/mozilla/readability) to pull the main article content and converts it to Markdown; falls back to selected text if you've highlighted something
- **Full issue control** — set Team, Project, Status, Assignee, Labels, and Priority before creating
- **Remembers your preferences** — last-used team, project, status, assignee, labels, and priority are restored on next use
- **OAuth2 + PKCE auth** — secure login via Linear's OAuth flow, no passwords stored
- **Graceful fallback** — on pages where content can't be extracted (browser pages, PDFs), you can still create an issue with a manual title and the page URL

## Installation

### 1. Download the extension

Clone or download this repository:

```bash
git clone https://github.com/andylobban/linear-simple-web-clipper.git
```

### 2. Load into Chrome

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (toggle in the top-right corner)
3. Click **Load unpacked**
4. Select the `linear-simple-web-clipper` folder

The extension will appear in your toolbar. Note the **extension ID** shown under its name — you'll need it in the next step.

### 3. Create a Linear OAuth app

1. In Linear, go to **Settings → API → OAuth applications**
2. Click **New application** and give it a name (e.g. "Web Clipper")
3. Set the **Callback URL** to:
   ```
   https://<YOUR_EXTENSION_ID>.chromiumapp.org/
   ```
   Replace `<YOUR_EXTENSION_ID>` with the ID from step 2.
4. Save and copy the **Client ID**

### 4. Add your Client ID

Open `auth/auth.js` and replace the placeholder on line 3:

```js
const CLIENT_ID = 'your_client_id_here';
```

### 5. Reload the extension

Back in `chrome://extensions`, click the **reload icon** on the extension card.

You're ready — click the extension icon on any web page to start clipping.

## Usage

1. Navigate to a page you want to clip
2. Optionally, select some text to clip just that excerpt instead of the full article
3. Click the extension icon in the toolbar
4. Adjust the title, team, project, status, assignee, labels, and priority as needed
5. Click **Create Issue**
6. A link to the newly created issue appears — click it to open in Linear

## Tech stack

- Chrome Extension Manifest V3
- [Mozilla Readability](https://github.com/mozilla/readability) — article extraction
- [Turndown](https://github.com/mixmark-io/turndown) — HTML to Markdown conversion
- Linear GraphQL API
