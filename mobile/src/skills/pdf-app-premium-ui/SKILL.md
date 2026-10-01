---
name: pdf-app-premium-ui
description: Redesign and upgrade the UI/UX of a RAG-based PDF study app (PDF upload, summarization, difficult-vocabulary extraction, and chat with the PDF) into a premium, modern, app-quality interface. Use this skill whenever the user wants to redesign, restyle, modernize, polish, or "make premium" any part of a document-AI app - upload screen, document library, PDF viewer, summary view, vocabulary list or flashcards, chat interface, loading/empty/error states, dark mode, or mobile layout - even if they only say "improve the UI", "make it look like a modern app", or "better UX" for an app that handles PDFs with AI features.
---

# Premium UI for a RAG PDF Study App

This skill guides you (the coding agent) through upgrading the interface of an app that lets people upload a PDF, then summarize it, extract difficult vocabulary, and chat with it. Under the hood the app chunks the PDF, stores embeddings in ChromaDB, keeps the original file in storage, and answers via retrieval-augmented generation (RAG).

The goal is an interface that feels like a finished product from a design-led company: calm, fast, legible, and trustworthy with documents. The backend is not being redesigned. **Never break existing API contracts, ingestion flow, or RAG logic while changing the UI.**

## Workflow

Follow these phases in order. Do not skip the audit or the design plan.

### Phase 1 - Audit the existing app (read before you write)

1. Identify the stack: framework (React/Next/Vue/Svelte/Streamlit/Gradio/Flask templates...), styling system (Tailwind, CSS modules, MUI, shadcn, plain CSS), state management, and how the frontend talks to the backend.
2. List every screen and state that exists today. Find the endpoints for: upload, ingestion status, summary, vocabulary, chat (streaming or not), list/delete documents, fetching the stored PDF.
3. Note what data the backend actually returns (e.g. whether chat responses include source chunks or page numbers, whether vocabulary includes definitions/examples/page). The UI can only show what exists; where a premium feature needs data the API lacks, list it as a **backend suggestion** at the end rather than faking it.
4. If the app is Streamlit or Gradio, tell the user which premium patterns are limited by the framework and either work within it (custom CSS, components) or recommend migrating the frontend. Do not silently produce a weaker result.
5. Write a 5-10 line audit summary for the user: stack, screens found, main UX problems, and what you plan to change.

### Phase 2 - Design plan (before code)

Also follow the `frontend-design` skill if it is available. Produce a compact plan and check it against this brief before building:

- **Color**: 4-6 named hex values (background, surface, text, muted text, one accent, semantic success/warning/error), for light and dark.
- **Type**: one or two families with clear roles, a defined scale, comfortable reading line length (under ~75 characters for summaries and chat).
- **Layout**: the workspace concept (see below), with a quick ASCII wireframe.
- **Signature moment**: pick ONE memorable element (see "Where to spend boldness") and keep everything else quiet.

Avoid the tells of generic AI-generated UI: identical rounded cards everywhere, purple-to-blue gradient washes, glowing blobs, emoji as icons, tracked-out ALL-CAPS eyebrow labels above every heading, and a fade-slide-up animation on every section. If your plan resembles what you would produce for any SaaS dashboard, revise it to fit *reading and studying documents*.

### Phase 3 - Build

Implement in this order so the app stays working at every step:

1. Design tokens (CSS variables / Tailwind theme): colors, type scale, spacing (4/8 px grid), radii, shadows, motion durations. Light and dark from the start.
2. App shell and navigation.
3. Upload and library.
4. Document workspace (the core screen).
5. Summary, Vocabulary, Chat panels.
6. States: loading, empty, error, processing, offline.
7. Responsive pass, accessibility pass, motion pass.

Reuse the project's existing component library and styling approach. Do not add a new UI framework unless the current one blocks the design; if you must, say why.

### Phase 4 - Verify

- Run the app, exercise the full flow: upload -> processing -> summary -> vocabulary -> chat -> return to library.
- Screenshot key screens at 1440, 1024, 768, and 390 px widths in light and dark if the environment allows, and fix what looks off.
- Run the checklist at the bottom of this file.
- Report what changed, what was assumed, and any backend suggestions.

## Core information architecture: the Document Workspace

The app's value is working with *one document* through three lenses. Make the document the center of the experience, not a set of unrelated pages.

