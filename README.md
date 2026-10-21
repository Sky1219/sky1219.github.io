# akash-portfolio

A résumé site where the orange links open a 3D tour of UT Dallas. Clicking one flies the camera across campus
to the building where that work happens and into the room. Each room has a screen showing the work: code,
logs and plots on the lab computer, slides in the lecture hall, and the live dashboard at HackUTD. An
explanation overlays the room. Its highlighted step follows the screen, and clicking a step jumps the screen
there. "Look around" pulls the camera back to show the room, which has other people in it and an avatar of me,
and from there you can drag to look round. On the page itself, hovering a link floats a live view of that room's
screen, and the same link lights its building on the map.

| Link | Room | Screen |
|---|---|---|
| Subset selection, agentic memory, KV-cache eviction, mnk-bench, hipinfer | CARAML Research Lab, ECSS | the computer at the back left |
| Teaching AI workshops | a lecture hall in ECSS | the projector: RAG, MCP, agents and tools, hands-on |
| Organizing HackUTD | ECSW during the hackathon | the stage screen dashboard |

## The KV-cache game

The KV-cache tour's game runs a real language model in the visitor's browser: DistilGPT-2 (82M parameters), on a
GPT-2 implementation written from scratch in plain JavaScript (`src/llm/gpt2.js`: int8 weights with one scale per
row, fp32 activations, and an explicit per-layer KV cache that a policy can evict from). The model reads a short
story through a cache of 32 entries per layer; the visitor pins the tokens it must keep, and the same story goes
through four eviction policies at the same budget (`src/llm/policies.js`: StreamingLLM, H2O, SnapKV, and
attention-weighted facility location over the cached keys) and the full cache, in parallel workers. The score is
the probability the model gave each of the two names the ending comes back to, and its perplexity on the ending.
Nothing leaves the visitor's device.

The model matches PyTorch: on a test passage the last-token logits have cosine similarity 1.0000 with Hugging
Face's fp32 model, and perplexity is 35.9 against 36.3 (the difference is the int8 weights).

## The games

Every tour has a game in its panel, played on that same in-browser DistilGPT-2 (one
download, shared: `src/llm/engine.js` holds the model in a pool of workers, and the KV-cache experiment and the
games all send their work through it). The controls are in the panel; the room's screen shows the result, and
clicking a step hands the screen back to the walkthrough.

| Tour | Game | What is measured |
|---|---|---|
| hipinfer | Tune TinyLlama to beat the memory wall | This device's decode time and memory bandwidth on DistilGPT-2, then a roofline plan for TinyLlama-1.1B on the RTX 2080 Ti (fitted to hipinfer's measured runs: 4.13 ms at batch 1, about 7,500 tok/s at 64) against four challenges |
| KV-cache eviction | Keep 32 of 86 tokens and see if it remembers | P(each name) when the ending reaches it, and perplexity on the ending, with your pinned tokens against StreamingLLM, H2O, SnapKV, facility location and the full cache at a 32-entry budget |
| Subset selection | Teach a model with 4 sentences | Perplexity on a held-out passage after your 4 of 24 sentences, facility location's 4 and a random 4 |
| Agentic memory | Pack a conversation into 48 tokens | Probability of the right answer token from the turns you fit in 48 tokens, against recency-only and set cover |
| mnk-bench | Play tic-tac-toe against matchboxes and an LLM | MENACE (O) against DistilGPT-2 (X), which scores each legal move as the next token of the game written as text |
| Teaching workshops | Fix the model's answer with retrieval | Next-token probabilities, and the 8-token answer, for a question about HackUTD with each of five documents retrieved |
| HackUTD | Prompt-inject the model to leak a flag | Whether a hidden flag turns up in the model's next 12 tokens after your suffix of at most 20; shortest working prompts ranked |

Nothing in them is scripted: the numbers are whatever the model does on the visitor's machine. Facility location
runs on idf-weighted means of the model's token embeddings and never sees the passage. The CTF leaderboard is
kept in the visitor's own browser (`localStorage`), since the site has no server; the organizers' entry on it is
a real prompt, measured like any other.

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

On Vercel: framework preset "Other", build command `npm run build`, output directory `dist`.
The page opens a tour directly from its link too, for example `/#kv`.

## Where things live

- `src/index.html`, `src/styles.css`: the page. Résumé text is written straight into the HTML. The hero map is
  campus at night, drawn from `src/campus-plan.svg`.
- `src/content.js`: every tour's room, title, explanation, steps and "My part".
- `src/intro.js`: the hello a moment after the page loads: my avatar pops up in the corner, waves, and says the
  orange links are worth clicking. On every load, but not after a tour has been opened (so not on the way back from one), nor with reduced motion.
- `src/warp.js`: the way in (the grid wave from the link) and the block transition into a room.
- `src/screens/`: what runs on each room's screen, drawn on a canvas (`subset`, `memory`, `kv`, `mnk`,
  `hackathon`, `board`, `hipinfer`). `kit.js` has the shared look: panes, highlighted Python, plots, a terminal. The
  subset picks and MENACE runs are computed for real; the KV-cache attention, the agent session and the
  accuracy curves are simulated or illustrative, and the screens say so.
- `src/play/`: the games. `index.js` mounts a tour's game in its panel once the model is there; each game file
  has its content, its logic, its panel controls and its view for the room's screen. `content.js` says which
  tour gets which (`play`).
- `src/llm/`: the in-browser model. `gpt2.js` is the model, `worker.js` what a worker can be asked (a KV-cache
  run, scoring a prompt, an embedding), `engine.js` the shared download and worker pool, `policies.js` the KV-cache
  eviction policies.
- `src/tour/`: the 3D. `campus.js` draws campus at night from the HackUTD map's building models and the
  OpenStreetMap footprints, with the scan-in; `rooms.js` loads the rooms and sets their lighting and camera
  paths; `people.js` builds the light people and my avatar; `index.js` runs the flight and the camera.
  three.js and the rooms only load when someone opens a tour.
- `public/intro/intro.glb`: the opening intro's models (src/boot.js): a graphics card, a GPU package, a memory stick, a neural network, an attention pattern, a stopwatch and a gauge, from `blender -b --factory-startup --python tools/build_intro.py`.
- `public/rooms/*.glb`: the three rooms and the avatar, modelled in Blender. Sources: `assets/rooms.blend`
  (scenes Lab, Hall and Atrium; each room has empties named `cam_start` and `screen_target`) and
  `assets/avatar.blend` (one mesh per body part, named like the rig's parts in `people.js`). Export with
  File > Export > glTF (.glb), "Active scene" on, into `public/rooms/`. The lab is generated instead, after a
  photo of the real room: `blender -b assets/rooms.blend --python tools/build_lab.py` rebuilds the Lab scene and
  exports it. The two labmates in that photo are modelled the same way as the avatar, by
  `blender -b --factory-startup --python tools/build_labmates.py` (`public/rooms/labmates.glb`). The lab generator builds
  from `tools/roomkit.py` (materials, boxes, the furniture, export and preview).
- `public/data/`: campus geometry. `campus3d.*` come from the HackUTD CTF map; `site.json` and
  `src/campus-plan.svg` are made by `python3 tools/prep.py <path to the CTF repo's public/map/data>`;
  `python3 tools/prep.py --plan` redraws the hero map alone from `site.json`.

With no WebGL, or for anyone who prefers reduced motion, a link opens the screen flat on the page with the same
explanation beside it.

`src/visuals/`, `src/games/` and `src/screen.js`, if present, are from earlier designs and no longer used (the
games are in `src/play/`).
