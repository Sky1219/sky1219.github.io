// The screen for each tour, by the name content.js gives it (tour.visual).
import { SubsetScreen } from './subset.js';
import { MemoryScreen } from './memory.js';
import { KvScreen } from './kv.js';
import { MnkScreen } from './mnk.js';
import { HackathonScreen } from './hackathon.js';
import { BoardScreen } from './board.js';
import { HipinferScreen } from './hipinfer.js';

const SCREENS = { subset: SubsetScreen, memory: MemoryScreen, kv: KvScreen, mnk: MnkScreen, hackathon: HackathonScreen, stage: HackathonScreen, board: BoardScreen, hipinfer: HipinferScreen };
export const makeScreen = (id, w, h) => new SCREENS[id](w, h);
