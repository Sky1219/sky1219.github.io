// Everything the tours explain. Each tour names its room (see tour/rooms.js) and what plays on that room's
// screen (src/screens/). The steps are in the order the screen shows them: as it moves on, the overlay
// highlights the step it's on, and clicking a step jumps the screen there. A tour's `play` is the game its panel
// offers (src/play/), which runs on the in-browser model and takes over the screen while it's played.
export const PLACES = {
  lab: { building: 'ECSS', name: 'CARAML Research Lab', sub: 'Data-efficient machine learning' },
  hall: { building: 'ECSS', name: 'Lecture Hall', sub: 'HackUTD AI workshops' },
  ecsw: { building: 'ECSW', name: 'HackUTD', sub: 'Student hackathon, 1,300 participants' },
  home: { building: 'CH6', name: 'My apartment', sub: 'Canyon Creek Heights South', latlon: '32.981 N  96.755 W' },
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
    role: 'In Prof. Rishabh Iyer\'s CARAML Lab I work on submodular methods for learning from less. My current paper turns the same idea into a training loss: submodular losses with hard negatives that teach CLIP-style vision-language models which attributes belong to which objects. I trained and evaluated several loss functions and generated the training data, and the paper is targeting CVPR. The same data-selection idea picked which game positions to label in mnk-bench.',
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
      'Send the chosen turns with the new request, and check the answer against what top-k and MMR retrieval would have sent.',
    ],
    role: 'I\'m developing a submodular method that chooses which past turns an LLM agent keeps under a fixed token budget. I test it against top-k and MMR retrieval on the LoCoMo benchmark, self-hosting Qwen2.5-32B with vLLM on an A6000 in the lab. The paper is in preparation, targeting ICML.',
  },
  kv: {
    place: 'lab', visual: 'kv', kicker: 'Project, SubCache',
    play: {
      id: 'kv', title: 'Finish the story with 32 slots of memory',
      pitch: 'DistilGPT-2 reads an 86-token story with room for only 32 of them in its memory, so once it is full every new token pushes one out. Pin the tokens it must keep; the rest roll with the newest. The story ends on two names from its start, and the screen shows whether the model still knew them, next to what the real eviction policies kept.',
    },
    title: 'Evicting from the KV cache',
    lede: 'While a language model generates text it keeps a key and a value for every earlier token, which is how it remembers what came before. At long contexts this cache is what fills GPU memory, so some entries have to be evicted, and which ones decides whether the model can still remember the start.',
    steps: [
      'Each new token adds a key and value entry to the cache.',
      'With a fixed budget, every new entry means evicting an old one.',
      'There are three baselines. StreamingLLM keeps a sink token and a recent window, H2O keeps heavy hitters, and SnapKV keeps what recent queries attend to.',
      'The submodular policy is facility location over the keys, weighted by the attention each key has received. It keeps the set that best covers what is attended to, so near-duplicate keys don\'t crowd out the rest.',
      'Compare at the same budget. In SubCache I measure output quality, memory, throughput and latency during decoding.',
    ],
    role: 'SubCache is my open-source KV-cache compression benchmark (Python, PyTorch). On DeepSeek-Coder 1.3B and TinyLlama, keeping a quarter of the cache fit three times as many concurrent requests on one GPU and raised throughput 2.8x, which is 64% less per token, for a 5% rise in perplexity. It compares five eviction methods on an RTX 2080 Ti and an A6000, and my own method beat H2O on output quality by up to 1.4% on agent workloads. The screen starts with simulated attention. Run it on the real model below to measure the policies on your own text.',
  },
  mnk: {
    place: 'lab', visual: 'mnk', kicker: 'Project, mnk-bench',
    play: {
      id: 'mnk', title: 'Matchboxes vs. the language model',
      pitch: 'DistilGPT-2 plays tic-tac-toe as text, taking the legal square it rates likeliest. MENACE starts out no better, but wins most games after a couple of hundred. You can play against either one.',
    },
    title: 'MENACE for (m, n, k) games',
    lede: 'MENACE is a 1960s learning machine made of matchboxes and beads. mnk-bench puts it on the same bench as nine other ways to play, from classic search to a self-play neural network and an LLM, on (m, n, k) games from tic-tac-toe to Gomoku.',
    steps: [
      'Keep one matchbox for every board position, with beads for each legal move.',
      'To move, draw a random bead from the current position\'s matchbox.',
      'After the game, add beads to the moves that won and remove beads from the moves that lost.',
      'Repeat for thousands of games and graph how the win rate climbs.',
      'Change the board size or the number in a row, swap in another agent, and compare how fast each one learns.',
    ],
    role: 'I built mnk-bench in Python and PyTorch, with a CLI, 118 tests and CI. Its 39k-parameter AlphaZero-style network trains by self-play in under 15 minutes per board on one CPU core, never lost to a perfect player at tic-tac-toe or 4\u00d74, and matched the strongest search agent at Connect Four. I also borrowed my lab\'s data-selection research to choose which positions to label to fix an agent\'s tactical blind spots, and it found 2 to 3x more useful examples than picking at random. The learning curves on the screen come from actual MENACE runs.',
  },
  hipinfer: {
    place: 'home', visual: 'hipinfer', kicker: 'Project, hipinfer',
    title: 'An inference engine in HIP',
    lede: 'When a language model writes one token at a time, the GPU spends most of its time waiting for memory rather than doing math. hipinfer is my decode engine for TinyLlama-1.1B, written as HIP kernels, and it gets within 13% of that memory speed limit on my own RTX 2080 Ti.',
    steps: [
      'Every token reads all 2.2 GB of weights. At 616 GB/s that takes 3.57 ms, so no engine on this card can beat 3.57 ms per token.',
      'Fuse the small kernels. RMSNorm, RoPE and the q/k/v projection run as one launch, so activations stop making round trips to memory between them.',
      'Attention in the FlashAttention-2 style. Tiles of K and V stream through shared memory while the softmax is kept running, so the score row never exists in memory.',
      'Split-K GEMV. At batch 1 every matrix multiply is a matrix times a vector, which leaves most of the GPU idle. Splitting the inner dimension four ways gives every SM a share.',
      'Check and measure. The output is token-identical to Hugging Face, and then every engine is timed on the same card.',
    ],
    role: 'I wrote hipinfer in my apartment, on my own RTX 2080 Ti. The attention, split-K GEMM and fused RMSNorm and RoPE kernels are mine, as is the benchmark harness. It decodes TinyLlama-1.1B at 4.1 ms per token, 87% of the memory-bandwidth limit, which is 8 to 16% faster than llama.cpp and vLLM and 6x faster than Hugging Face. It is verified on NVIDIA GPUs; the AMD builds have not run on hardware yet.',
  },
  hackutd: {
    place: 'ecsw', visual: 'stage', kicker: 'Leadership, HackUTD',
    play: {
      id: 'ctf', title: 'Prompt-injection CTF',
      pitch: 'A hidden instruction gives DistilGPT-2 a flag and tells it to keep the flag secret. You get 20 tokens to make the model say it, and the stage screen ranks the shortest prompts that worked.',
    },
    title: 'Running HackUTD',
    lede: 'HackUTD is a 1,300-participant collegiate hackathon that takes over ECSW for a weekend, with sponsors like T-Mobile. I\'m on the leadership team that organizes it.',
    steps: [
      'I design our CTF competition.',
      'I handle logistics for the weekend.',
      'I organize events.',
      'I coordinate with sponsors such as T-Mobile.',
    ],
    role: 'Organizer on the HackUTD leadership team since 2026.',
  },
  teaching: {
    place: 'hall', visual: 'board', kicker: 'Leadership, HackUTD workshops',
    play: {
      id: 'rag', title: 'Build the RAG pipeline',
      pitch: 'On its own, DistilGPT-2 names the wrong city for HackUTD. Choose which of five documents goes into the prompt and see whether the answer changes.',
    },
    title: 'Teaching AI workshops',
    lede: 'HackUTD runs 10 AI workshops. I led 5 and assisted 5, and after we redesigned how topics get picked, average attendance tripled from 30 to over 100. Everyone leaves having built something that works.',
    steps: [
      'Retrieval-augmented generation: look up the relevant documents, then answer from them.',
      'Model Context Protocol: one standard way to connect tools and data to any AI app.',
      'Agents and tools: the model calls tools in a loop until it can answer.',
      'Hands-on: everyone builds a small agent with a RAG tool.',
    ],
    role: 'I lead workshops on building with AI for hundreds of HackUTD participants, and redesigned the topic selection across all 10 of them.',
  },
};
