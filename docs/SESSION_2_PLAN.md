# Session 2 implementation plan / ledger
Spec: user's Session 2 instructions and docs/SESSION_1_APPROVED_AMENDMENTS.md; /workspace/WAR_MACHINE_LAB_ARCHITECTURE.md.

1. Add failing owner account tests: deterministic two-slot migration, preservation, strict save/rename/activate, conflict/ownership, read failures. Implement shared rules and authoritative account API. Test new client capability while preserving legacy accounts pending reconciliation.
2. Add failing frozen-loadout tests across modes and PvP; implement immutable ticket/room snapshots and transient owned chassis counterpick, preserving old tickets. No combat/stat formulas changed.
3. Add browser tests for two cards/edit/save/equip/sync and narrow display. Implement client revision adapters and mobile Engineer selection screen using owned gear. Keep upgrades account-wide.
4. Run isolated existing backend/PvP/farm suites and browser regressions, record exact results and unverified cases; fresh whole-branch review then fix material findings. No commits/pushes/deploys required; preserve working branch changes.

Shared interfaces: rules Lab record -> eco pub/API -> client applyEco and UI; canonical L -> frozen AI ticket/PvP room -> transient counterpick/proof. Same pure rules compiled for browser/worker.
Ruling: use native execution with a final reviewer; approval explicitly requests implementation without another design checkpoint.
Ruling: keep worktree outside source checkout; original tree remains untouched except an ignored generated sim from baseline tests.
Baseline: node dev/tests/wtest/test.mjs passed (see /tmp/lunar-baseline.log); other baseline suites run below.

Task 1: tests RED (Lab v1 absent) -> GREEN: node dev/tests/wtest/lab.mjs. Owner-only migration/actions, inventory/points preserved, shape/ownership/revision guards, failed reads covered. No extra slot grant or pricing.
Task 2: tests RED (unowned proof class accepted) -> GREEN: node dev/tests/wtest/lab-battle.mjs. Frozen class/HP/speed variants; detached PvP seat and rejoin snapshot; no combat formulas changed.
Task 3: browser RED (server Lab absent) -> GREEN: python dev/tests/lab-browser.py. Two cards/edit/equip/reload/stale reply/six-mode capture at 320/390 2D/high.
Baseline: economy 189/0; PvP 106/0; farm 46/1, reminder-batch failure before feature edits. Do not label whole suite green.
Ruling: leave working diff uncommitted on feature branch; no external actions.

Final review: fresh independent read-only reviewer found five Important issues, no Critical: authoritative ticket vs cached stats, Firebase sparse cores, acquisition auto-equip, phase-valid proof changes, pending migration placeholder.
Final fixed: authoritative L adoption before VS start and wait for ticket; regression simulates other-device Hull upgrade.
Final fixed: normalize fixed three socket indices on ecoNorm; sparse/empty/trailing arrays tested RED -> GREEN.
Final fixed: server labGain preserves acquired Moonbeam/paint/selected-family upgrades without client-only selection; purchase auto-equip regression RED -> GREEN. Payment verification/accounting is untouched.
Final fixed: round markers need elimination/timeout evidence and maximum 5 rounds; capture end-of-round sample. Forged phase regression RED -> GREEN.
Final fixed: successful old migration replaces starter placeholder before Lab clone; selected Rare regression RED -> GREEN.
Additional fix: owner-only PvP go message supplies frozen chassis choices; client VS reads these, not latest inventory. RED -> GREEN test.
Ruling: preserve legacy purchase auto-equip through shared rules instead of silently dropping existing behavior. No new purchase SKU or accounting logic.
Ruling: Lab fields are capability-migrated on sync after existing S.mig reconciliation; anonymous/offline browser play remains available with the legacy selection flow.
Final fix: capture end-of-round proof before AI counterpick rebuild can refill HP. Deterministic browser regression observed hp100 (RED), then hp0 (GREEN).
Final fixture correction: repeated browser tests use unique fake account IDs to avoid active-slot residue in the persistent in-memory test server. The earlier repeat-fixture failure is preserved.
Final compatibility fix: migrated accounts require Lab revision capability for new AI/PvP starts; old clients receive update instead of a ticket that could produce false loadout flags. Pending legacy results/rooms remain accepted. RED -> GREEN backend regression.
Final evidence: economy189/0; PvP106/0; Lab account/battle/parity PASS; Lab browser PASS; 7 Lab simulated matches proof PASS; existing proofreal64/0; QA five sizes0 issues. Farm baseline46/1 remains. See implementation report for timing and remaining limits.

Preservation authorization: user accepted Session 2 and requested a local commit on the existing feature branch. This supersedes the earlier decision to leave the diff uncommitted. Temporary test logs moved outside Git to /workspace/lunar-session2-preserved-logs/; implementation, regression tests, architecture/amendments/report and reviewed screenshots included. No push/merge/deploy or Session 3.
