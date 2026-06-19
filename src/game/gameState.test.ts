import { describe, it, expect, vi } from 'vitest';
import { initializeGame, executeAction, getAiAction } from './gameState';

describe('RetroSweeper Game State Machine', () => {
  it('should initialize a valid RetroSweeper game board with per-player grids', () => {
    const state = initializeGame({
      name: 'Retro Sector 9',
      hostName: 'NeonSweeper',
      hostEmail: 'player@kbs-cloud.com',
      maxPlayers: 2,
      width: 10,
      height: 10,
      mineCount: 15
    });

    expect(state.name).toBe('Retro Sector 9');
    expect(state.status).toBe('setup');
    expect(state.players.length).toBe(2);
    expect(state.players[0].name).toBe('NeonSweeper');
    expect(state.players[0].score).toBe(0);
    expect(state.width).toBe(10);
    expect(state.height).toBe(10);
    expect(state.mineCount).toBe(15);
    expect(state.grids['player_1'].length).toBe(10);
    expect(state.grids['player_1'][0].length).toBe(10);
    expect(state.grids['player_2'].length).toBe(10);
    expect(state.firstClick).toBe(true);
  });

  it('should transition status to playing upon start', () => {
    const state = initializeGame({
      name: 'Sector Zero',
      hostName: 'GuestUser',
      hostEmail: 'guest@kbs-cloud.com',
      maxPlayers: 1
    });

    const res = executeAction(state, { type: 'start' }, 'player_1');
    expect(res.success).toBe(true);
    expect(res.newState.status).toBe('playing');
  });

  it('should flag a cell and not award points (since scoring is progress-based)', () => {
    let state = initializeGame({
      name: 'Sector Zero',
      hostName: 'GuestUser',
      hostEmail: 'guest@kbs-cloud.com',
      maxPlayers: 1,
      width: 5,
      height: 5,
      mineCount: 2
    });

    state = executeAction(state, { type: 'start' }, 'player_1').newState;

    // Manually place a mine and a safe cell
    state.grids['player_1'][0][0].isMine = true;
    state.grids['player_1'][1][0].isMine = false;

    // Flag mine cell (0, 0)
    let res = executeAction(state, { type: 'flag', x: 0, y: 0 }, 'player_1');
    expect(res.success).toBe(true);
    expect(res.newState.grids['player_1'][0][0].isFlagged).toBe(true);
    expect(res.newState.players[0].score).toBe(0); // Flagging doesn't unlock safe area directly

    // Flag safe cell (0, 1)
    res = executeAction(res.newState, { type: 'flag', x: 0, y: 1 }, 'player_1');
    expect(res.success).toBe(true);
    expect(res.newState.grids['player_1'][1][0].isFlagged).toBe(true);
  });

  it('should end the game when the human player blows up', () => {
    let state = initializeGame({
      name: 'Sector Solo',
      hostName: 'User',
      hostEmail: 'user@kbs.com',
      maxPlayers: 1,
      width: 5,
      height: 5,
      mineCount: 1
    });

    state = executeAction(state, { type: 'start' }, 'player_1').newState;
    
    // Put a mine at (2, 2)
    state.grids['player_1'][2][2].isMine = true;
    
    const res = executeAction(state, { type: 'reveal', x: 2, y: 2 }, 'player_1');
    expect(res.success).toBe(true);
    expect(res.newState.players[0].status).toBe('failed');
    expect(res.newState.status).toBe('completed'); // Solo human finished
  });

  it('should NOT end the game and let the human player continue when an AI player blows up', () => {
    let state = initializeGame({
      name: 'Sector Co-op',
      hostName: 'HumanUser',
      hostEmail: 'human@kbs.com',
      maxPlayers: 2,
      width: 5,
      height: 5,
      mineCount: 2
    });

    state.players[1].isAi = true;
    state.players[1].assignedEmail = 'ai_player_2@retrosweeper.ai';

    state = executeAction(state, { type: 'start' }, 'player_1').newState;

    // Force firstClick to false to disable random mine population
    state.firstClick = false;
    state.grids['player_1'][0][0].isMine = true;
    state.grids['player_1'][4][4].isMine = true;
    state.grids['player_1'][2][2].neighborMines = 1; // Prevent flood reveal from clearing entire board
    state.grids['player_2'][0][0].isMine = true;
    state.grids['player_2'][4][4].isMine = true;

    // AI player hits a mine
    let res = executeAction(state, { type: 'reveal', x: 0, y: 0 }, 'player_2');
    expect(res.success).toBe(true);
    expect(res.newState.players[1].status).toBe('failed');
    expect(res.newState.status).toBe('playing');

    // Human player makes a safe move
    res = executeAction(res.newState, { type: 'reveal', x: 2, y: 2 }, 'player_1');
    expect(res.success).toBe(true);
    expect(res.newState.players[0].status).toBe('playing');
  });

  it('should successfully run logical solver rules in AI reasoning', () => {
    const state = initializeGame({
      name: 'Sector AI',
      hostName: 'NeonSweeper',
      hostEmail: 'player@kbs-cloud.com',
      maxPlayers: 1,
      width: 3,
      height: 3,
      mineCount: 1
    });

    const grid = state.grids['player_1'];
    // Reveal center as safe with 1 neighbor mine
    grid[1][1].isRevealed = true;
    grid[1][1].neighborMines = 1;

    // Mark 7 out of 8 neighbors as revealed (safe), leaving only (0, 0) unrevealed
    grid[0][1].isRevealed = true;
    grid[0][2].isRevealed = true;
    grid[1][0].isRevealed = true;
    grid[1][2].isRevealed = true;
    grid[2][0].isRevealed = true;
    grid[2][1].isRevealed = true;
    grid[2][2].isRevealed = true;

    // The only unrevealed cell is (0, 0), so it must be a mine!
    grid[0][0].isMine = true;

    // Mock Math.random to avoid the 5% random mistake chance
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.5);

    const action = getAiAction(grid, 'hard');
    expect(action).not.toBeNull();
    expect(action!.type).toBe('flag');
    expect(action!.x).toBe(0);
    expect(action!.y).toBe(0);

    spy.mockRestore();
  });
});
