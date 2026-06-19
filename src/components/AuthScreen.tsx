import React from 'react';
import { Flag, Globe, Zap } from 'lucide-react';

interface AuthScreenProps {
  authError: string;
  playOnline: boolean;
  setPlayOnline: (play: boolean) => void;
  redirectToAuth: () => void;
  setUser: (user: any) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  authError,
  playOnline,
  setPlayOnline,
  redirectToAuth,
  setUser
}) => {
  return (
    <div className="auth-container">
      <div className="lab-grid" />
      <div className="glass-panel auth-card">
        <div className="auth-header" style={{ textAlign: 'center' }}>
          <Flag className="auth-logo-icon" style={{ color: 'var(--accent-magenta)', width: '48px', height: '48px', margin: '0 auto 12px auto' }} />
          <h1 className="auth-title" style={{ fontSize: '28px', letterSpacing: '2px' }}>RETRO<span style={{ color: 'var(--accent-magenta)' }}>SWEEPER</span></h1>
          <p className="auth-subtitle">Cyberpunk Hazard Clearing Protocol</p>
        </div>

        {authError && <div className="auth-error-banner" style={{ margin: '16px 0' }}>LINK SYSTEM ERROR: {authError}</div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '24px' }}>
          {playOnline ? (
            <button onClick={redirectToAuth} className="btn-sci-fi btn-sci-fi-gold auth-btn-login" style={{ width: '100%' }}>
              <Globe className="h-4 w-4" /> SECURE LINK VIA KBS SSO
            </button>
          ) : (
            <button 
              onClick={() => {
                setUser({ email: 'apprentice@local', displayName: 'Local Sweeper', stats: { gamesPlayed: 0, gamesWon: 0 } });
              }} 
              className="btn-sci-fi auth-btn-login" 
              style={{ width: '100%' }}
            >
              <Zap className="h-4 w-4" /> LAUNCH LOCAL GUEST GRID
            </button>
          )}

          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', fontSize: '12px', marginTop: '10px' }}>
            <span style={{ color: 'rgba(255,255,255,0.45)' }}>CONNECTION PROTOCOL:</span>
            <button 
              onClick={() => setPlayOnline(!playOnline)}
              className={`badge-status ${playOnline ? 'badge-status-turn' : 'badge-status-wait'}`}
              style={{ border: 'none', cursor: 'pointer', padding: '4px 10px', fontSize: '11px' }}
            >
              {playOnline ? 'ONLINE (SSO)' : 'OFFLINE (LOCAL)'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
