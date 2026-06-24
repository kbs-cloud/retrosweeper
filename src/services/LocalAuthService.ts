// Offline Authentication Service for RetroSweeper

export class LocalAuthService {
  public async initCSRF(): Promise<void> {
    // No-op offline
  }

  public async checkSession(): Promise<any | null> {
    const isOnline = localStorage.getItem('retrosweeper_play_online') !== 'false';
    if (isOnline) return null;
    return this.getLocalUser();
  }

  public async logoutUser(): Promise<void> {
    // No-op offline
  }

  public async pollAuth(_token: string): Promise<any> {
    return { status: 'error', error: 'OAuth not supported offline.' };
  }

  public async recordGameStats(won: boolean): Promise<void> {
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
  }

  private getLocalUser(): any {
    const displayName = localStorage.getItem('retrosweeper_display_name') || 'Local Sweeper';
    let stats = { gamesPlayed: 0, gamesWon: 0 };
    try {
      const storedStats = localStorage.getItem(`retrosweeper_offline_stats_${displayName}`);
      if (storedStats) {
        stats = JSON.parse(storedStats);
      }
    } catch (e) {
      console.error('Failed to parse offline stats:', e);
    }

    return {
      email: 'apprentice@local',
      displayName,
      stats
    };
  }
}
