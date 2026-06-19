import React from 'react';
import { isPlayerVacant } from '../game/gameState';

interface LobbySetupProps {
  currentGame: any;
  user: any;
  ownerEmail: string | null;
  handleAssignSlot: (playerId: string, options: any) => void;
  handleStartGame: () => void;
}

export const LobbySetup: React.FC<LobbySetupProps> = ({
  currentGame,
  user,
  ownerEmail,
  handleAssignSlot,
  handleStartGame
}) => {
  return (
    <div className="glass-panel lobby-setup-container" style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '30px', margin: '0 auto', maxWidth: '600px', textAlign: 'center' }}>
      <div>
        <h3 className="widget-title" style={{ fontSize: '20px' }}>GRID SWEEPER ROSTER</h3>
        <p className="widget-subtitle">Verify connections and assign sweep channels before ignition</p>
      </div>

      <div className="lobby-slots-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {currentGame?.players.map((p: any) => {
          const isVacant = isPlayerVacant(p, currentGame.status);
          return (
            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '10px 16px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <span style={{ fontSize: '13px', fontFamily: 'Share Tech Mono' }}>CHANNEL {p.id.split('_')[1]}: <span style={{ color: isVacant ? 'rgba(255,255,255,0.2)' : '#00ffff' }}>{p.name}</span></span>
              
              <div style={{ display: 'flex', gap: '8px' }}>
                {isVacant ? (
                  <>
                    <button 
                      onClick={() => handleAssignSlot(p.id, { isLocal: true, name: user.displayName || user.email.split('@')[0], email: user.email })}
                      className="btn-sci-fi"
                      style={{ padding: '4px 10px', fontSize: '11px' }}
                    >
                      CLAIM
                    </button>
                    <button 
                      onClick={() => handleAssignSlot(p.id, { isAi: true, aiDifficulty: 'easy' })}
                      className="btn-sci-fi"
                      style={{ padding: '4px 6px', fontSize: '10px', borderColor: 'var(--accent-magenta)' }}
                    >
                      AI EASY
                    </button>
                    <button 
                      onClick={() => handleAssignSlot(p.id, { isAi: true, aiDifficulty: 'medium' })}
                      className="btn-sci-fi"
                      style={{ padding: '4px 6px', fontSize: '10px', borderColor: 'var(--accent-magenta)' }}
                    >
                      AI MED
                    </button>
                    <button 
                      onClick={() => handleAssignSlot(p.id, { isAi: true, aiDifficulty: 'hard' })}
                      className="btn-sci-fi"
                      style={{ padding: '4px 6px', fontSize: '10px', borderColor: 'var(--accent-magenta)' }}
                    >
                      AI HARD
                    </button>
                  </>
                ) : (
                  <button 
                    onClick={() => handleAssignSlot(p.id, { isLocal: false, email: null, name: `Sweeper ${p.id.split('_')[1]}` })}
                    className="btn-sci-fi btn-danger"
                    style={{ padding: '4px 10px', fontSize: '11px' }}
                    disabled={p.id === 'player_1' && ownerEmail === user.email}
                  >
                    CLEAR
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {ownerEmail === user.email || user.email === 'apprentice@local' ? (
        <button 
          onClick={handleStartGame} 
          className="btn-sci-fi btn-sci-fi-gold"
          style={{ width: '100%', padding: '12px' }}
        >
          IGNITE SWEEP SIGNAL
        </button>
      ) : (
        <div className="terminal-log-row" style={{ color: 'var(--accent-magenta)' }}>
          [SYSTEM LOG] Awaiting signal trigger from system host...
        </div>
      )}
    </div>
  );
};
