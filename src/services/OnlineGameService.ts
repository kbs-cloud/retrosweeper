import { apiFetch } from './api';

export class OnlineGameService {
  private async handleResponse(res: Response, defaultError: string): Promise<any> {
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || defaultError };
      }
      return data;
    }
    if (res.ok) {
      return { success: true };
    }
    throw new Error(defaultError);
  }

  public async listGames(search?: string): Promise<any> {
    const url = search ? `/api/games?search=${encodeURIComponent(search)}` : '/api/games';
    const res = await apiFetch(url);
    return this.handleResponse(res, 'Failed to list games.');
  }

  public async getGame(id: string): Promise<any> {
    const res = await apiFetch(`/api/games/${id}`);
    return this.handleResponse(res, 'Failed to load game.');
  }

  public async fetchJoinRequests(gameId: string): Promise<any> {
    const res = await apiFetch(`/api/games/${gameId}/join-requests`);
    return this.handleResponse(res, 'Failed to fetch join requests.');
  }

  public async createGame(name: string, maxPlayers: number, width: number, height: number, mineCount: number): Promise<any> {
    const res = await apiFetch('/api/games', {
      method: 'POST',
      body: JSON.stringify({
        name,
        setupOptions: { maxPlayers, width, height, mineCount }
      })
    });
    return this.handleResponse(res, 'Failed to create game.');
  }

  public async joinGame(gameId: string): Promise<any> {
    const res = await apiFetch(`/api/games/${gameId}/join`, { method: 'POST' });
    return this.handleResponse(res, 'Failed to join game.');
  }

  public async assignSlot(gameId: string, playerId: string, assignOptions: any): Promise<any> {
    const res = await apiFetch(`/api/games/${gameId}/assign-slot`, {
      method: 'POST',
      body: JSON.stringify({
        playerId,
        ...assignOptions
      })
    });
    return this.handleResponse(res, 'Failed to assign slot.');
  }

  public async performGameAction(gameId: string, action: any, playerId: string): Promise<any> {
    const res = await apiFetch(`/api/games/${gameId}/action`, {
      method: 'POST',
      body: JSON.stringify({
        action,
        playerId
      })
    });
    return this.handleResponse(res, 'Action failed.');
  }

  public async rejectJoin(gameId: string, joinRequestId: number): Promise<any> {
    const res = await apiFetch(`/api/games/${gameId}/reject-join`, {
      method: 'POST',
      body: JSON.stringify({ joinRequestId })
    });
    return this.handleResponse(res, 'Failed to reject join request.');
  }

  public async deleteGame(gameId: string): Promise<any> {
    const res = await apiFetch(`/api/games/${gameId}`, { method: 'DELETE' });
    return this.handleResponse(res, 'Failed to delete game.');
  }

  public async updateStats(won: boolean): Promise<any> {
    const res = await apiFetch('/api/stats', {
      method: 'POST',
      body: JSON.stringify({ won })
    });
    return this.handleResponse(res, 'Failed to update stats.');
  }
}
