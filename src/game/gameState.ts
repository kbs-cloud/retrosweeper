export interface Cell {
  x: number;
  y: number;
  isMine: boolean;
  isRevealed: boolean;
  isFlagged: boolean;
  neighborMines: number;
}

export interface Player {
  id: string;
  name: string;
  assignedEmail: string | null;
  isAi: boolean;
  isLocal: boolean;
  score: number;
  glitchUntil: number; // timestamp in ms
  aiDifficulty?: 'easy' | 'medium' | 'hard';
  lastAiMoveTime?: number;
  status?: 'playing' | 'completed' | 'failed';
}

export interface GameState {
  gameId: string;
  name: string;
  status: 'setup' | 'playing' | 'completed';
  players: Player[];
  width: number;
  height: number;
  mineCount: number;
  grids: { [playerId: string]: Cell[][] };
  history: string[];
  firstClick: boolean;
  winnerEmail: string | null;
}

export function generateRandomGameName(): string {
  const prefixes = ['Sector', 'Cyber', 'Grid', 'Terminal', 'Core', 'Voxel', 'Matrix'];
  const nouns = ['Sweep', 'Glitch', 'Hazard', 'Detonator', 'Null', 'Gate', 'Nexus'];
  const p = prefixes[Math.floor(Math.random() * prefixes.length)];
  const n = nouns[Math.floor(Math.random() * nouns.length)];
  return `${p}-${n} ${Math.floor(100 + Math.random() * 900)}`;
}

export function isPlayerVacant(player: Player, status?: string): boolean {
  if (status && status !== 'setup') return false;
  return !player.isAi && player.assignedEmail === null && player.name.startsWith('Sweeper ');
}

export function initializeGame(options: {
  name: string;
  hostName: string;
  hostEmail: string;
  maxPlayers: number;
  width?: number;
  height?: number;
  mineCount?: number;
}): GameState {
  const gameId = Math.random().toString(36).substring(2, 15);
  const width = options.width || 12;
  const height = options.height || 12;
  const mineCount = options.mineCount || 20;

  const players: Player[] = [];
  const grids: { [playerId: string]: Cell[][] } = {};

  for (let i = 1; i <= options.maxPlayers; i++) {
    const isHost = i === 1;
    const playerId = `player_${i}`;
    players.push({
      id: playerId,
      name: isHost ? options.hostName : `Sweeper ${i}`,
      assignedEmail: isHost ? options.hostEmail : null,
      isAi: false,
      isLocal: isHost,
      score: 0,
      glitchUntil: 0,
      status: 'playing'
    });

    // Create empty grid
    const grid: Cell[][] = [];
    for (let y = 0; y < height; y++) {
      const row: Cell[] = [];
      for (let x = 0; x < width; x++) {
        row.push({
          x,
          y,
          isMine: false,
          isRevealed: false,
          isFlagged: false,
          neighborMines: 0
        });
      }
      grid.push(row);
    }
    grids[playerId] = grid;
  }

  return {
    gameId,
    name: options.name,
    status: 'setup',
    players,
    width,
    height,
    mineCount,
    grids,
    history: ['Hazards terminal online. Awaiting system sweep launch.'],
    firstClick: true,
    winnerEmail: null
  };
}

// Helper to check if a player has swept their grid successfully
function checkPlayerVictory(grid: Cell[][], mineCount: number): boolean {
  let unrevealedCount = 0;
  for (const row of grid) {
    for (const cell of row) {
      if (!cell.isRevealed) {
        unrevealedCount++;
      }
    }
  }
  return unrevealedCount === mineCount;
}

// Calculate number of safe cells revealed by the player
export function calculateScore(grid: Cell[][]): number {
  let count = 0;
  for (const row of grid) {
    for (const cell of row) {
      if (cell.isRevealed && !cell.isMine) {
        count++;
      }
    }
  }
  return count;
}

