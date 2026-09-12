# Skip a stone.

Product requirements document · Draft v1 · September 11, 2026

Owner: Chris DiMarco  
Target: a public GPT Site with a playable Three.js game  
Status: specification only. This document does not represent an implemented or published game.

## 1. Product intent

Pick a stone, pull back, and release it nearly level across a beautiful lake. Watch each skip, learn from the throw, and try again. A friend's recorded best can play alongside yours as a faint ghost.

The game should feel good within the first attempt and become more satisfying as players develop control. It should work with a mouse, trackpad, touchscreen, or keyboard. Throw strength must not depend on how quickly someone can move their mouse.

The central design decision is a tradeoff between power and release precision: moderate power produces dependable throws; high power offers a higher ceiling but a smaller clean-release window. Outcomes come from the throw simulation, not a preselected skip count.

### Requirements and proposed decisions

| Status | Decision |
|---|---|
| Required by the request | A 3D Three.js game, public GPT Sites hosting, stone selection, satisfying skips, and a friend's best throw visible beside yours. |
| Visual direction | The two supplied AI-generated screenshots below define the lake, materials, restrained interface, and result presentation. |
| Proposed v1 implementation | Drag distance controls power; release timing controls stone stability. Friend challenges use shareable replay links. No accounts or live multiplayer. |
| Requires tuning during development | Power curve, timing windows, stone balance, bounce coefficients, camera follow, and device quality settings. These are design targets, not validated results. |

## 2. Visual targets

### Throw in progress

![Gameplay visual target](/Users/chrisdimarco/jarvis/projects/skip-a-stone/docs/references/gameplay-target.png)

### Completed personal best

![Result visual target](/Users/chrisdimarco/jarvis/projects/skip-a-stone/docs/references/result-target.png)

Reproduce the clear turquoise shallows, submerged pebbles, darker open water, pine shoreline, layered mountains, warm sunlight, and small reflective slate stones. The lake dominates the screen. Interface elements stay near the edges, with a compact result card after the throw.

These images are art-direction targets, not evidence of implemented graphics or physically exact trajectories. The browser toolbar belongs to the browser and must not be drawn inside the game. Numbers, splash positions, and friend names must come from actual game state.

## 3. Audience and scope

Designed for casual players opening a link for a short break or trying to beat a friend's throw. A typical visit should support several attempts without setup or account creation.

### Required for v1

- One polished alpine lake with calm, consistent conditions.
- Three selectable stones with distinct handling.
- Mouse, trackpad, touch, and keyboard controls.
- Standard and relaxed release timing, with separate records.
- Simulated flight, bounces, sinking, ripples, and sound.
- Skip count, distance, useful release feedback, and immediate retry.
- Device-local personal bests and real friend challenge replays.
- Responsive presentation, quality adaptation, mute, and reduced camera motion.
- A public HTTPS GPT Sites URL verified after deployment.

### Outside v1

Live multiplayer, accounts, cloud profiles, public leaderboards, chat, monetization, collectibles, upgrades, user uploads, multiple lakes, variable wind, daily challenges, and runtime AI generation. No backend service or API key is required for the proposed v1.

## 4. Core player journey

1. Open the site directly into the lake. A flat stone is selected. A brief instruction explains pulling back and releasing when level.
2. Choose a stone or keep the default. Existing personal best appears when available. A valid challenge link loads the friend's recorded throw.
3. Press and drag in the throwing area. Pull distance sets power; sideways movement sets direction. The release indicator sweeps through its level zone.
4. Release. Lock the throw parameters once, simulate the outcome, and animate the player's stone and the comparison ghost together.
5. Count qualifying skips as they happen. Finish with sinking, a compact result, and one useful technique cue.
6. Choose “Throw again.” Preserve the stone, timing mode, and challenge, and return to the shore without reloading assets.
7. After achieving a best, choose “Challenge a friend” to share that completed throw.

No countdown forces the player to throw. Holding through another timing cycle is allowed. The result screen never advances automatically.

## 5. Throw controls

### Pointer and touch

