# Maxiom

Maxiom is a cloud-synced, Obsidian-style Markdown notebook that runs as a **static website**, including on GitHub Pages. It has Vim editing, LaTeX math, split preview, wikilinks, folders, search, backlinks, and a knowledge graph.

**Architecture:** GitHub Pages hosts the public HTML/JS/CSS frontend; [Supabase](https://supabase.com/) provides account login and a hosted Postgres database. Notes are stored in each account's private vault, protected with Postgres row-level security (RLS). **You must configure your own Supabase project; Maxiom has not been connected to any real backend yet.** No Node/npm/build step is needed.

## 1. Set up the cloud database

1. Sign up at [Supabase](https://supabase.com/) and create a new project.
2. Open **SQL Editor** in your project. Paste and run the entire contents of [`supabase/schema.sql`](supabase/schema.sql). This creates the `maxiom_vaults` table and three user-scoped RLS policies. Do not skip this step.
3. Open **Project Settings → API Keys** (the location may also be **Connect**) and find the **Project URL** and **Publishable key** (it begins with `sb_publishable_`; older projects may have a public `anon` key).
4. Edit `supabase-config.js`:

   ```javascript
   window.MAXIOM_CONFIG = {
     supabaseUrl: 'https://YOUR_PROJECT_ID.supabase.co',
     supabasePublishableKey: 'sb_publishable_YOUR_PUBLIC_KEY'
   };
   ```

   The URL and **publishable** key are intended for browser use. Do **not** put a secret key, `service_role` key, database password, or other privileged credential into this file or your GitHub repository. The RLS rules are what stop other users from reading your notes.

5. In Supabase go to **Authentication → Providers → Email**. Keep email/password authentication enabled. Keeping email confirmation enabled is recommended. You can turn off public new-user signups after creating your personal account if this will be a private app.

## 2. Publish on GitHub Pages

1. Create a new repository, e.g. `maxiom`.
2. Upload **the contents of this folder** to the repository root. Make sure `index.html`, `app.js`, `style.css`, `sw.js`, `supabase-config.js`, `supabase/schema.sql`, and `vendor/` are included.
3. In GitHub open **Settings → Pages**, set **Build and deployment → Deploy from a branch**, choose `main` and `/ (root)`, and save.
4. Your web app should be available at `https://YOUR_USERNAME.github.io/maxiom/` (substitute your own repository name).
5. In Supabase go to **Authentication → URL Configuration**. Set **Site URL** to the *exact deployed address*, e.g. `https://YOUR_USERNAME.github.io/maxiom/`. Add the same URL to **Redirect URLs**. This is necessary for signup confirmation and password-reset links. If you later change the domain, update these settings too.
6. Open the deployed site, select **Create account**, verify your email if prompted, and sign in. Create a note, wait for **Saved to cloud**, then sign into the same account in another browser/computer to see it.

No hosting backend, build command, server secrets or GitHub Actions workflow are required. GitHub Pages provides the frontend **only**. Supabase continues to run the authentication and database.

## 3. Develop locally

From the project folder:

```bash
python3 -m http.server 8000
```

Open http://localhost:8000. Add `http://localhost:8000/` to Supabase **Redirect URLs** if you need to confirm or reset accounts locally. A web connection is required for login and syncing. The editor libraries are included under `vendor/`; the Supabase JS client is loaded from jsDelivr.

## What syncs, and how

- Your notes, folders, favorites, Markdown content, selected note, and editor preferences are saved in one Postgres JSONB vault per account.
- Autosave occurs approximately one second after editing, and the app checks for cloud changes every 15 seconds. On another computer, log in with the same account; your cloud notes load immediately. When you edit on one computer, the other can pick up the changes automatically after it has finished any pending edits.
- **Simultaneous editing is not Google Docs-style collaborative editing.** Maxiom compares an atomic vault revision on every save. If a second device modified the vault, it blocks an overwrite and gives you the choices to download a JSON backup of local edits, use the cloud version, or deliberately replace the cloud version.
- An unsynced draft can be temporarily held in the current tab's `sessionStorage` for recovery. The authoritative copy is the cloud database. On shared devices, sign out and avoid leaving unfinished drafts.
- When the server is unreachable, **Offline · changes pending** is shown; do not close the tab without exporting a JSON backup. Once the connection returns, the app retries the save.
- Supabase RLS keeps users from querying each other's vaults. However, notes are **not end-to-end encrypted**: database administrators for your project and authorized infrastructure can potentially access plaintext content. Use a trusted Supabase account, strong password, and keep backups.
- Every account is independent. If you previously used the local Axiom version **on the same website address**, Maxiom offers to import its previous IndexedDB notes into a *new/empty cloud account*. If you moved website addresses, export a JSON backup from Axiom and import it via Maxiom Settings.

## Features and shortcuts

| Action | Keyboard shortcut |
|---|---|
| Command palette | Ctrl/Cmd + K |
| Search notes | Ctrl/Cmd + P |
| New note | Ctrl/Cmd + Shift + N |
| Save now | Ctrl/Cmd + S |
| Toggle sidebar | Ctrl/Cmd + backslash |
| Toggle right panel | Ctrl/Cmd + B |
| Vim insert mode | `i` |
| Vim normal mode | `Esc` |
| Vim delete line | `dd` |
| Vim save | `:w` |
| Vim note picker | `:e` |

Math preview supports `$inline math$` and `$$display math$$` (MathJax). Note navigation uses `[[wikilinks]]`. Export all Markdown files as a ZIP, export a JSON vault backup, or import `.md`, `.markdown`, and `.json` note files.

## Important limitations

- Cloud hosting must be set up using your own Supabase project; the downloaded archive cannot automatically create a hosted database or published GitHub Pages site.
- This implementation uses a **single JSONB document per account**. It is a practical first release for a personal vault but is not designed for extremely large vaults, attachments, simultaneous collaborative editing, or multi-user shared notebooks.
- Notes are visible to the hosting database operator; this is not end-to-end encryption.
- The frontend files in a public GitHub Pages repository are public; never add privileged API keys, personal notes, or account credentials to the repository. Notes are held in Supabase, not in the GitHub repository.
- GitHub Pages deploys changes after GitHub publishes them. Its branch build may process files with Jekyll; an empty `.nojekyll` file is included for predictable static asset hosting.

## Project files

- `index.html`, `style.css`, `app.js`: UI, editor, authentication and sync
- `supabase-config.js`: public Supabase browser configuration (requires your values)
- `supabase/schema.sql`: cloud database table and access policies
- `sw.js`: caching for static application assets only (not your remote API data)
- `public/icon.svg`: Maxiom logo
- `vendor/`: bundled CodeMirror 5, Marked, and MathJax

Original application code licensed MIT; bundled libraries keep their own licenses.
