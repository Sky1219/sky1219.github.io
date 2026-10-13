// Everything the tours explain. Each tour names its room (see tour/rooms.js) and what plays on that room's
// screen (src/screens/). The steps are in the order the screen shows them: as it moves on, the overlay
// highlights the step it's on, and clicking a step jumps the screen there. A tour's `play` is the game its panel
// offers (src/play/), which runs on the in-browser model and takes over the screen while it's played.
export const PLACES = {
  lab: { building: 'ECSS', name: 'CARAML Research Lab', sub: 'Data-efficient machine learning' },
  hall: { building: 'ECSS', name: 'Lecture Hall', sub: 'HackUTD AI workshops' },
  ecsw: { building: 'ECSW', name: 'HackUTD', sub: 'Student hackathon, 1,300 participants' },
};

export const TOURS = {
  subset: {
    place: 'lab', visual: 'subset', kicker: 'Research, CARAML Lab',
    play: {
      id: 'subset', title: 'Teach it with 4 sentences',
      pitch: 'Pick 4 of 24 sentences about a small town to put in the prompt. DistilGPT-2 is then scored on a passage about the town that it has not seen, next to facility location\'s 4 and a random 4.',
    },
    title: 'Submodular subset selection',
    lede: 'A model trained on a carefully chosen part of a dataset can do nearly as well as one trained on all of it. Submodular functions give a way to score which part to choose.',
    steps: [
      'Every example becomes a point, placed by its embedding.',
      'Facility location scores a subset by how well each example is covered by its most similar pick.',
      'A second pick near one you already have adds little. This diminishing-returns property is what makes the function submodular.',
      'Greedy takes the biggest gain each time, and is guaranteed at least 63% (1 − 1/e) of the best possible score. Lazy greedy skips most of the work by reusing stale gains as upper bounds.',
      'Other submodular functions pick differently. Graph cut favors central, representative examples, and log-determinant favors diverse ones.',
      'Train on the subset and compare it with a random one of the same size.',
    ],
    role: 'In Prof. Rishabh Iyer\'s CARAML Lab I research these methods for data-efficient training, with applications to computer vision and multimodal models.',
  },
  memory: {
    place: 'lab', visual: 'memory', kicker: 'Research, CARAML Lab',
    play: {
      id: 'memory', title: 'Pack the context',
      pitch: 'The last question in a twelve-turn conversation is answered in the first turn. Fit turns into 48 tokens so that DistilGPT-2 can still answer it, then compare with a recency-only pick and a set-cover pick.',
    },
    title: 'Context selection for agent memory',
    lede: 'A long conversation with an AI agent eventually stops fitting in its context window, so only some of the earlier turns can be sent back to the model.',
    steps: [
      'Split the history into turns, each with a token cost, and set a memory budget.',
      'Weight what each turn says by how much the new request needs it, and score a set of turns with probabilistic set cover.',
      'A turn that repeats something already covered adds almost nothing, because the objective is submodular.',
      'Pack with cost-sensitive greedy, by gain per token, until the budget is spent.',
      'Send the chosen turns with the new request, and check the answer has what it needs.',
    ],
    role: 'I\'m developing submodular methods for choosing context from earlier turns in long multi-turn LLM conversations. Two papers are in preparation.',
  },
  kv: {
    place: 'lab', visual: 'kv', live: true, kicker: 'Research and the sub-cache project',
    title: 'Evicting from the KV cache',
    lede: 'While an LLM generates text it keeps a key and a value for every earlier token. At long contexts this cache is what fills GPU memory, so some entries have to be evicted.',
    steps: [
      'Each new token adds a key and value entry to the cache.',
      'With a fixed budget, every new entry means evicting an old one.',
      'There are three baselines. StreamingLLM keeps a sink token and a recent window, H2O keeps heavy hitters, and SnapKV keeps what recent queries attend to.',
      'The submodular policy is facility location over the keys, weighted by the attention each key has received. It keeps the set that best covers what is attended to, so near-duplicate keys don\'t crowd out the rest.',
      'Compare at the same budget. In sub-cache I measure output quality, memory and latency during decoding.',
    ],
    role: 'I\'m investigating submodular KV-cache eviction in the CARAML Lab, advised by a PhD student, and building it as sub-cache (Python, PyTorch) with H2O, StreamingLLM and SnapKV as baselines. The screen starts with simulated attention. You can run it on the real model below to measure the policies on your own text.',
  },
  mnk: {
    place: 'lab', visual: 'mnk', kicker: 'Project, mnk-bench',
    play: {
      id: 'mnk', title: 'Matchboxes vs. the language model',
      pitch: 'DistilGPT-2 plays tic-tac-toe as text, taking the legal square it rates likeliest. MENACE starts out no better, but wins most games after a couple of hundred. You can play against either one.',
    },
    title: 'MENACE for (m, n, k) games',
    lede: 'MENACE is a 1960s learning machine made of matchboxes and beads. mnk-bench extends it from tic-tac-toe to general (m, n, k) games like Gomoku and benchmarks agents across them.',
    steps: [
      'Keep one matchbox for every board position, with beads for each legal move.',
      'To move, draw a random bead from the current position\'s matchbox.',
      'After the game, add beads to the moves that won and remove beads from the moves that lost.',
      'Repeat for thousands of games and graph how the win rate climbs.',
      'Change the board size or the number in a row and compare how fast agents learn.',
    ],
    role: 'I\'m building mnk-bench in Python. It extends MENACE to (m, n, k) games and generates the learning-curve graphs automatically. The learning curves on the screen come from actual MENACE runs.',
  },
  hackutd: {
    place: 'ecsw', visual: 'stage', kicker: 'Leadership, HackUTD',
    play: {
      id: 'ctf', title: 'Prompt-injection CTF',
      pitch: 'A hidden instruction gives DistilGPT-2 a flag and tells it to keep the flag secret. You get 20 tokens to make the model say it, and the stage screen ranks the shortest prompts that worked.',
    },
    title: 'Running HackUTD',
    lede: 'HackUTD is a 1,300-participant collegiate hackathon that takes over ECSW for a weekend. I\'m on the leadership team that organizes it.',
    steps: [
      'I design our CTF competition.',
      'I handle logistics for the weekend.',
      'I organize events.',
      'I coordinate with industry representatives.',
    ],
    role: 'Organizer on the HackUTD leadership team since January 2026.',
  },
  teaching: {
    place: 'hall', visual: 'board', kicker: 'Leadership, HackUTD workshops',
    play: {
      id: 'rag', title: 'Build the RAG pipeline',
      pitch: 'On its own, DistilGPT-2 names the wrong city for HackUTD. Choose which of five documents goes into the prompt and see whether the answer changes.',
    },
    title: 'Teaching AI workshops',
    lede: 'In my workshops, hundreds of HackUTD participants learn how current AI systems are put together and then build one themselves.',
    steps: [
      'Retrieval-augmented generation: look up the relevant documents, then answer from them.',
      'Model Context Protocol: one standard way to connect tools and data to any AI app.',
      'Agents and tools: the model calls tools in a loop until it can answer.',
      'Hands-on: everyone builds a small agent with a RAG tool.',
    ],
    role: 'I teach workshops on building with AI for hundreds of HackUTD participants.',
  },
};