// Check if all human players finished the game, transitioning status if so
function checkGameCompletion(state: GameState) {
  const activeHumanPlayers = state.players.filter(p => !p.isAi && !isPlayerVacant(p, state.status));
  if (activeHumanPlayers.length === 0) return;

  const allHumansFinished = activeHumanPlayers.every(p => p.status === 'completed' || p.status === 'failed');
  if (allHumansFinished) {
    state.status = 'completed';
    // Find winner among human players (prefer completed/survived status, then highest score)
    const sorted = [...activeHumanPlayers].sort((a, b) => {
      if (a.status === 'completed' && b.status !== 'completed') return -1;
      if (a.status !== 'completed' && b.status === 'completed') return 1;
      return b.score - a.score;
    });
    const winner = sorted[0];
    state.winnerEmail = winner.assignedEmail;
    state.history.push(`🏆 SECTOR SWEEP SEQUENCE OVER. Best clearance: ${winner.name} with ${winner.score} safe sectors.`);
  }
}

// Populate mines avoiding the first click cell coordinates
function populateMines(grid: Cell[][], mineCount: number, avoidX: number, avoidY: number) {
  const height = grid.length;
  const width = grid[0].length;
  let placed = 0;

  while (placed < mineCount) {
    const rx = Math.floor(Math.random() * width);
    const ry = Math.floor(Math.random() * height);

    if (Math.abs(rx - avoidX) <= 1 && Math.abs(ry - avoidY) <= 1) {
      continue;
    }

    if (!grid[ry][rx].isMine) {
      grid[ry][rx].isMine = true;
      placed++;
    }
  }

  // Calculate neighbor counts
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (grid[y][x].isMine) continue;
      let count = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const ny = y + dy;
          const nx = x + dx;
          if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
            if (grid[ny][nx].isMine) {
              count++;
            }
          }
        }
      }
      grid[y][x].neighborMines = count;
    }
  }
}

// Flood reveal blank cells
function floodReveal(grid: Cell[][], x: number, y: number): number {
  const height = grid.length;
  const width = grid[0].length;
  const queue: [number, number][] = [[x, y]];
  let cellsRevealed = 0;

  grid[y][x].isRevealed = true;
  cellsRevealed++;

  while (queue.length > 0) {
    const [cx, cy] = queue.shift()!;
    const cell = grid[cy][cx];

    if (cell.neighborMines === 0 && !cell.isMine) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const ny = cy + dy;
          const nx = cx + dx;
          if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
            const neighbor = grid[ny][nx];
            if (!neighbor.isRevealed && !neighbor.isMine && !neighbor.isFlagged) {
              neighbor.isRevealed = true;
              cellsRevealed++;
              queue.push([nx, ny]);
            }
          }
        }
      }
    }
  }
  return cellsRevealed;
}

