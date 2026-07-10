# Task 3 Report: Admin Member Message Modal

## Status

DONE

## Scope completed

- Added a characterization test in `apps/admin/src/tests/adminDataApi.test.js` confirming `mapProfileToAdminMember()` preserves the profile `id` needed for direct member messaging.
- Updated `apps/admin/src/pages/AdminPages.jsx` so traveler and guide `메시지` actions open a dedicated modal instead of dispatching a local-only placeholder payload.
- Wired modal submission to `sendAdminMemberMessage(client, { adminId, memberId, title, body })`.
- Used runtime sender id from `state.auth.admin?.id`.
- Used member id fallback `messageTarget.userId || messageTarget.id` so both traveler rows and guide rows resolve correctly.
- Preserved the existing publishable-key REST client pattern through `createSupabaseRestClient`.
- Kept changes scoped to the two task-owned files.

## TDD / characterization notes

1. Added the required characterization test first:
   - `mapProfileToAdminMember preserves member id for direct messages`
2. Ran the targeted test file before UI changes.
3. Result was already green, which matches the brief's expected characterization path because `mapProfileToAdminMember()` already preserved `id`.
4. Implemented the modal wiring after that verification.
5. Ran the full admin test suite after the UI change.

## Verification

### Characterization run

Command:

```powershell
$env:PATH='C:\Users\kkolk\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;C:\Users\kkolk\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin;' + $env:PATH; node apps/admin/src/tests/adminDataApi.test.js
```

Result:

- PASS
- 16 tests passed

### Full admin suite

Command:

```powershell
$env:PATH='C:\Users\kkolk\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;C:\Users\kkolk\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin;' + $env:PATH; pnpm --dir apps/admin test
```

Result:

- PASS
- 31 tests passed

Note:

- The first sandboxed `pnpm --dir apps/admin test` attempt failed with `spawn EPERM`, so the same command was rerun with escalation and passed cleanly. This was an environment permission issue, not an application failure.

## Implementation details

### `apps/admin/src/pages/AdminPages.jsx`

- Imported `sendAdminMemberMessage`.
- Removed the unused `buildMemberMessagePayload` import from the member-management path.
- Added local state:
  - `messageTarget`
  - `messageError`
- Replaced the traveler and guide `메시지` action handlers so they:
  - open the modal with the clicked row
  - clear any prior modal error
- Added `sendMemberMessage()` that:
  - exits if no target is selected
  - sends via `sendAdminMemberMessage`
  - uses `state.auth.admin?.id`
  - uses `messageTarget.userId || messageTarget.id`
  - dispatches the existing `SEND_MESSAGE` log action on success
  - closes the modal and clears errors on success
  - surfaces a localized fallback error on failure
- Added `MessageModal` near other modal helpers using the exact brief values:
  - title: `회원에게 메시지 보내기`
  - recipient line
  - default title: `운영팀 메시지`
  - body textarea
  - inline error rendering
  - submit button with `Send` icon

### `apps/admin/src/tests/adminDataApi.test.js`

- Imported `mapProfileToAdminMember`.
- Added the required direct-message id preservation test.

## Commit

Created commit:

- `Wire member message button to real chat`

## Concerns

- No functional concerns from this task's owned scope.
- There is still no dedicated UI test coverage for modal interaction in `apps/admin`; current verification relies on the full admin suite plus the required characterization coverage.

---

## Review follow-up: payload coverage and log fallback

### Findings addressed

1. Added focused coverage for the modal submit request shape so the member-message request proves:
   - `adminId` comes from the authenticated admin session
   - guide rows use `target.userId`
   - traveler rows fall back to `target.id`
2. Fixed the success log target fallback so blank `messageTarget.name` now falls back to `messageTarget.email`, then `회원`.

### Implementation

- Added `buildAdminMemberMessageRequest({ adminId, target, title, body })` in `apps/admin/src/lib/adminDataApi.js`.
- Updated `MemberManagement.sendMemberMessage()` in `apps/admin/src/pages/AdminPages.jsx` to use that helper for both:
  - the `sendAdminMemberMessage()` payload
  - the `SEND_MESSAGE` log payload
- Added focused tests in `apps/admin/src/tests/adminDataApi.test.js` for:
  - guide rows resolving `memberId` from `userId`
  - traveler rows resolving `memberId` from `id`
  - preserving the authenticated `adminId`
  - log-target fallback to email when `name` is blank

### TDD evidence

RED:

- After adding the new tests, `node apps/admin/src/tests/adminDataApi.test.js` failed because `buildAdminMemberMessageRequest` was not exported yet.

GREEN:

- After implementing the helper and wiring it into `MemberManagement`, the targeted test file passed.

### Verification evidence

Targeted run:

```powershell
$env:PATH='C:\Users\kkolk\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;C:\Users\kkolk\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin;' + $env:PATH; node apps/admin/src/tests/adminDataApi.test.js
```

- PASS
- 18 tests passed

Full admin suite:

```powershell
$env:PATH='C:\Users\kkolk\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;C:\Users\kkolk\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin;' + $env:PATH; pnpm --dir apps/admin test
```

- Initial sandboxed run failed with `spawn EPERM`
- Escalated rerun passed cleanly
- PASS
- 33 tests passed
