# Security Specification - Honda Logistics T&P

## 1. Data Invariants
- A **Process** must have a unique ID, name, sector, and function. Only authenticated users can manage processes.
- A **Step** must belong to an existing Process.
- A **StudySession** must be linked to a valid Process and a User.
- A **Measurement** must be linked to an active StudySession and a valid Step of the linked Process.
- Sessions cannot be modified once marked as `completed`.
- Measurements can only be added to `in-progress` sessions.

## 2. The Dirty Dozen Payloads (Attack Vectors)
1. **Identity Spoofing**: Attempt to create a `StudySession` with another user's `userId`.
2. **Orphaned Steps**: Create a `Step` without a valid `processId`.
3. **Invalid Process ID poisoning**: Inject a 2KB string as a `processId`.
4. **State Shortcutting**: Directly update a session's `status` from `in-progress` to `completed` without recording any measurements (logic check, but rules should at least guard the field).
5. **Unauthorized Process Modification**: A regular user trying to delete a Process they didn't create (or any Process if system is admin-only for setup).
6. **Timeline Tampering**: Sending a `Measurement` with a `duration` of -100 seconds.
7. **Cross-Session Injection**: Adding a `Measurement` to a session ID that belongs to another user.
8. **Shadow Field Injection**: Adding `isVerified: true` to a `Process` document during creation.
9. **Bulk Read Attack**: Trying to `list` all `study_sessions` without being logged in.
10. **Resource Exhaustion**: Creating 10,000 steps for a single process in one go (guarded by UI usually, but rules should restrict).
11. **Impersonating Admin**: Trying to write to an `admins` collection document.
12. **Post-Completion Edit**: Trying to add a `Measurement` to a session that was finished an hour ago.

## 3. Test Runner (Draft Plan)
We will verify that:
- `create` on `/processes` fails if `!isSignedIn()`.
- `create` on `/study_sessions` fails if `userId != request.auth.uid`.
- `update` on finished sessions fails.
- `create` on measurements fails if session is completed.
