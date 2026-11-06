# Play the branch locally

Production still runs build 20261105034106. This branch is not released.

From `feat/conquest-living-war-v1`, with Node and the existing Worker dependencies installed:

```sh
npm install --prefix worker --no-audit --no-fund --package-lock=false
node dev/tests/conquest-server.mjs --preview
```

Open the printed local URL, choose CONQUEST, enter and acknowledge the transmission. This is the actual client and authenticated Worker with a disposable in-memory Firebase emulator. It starts with the canonical starter loadout and zero CP/materials. Nothing connects to production accounts, payments or databases. Stopping the server discards its CP, mission and base state; browser settings/discovery can remain.

For Safari on an iPhone on the same trusted Wi-Fi, run:

```sh
CQ_PREVIEW_HOST=0.0.0.0 node dev/tests/conquest-server.mjs --preview
```

Open `http://YOUR_COMPUTER_LAN_IP:8787/index.html` on the phone. The default command binds only to localhost. This local Safari path does not certify a Telegram WebView.

# Time-boxed review

These are suggested review steps, not a recorded human playthrough:

- First 2 minutes: cross the viaduct east, approach actual moving Parasites, tap a hull, FIRE and use DRIVE+FIRE+Dash/Shield. The stock input trace first sees an enemy 28.2s into its route and banks actual salvage at 73.2s.
- Next 10 minutes: try Oxygen, Relay and Signal Recovery; physically collect drops and bank at Refuge X1174 Z1168. Inspect actual rewards, map ownership, Field Veteran trim and base goal. Check heat/cooling during held fire.
- First hour: choose between engineering and saving for the base, then mix patrols, contracts, convoy interception, extraction and the Redoubt. Hard/Veteran sites are authored stronger threats. The continuous automatic starter controller earned Base I at 73.66 accelerated game minutes; the separate ordinary-cycle estimate is 56.25–67.5 minutes. Engineering spending changes that timing.
- Base: approach X1080 Z1160, construct, enter through the open gate and build a module with earned resources. Reactor I costs 180 CP / 12 Alloy / 8 Biomass / 1 Helium and takes 60 server-clock seconds. Reconnect/reload and verify retained state.

For separate retained-base review, run `node dev/tests/conquest-earned-journey.mjs`, then `CQ_EARNED_SAVE=/tmp/lunar-earned-journey.json node dev/tests/conquest-server.mjs --preview`. This continues the genuinely earned accelerated save, rather than gifting base funds. It is not a continuous 80-minute native-input browser recording.

# Remaining acceptance

Record actual device/model, browser/Telegram version and graphics mode. During 30 minutes continuous travel/fighting and 20 minutes dense combat, sample `Conquest.view.performanceReport()` from Web Inspector; retain median/p95, below 50/40/30 FPS percentages, worst hitch, heap when available, geometry/texture/draw counts and any missed touch/reconnect. Try HIGH/LOW/2D and rotation/resume.

**PHYSICAL_IPHONE_NOT_TESTED.** Local/CI software GPU results do not establish physical phone performance. The prescribed device/soak/manual-experience gates still block release. Do not describe this disposable preview as production.
