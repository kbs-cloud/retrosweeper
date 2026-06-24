// Offline Game Service for RetroSweeper
import type { GameState } from '../game/gameState';
import { initializeGame, executeAction, getAiAction } from '../game/gameState';

function generateUUID(): string {
  return 'local-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 9);
}

interface StoredGame {
  id: string;
  inviteCode: string;
  ownerEmail: string | null;
  name: string;
  gameState: string; // JSON string
  created_at: string;
  updated_at: string;
}

export class LocalGameService {
  private getStoredGames(): StoredGame[] {
    const stored = localStorage.getItem('retrosweeper_local_games');
    if (!stored) return [];
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.error('Failed to parse local games:', e);
      return [];
    }
  }

  private saveStoredGames(games: StoredGame[]) {
    localStorage.setItem('retrosweeper_local_games', JSON.stringify(games));
  }

  public async listGames(search?: string): Promise<{ success: boolean; games?: any[]; error?: string }> {
    let list = this.getStoredGames();
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(g => g.name.toLowerCase().includes(q) || g.inviteCode.toLowerCase().includes(q));
    }
    const games = list.map(g => ({
      id: g.id,
      inviteCode: g.inviteCode,
      ownerEmail: g.ownerEmail,
      name: g.name,
      gameState: JSON.parse(g.gameState)
    }));
    return { success: true, games };
  }

  public async getGame(id: string): Promise<{ success: boolean; game?: any; connectedPlayers?: string[]; error?: string }> {
    const list = this.getStoredGames();
    const index = list.findIndex(g => g.id === id || g.inviteCode === id);
    if (index === -1) {
      return { success: false, error: 'RetroSweeper session not found.' };
    }
    const found = list[index];
    let state: GameState;
    try {
      state = JSON.parse(found.gameState);
    } catch (e) {
      return { success: false, error: 'Corrupt local game state.' };
    }

    // Process AI moves client-side in local mode
    let stateChanged = false;
    if (state.status === 'playing') {
      const now = Date.now();
      for (const player of state.players) {
        if (!player.isAi) continue;
        if (player.status !== 'playing') continue;
        if (player.glitchUntil && player.glitchUntil > now) continue;

        const difficulty = player.aiDifficulty || 'medium';
        let cooldown = 2000;
        if (difficulty === 'easy') cooldown = 4000;
        else if (difficulty === 'hard') cooldown = 1000;

        const lastMove = player.lastAiMoveTime || 0;
        if (now - lastMove >= cooldown) {
          const grid = state.grids[player.id];
          if (grid) {
            const action = getAiAction(grid, difficulty);
            if (action) {
              const execResult = executeAction(state, action, player.id);
              if (execResult.success) {
                state = execResult.newState;
                const updatedPlayer = state.players.find(p => p.id === player.id);
                if (updatedPlayer) {
                  updatedPlayer.lastAiMoveTime = now;
                }
                stateChanged = true;
              }
            }
          }
        }
      }
    }

    if (stateChanged) {
      found.gameState = JSON.stringify(state);
      found.updated_at = new Date().toISOString();
      list[index] = found;
      this.saveStoredGames(list);
    }

    // Gather names of active local/AI players
    const connectedPlayers = state.players
      .filter(p => !p.name.startsWith('Sweeper ') || p.assignedEmail !== null)
      .map(p => p.name);

    return {
      success: true,
      game: {
        id: found.id,
        inviteCode: found.inviteCode,
        ownerEmail: found.ownerEmail,
        name: found.name,
        gameState: state
      },
      connectedPlayers
    };
  }

  public async fetchJoinRequests(_gameId: string): Promise<{ success: boolean; requests: any[]; error?: string }> {
    return { success: true, requests: [] };
  }

  public async createGame(
    name: string,
    maxPlayers: number,
    width: number,
    height: number,
    mineCount: number
  ): Promise<{ success: boolean; gameId?: string; inviteCode?: string; name?: string; error?: string }> {
    const hostName = localStorage.getItem('retrosweeper_display_name') || 'Local Sweeper';
    let state: GameState;
    try {
      state = initializeGame({
        name: name.trim(),
        hostName,
        hostEmail: 'apprentice@local',
        maxPlayers,
        width,
        height,
        mineCount
      });
    } catch (e) {
      return { success: false, error: 'Failed to initialize hazard field.' };
    }

    // Set first slot as host/local
    if (state.players.length > 0) {
      state.players[0].isLocal = true;
      state.players[0].assignedEmail = 'apprentice@local';
    }

    const uuid = generateUUID();
    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const newStored: StoredGame = {
      id: uuid,
      inviteCode,
      ownerEmail: 'apprentice@local',
      name: state.name,
      gameState: JSON.stringify(state),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const list = this.getStoredGames();
    list.push(newStored);
    this.saveStoredGames(list);

    return {
      success: true,
      gameId: uuid,
      inviteCode,
      name: state.name
    };
  }

  public async joinGame(gameId: string): Promise<{ success: boolean; error?: string }> {
    const list = this.getStoredGames();
    const index = list.findIndex(g => g.id === gameId || g.inviteCode === gameId);
    if (index === -1) {
      return { success: false, error: 'Lobby not found.' };
    }
    const found = list[index];
    const state: GameState = JSON.parse(found.gameState);

    // Find first vacant slot
    const vacantSlot = state.players.find(p => !p.isAi && p.assignedEmail === null);
    if (!vacantSlot) {
      return { success: false, error: 'Lobby is full.' };
    }

    const hostName = localStorage.getItem('retrosweeper_display_name') || 'Local Sweeper';
    vacantSlot.assignedEmail = 'apprentice@local';
    vacantSlot.name = hostName;
    vacantSlot.isLocal = true;

    found.gameState = JSON.stringify(state);
    found.updated_at = new Date().toISOString();
    list[index] = found;
    this.saveStoredGames(list);

    return { success: true };
  }

  public async assignSlot(gameId: string, playerId: string, assignOptions: any): Promise<{ success: boolean; error?: string }> {
    const list = this.getStoredGames();
    const index = list.findIndex(g => g.id === gameId);
    if (index === -1) return { success: false, error: 'Session not found.' };
    const found = list[index];
    const state: GameState = JSON.parse(found.gameState);

    const player = state.players.find(p => p.id === playerId);
    if (!player) return { success: false, error: 'Sweeper channel slot not found.' };

    if (assignOptions.type === 'ai') {
      player.isAi = true;
      player.isLocal = false;
      player.assignedEmail = null;
      player.aiDifficulty = assignOptions.difficulty || 'medium';
      player.name = assignOptions.name || `AI-Sweeper ${playerId.split('_')[1]}`;
    } else if (assignOptions.type === 'human') {
      player.isAi = false;
      player.isLocal = false;
      player.assignedEmail = 'guest@local';
      player.name = assignOptions.name || `Sweeper ${playerId.split('_')[1]}`;
    } else {
      // Clear/vacate slot
      player.isAi = false;
      player.isLocal = false;
      player.assignedEmail = null;
      player.name = `Sweeper ${playerId.split('_')[1]}`;
    }

    found.gameState = JSON.stringify(state);
    found.updated_at = new Date().toISOString();
    list[index] = found;
    this.saveStoredGames(list);

    return { success: true };
  }

  public async performGameAction(gameId: string, action: any, playerId: string): Promise<{ success: boolean; error?: string }> {
    const list = this.getStoredGames();
    const index = list.findIndex(g => g.id === gameId);
    if (index === -1) return { success: false, error: 'Session not found.' };
    const found = list[index];
    let state: GameState = JSON.parse(found.gameState);

    const execResult = executeAction(state, action, playerId);
    if (!execResult.success) {
      return { success: false, error: execResult.reason || 'Action failed.' };
    }

    state = execResult.newState;
    found.gameState = JSON.stringify(state);
    found.updated_at = new Date().toISOString();
    list[index] = found;
    this.saveStoredGames(list);

    return { success: true };
  }

  public async rejectJoin(_gameId: string, _joinRequestId: number): Promise<{ success: boolean; error?: string }> {
    return { success: true };
  }

  public async deleteGame(gameId: string): Promise<{ success: boolean; error?: string }> {
    const list = this.getStoredGames().filter(g => g.id !== gameId);
    this.saveStoredGames(list);
    return { success: true };
  }

  public async updateStats(won: boolean): Promise<{ success: boolean; error?: string }> {
    const displayName = localStorage.getItem('retrosweeper_display_name') || 'Local Sweeper';
    const key = `retrosweeper_offline_stats_${displayName}`;
    let stats = { gamesPlayed: 0, gamesWon: 0 };
    try {
      const stored = localStorage.getItem(key);
      if (stored) stats = JSON.parse(stored);
    } catch (e) {
      // ignore
    }

    stats.gamesPlayed += 1;
    if (won) stats.gamesWon += 1;

    localStorage.setItem(key, JSON.stringify(stats));
    return { success: true };
  }
}
