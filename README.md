# akash-portfolio

A résumé site where the orange links open a tour of UT Dallas. Clicking one breaks the page into a grid from
the link outward, campus scans itself in around the building, the camera flies to it and stops at the wall,
and the view breaks into blocks and resolves into the room, with the room's name decoding over it. Inside,
people made of light are at work, I'm there as a hologram modelled on me, and the camera walks up to the screen
where the work is running: real code, logs and plots on the lab computer, slides in the lecture hall, the live
dashboard at HackUTD. The explanation overlays the room; its highlighted step follows the screen, and clicking
a step jumps the screen there. "Look around" pulls back to see the room.

| Link | Room | Screen |
|---|---|---|
| Subset selection, agentic memory, KV-cache eviction, mnk-bench | CARAML Research Lab, ECSS | the computer at the back left |
| Teaching AI workshops | a lecture hall in ECSS | the projector: RAG, MCP, agents and tools, hands-on |
| Organizing HackUTD | ECSW during the hackathon | the stage screen dashboard |

## The real model on the KV-cache screen

The KV-cache tour can switch from simulated attention to a real language model running in the visitor's
browser: DistilGPT-2 (82M parameters), on a GPT-2 implementation written from scratch in plain JavaScript
(`src/llm/gpt2.js`: int8 weights with one scale per row, fp32 activations, and an explicit per-layer KV cache).
The same text goes through the full cache and four eviction policies at the same budget (`src/llm/policies.js`:
StreamingLLM, H2O, SnapKV, and attention-weighted facility location over the cached keys), in parallel workers.
The screen shows the model's real attention, which tokens each policy made harder to predict, and the measured
perplexity, agreement with the full cache and speed. Nothing leaves the visitor's device.

It matches PyTorch: on the default passage the last-token logits have cosine similarity 1.0000 with Hugging
Face's fp32 model, and perplexity is 35.9 against 36.3 (the difference is the int8 weights).

The weights live in `public/model/` (85 MB in 14 MB chunks, downloaded only when a visitor asks). To rebuild them:

```sh
python -c "from huggingface_hub import snapshot_download; print(snapshot_download('distilbert/distilgpt2', allow_patterns=['config.json','vocab.json','merges.txt','model.safetensors']))"
python tools/pack_gpt2.py <the folder that printed> public/model
```

## Run it

```sh
npm install
npm run dev      # http://localhost:5173, rebuilds on save
npm run build    # writes dist/, a static site you can host anywhere
```

Live at https://sky1219.github.io. Every push to `main` rebuilds and redeploys it through GitHub Actions
(`.github/workflows/pages.yml`). It also works on Vercel: framework preset "Other", build command `npm run build`,
output directory `dist`.
The page opens a tour directly from its link too, for example `/#kv`.

## Where things live

- `src/index.html`, `src/styles.css`: the page. Résumé text is written straight into the HTML. The hero map is
  campus at night, drawn from `src/campus-plan.svg`.
- `src/content.js`: every tour's room, title, explanation, steps and "My part".
- `src/warp.js`: the way in (the grid wave from the link) and the block transition into a room.
- `src/screens/`: what runs on each room's screen, drawn on a canvas (`subset`, `memory`, `kv`, `mnk`,
  `hackathon`, `board`). `kit.js` has the shared look: panes, highlighted Python, plots, a terminal. The
  subset picks and MENACE runs are computed for real; the KV-cache attention, the agent session and the
  accuracy curves are simulated or illustrative, and the screens say so.
- `src/tour/`: the 3D. `campus.js` draws campus at night from the HackUTD map's building models and the
  OpenStreetMap footprints, with the scan-in; `rooms.js` loads the rooms and sets their lighting and camera
  paths; `people.js` builds the light people and my avatar; `index.js` runs the flight and the camera.
  three.js and the rooms only load when someone opens a tour.
- `public/rooms/*.glb`: the three rooms and the avatar, modelled in Blender. Sources: `assets/rooms.blend`
  (scenes Lab, Hall and Atrium; each room has empties named `cam_start` and `screen_target`) and
  `assets/avatar.blend` (one mesh per body part, named like the rig's parts in `people.js`). Export with
  File > Export > glTF (.glb), "Active scene" on, into `public/rooms/`.
- `public/data/`: campus geometry. `campus3d.*` come from the HackUTD CTF map; `site.json` and
  `src/campus-plan.svg` are made by `python3 tools/prep.py <path to the CTF repo's public/map/data>`.

With no WebGL, or for anyone who prefers reduced motion, a link opens the screen flat on the page with the same
explanation beside it.

`src/visuals/`, `src/games/` and `src/screen.js`, if present, are from earlier designs and no longer used.