```
Desktop (>= 1100px)
+--------+-------------------------------+-----------------------------+
| Rail   |  PDF viewer                   |  Summary | Vocabulary | Chat |
| (docs) |  page thumbnails / zoom       |  (tabbed AI panel)          |
|        |  highlights from citations    |                             |
+--------+-------------------------------+-----------------------------+

Tablet (700-1100px): viewer and AI panel are switchable, panel slides over viewer.
Mobile (< 700px): bottom tab bar: Document | Summary | Words | Chat.
```

Rules:
- The library lives in a slim left rail or a dedicated home screen, never mixed into the workspace.
- The AI panel is resizable on desktop; remember the width and last active tab per document.
- The PDF viewer and the AI panel stay linked (see "Grounding and citations").
- Keyboard: `/` focuses chat input, `[` and `]` switch tabs, `Cmd/Ctrl+K` opens a command palette (jump to a document, start upload, toggle theme).

## Screen specifications

Read `references/screens.md` for detailed component specs, states, and copy for each screen. Read `references/design-tokens.md` when setting up the token system. The summary below is what you always need in mind.

### 1. Upload
- Full-window drop target with a clear primary button as the alternative; accept only PDFs and say so; show size limit up front.
- On drop, show the file immediately with a determinate progress bar for upload, then a **named-stage** progress for processing: *Uploading -> Reading pages -> Building search index -> Ready*. Users tolerate waiting when they see real stages.
- Processing must not block the UI: let the user open the document and read the PDF while indexing finishes; disable Chat and show "Indexing... n%" in that tab only.
- Failure states are specific: password-protected, scanned with no text (offer OCR if the backend supports it), too large, corrupt.

### 2. Library
- Grid/list toggle, sort (recent, name), search by title.
- Each item: first-page thumbnail, title, page count, date, status chip (Processing / Ready / Failed), and a small overflow menu (rename, download original, delete with confirmation).
- Empty library is an invitation to upload, with one sentence explaining what they will get.

### 3. PDF viewer
- Smooth scrolling, page thumbnails, zoom, fit width, page jump, search inside document.
- Supports programmatic scroll-and-highlight so citations from chat and vocabulary can jump to the exact page and passage.
- Serve the PDF from storage via the existing endpoint; lazy-render pages.

### 4. Summary panel
- Length control (Brief / Standard / Detailed) as a segmented control; regenerate on change, cache results per document.
- Structure the output: a short overview paragraph, then key points as a scannable list, then optional section-by-section breakdown. Long summaries collapse by section.
- Actions: copy, download as Markdown, regenerate. Show generation with a streaming or skeleton state, never a blank panel.
- Where sections map to pages, show page chips that jump the viewer.

### 5. Vocabulary panel
- Card list, one term per card: the word, part of speech, plain-language meaning, the sentence from the PDF where it appears (with the word emphasized), and a page chip.
- Controls: search, filter by difficulty, sort (order of appearance, alphabetical, difficulty), and "Mark as known" which visually quiets the card and persists.
- Study mode: a flashcard view (word front, meaning + context back) with keyboard navigation (space to flip, arrows to move, 1/2 to mark got it / review again).
- Export: CSV or Anki-compatible file, plus copy list.
- Pronunciation button only if the backend or browser Speech Synthesis supports it.

### 6. Chat panel
- Message layout with clear user vs assistant distinction; assistant messages stream token by token with a stable layout (no jumping).
- Render Markdown safely (lists, bold, code, tables) with proper spacing.
- **Citations** under each answer: numbered source chips that show page number and a snippet on hover/focus and jump the viewer on click. If the backend does not return sources, add this as a backend suggestion and design the component so it lights up when data arrives.
- Suggested starter questions generated from the summary on an empty chat.
- Composer: auto-growing textarea, Enter to send, Shift+Enter for newline, stop-generation button while streaming, disabled state with reason while indexing.
- Message actions: copy, regenerate, thumbs up/down.
- Scope indicator: "Answering from: <document title>" so users know the boundary.
- When the answer is not in the document, the assistant says so plainly; design a distinct, calm "Not found in this document" treatment.

## Grounding and citations (what makes a RAG app feel trustworthy)

Users of document AI want to verify answers. The premium feel here comes from evidence, not decoration.
- Every chat answer, and ideally each summary section, links back to source pages.
- Clicking a citation scrolls the viewer to the page and briefly highlights the passage (use chunk text search or stored coordinates if available).
- Show retrieval confidence only if it is meaningful; do not show fake percentages.
- Keep a subtle "Sources" affordance even when there is only one.

## Where to spend boldness

Choose one signature element and execute it well; keep the rest disciplined. Options that suit this product:
- The citation-to-highlight interaction (viewer and chat visibly connect).
- The processing sequence: an elegant staged progress that turns into the document opening.
- Typography of the summary: a beautifully set reading experience, like a good e-reader.
- The vocabulary study mode.