- Press on the selected stone or a generous, indicated launch area to begin preparing a throw. Ordinary interface taps never launch a stone.
- Measure drag displacement relative to the viewport's shorter dimension. Use a dead zone, then map backward displacement to normalized power from 0 to 1, with a visible maximum.
- Sideways displacement sets a bounded heading across the open lake. In calm water, heading changes the path and composition, not the score. Do not imply invisible targets or obstacles.
- Actual pointer speed, event frequency, and display refresh rate must not affect power or release quality.
- Keep power adjustable while holding. Show the power meter and a small side-view stone/tilt gauge with a labeled level band.
- Release once to throw. A tap below the drag threshold selects or prepares the stone without launching it. Provide explicit cancellation; pointer cancellation or loss of focus must not cause an accidental throw.
- Use pointer capture. Restrict touch scrolling prevention to the throwing surface and maintain usable page controls.

### Release timing

The moving tilt gauge represents release stability. It is a gameplay abstraction, not a claim to model all real stone-skipping mechanics.

Start tuning with a smooth, repeatable cycle of approximately 1.6 seconds. At moderate power, target a clean window around 300 ms; at maximum power, around 150 ms. Relaxed mode doubles the cycle duration, preserving the visible range and power tradeoff. Treat these as starting values to test.

The window must narrow continuously as power increases. Poor timing produces visibly steeper or unstable contacts and fewer skips; small errors remain playable. Never secretly reduce the count after a good-looking throw. A short launch arc is derived from the input; a separate manual angle slider is unnecessary in v1.

Use continuous feedback rather than success/failure alone: “Clean release,” “Slightly steep,” or “Too much tilt.” Choose the strongest relevant cue after the throw. Do not always prescribe more power.

### Keyboard and accessibility

Keys 1–3 select a stone when selection is allowed. Left/right adjusts heading; up/down adjusts power. Space begins preparation; a subsequent Space press releases. Escape cancels preparation or pauses playback. Ignore key repeat for begin/release actions.

Provide visible focus, labeled controls, at least 44 CSS-pixel touch targets, text beside color-coded feedback, readable overlays, and a screen-reader result announcement. Relaxed mode is available before throwing and is identified in records and challenges. Reduced-motion mode retains the essential timing indicator but disables camera tracking, screen shake, and decorative motion. Offer a stationary-camera setting independently of sound.

## 6. Stones, scores, and learning

| Stone | Player-facing distinction | Balance requirement |
|---|---|---|
| Flat | Forgiving | Widest stable-release tolerance; useful beginner results at moderate power. Default selection. |
| Thin | More skips | Higher potential skip count with clean technique; larger penalty for tilt errors. |
| Heavy | More distance | Longer travel between successful contacts; lower count ceiling is acceptable and must be honestly communicated. |

Stone choice must affect simulation coefficients, appearance, and sound. It must not simply add a score multiplier.

Primary score is the number of successful airborne rebounds. Distance is the tiebreaker. Measure distance from the first water contact to the final contact, excluding the initial airborne approach. Compare rounded centimeters internally and display meters to one decimal place.

Maintain personal bests separately by stone, timing mode, condition set, and rules version. A challenge fixes the sender's stone, timing mode, and conditions, avoiding an unfair heavy-versus-thin comparison. The player can leave the challenge to try other stones in free play.

A first contact that rebounds counts as skip one. A splash that immediately sinks earns zero. Exactly equal count and distance is a tie; do not label it a win or new best. The result can read “11 skips · 24.6 m,” with “You beat Sam by 2 skips” only when count actually exceeds Sam's count.

Keep the learning loop short: preparation at the player's pace, roughly 3–10 seconds of visible flight, then a result. A weak throw may finish sooner. At the safety duration limit, preserve all valid events and use a natural final sink. Retry becomes available within 500 ms of the completed sink; return to the ready camera within 600 ms without a network request.

## 7. Simulation contract

Use a small deterministic stone-skipping model rather than a general-purpose rigid-body engine unless a prototype demonstrates a need for one.

