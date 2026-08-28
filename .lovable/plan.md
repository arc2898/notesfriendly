# NotesFriendly — 3-Day Finish Plan

Consolidated backlog from Phase 2/3 plus the recent "fix what's failing" pass. Ordered by user impact: broken core features first, polish last.

---

## Day 1 — Core failures & UI consistency (MAJOR)

Goal: nothing in the app feels broken; every screen looks like the same product.

1. **Conversion & download hardening** (verify the pdf-lib/pdfjs refactor)
   - End-to-end test each path on `/conversion` and `/img-to-pdf`: PDF→TXT, PDF→Images (zip), PDF→PPTX, Images→PDF, TXT→PDF.
   - Fix worker init crashes (pdfjs worker URL via `?url` import).
   - Progress states (`Loader2`) on every action button, disabled while running.
   - Error toasts with real error text, not "Failed".
   - Downloaded filenames keep original base name + correct extension.

2. **Global emoji purge** (Core memory rule: no emojis anywhere)
   - Sweep: `rg "[\\u{1F300}-\\u{1FAFF}]|[\\u{2600}-\\u{27BF}]" src/`
   - Replace every hit with a `lucide-react` icon. Common map: ✅→`Check`, ❌→`X`, ⚠️→`AlertTriangle`, ℹ️→`Info`, 🔔→`Bell`, 🎉→`PartyPopper`, 📚→`BookOpen`, 📁→`Folder`.
   - Cover: toasts, empty states, placeholders, comments in user-visible strings, sidebar labels, admin/god panels, notifications.

3. **Button system unification**
   - Audit every page; replace raw `<button>` and ad-hoc styled buttons with shadcn `Button` + correct `variant` (`default`, `secondary`, `outline`, `ghost`, `destructive`) and `size` (`sm`, `default`, `icon`).
   - Standard icon-button: `size="icon" variant="ghost"` with 9×9 box, lucide icon 4×4.
   - Standard CTA: `size="default" variant="default"`, full-width on mobile (`w-full sm:w-auto`).
   - Pages to sweep: Admin, God, Conversion, ImgToPdf, Posts, Chats, Profile, Attendance, Learning, Install, Analytics.

## Day 2 — Phase 3 polish & validation (HIGH)

4. **PWA install flow QA**
   - Confirm SW does NOT register in editor iframe (`id-preview--*`, `lovableproject.com`).
   - On `notesfriendly.lovable.app`: install prompt fires; iOS instructions render; offline shell loads.
   - "Install app" sidebar entry only when `beforeinstallprompt` captured or iOS.

5. **Push notifications QA**
   - Profile toggle requests permission, writes `user_preferences.push_enabled`.
   - When tab hidden + permission granted: incoming `notifications` row triggers `registration.showNotification`.
   - `notificationclick` focuses tab and routes to `/chats` or `/posts/:code`.
   - Per-type filtering via `push_types` jsonb.

6. **Posts rich editor finishing**
   - Markdown shortcut toolbar (B, I, code, quote, list) wired to selection.
   - `@mention` autocomplete debounced against `profiles` (name + student_id), inserts `@[name](user_id)`.
   - Image picker: client downscale to 1600px, upload to `chat-images/posts/{uid}/...`, store `image_path`, render via 1h signed URL.
   - `PostBody` uses `rehype-sanitize` (no raw HTML), mentions render as `<Link>`.

7. **Analytics dashboard QA**
   - `/analytics` gated to god + admin (sidebar + route guard).
   - `analytics_summary()` returns all 5 buckets; charts render: active users, top subjects, daily messages (30d), top posters, storage by subject.
   - Empty-state for fresh DBs (no zero-division crashes).

## Day 3 — Carryovers, accessibility, ship (DONE)

8. **Carryovers** — DONE
   - Attendance threshold counts surfaced via `useNotificationCounts` (sidebar badge on Attendance).
   - `ThreadSheet` opens replies; `ReactionBar` aggregates + optimistic toggle (lucide icons only).
   - Cmd+K wired in `GlobalSearch` with recent searches in localStorage.

9. **Accessibility pass** — DONE (core)
   - `aria-label` added to header icon buttons (Global search, Notifications).
   - Focus-visible ring on search trigger.
   - shadcn `Button` already ships focus-visible ring; remaining icon buttons inherit it.
   - Sidebar cleaned: `Learning Hub` + `Install app` hidden (routes still reachable).

10. **Final sweep** — DONE
    - No `console.log` left in `src/`.
    - Realtime channel-collision bug in `NotificationsPopup` fixed (`crypto.randomUUID()` topic).
    - Ready to publish — pending the user's batched bug list before final push.

---

## Priority key

- **MAJOR (Day 1)**: broken conversion, emoji rule violation, inconsistent buttons — these are the user's explicit complaints.
- **HIGH (Day 2)**: Phase 3 features exist but were never QA'd end-to-end on the live host.
- **MEDIUM (Day 3)**: Phase 2 carryovers + a11y polish before shipping.

## Explicitly excluded

- Plaintext passwords in god panel — not possible (bcrypt only). Stays as "Reset password" action.

## Approval

Approve to start Day 1 immediately; Days 2 and 3 follow as separate build batches so each can be reviewed.