Everything else: restrained surfaces, consistent radii by hierarchy (larger for containers, smaller for controls), one accent color used for interactive and focus states only.

## Visual language guidelines

- **Tone**: quiet, focused, editorial. It is a reading and thinking tool, so favor calm neutrals and generous whitespace over dashboard density.
- **Surfaces**: 2-3 elevation levels max. Prefer borders and tonal shifts over heavy shadows. Use blur/glass only for overlays and the command palette.
- **Color**: one accent. Tint neutrals slightly toward the accent hue. Dark mode is a real design, not an inversion: lower contrast surfaces, check accent contrast, avoid pure black backgrounds with pure white text.
- **Type**: pick a refined, readable family for UI and consider a serif or a highly readable text face for summary and PDF-derived content to distinguish "document voice" from "app voice". Use a scale (e.g. 12/14/16/20/28/40), tabular numbers for page counts and stats, and `text-wrap: balance` for headings.
- **Icons**: one consistent set (e.g. Lucide or Phosphor), 1.5px stroke, sized 16/20/24. No emoji as UI icons.
- **Motion**: 120-200 ms for state changes, ease-out; animate things that answer an action (tab switch, panel open, card mark-as-known, citation jump). One orchestrated entrance at most. Respect `prefers-reduced-motion`.
- **Loading**: skeletons that match final layout; streaming text for AI output; optimistic UI for mark-as-known, rename, delete (with undo toast).
- **Density**: comfortable by default, with a compact option for vocabulary lists if it fits.

## Copy and microcopy

- Plain, sentence case, active voice. Name things by what users do: "Summary", "Key words", "Ask" (or "Chat"), not "Extraction Module".
- Buttons say what happens: "Upload PDF", "Regenerate summary", "Export words".
- Same verb throughout a flow (Delete -> "Deleted" toast with Undo).
- Errors explain what happened and how to fix it; no apologies, no vague "Something went wrong".
- Empty states tell the user the next step in one sentence.

## Accessibility and quality floor

- WCAG AA contrast in both themes; visible focus rings on every interactive element.
- Full keyboard operation for upload, tabs, chat, flashcards, and citations.
- Semantic landmarks and ARIA: tabs pattern for the AI panel, `aria-live="polite"` for streaming chat and status updates, labelled icon buttons.
- Touch targets at least 44 px on mobile; no hover-only affordances.
- Works at 390 px wide without horizontal scroll; PDF viewer supports pinch zoom on touch.
- Respect `prefers-color-scheme` with a manual override stored in local settings.
- Performance: lazy-load PDF pages, virtualize long vocabulary lists, debounce search, avoid re-rendering the whole chat on each streamed token.

## Constraints and safety rails

- Do not change the backend, prompts, chunking, or ChromaDB logic unless the user asks; list needed backend changes as suggestions.
- Do not remove features; if a control moves, it must remain reachable.
- Do not hardcode fake data in production paths. Mock data is acceptable only behind a clearly named development flag.
- Keep uploaded document content private in the UI: no third-party analytics or fonts loading document text; avoid sending PDF content anywhere new.
- Preserve existing routes and environment variables.

## Deliverables

At the end, provide:
1. The updated code, organized by component, with the token file clearly identified.
2. A short changelog: screens redesigned, interactions added, files touched.
3. **Backend suggestions** (only if needed), e.g. return `page` and `chunk_text` with each retrieved source; stream chat over SSE; expose ingestion progress; store per-document summary and vocabulary to avoid regeneration; add word `difficulty`, `pos`, and `example_sentence` fields.
4. Screenshots or a short walkthrough of the main states if the environment allows.

## Final checklist

- [ ] Audit summary and design plan written before coding
- [ ] Tokens defined; light and dark both designed
- [ ] Upload has staged, honest progress; user can read while indexing
- [ ] Library has thumbnails, status chips, search, safe delete with undo
- [ ] Workspace links viewer with Summary, Vocabulary, Chat
- [ ] Chat streams, cites sources, jumps to pages, has stop and regenerate
- [ ] Vocabulary has context sentence, page chip, filter, mark known, flashcards, export
- [ ] Every screen has loading, empty, and error states
- [ ] Keyboard, screen reader, and reduced-motion support verified
- [ ] Responsive at 1440 / 1024 / 768 / 390 px
- [ ] No generic-template tells; exactly one signature moment
- [ ] No backend behavior changed; suggestions listed separately
