# Screen and Component Specs

Read the section for the screen you are building. Contents:
1. App shell
2. Upload and processing
3. Library
4. PDF viewer
5. Summary panel
6. Vocabulary panel and flashcards
7. Chat panel
8. Global states (empty, loading, error)
9. Suggested component inventory
10. Suggested microcopy

## 1. App shell
- Left rail (64-72 px collapsed, 240-280 px expanded): logo, Library, Upload (primary action), recent documents, settings and theme at the bottom.
- Top bar inside the workspace: document title (click to rename), page count, status chip, overflow menu (download original, delete).
- Command palette (Cmd/Ctrl+K): search documents, "Upload PDF", "Switch to Summary/Words/Chat", "Toggle theme".
- Toasts bottom-center on mobile, bottom-right on desktop; always with an Undo for destructive actions.

## 2. Upload and processing
States: idle -> dragging over -> uploading -> processing (stages) -> ready | failed.

- Idle: large drop area with a single icon, one line of instruction, "Choose PDF" button, and a muted line for limits (file type, max size).
- Dragging over: the entire window gets a subtle overlay and the drop area shows "Release to upload".
- Uploading: filename, size, determinate progress bar, cancel button.
- Processing stages, shown as a compact vertical or horizontal stepper with the current stage animated:
  1. Uploading
  2. Reading pages
  3. Building search index
  4. Ready
  If the backend does not report progress, show indeterminate progress with the stage names advancing on known events (upload done, ingestion endpoint returned).
- When "Reading pages" finishes, allow opening the viewer immediately.
- Failure messages (specific):
  - Not a PDF: "Only PDF files are supported."
  - Too large: "This file is over the limit of {n} MB. Try a smaller file or split it."
  - Password protected: "This PDF is password protected. Remove the password and upload again."
  - No text found: "No readable text was found. This may be a scanned PDF."
  - Server error: "The upload didn't finish. Try again." with a Retry button.
- Multiple uploads: queue items in a list; each has its own status.

## 3. Library
- Card: thumbnail (first page, 3:4 ratio, lazy), title (2-line clamp), meta line (pages, date), status chip.
- List view: table with title, pages, date, status, actions; sortable headers.
- Selecting a card opens the workspace on the last used tab.
- Delete: confirm dialog naming the document, explains that the file and its search index will be removed; toast with Undo for a few seconds if backend supports soft delete, otherwise require confirmation only.
- Skeleton grid while loading. Empty: "No documents yet. Upload a PDF to get a summary, key words, and a chat that answers from it."

## 4. PDF viewer
- Toolbar: page input (n / total), zoom (-, fit width, +), search, download.
- Left thumbnails strip (collapsible).
- Page rendering: lazy, with page-shaped skeleton placeholders to avoid layout jump.
- Public method for other panels: `scrollToPage(page, { highlight?: string })`. Highlight by matching the chunk text in the text layer; fade highlight after ~2.5 s. If exact match fails, highlight the page top edge subtly.
- Remember scroll position per document.
- Text selection popover (nice-to-have): "Ask about this", "Explain word" - sends selected text to Chat.

## 5. Summary panel
- Header row: segmented control (Brief | Standard | Detailed), regenerate icon button, overflow (copy, download .md).
- Body typography: reading-optimized, 16-17 px, line-height 1.6-1.7, max ~70 characters.
- Structure:
  - Overview (1 paragraph)
  - Key points (list of 4-8)
  - By section (collapsible, each with page chips)
- Generation state: skeleton lines, or streamed text with a caret; label "Summarizing..." with `aria-live`.
- Cached summary displays instantly with a small "Generated {relative time}" note.
- Error: inline card with the reason and a Retry button; never blank.

## 6. Vocabulary panel and flashcards
Card anatomy:
- Term (largest text), part of speech (muted), difficulty indicator (dots or a small label, not color alone).
- Meaning in plain language (1-2 sentences).
- Context: the sentence from the PDF with the term emphasized; page chip that jumps the viewer.
- Actions: mark as known (checkbox-style toggle), copy, speak (optional).

Toolbar: search, filter (All | To learn | Known), sort, "Study" button, "Export".

Long lists: virtualize beyond ~100 items; sticky toolbar.

Flashcard mode:
- Full-panel focus view with progress (e.g. 12 of 48).
- Front: term. Back: meaning, example, page chip.
- Keys: Space flips, Right/Left navigate, 1 = review again, 2 = got it.
- End screen: counts of known vs. review; buttons "Review missed words" and "Back to list".
- Persist known/unknown state (backend if available, otherwise local storage keyed by document id).

Export: CSV with columns term, meaning, context, page; optionally Anki-friendly tab-separated file.

## 7. Chat panel
Layout:
- Scrollable message list; composer pinned at the bottom.
- Auto-scroll to newest only if the user is already near the bottom; otherwise show a "Jump to latest" pill.

Messages:
- User: right-aligned or subtly tinted block.
- Assistant: full-width text block on the panel surface, Markdown rendered, no heavy bubble.
- Citation chips beneath the answer: `p. 4`, `p. 9`. Hover/focus shows the snippet in a popover. Click -> `scrollToPage`.
- Actions row on hover/focus: copy, regenerate, helpful / not helpful.

Empty chat: title "Ask about this document", 3-4 starter question buttons derived from the summary (e.g. "What are the main arguments?", "List the key dates", "Explain the methodology in simple terms").

Streaming: reserve space, avoid layout shift, show a "Stop" button in the composer while streaming. Announce completion via `aria-live` once, not per token.

Composer:
- Auto-grow up to ~6 lines, then scroll.
- Enter sends, Shift+Enter newline; send button disabled when empty.
- Placeholder: "Ask anything about this PDF".
- If indexing: disabled with helper text "Chat will be ready when indexing finishes."

Not-found answers: a calm note style, e.g. "I couldn't find this in the document." with a suggestion to rephrase or check the summary.

Conversation persistence: keep history per document; provide "Clear chat" with confirmation.

## 8. Global states
- Loading: skeletons that match final layout; never spinners over the whole screen for more than 300 ms.
- Empty: one sentence + one action.
- Error: state what happened, what to do, a retry action; keep technical details behind a "Details" disclosure.
- Offline: banner "You're offline. Reading works, AI features need a connection."
- Rate limit / model unavailable: "The assistant is busy. Try again in a moment." with a Retry button.

## 9. Suggested component inventory
AppShell, SideRail, CommandPalette, ThemeToggle, UploadDropzone, UploadQueueItem, ProcessingStepper, DocumentCard, DocumentTable, StatusChip, PdfViewer, PageThumbnails, ViewerToolbar, AiPanel (Tabs), SegmentedControl, SummaryView, SectionAccordion, PageChip, VocabCard, VocabToolbar, FlashcardDeck, ChatThread, ChatMessage, CitationChip, CitationPopover, Composer, StarterPrompts, Toast, ConfirmDialog, Skeleton, EmptyState, ErrorState.

## 10. Suggested microcopy
| Where | Copy |
|---|---|
| Tab labels | Summary, Words, Chat |
| Upload button | Upload PDF |
| Processing done | Ready. Ask questions or read the summary. |
| Summary regenerate | Regenerate summary |
| Vocabulary empty | No difficult words found in this document. |
| Mark known | Mark as known |
| Export | Export words |
| Chat placeholder | Ask anything about this PDF |
| Not found | I couldn't find this in the document. |
| Delete confirm | Delete "{title}"? The file and its search index will be removed. |
| Delete toast | Deleted. Undo |
