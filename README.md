# Skip a stone.

A browser game built with Three.js. Pull back to choose power, aim sideways, and release when the marker is level. Flat, thin, and heavy stones have different skipping behavior. A friend challenge URL carries the actual throw inputs and reconstructs the replay locally.

Run `npm run dev` and open http://localhost:4322. Run `npm test` for deterministic physics and challenge validation checks. Static deployment output is authored in `dist/`; `.openai/hosting.json` identifies its GPT Site.

The lake combines a generated, reference-derived environment capture with a Three.js water mesh, animated normal-map refraction, and specular response. Stones, ripple rings, splash crowns, droplets, and nearby pebbles are Three.js geometry. The camera is intentionally constrained. This is not an explorable 3D mountain landscape.

Records are local to the browser and separated by stone, timing mode, conditions, and rules version. Challenge links do not contain authoritative scores; results are recomputed. They are casual challenges, not cheat-proof rankings. No account, server database, analytics, or runtime AI is required.

Keyboard: 1/2/3 chooses stone, arrows adjust aim/power, Space prepares then releases, Escape cancels preparation or pauses flight. Focused interface buttons retain normal keyboard behavior. Settings includes slower timing and stationary camera. Audio is optional.

Generated originals and visual targets are retained in `docs/`; they are excluded from the published static directory. Three.js license is in `dist/vendor/THREE-LICENSE.txt`.

Feature update: drag-to-aim launch rock, independently timed body alignment, four deterministic moving boat targets, and a default low stone camera. During flight, water uses world-space normals and reflected environment shading; the distant landscape remains a constrained backdrop. Boat points are separate from skip records. Rules 2 preserves old stored records without comparing them against the new physics; v1 challenge links report a version mismatch.
