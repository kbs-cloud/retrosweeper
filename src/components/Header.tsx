import React from 'react';
import { 
  Flag, 
  Globe, 
  Volume2, 
  VolumeX, 
  User, 
  LogOut, 
  Menu, 
  X 
} from 'lucide-react';

interface HeaderProps {
  playOnline: boolean;
  setPlayOnline: (play: boolean) => void;
  currentGameId: string | null;
  setCurrentGameId: (id: string | null) => void;
  setCurrentGame: (game: any) => void;
  loadGames: () => void;
  muted: boolean;
  setMuted: (muted: boolean) => void;
  user: any;
  handleLogout: () => void;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  getHubUrl: () => string;
}

export const Header: React.FC<HeaderProps> = ({
  playOnline,
  setPlayOnline,
  currentGameId,
  setCurrentGameId,
  setCurrentGame,
  loadGames,
  muted,
  setMuted,
  user,
  handleLogout,
  mobileMenuOpen,
  setMobileMenuOpen,
  getHubUrl
}) => {
  return (
    <header className="header-bar">
      <div className="header-logo">
        <Flag className="header-logo-icon" style={{ color: 'var(--accent-magenta)' }} />
        <span className="header-title">
          RETRO<span style={{ color: 'var(--accent-magenta)' }}>SWEEPER</span>
        </span>
      </div>
      
      {/* Desktop Header Actions */}
      <div className="header-actions">
        <div className="header-action-group">
          <Globe className={`h-4 w-4 ${playOnline ? 'connection-badge-pulse' : 'text-gray-500'}`} />
          <select
            value={playOnline ? 'online' : 'offline'}
            onChange={e => setPlayOnline(e.target.value === 'online')}
            className="connection-selector"
          >
            <option value="online">ONLINE</option>
            <option value="offline">OFFLINE</option>
          </select>
        </div>
        {!currentGameId ? (
          <a 
            href={getHubUrl()} 
            className="header-btn-back" 
            style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            HUB CATALOG
          </a>
        ) : (
          <button 
            onClick={() => {
              if (confirm("Disconnect sweep link and return to sector maps?")) {
                setCurrentGameId(null);
                setCurrentGame(null);
                loadGames();
              }
            }}
            className="header-btn-back"
          >
            ← SECTOR MAP
          </button>
        )}

        <button
          onClick={() => setMuted(!muted)}
          className="header-btn-mute"
          title={muted ? 'Unmute grid alerts' : 'Mute grid alerts'}
        >
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>

        <div className="header-user-section">
          <User className="header-user-icon" />
          <span className="header-user-name">{user.displayName || user.email.split('@')[0]}</span>
        </div>

        <button onClick={handleLogout} className="header-btn-disconnect">
          <LogOut className="h-4 w-4" /> DISCONNECT
        </button>
      </div>

      {/* Mobile Hamburger Drawer Toggle */}
      <button 
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)} 
        className="header-drawer-toggle"
        title="Toggle settings drawer"
      >
        {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Mobile Settings Drawer Menu */}
      {mobileMenuOpen && (
        <div className="header-mobile-drawer">
          <div className="mobile-drawer-row">
            <span>SYSTEM CONNECTION:</span>
            <select
              value={playOnline ? 'online' : 'offline'}
              onChange={e => {
                setPlayOnline(e.target.value === 'online');
                setMobileMenuOpen(false);
              }}
              className="connection-selector"
            >
              <option value="online">ONLINE</option>
              <option value="offline">OFFLINE</option>
            </select>
          </div>
          {!currentGameId ? (
            <div className="mobile-drawer-row">
              <span>CATALOG:</span>
              <a 
                href={getHubUrl()} 
                className="header-btn-back"
                style={{ textDecoration: 'none' }}
              >
                HUB CATALOG
              </a>
            </div>
          ) : (
            <div className="mobile-drawer-row">
              <span>SECTOR MAPS:</span>
              <button 
                onClick={() => {
                  setCurrentGameId(null);
                  setCurrentGame(null);
                  loadGames();
                  setMobileMenuOpen(false);
                }}
                className="header-btn-back"
              >
                ← SECTOR MAP
              </button>
            </div>
          )}
          <div className="mobile-drawer-row">
            <span>SOUND ALERTS:</span>
            <button
              onClick={() => setMuted(!muted)}
              className="header-btn-mute"
              style={{ padding: '4px 10px', fontSize: '11px', fontFamily: 'Share Tech Mono', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', cursor: 'pointer' }}
            >
              {muted ? <span style={{ color: 'var(--accent-magenta)' }}>MUTED</span> : <span style={{ color: '#10b981' }}>ACTIVE</span>}
            </button>
          </div>
          <div className="mobile-drawer-row">
            <span>SWEEPER:</span>
            <span style={{ color: 'var(--accent-magenta)', fontWeight: 'bold' }}>{user.displayName || user.email.split('@')[0]}</span>
          </div>
          <div className="mobile-drawer-row">
            <span>LOGOUT LOG:</span>
            <button 
              onClick={() => {
                handleLogout();
                setMobileMenuOpen(false);
              }} 
              className="header-btn-disconnect"
            >
              <LogOut className="h-4 w-4" /> DISCONNECT
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