- Inputs: stone ID, quantized power, heading, release phase/quality, timing mode, condition ID/seed, and rules version.
- State: position, velocity, orientation/stability, airborne/contact/sinking phase, elapsed simulation time, and skip events.
- Integrate ballistic flight at a fixed timestep, initially 1/120 second. Detect contact by crossing the logical water plane and resolve the crossing within the step to avoid tunneling.
- At contact, derive rebound and energy loss from incidence, horizontal speed, stability, and stone coefficients. Stability and forward energy decay over successive contacts.
- Count one skip only when contact produces a qualifying positive rebound. Rearm contact detection after the stone clears the surface tolerance. Final sinking contacts, repeated submerged intersections, and ripple animations never increase the count.
- Rendered small surface waves are cosmetic in v1; they must not introduce different physics on different quality settings.
- Bound simulation duration, speed, particle counts, and iteration count. Reject non-finite input. Never leave a stone bouncing forever or hovering above the water.
- Return a trajectory plus timestamped bounce/sink events and a final result. Score, splashes, sound, ghost playback, and the HUD consume this same event stream.

Quantize parameters before simulating the original throw, not just when sharing it. Precompute the short trajectory so low render FPS cannot change the outcome. Keep simulation independent of Three.js and the DOM. Replay timestamps drive animation; render frames interpolate between simulation samples.

Initial tuning goals: ordinary flat-stone throws produce several skips, improvement is possible after a few attempts, and skilled thin-stone throws can reach double digits. No fixed count is guaranteed. Reject a tuning configuration where maximum power dominates all skill levels or moderate power always wins.

## 8. Friend challenges and persistence

### Sharing a real throw

Use a compact versioned payload in the URL fragment, for example `/#challenge=<encoded-payload>`. This is a proposed client-only architecture, not an already existing service.

The payload contains a schema version, rules version, condition ID/seed, stone ID, timing mode, quantized throw inputs, and an optional short display name. Share the player's best completed throw in the current record category, not a fabricated benchmark or an unfinished attempt.

On import, decode and validate the payload, run the matching simulation, and calculate the friend's count and distance. Never trust a score supplied in the link. Limit encoded payloads to 2 KB and decoded display names to 24 characters; reject unknown fields/types or out-of-range values and render names as text.

These are informal friend challenges. Local input recomputation prevents invented score fields but cannot prove a human made the throw. Do not call the results verified or introduce a ranked leaderboard on this architecture.

Native sharing should be invoked from a user action where supported, with Copy link and selectable-link fallbacks. Dismissing the share sheet does not erase the result. The Web Share API requires a secure context and transient user activation; support varies by browser. [MDN documentation](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share)

### Ghost behavior

Start both throws at simulation time zero. The friend ghost is translucent gold with its own label, while the player's stone remains solid with white effects. Offset only the ghost's rendered trajectory slightly to prevent overlap; preserve its actual score, times, and distance. An endpoint marker identifies where its run ended.

When no challenge exists, offer a ghost of the player's actual personal best or show no ghost. “Sam” is example artwork text and must not appear as a fake friend. If one replay finishes first, its score and endpoint remain visible while the other continues.

### Local records and compatibility

Store versioned best throws and preferences locally. If storage is blocked or full, continue with session-only records and explain that the best could not be saved. No cross-device persistence is promised except through a copied challenge link.

Keep URL schema and physics/rules versions separate. Cosmetic updates may preserve replay compatibility. Scoring changes require a new rules version and record category. Retain old simulation versions where practical; otherwise show “This challenge uses an older version” with a clear free-play action. Never silently recalculate an old challenge under new rules.

## 9. 3D scene, sound, and interface

Build actual 3D stones, near-shore geometry, water, and spatial splash effects. Distant sky or mountain imagery is acceptable as part of the environment. A full-screen generated screenshot with animated dots placed on top does not satisfy the 3D requirement.

Use a perspective camera at the shoreline for aiming. During flight, optional restrained tracking may follow the stone without losing the horizon or suddenly changing direction. Return to the same launch framing on retry. Personal-best results may use the closer water-level framing in the second target. Keep the camera stationary in reduced-motion mode.

