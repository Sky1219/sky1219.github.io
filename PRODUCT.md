# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Industry recruiters** looking at Akash Dasarraju for a summer 2027 internship in ML research or ML systems. They skim quickly, often on a phone, and decide whether to pass the résumé on.
- **Hiring engineers** who check the claims: they read the numbers, open the GitHub repos and Colab links, and try the games to see whether the work is real.
- **HackUTD people and other students** who come by way of the hackathon, the workshops or the campus map.

## Product Purpose

A personal portfolio that gets Akash an internship interview. It shows the work as things a visitor can try, not just read about. A 3D campus tour visits each room where the work happened, and small games run DistilGPT-2 in the browser to show what each project tests. It succeeds when a visitor leaves sure he can both build fast inference systems and do ML research, and reaches out.

## Positioning

The systems work and the research count equally:
- **Systems:** hipinfer, a HIP inference engine written from scratch that decodes faster than llama.cpp, and SubCache, a KV-cache eviction benchmark.
- **Research:** submodular methods in Prof. Rishabh Iyer's CARAML Lab, with papers targeting CVPR and ICML.

The same idea ties the halves together: submodular selection is used for data subsets, agent memory, KV-cache eviction and mnk-bench's labeling.

The interactive proof is specific to him. Every project has a playable game on a real in-browser model, set in a scan of the UT Dallas campus.

## Operating Context

- **Site:** a static site on GitHub Pages (Sky1219.github.io). Built with esbuild and three.js.
- **3D tour:** rooms are GLBs generated from Blender scripts in `tools/`. The places are the CARAML lab and the lecture hall in ECSS, and HackUTD in ECSW.
- **Games:** run DistilGPT-2 in a web worker; the model downloads on first play.
- **Résumé sections:** Projects, Research, Leadership, Education and Skills, and a contact CTA.

## Capabilities and Constraints

- **Games:**
  - subset ("Teach it with 4 sentences")
  - memory ("Pack the context")
  - kv ("Finish the story with 32 slots")
  - mnk (MENACE vs. the LM)
  - roofline ("Beat the memory wall", hipinfer)
  - ctf (prompt-injection CTF, HackUTD)
  - rag (RAG pipeline, workshops)
- **Fallbacks:** a flat fallback for reduced motion or no WebGL.
- **Intro:** an avatar says hello on every load, but not after returning from a tour.
- **Sources of truth:**
  - The latest résumé is `../Projects/resume/Akash_Dasarraju_Resume.tex`.
  - Project figures come from the hipinfer and SubCache READMEs and from `hipinfer/results/SUMMARY.md`.
- **Dates:** show years only, never months.

## Brand Commitments

- **Plain, short copy.** Nothing that sounds AI-written. Game explanations are short and concrete: what is being tested, and what the result means.
- **No private places.** Never mention an apartment, a residential building name or where he lives. hipinfer's tour lives in the CARAML lab.
- **Orange marks interactive links.** The intro tells visitors to click the orange links.
- **Contact line:** "Looking for a summer 2027 internship in ML research or ML systems."

## Evidence on Hand

- **Repos:**
  - hipinfer: README and `results/SUMMARY.md`
  - SubCache: README
  - mnk-bench
- Live measurements are drawn on the screens in `src/screens/`.
- The social image is at `public/og.jpg`.
- **Paper status:** the CVPR and ICML papers are *targeting* those venues. Neither is accepted, so never call them published.
- **Do not fabricate:** there are no testimonials, quotes or press. AMD support is compile-checked only, never benchmarked.

## Product Principles

1. **Show by doing.** A claim is stronger when the visitor can run it.
2. **A recruiter gets it in seconds; an engineer can verify it in minutes.** Make the headline obvious and keep the depth one click away.
3. **Systems and research, one story.** Present them together, not as two people.
4. **Say less, mean it.** Short, specific and true beats impressive-sounding.
