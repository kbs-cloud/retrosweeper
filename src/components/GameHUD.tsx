import React from 'react';
import { isPlayerVacant } from '../game/gameState';

interface GameHUDProps {
  gameTab: 'board' | 'hud';
  hudTab: 'sweepers' | 'logs';
  setHudTab: (tab: 'sweepers' | 'logs') => void;
  currentGame: any;
  mySlot: any;
  terminalRef: React.RefObject<HTMLDivElement | null>;
  handleResetGame: () => void;
  setCurrentGameId: (id: string | null) => void;
  setCurrentGame: (game: any) => void;
  loadGames: () => void;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  gameTab,
  hudTab,
  setHudTab,
  currentGame,
  mySlot,
  terminalRef,
  handleResetGame,
  setCurrentGameId,
  setCurrentGame,
  loadGames
}) => {
  return (
    <div className={`game-hud-panel ${gameTab === 'hud' ? 'mobile-active-pane' : 'mobile-inactive-pane'}`} style={{ display: 'flex', flexDirection: 'column', gap: '20px', background: 'rgba(5, 3, 13, 0.6)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(0, 255, 255, 0.1)', height: '100%', minHeight: 0 }}>
      
      {/* HUD Sub-tabs (visible only when screen/viewport is small) */}
      <div className="hud-subtabs-container">
        <button 
          type="button"
          onClick={() => setHudTab('sweepers')} 
          className={`hud-subtab-btn ${hudTab === 'sweepers' ? 'hud-subtab-btn-active' : ''}`}
        >
          SWEEPERS
        </button>
        <button 
          type="button"
          onClick={() => setHudTab('logs')} 
          className={`hud-subtab-btn ${hudTab === 'logs' ? 'hud-subtab-btn-active' : ''}`}
        >
          LOGS
        </button>
      </div>

      {/* Active Sweepers Section */}
      <div className={`hud-section-sweepers ${hudTab === 'sweepers' ? 'hud-section-active' : 'hud-section-inactive'}`} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <h3 className="widget-title">ACTIVE SWEEPERS</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px', overflowY: 'auto', maxHeight: '180px' }}>
          {currentGame?.players.filter((p: any) => !isPlayerVacant(p, currentGame.status)).map((p: any) => {
            const isGlitched = p.glitchUntil > Date.now();
            const totalSafe = currentGame ? (currentGame.width * currentGame.height - currentGame.mineCount) : 1;
            const progressPercent = currentGame ? Math.round((p.score / totalSafe) * 100) : 0;

            return (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255, 255, 255, 0.02)', padding: '8px 12px', borderRadius: '4px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <span style={{ fontSize: '12px', color: p.id === mySlot?.id ? '#00ffff' : 'white' }}>{p.name} {p.isAi && '🤖'}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {p.status === 'completed' ? (
                    <span className="badge-status-turn" style={{ fontSize: '9px', padding: '2px 6px' }}>CLEARED</span>
                  ) : p.status === 'failed' ? (
                    <span className="badge-status-wait" style={{ fontSize: '9px', padding: '2px 6px', background: 'rgba(255, 0, 85, 0.2)', color: '#ff0055', borderColor: '#ff0055' }}>OUT</span>
                  ) : isGlitched ? (
                    <span className="badge-status-wait" style={{ fontSize: '9px', padding: '2px 6px' }}>GLITCHED</span>
                  ) : null}
                  <span style={{ fontFamily: 'Share Tech Mono', fontSize: '12px', color: 'var(--accent-magenta)', fontWeight: 'bold' }}>{p.score} / {totalSafe} ({progressPercent}%)</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Activity Monitor Section */}
      <div className={`hud-section-logs ${hudTab === 'logs' ? 'hud-section-active' : 'hud-section-inactive'}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <h3 className="widget-title">ACTIVITY MONITOR</h3>
        <div ref={terminalRef} className="activity-terminal" style={{ flex: 1, overflowY: 'auto', background: '#030107', padding: '10px', borderRadius: '4px', border: '1px solid rgba(0, 255, 255, 0.05)', fontSize: '11px', fontFamily: 'Share Tech Mono', color: '#00ffcc', lineHeight: '1.4' }}>
          {currentGame?.history.map((log: string, index: number) => (
            <div key={index} style={{ marginBottom: '6px', borderBottom: '1px dashed rgba(0, 255, 255, 0.05)', paddingBottom: '4px' }}>{log}</div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        <button onClick={handleResetGame} className="btn-sci-fi btn-sci-fi-gold" style={{ flex: 1, padding: '8px' }}>RESET FIELD</button>
        <button 
          onClick={() => {
            if (confirm("Disconnect sweep link and return to sector maps?")) {
              setCurrentGameId(null);
              setCurrentGame(null);
              loadGames();
            }
          }} 
          className="btn-sci-fi" 
          style={{ padding: '8px' }}
        >
          EXIT
        </button>
      </div>
    </div>
  );
};
