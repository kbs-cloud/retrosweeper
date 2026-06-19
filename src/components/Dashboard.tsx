import React from 'react';
import { Plus } from 'lucide-react';
import { isPlayerVacant } from '../game/gameState';

interface DashboardProps {
  dashboardTab: 'grids' | 'archives';
  setDashboardTab: (tab: 'grids' | 'archives') => void;
  setShowCreateModal: (show: boolean) => void;
  joinError: string;
  joinSuccess: string;
  inviteCodeInput: string;
  setInviteCodeInput: (code: string) => void;
  handleJoinGame: (e: React.FormEvent) => void;
  user: any;
  games: any[];
  setCurrentGameId: (id: string | null) => void;
  handleDeleteGame: (gameId: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  dashboardTab,
  setDashboardTab,
  setShowCreateModal,
  joinError,
  joinSuccess,
  inviteCodeInput,
  setInviteCodeInput,
  handleJoinGame,
  user,
  games,
  setCurrentGameId,
  handleDeleteGame
}) => {
  return (
    <main className={`dashboard-layout tab-active-${dashboardTab}`}>
      {/* Mobile only Tab system */}
      <div className="mobile-tabs-container" style={{ gridColumn: 'span 4' }}>
        <button 
          onClick={() => setDashboardTab('grids')} 
          className={`tab-btn ${dashboardTab === 'grids' ? 'tab-btn-active' : ''}`}
        >
          Grids
        </button>
        <button 
          onClick={() => setDashboardTab('archives')} 
          className={`tab-btn ${dashboardTab === 'archives' ? 'tab-btn-active' : ''}`}
        >
          Achievements
        </button>
      </div>

      <div className="main-panel tab-content-reactors">
        <div className="dashboard-title-section">
          <div>
            <h2 className="dashboard-title-heading">HAZARD GRID SECTORS</h2>
            <p className="dashboard-title-subtext">Establish a terminal link to start sweeping mines</p>
          </div>
          <button onClick={() => setShowCreateModal(true)} className="btn-sci-fi btn-sci-fi-gold">
            <Plus className="h-4 w-4" /> INITIALIZE SWEEP FIELD
          </button>
        </div>

        <div className="dashboard-grid-widgets">
          {/* Join Game Box */}
          <div className="glass-panel glass-panel-neon-purple" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <h3 className="widget-title">ESTABLISH SECTOR LINK</h3>
              <p className="widget-subtitle">Enter sector authorization code to connect</p>
            </div>
            {joinError && <div className="auth-error-banner">ERROR: {joinError}</div>}
            {joinSuccess && <div className="notice-success" style={{ padding: '8px', fontSize: '11px', fontFamily: 'Share Tech Mono', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '6px' }}>SUCCESS: {joinSuccess}</div>}
            <form onSubmit={handleJoinGame} style={{ display: 'flex', gap: '8px' }}>
              <input 
                type="text" 
                required
                placeholder="SECTOR CODE" 
                className="terminal-input"
                style={{ flex: 1, textTransform: 'uppercase' }}
                value={inviteCodeInput}
                onChange={e => setInviteCodeInput(e.target.value)}
              />
              <button type="submit" className="btn-sci-fi">LINK</button>
            </form>
          </div>

          {/* Stats Box */}
          <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '16px' }}>
            <div>
              <h3 className="widget-title widget-title-muted">HAZARD CLEARANCE LOGS</h3>
              <p className="widget-subtitle">Telemetry results from active sweeper</p>
            </div>
            <div className="stats-grid">
              <div className="stat-box">
                <div className="stat-label">Sectors Scanned</div>
                <div className="stat-value">{user.stats?.gamesPlayed || 0} Grids</div>
              </div>
              <div className="stat-box">
                <div className="stat-label">System Swept</div>
                <div className="stat-value stat-value-gold" style={{ color: 'var(--accent-magenta)' }}>{user.stats?.gamesWon || 0} Cleared</div>
              </div>
            </div>
          </div>
        </div>

        {/* Games list */}
        <div className="glass-panel reactors-container">
          <h3 className="widget-title widget-title-muted" style={{ marginBottom: '16px' }}>ACTIVE GRID SECTORS</h3>
          {games.length === 0 ? (
            <div className="reactors-empty">
              <p className="reactors-empty-text">No active grid scans detected. Spawn a sector field above.</p>
            </div>
          ) : (
            <div className="reactors-list">
              {games.map(game => {
                const host = game.ownerEmail || 'Local';
                const playerCt = game.gameState.players?.filter((p: any) => !isPlayerVacant(p, game.gameState.status)).length || 1;
                
                return (
                  <div key={game.id} className="reactor-row">
                    <div className="reactor-info">
                      <span className="reactor-name">{game.name || 'Unnamed Grid'}</span>
                      <span className="reactor-details">HOST: {host} | Grid: {game.gameState.width}x{game.gameState.height} | Mines: {game.gameState.mineCount} | Sweepers: {playerCt}</span>
                    </div>
                    <div className="reactor-actions">
                      <span className="badge-code">
                        CODE: {game.inviteCode}
                      </span>
                      <span className={`badge-status ${game.gameState.status === 'playing' ? 'badge-status-turn' : 'badge-status-wait'}`}>
                        {game.gameState.status === 'setup' ? 'PREPARING' : game.gameState.status === 'completed' ? 'PURGED' : 'SCANNING'}
                      </span>
                      <button 
                        onClick={() => setCurrentGameId(game.id)}
                        className="btn-sci-fi"
                        style={{ padding: '6px 14px', fontSize: '12px' }}
                      >
                        LINK
                      </button>
                      {(game.ownerEmail === user.email || user.email === 'apprentice@local') && (
                        <button 
                          onClick={() => handleDeleteGame(game.id)}
                          className="btn-sci-fi btn-danger"
                          style={{ padding: '6px 10px', fontSize: '12px' }}
                        >
                          PURGE
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Achievements Tab Panel */}
      <div className="side-panel tab-content-recipes">
        <h3 className="panel-title">SWEEPER CORES & ARCHIVES</h3>
        <p className="panel-subtitle" style={{ marginBottom: '20px' }}>Global security achievements linked to account</p>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div className="glass-panel" style={{ padding: '16px', background: 'rgba(0, 255, 255, 0.03)' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <span style={{ fontSize: '24px' }}>🚩</span>
              <div>
                <h4 style={{ margin: 0, fontSize: '13px', color: '#00ffff' }}>Flawless Sweep</h4>
                <p style={{ margin: 0, fontSize: '11px', color: 'rgba(255,255,255,0.45)' }}>Clear a grid sector with zero incorrect flags set.</p>
              </div>
            </div>
          </div>
          <div className="glass-panel" style={{ padding: '16px', background: 'rgba(255, 0, 85, 0.03)' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <span style={{ fontSize: '24px' }}>💥</span>
              <div>
                <h4 style={{ margin: 0, fontSize: '13px', color: 'var(--accent-magenta)' }}>Glitch Survivor</h4>
                <p style={{ margin: 0, fontSize: '11px', color: 'rgba(255,255,255,0.45)' }}>Win a scan after surviving a cyber-mine CRT detonation lock.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};