Water needs visible shallow depth, submerged stones, coherent reflections, subtle wave normals, and concentric impact ripples. Use bounded particle pools for droplets; older ripples fade while the active impact stays clear. Contact positions must agree with the simulation.

Use physically based stone and shoreline materials, a consistent sun direction, environmental reflections, soft contact shading, and fog for distant depth. Generate or obtain purpose-built assets; do not crop a screenshot containing interface text into the environment.

The HUD shows current skips, the named comparison best when present, stone selection, release controls during preparation, mute/retry, and results only when final. Use the labels from the references where applicable. Main controls should remain legible over bright reflections. On portrait mobile, stack controls below the action and preserve reachable launch and retry targets without obscuring the current splash.

Sound consists of water contact, smaller/faster final skips, a final sink, subtle lake ambience, and restrained record feedback. Audio starts only after user interaction and remains optional. Sound events must not duplicate on pause/resume. No music is required for v1.

## 10. State and failure behavior

| State | Required behavior |
|---|---|
| Loading | Load the minimum playable scene, show progress, and provide retry for asset failure. No dead button over an unfinished scene. |
| Ready | Stone and mode selection, existing best/challenge, and launch instruction. |
| Preparing | Power, heading, and tilt feedback; cancel returns to ready without recording a throw. |
| Flight / skipping | Inputs locked; player and ghost use shared playback time; count only actual events. |
| Sinking | Final contact/effect; no additional skip credited. |
| Result | Final score, comparison, one technique cue, immediate retry, optional sharing. |
| Paused / hidden | Pause playback and audio. Cancel an active pointer preparation safely. Resume without time jumps. |
| Invalid challenge | Explain the link problem and offer free play; never pretend to load a friend's result. |
| Unsupported graphics / lost context | Clear recovery message and retry/reload action. Preserve completed records where possible. |

