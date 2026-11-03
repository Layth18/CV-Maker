# CV Studio

A visual CV editor whose output is real LaTeX. You edit your information and the
design in the browser; the app generates a modular `.tex` project, compiles it with
**XeLaTeX**, and shows the compiled PDF (via PDF.js). Exports download that same PDF
or its LaTeX sources.

```
React editor ──► CV config + bilingual profile (JSON) ──► LaTeX generator ──► XeLaTeX ──► PDF ──► PDF.js viewer / export
```

## Getting started

### 1. Install the requirements (once)

- **Node.js 20 or newer:** https://nodejs.org (the LTS installer is fine).
- **TeX Live 2023 or newer**, which provides XeLaTeX and every font the app offers:
  https://tug.org/texlive/ (on Windows, run `install-tl-windows.exe` and choose the full scheme).
  MiKTeX also works but downloads packages and fonts on first use, so the first build is slow.

Check both are available in a new terminal: `node -v` and `xelatex --version`.

### 2. Get the code and start it

```bash
git clone <this repository's URL>
cd CV_Custom
```

**Windows:** double-click **Start CV Studio.bat**. The first run installs dependencies (about a
minute), then the app opens in your browser. Close the "CV Studio" window to stop it.
Double-click **Create Desktop Shortcut.bat** once to get a Desktop icon.

**Any OS:**

```bash
npm install
npm run dev
```

Then open http://localhost:5173. The API runs on `127.0.0.1:5174` (set `CV_API_PORT` to change it).
Production: `npm run build` then `npm start` serves the built editor and the API from the same port.

### 3. Make it yours

The first launch shows an example CV filled with placeholders ("Your Name", "University name"…).
Open **Header & contact** in the left outline and replace them, upload a photo, then go through
the other sections. Everything you enter is stored in the `data/` folder on your own computer.

**Privacy:** `data/` (your profile, photo, CVs and PDFs) is listed in `.gitignore`, so it is
never committed or pushed. Back that folder up if you care about it.

## Using the editor

- **Outline (left):** the CV's sections in document order. Pick one and only its toolbox
  opens: its settings for this CV, then its entries. Drag rows to reorder, use the eye to hide.
  You can also click any section directly on the PDF preview.
- **Formats & language (top bar):** one CV can hold several formats (templates). Each format
  remembers its own layout, typography, colors and section setup; content is shared. Click the
  EN/FR switch (or press Alt+L) to flip the language; the format chips switch format. Both are
  instant because the other variants are compiled in the background (green dot = ready).
- **Checklists:** every skill, bullet point and student-life line has a checkbox that shows or
  hides it in the current CV and format only; the text stays in your database.
- **No start page:** the app opens the CV you edited last. The menu on the CV name switches,
  creates or duplicates CVs. Undo/redo: Ctrl+Z / Ctrl+Y (outside text fields) or the arrows.
- **Exports:** PDFs are named like `First_Last_CV_FR_French_Split_Photo.pdf`; "All N PDFs"
  downloads every format in both languages as one ZIP.

## How it works

| Layer | Where | Notes |
| --- | --- | --- |
| Bilingual profile database | `data/profile.json` | Source of truth for all personal content, every text field in EN + FR |
| Per-CV configuration | `data/cvs/<id>.json` | Language, active format, and per-format designs (`formats`, `designs`): section order/visibility, chosen items, layout, typography, colors |
| LaTeX generation | `server/latex/generate.ts` | Pure function: profile + CV config → `main.tex`, `settings.tex`, `personal_info.tex`, `sections/*.tex` |
| Shared LaTeX components | `server/latex-assets/cvcore.sty` | Headers, entries, columns, sidebar background, photo |
| Themes | `server/latex-assets/cvtheme-*.sty` | classic, modern, academic, compact |
| Templates | `shared/catalog.ts` | 11 templates = theme + layout/typography/color presets + section arrangement |
| Compilation | `server/compile/xelatex.ts` | Isolated temp dir, no shell, `-no-shell-escape`, timeouts, process-tree kill |
| Builds | `data/builds/<buildId>/` | PDF, log and the exact sources; cached by source hash |
| Editor | `client/src` | React + zustand; PDF.js viewer |

All user text is escaped before it reaches LaTeX (`server/latex/escape.ts`); text fields
accept `**bold**` and `*italic*`. The only raw LaTeX path is the optional
"Advanced: extra LaTeX" field, written to `custom_preamble.tex`.

### Preview and export guarantees

- The viewer shows the last **successful** build. A failed build never replaces it;
  errors are listed with file and line, and the full log is one click away.
- Identical sources reuse the existing build, so reverting a change brings back the same PDF instantly.
- Exports are served from the build that is on screen: **Export PDF** downloads that exact file;
  the source and project ZIPs contain the sources that produced it.

## Checks

```bash
npm run typecheck
npm run test:latex -- out            # every template, EN and FR
npm run test:latex -- out --fonts    # every font with light/semibold weights
npx tsx scripts/api-smoke.ts         # against a running server
python scripts/make-icon.py          # regenerate assets/cv-studio.ico and the favicon
```