function executeActionInternal(
  state: GameState,
  action: { type: 'reveal' | 'flag' | 'start' | 'reset'; x?: number; y?: number },
  playerId: string
): { success: boolean; reason?: string; newState: GameState } {
  const newState = JSON.parse(JSON.stringify(state)) as GameState;
  const player = newState.players.find(p => p.id === playerId);

  if (action.type === 'start') {
    if (newState.status !== 'setup') {
      return { success: false, reason: 'Game already active.', newState: state };
    }
    newState.status = 'playing';
    newState.history.push('Sweep protocol active. Watch for hazard fields.');
    return { success: true, newState };
  }

  if (action.type === 'reset') {
    const host = newState.players.find(p => p.isLocal) || newState.players[0];
    const resetState = initializeGame({
      name: newState.name,
      hostName: host.name,
      hostEmail: host.assignedEmail || '',
      maxPlayers: newState.players.length,
      width: newState.width,
      height: newState.height,
      mineCount: newState.mineCount
    });
    // Keep user logins, AI configurations and profiles
    resetState.players = newState.players.map(p => ({
      ...p,
      score: 0,
      glitchUntil: 0,
      status: 'playing'
    }));
    resetState.status = 'playing';
    resetState.history.push('Hazard fields reset. Safe sweeping!');
    return { success: true, newState: resetState };
  }

  if (newState.status !== 'playing') {
    return { success: false, reason: 'Game is not running.', newState: state };
  }

  if (!player) {
    return { success: false, reason: 'User not registered in this sweep segment.', newState: state };
  }

  // If player is already finished, reject action
  if (player.status === 'completed' || player.status === 'failed') {
    return { success: false, reason: 'Sweeper channel completed.', newState: state };
  }

  // Check if player is currently glitched out by CRT detonation
  if (player.glitchUntil > Date.now()) {
    return { success: false, reason: 'Terminal locked. Cyber-detonation in progress.', newState: state };
  }

  const { x, y } = action;
  if (x === undefined || y === undefined || y < 0 || y >= newState.height || x < 0 || x >= newState.width) {
    return { success: false, reason: 'Coordinates off-bounds.', newState: state };
  }

  const targetGrid = newState.grids[playerId];
  if (!targetGrid) {
    return { success: false, reason: 'Grid copy not found for this channel.', newState: state };
  }
  const targetCell = targetGrid[y][x];

  if (action.type === 'flag') {
    if (targetCell.isRevealed) {
      return { success: false, reason: 'Cell is already revealed.', newState: state };
    }
    targetCell.isFlagged = !targetCell.isFlagged;
    
    if (targetCell.isFlagged) {
      newState.history.push(`🚩 ${player.name} locked a holographic beacon at (${x}, ${y}).`);
    } else {
      newState.history.push(`🚩 ${player.name} removed a holographic beacon.`);
    }

    return { success: true, newState };
  }

  if (action.type === 'reveal') {
    if (targetCell.isRevealed || targetCell.isFlagged) {
      return { success: false, reason: 'Cell is already cleared or flagged.', newState: state };
    }

    // Populate mines on first click to guarantee safety
    if (newState.firstClick) {
      populateMines(targetGrid, newState.mineCount, x, y);
      
      // Copy identical mine positions and neighbor counts to all players' grids
      for (const p of newState.players) {
        if (p.id === playerId) continue;
        const otherGrid = newState.grids[p.id];
        for (let gy = 0; gy < newState.height; gy++) {
          for (let gx = 0; gx < newState.width; gx++) {
            otherGrid[gy][gx].isMine = targetGrid[gy][gx].isMine;
            otherGrid[gy][gx].neighborMines = targetGrid[gy][gx].neighborMines;
          }
        }
      }
      newState.firstClick = false;
    }

    // Hit a mine!
    if (targetCell.isMine) {
      targetCell.isRevealed = true;
      player.status = 'failed';
      player.score = calculateScore(targetGrid);
      player.glitchUntil = Date.now() + 5000; // 5 seconds terminal lock
      newState.history.push(`💥 HAZARD DETONATION! ${player.name} triggered a cyber-mine! Sweeper channel OFFLINE.`);
      
      checkGameCompletion(newState);
      return { success: true, newState };
    }

    // Safe cell reveal
    const cellsOpened = floodReveal(targetGrid, x, y);
    player.score = calculateScore(targetGrid);
    
    newState.history.push(`🎯 ${player.name} cleared ${cellsOpened} safe sectors.`);

    // Check Player Victory condition
    if (checkPlayerVictory(targetGrid, newState.mineCount)) {
      player.status = 'completed';
      newState.history.push(`🏆 ${player.name} cleared all safe sectors on their grid!`);
    }

    checkGameCompletion(newState);
    return { success: true, newState };
  }

  return { success: false, reason: 'Unknown grid action.', newState: state };
}

export function executeAction(
  state: GameState,
  action: { type: 'reveal' | 'flag' | 'start' | 'reset'; x?: number; y?: number },
  playerId: string
): { success: boolean; reason?: string; newState: GameState } {
  const result = executeActionInternal(state, action, playerId);
  if (result.success && result.newState) {
    if (result.newState.history.length > 25) {
      result.newState.history = result.newState.history.slice(-25);
    }
  }
  return result;
}

function getNeighbors(grid: Cell[][], x: number, y: number): Cell[] {
  const neighbors: Cell[] = [];
  const height = grid.length;
  const width = grid[0].length;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        neighbors.push(grid[ny][nx]);
      }
    }
  }
  return neighbors;
}