Current Three.js `WebGLRenderer` uses WebGL 2. Check availability and handle failure before creating the scene. Do not assume a WebGL 1 fallback. [Three.js documentation](https://threejs.org/docs/pages/WebGLRenderer.html)

## 11. Implementation and GPT Sites delivery

Preferred structure: a static TypeScript/Three.js application with a lightweight bundler, HTML/CSS interface, and a pure simulation module. Pin tested dependencies and generate hashed production assets. Proposed module boundaries are `input`, `simulation`, `replay`, `challenge-codec`, `records`, `scene`, `water-effects`, `audio`, and `ui`; avoid separate services for these responsibilities.

The static output must include `index.html` and all required game assets. Use `.openai/hosting.json` with the site's real returned `project_id` and `static.directory` pointing to the supported output directory. The currently installed Sites guidance supports static-only output without Worker bindings. Recheck that contract when implementation begins.

Create a separate Skip a stone Site. Do not reuse or overwrite Pool Sumo's identity or deployment. The owner agent handles registration, credentials, source push, version saving, and deployment. Asset/review agents may return their work without creating or publishing another Site.

Public access is the intended release audience. Before release, validate source and assets, push the exact source state, package that same state with the Sites helper, save a version, and deploy through native Sites tools. Preserve the returned Site/version/deployment IDs in a release receipt. A successful build or guessed URL does not count as publication: require native deployment status `succeeded` with its returned URL and verify anonymous play.

This PRD requests no registration or deployment now. Build and public release occur in the subsequent implementation task under its applicable authorization and current Sites instructions.

## 12. Performance and acceptance

All numbers below are proposed release targets, not measured results.

| Area | Acceptance criterion |
|---|---|
| First load | Playable within 5 seconds on a documented cold-cache 20 Mbps / 100 ms test connection; initial compressed transfer target ≤8 MB. Defer optional high-resolution detail. |
| Desktop rendering | Target 60 FPS; p95 frame time ≤20 ms during a full throw on a recorded reference laptop. |
| Mobile rendering | At least 30 FPS; p95 frame time ≤40 ms on a recorded midrange phone using adaptive quality. |
| Input | Visible power/aim response within 50 ms on reference hardware; the same gesture displacement gives the same settings across device classes. |
| Retry | No page reload or asset fetch; ready within 600 ms after retry input. |
| Stability | 100 consecutive retries without unbounded mesh, texture, audio-node, or event-listener growth. |
| Replay | A shared throw produces identical skip count and displayed distance across tested browsers and render rates. |

Quality settings may reduce render resolution, reflection update rate, distant detail, or particles. They must preserve the stone, splash timing, water depth cues, readable controls, and all scoring. Measure FPS from uncapped wall-clock frame intervals; do not report simulation timestep as rendering performance.

### Required verification before release

- Unit tests for contact counting, final sinking, grazing contacts, deterministic results, invalid inputs, score ties, record partitions, and challenge encoding/version handling.
- Replay fixtures exercised at 30, 60, and 120 Hz render schedules, plus stall/pause cases; rendering schedule must not affect results.
- Browser journeys on desktop mouse, trackpad, keyboard, and a real touch device: launch, poor and clean releases, cancel, retry, change stone, relaxed mode, mute, pause, result, and persistence.
- Create a challenge in one browser, open it in another, verify the actual ghost and score, beat or tie it, and share the new best. Test malformed, oversize, and unsupported-version links.
- Exercise disabled storage, unavailable native sharing, missing assets, and graphics-context failure. The page must offer a usable next action.
- Check desktop, portrait mobile, landscape mobile, enlarged text, reduced motion, and keyboard focus. Emulation alone does not establish real-phone performance.
- Compare ready, skipping, and result screenshots against the two targets. If Dream Loop is used for implementation, require an independent score of at least 8/10 alongside the performance gate; report remaining visual gaps honestly.
- Open the deployed public URL without an owner session, complete a throw, retry, and load a challenge. Save the receipt for this exact published version.

Run a small formative playtest, initially five unfamiliar players: at least four should launch without coaching within 30 seconds, identify the effect of a mistimed release, and voluntarily retry. Watch whether power and stone choice create meaningful decisions. This is a tuning gate, not evidence of retention or virality.

## 13. Build sequence and handoff

| Stage | Deliverable and exit condition |
|---|---|
| 1. Throw prototype | Neutral lake, one stone, real controls and simulation. Repeated throws feel controllable; count and contact tests pass before expensive art work. |
| 2. Replay and stone balance | Three stones, local bests, standard/relaxed modes, challenge codec and ghost. Cross-browser replay fixtures pass. |
| 3. Visual vertical slice | One complete art-directed lake with water, stone, splashes, audio, and the full ready-to-result loop. Meets initial visual and frame-time targets. |
| 4. Product polish | Mobile/keyboard paths, failure states, share fallbacks, version handling, fast retries, playtest-driven tuning, and independent review. |
| 5. Public release | Exact validated version deployed to its own public GPT Site, anonymous play verified, source and release receipt delivered. |

The implementation brief should carry both reference images, this PRD, tested tuning values, and the acceptance checklist. No external product decision blocks a first prototype. Timing windows, bounce behavior, and camera movement remain tuning questions to resolve through that prototype. A requirement for ranked competition, live multiplayer, or cloud accounts would require a scope and architecture revision before adding those features.

### Technical sources checked for this draft

- [Three.js WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html): graphics compatibility, renderer diagnostics, and shader preparation.
- [MDN Navigator.share](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share): native sharing constraints and fallback need.
- Installed Sites 0.1.66 building/hosting guidance: static output, Site identity, source/version packaging, and deployment lifecycle. This platform contract was checked locally; verify the installed version again when building.

## September 12 feature update — approved user request

- Drag the actual launch rock: pull direction aims the shot, pull length sets power; retain keyboard controls and pointer cancellation.
- Default to a low stone-following camera after release. Keep stationary camera and reduced-motion alternatives.
- Four moving toy sailboats award 100/150/200/300 points once each per throw. Share deterministic target phase in challenges; keep boat points separate from skip records.
- Add independently moving body alignment to release angle; power remains controlled by pullback. Both alignment errors affect the simulation. Use a compact horizontal three-meter deck.
- Rules version 2 isolates the new stability and starting-position behavior from published v1 records/challenges. Old data is retained, and old challenge links show the existing version mismatch message instead of silently changing their score.
