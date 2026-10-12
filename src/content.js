// Everything the tours explain. Each tour names its room (see tour/rooms.js) and what plays on that room's
// screen (src/screens/). The steps are in the order the screen shows them: as it moves on, the overlay
// highlights the step it's on, and clicking a step jumps the screen there.
export const PLACES = {
  lab: { building: 'ECSS', name: 'CARAML Research Lab', sub: 'Data-efficient machine learning' },
  hall: { building: 'ECSS', name: 'Lecture Hall', sub: 'HackUTD AI workshops' },
  ecsw: { building: 'ECSW', name: 'HackUTD', sub: '1,300 hackers, one weekend' },
};

export const TOURS = {
  subset: {
    place: 'lab', visual: 'subset', kicker: 'Research, CARAML Lab',
    title: 'Learning from less data',
    lede: 'A well-chosen slice of a dataset can train a model nearly as well as all of it. Submodular functions make "well-chosen" precise.',
    steps: [
      'Every example becomes a point, placed by its embedding.',
      'Facility location scores a subset by how well each example is covered by its most similar pick.',
      'Diminishing returns: a second pick near one you already have adds little. That is what makes it submodular.',
      'Greedy takes the biggest gain each time, and is guaranteed at least 63% (1 − 1/e) of the best possible score. Lazy greedy skips most of the work by reusing stale gains as upper bounds.',
      'Other submodular functions pick differently: graph cut favors central, representative examples; log-determinant favors diverse ones.',
      'Train on the subset and compare it with a random one of the same size.',
    ],
    role: 'In Prof. Rishabh Iyer\'s CARAML Lab I research these methods for data-efficient training, with applications to computer vision and multimodal models.',
  },
  memory: {
    place: 'lab', visual: 'memory', kicker: 'Research, CARAML Lab',
    title: 'Choosing what an agent remembers',
    lede: 'Long conversations with an AI agent outgrow its context window. Something has to decide which earlier turns get sent back to the model.',
    steps: [
      'Split the history into turns, each with a token cost, and set a memory budget.',
      'Weight what each turn says by how much the new request needs it, and score a set of turns with probabilistic set cover.',
      'Turns that repeat something already covered add almost nothing: the objective is submodular.',
      'Pack with cost-sensitive greedy, by gain per token, until the budget is spent.',
      'Send the chosen turns with the new request, and check the answer has what it needs.',
    ],
    role: 'I\'m developing submodular methods for choosing context from earlier turns in long multi-turn LLM conversations. Two papers are in preparation.',
  },
  kv: {
    place: 'lab', visual: 'kv', live: true, kicker: 'Research and the sub-cache project',
    title: 'Evicting from the KV cache',
    lede: 'While an LLM generates text it keeps a key and a value for every earlier token. At long contexts that cache, not the model weights, fills GPU memory, so some entries have to go.',
    steps: [
      'Each new token adds a key and value entry to the cache.',
      'With a fixed budget, every new entry means evicting an old one.',
      'The baselines: StreamingLLM keeps a sink token and a recent window, H2O keeps heavy hitters, SnapKV keeps what recent queries attend to.',
      'A submodular policy, facility location over the keys weighted by the attention each has received, keeps the set that best covers what is attended, so near-duplicates don\'t crowd out the rest.',
      'Compare at the same budget. In sub-cache I measure output quality, memory and latency during decoding.',
    ],
    role: 'I\'m investigating submodular KV-cache eviction in the CARAML Lab, advised by a PhD student, and building it as sub-cache (Python, PyTorch) with H2O, StreamingLLM and SnapKV as baselines. The screen starts on simulated attention; run it on the real model below to measure the policies on your own text.',
  },
  mnk: {
    place: 'lab', visual: 'mnk', kicker: 'Project, mnk-bench',
    title: 'Teaching matchboxes to play',
    lede: 'MENACE is a 1960s learning machine made of matchboxes and beads. mnk-bench extends it from tic-tac-toe to general (m, n, k) games like Gomoku and benchmarks agents across them.',
    steps: [
      'Keep one matchbox for every board position, with beads for each legal move.',
      'To move, draw a random bead from the current position\'s matchbox.',
      'After the game, add beads to the moves that won and remove beads from the moves that lost.',
      'Repeat for thousands of games and graph how the win rate climbs.',
      'Change the board size or the number in a row and compare how fast agents learn.',
    ],
    role: 'I\'m building mnk-bench in Python. It extends MENACE to (m, n, k) games and generates the learning-curve graphs automatically. The learning curves on the screen are real MENACE runs.',
  },
  hackutd: {
    place: 'ecsw', visual: 'stage', kicker: 'Leadership, HackUTD',
    title: 'Running HackUTD',
    lede: 'HackUTD is a 1,300-participant collegiate hackathon that takes over ECSW for a weekend. I\'m on the leadership team that organizes it.',
    steps: [
      'Design our CTF competition.',
      'Handle logistics.',
      'Organize events.',
      'Coordinate with industry representatives.',
    ],
    role: 'Organizer on the HackUTD leadership team since January 2026.',
  },
  teaching: {
    place: 'hall', visual: 'board', kicker: 'Leadership, HackUTD workshops',
    title: 'Teaching AI to a full room',
    lede: 'My workshops teach hundreds of HackUTD participants how modern AI systems are put together, and then they build one.',
    steps: [
      'Retrieval-augmented generation: look up the relevant documents, then answer from them.',
      'Model Context Protocol: one standard way to connect tools and data to any AI app.',
      'Agents and tools: the model calls tools in a loop until it can answer.',
      'Hands-on: everyone builds a small agent with a RAG tool.',
    ],
    role: 'I teach AI skills and usage in workshops for hundreds of HackUTD participants.',
  },
};