// AI Solver and Reasoning engine
export function getAiAction(
  grid: Cell[][],
  difficulty: 'easy' | 'medium' | 'hard'
): { type: 'reveal' | 'flag'; x: number; y: number } | null {
  const height = grid.length;
  const width = grid[0].length;

  // Gather all unrevealed cells
  const allUnrevealed: Cell[] = [];
  for (const row of grid) {
    for (const cell of row) {
      if (!cell.isRevealed) {
        allUnrevealed.push(cell);
      }
    }
  }

  if (allUnrevealed.length === 0) return null;

  // Check if we should make a random mistake
  const rand = Math.random();
  let mistakeChance = 0.05; // hard
  if (difficulty === 'easy') mistakeChance = 0.40;
  else if (difficulty === 'medium') mistakeChance = 0.20;

  if (rand < mistakeChance) {
    const nonFlaggedUnrevealed = allUnrevealed.filter(c => !c.isFlagged);
    const targetList = nonFlaggedUnrevealed.length > 0 ? nonFlaggedUnrevealed : allUnrevealed;
    const randomCell = targetList[Math.floor(Math.random() * targetList.length)];
    const actionType = Math.random() > 0.35 ? 'reveal' : 'flag';
    return { type: actionType, x: randomCell.x, y: randomCell.y };
  }

  // Scan for logical moves using single-point Minesweeper rules
  const logicalSafe: Cell[] = [];
  const logicalMine: Cell[] = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const cell = grid[y][x];
      if (cell.isRevealed && cell.neighborMines > 0) {
        const neighbors = getNeighbors(grid, x, y);
        const unrevealed = neighbors.filter(n => !n.isRevealed);
        const flagged = neighbors.filter(n => n.isFlagged);

        if (unrevealed.length > 0) {
          // Rule 1: All remaining neighbors are mines
          if (cell.neighborMines === unrevealed.length + flagged.length) {
            for (const u of unrevealed) {
              if (!u.isFlagged && !logicalMine.some(m => m.x === u.x && m.y === u.y)) {
                logicalMine.push(u);
              }
            }
          }
          // Rule 2: All remaining neighbors are safe
          if (cell.neighborMines === flagged.length) {
            for (const u of unrevealed) {
              if (!u.isFlagged && !logicalSafe.some(s => s.x === u.x && s.y === u.y)) {
                logicalSafe.push(u);
              }
            }
          }
        }
      }
    }
  }

  // Execute safe cells first
  if (logicalSafe.length > 0) {
    const target = logicalSafe[Math.floor(Math.random() * logicalSafe.length)];
    return { type: 'reveal', x: target.x, y: target.y };
  }

  // Execute flagging next
  if (logicalMine.length > 0) {
    const target = logicalMine[Math.floor(Math.random() * logicalMine.length)];
    return { type: 'flag', x: target.x, y: target.y };
  }

  // Educational guess logic: pick unrevealed cell with lowest risk rating
  const candidates: { cell: Cell; risk: number }[] = [];
  for (const cell of allUnrevealed) {
    if (cell.isFlagged) continue;
    const neighbors = getNeighbors(grid, cell.x, cell.y);
    const revealedNeighbors = neighbors.filter(n => n.isRevealed);
    if (revealedNeighbors.length > 0) {
      let risk = 0;
      for (const rn of revealedNeighbors) {
        const rnNeighbors = getNeighbors(grid, rn.x, rn.y);
        const rnUnrevealed = rnNeighbors.filter(n => !n.isRevealed);
        const rnFlagged = rnNeighbors.filter(n => n.isFlagged);
        if (rnUnrevealed.length > 0) {
          risk += (rn.neighborMines - rnFlagged.length) / rnUnrevealed.length;
        }
      }
      candidates.push({ cell, risk });
    }
  }

  if (candidates.length > 0) {
    candidates.sort((a, b) => a.risk - b.risk);
    const bestCandidate = candidates[0].cell;
    return { type: 'reveal', x: bestCandidate.x, y: bestCandidate.y };
  }

  // No adjacent clues: click a random unrevealed cell (that is not flagged)
  const cleanUnrevealed = allUnrevealed.filter(c => !c.isFlagged);
  const fallback = cleanUnrevealed.length > 0 ? cleanUnrevealed : allUnrevealed;
  const choice = fallback[Math.floor(Math.random() * fallback.length)];
  return { type: 'reveal', x: choice.x, y: choice.y };
}
