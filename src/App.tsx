import React, { useState, useEffect, useRef } from 'react';
import { 
  Shield, 
  User, 
  LogOut, 
  Plus, 
  Volume2, 
  VolumeX, 
  RefreshCw,
  Trophy,
  History,
  Globe,
  Menu,
  X,
  Flag,
  Zap,
  Grid
} from 'lucide-react';
import type { GameState } from './game/gameState';
import { isPlayerVacant } from './game/gameState';
import { apiFetch, isOnlineMode } from './services/api';
import { authService } from './services/authService';
import { gameService } from './services/gameService';
import { startSSOBackgroundCheck, redirectToSSO } from './shared/auth/sso-helper';
import { GameBoard } from './components/GameBoard';

function getHubUrl(): string {
  if (typeof window === 'undefined') return 'http://localhost:19000';
  const proto = window.location.protocol === 'https:' ? 'https:' : 'http:';
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:19000';
  }
  return `${proto}//kbs-cloud.com`;
}

export default function App() {
  const [playOnline, setPlayOnline] = useState<boolean>(() => localStorage.getItem('retrosweeper_play_online') !== 'false');
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [isGooglePolling, setIsGooglePolling] = useState(false);
  const [loaderText, setLoaderText] = useState('BOOTING HAZARD SYSTEMS...');
  const ssoCheckedRef = useRef(false);

  const [muted, setMuted] = useState(true);

  // Mobile navigation tabs & menu states
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dashboardTab, setDashboardTab] = useState<'grids' | 'archives'>('grids');

  // Dashboard state
  const [games, setGames] = useState<any[]>([]);
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [joinError, setJoinError] = useState('');
  const [joinSuccess, setJoinSuccess] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  // Custom setup options
  const [createGameName, setCreateGameName] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(3);
  const [boardWidth, setBoardWidth] = useState(12);
  const [boardHeight, setBoardHeight] = useState(12);
  const [mineCount, setMineCount] = useState(20);

  // Active Game State
  const [currentGameId, setCurrentGameId] = useState<string | null>(null);
  const [currentGame, setCurrentGame] = useState<GameState | null>(null);
  const [ownerEmail, setOwnerEmail] = useState<string | null>(null);
  const [connectedPlayers, setConnectedPlayers] = useState<string[]>([]);
  const [gameActionError, setGameActionError] = useState('');
  const [activeViewPlayerId, setActiveViewPlayerId] = useState<string | null>(null);

  // Lobby lists
  const [joinRequests, setJoinRequests] = useState<any[]>([]);

  // Polling ref
  const pollIntervalRef = useRef<any>(null);
  const stateRef = useRef({ currentGameId, user, activeViewPlayerId });

  useEffect(() => {
    stateRef.current = { currentGameId, user, activeViewPlayerId };
  }, [currentGameId, user, activeViewPlayerId]);

  // Init CSRF
  useEffect(() => {
    localStorage.removeItem('retrosweeper_auth_pending_token');
    authService.initCSRF();
  }, []);

  // Connection mode / session sync
  useEffect(() => {
    setAuthLoading(true);
    setCurrentGameId(null);
    setCurrentGame(null);
    setLoaderText('BOOTING HAZARD SYSTEMS...');
    localStorage.setItem('retrosweeper_play_online', playOnline ? 'true' : 'false');

    let active = true;
    let cleanupBackgroundCheck: (() => void) | null = null;

    authService.checkSession().then(async (u) => {
      if (!active) return;
      if (u) {
        setUser(u);
        setAuthLoading(false);
        loadGames();
      } else {
        setGames([]);
        
        if (playOnline && !ssoCheckedRef.current) {
          ssoCheckedRef.current = true;
          setLoaderText('ACQUIRING LINK TO SSO CORE...');
          
          cleanupBackgroundCheck = startSSOBackgroundCheck({
            clientId: 'retrosweeper',
            onSuccess: async () => {
              try {
                const uData = await authService.checkSession();
                if (uData && active) {
                  setUser(uData);
                  loadGames();
                }
              } catch (e) {
                console.error(e);
              } finally {
                if (active) {
                  setAuthLoading(false);
                }
              }
            },
            onFinished: () => {
              if (active) {
                setAuthLoading(false);
                const params = new URLSearchParams(window.location.search);
                const error = params.get('error');
                if (error) {
                  setAuthError(error === 'session_fail' ? 'Session establishment failed.' : error);
                  window.history.replaceState(null, '', window.location.pathname);
                }
              }
            }
          });
        } else {
          setAuthLoading(false);
          const params = new URLSearchParams(window.location.search);
          const error = params.get('error');
          if (error) {
            setAuthError(error === 'session_fail' ? 'Session establishment failed.' : error);
            window.history.replaceState(null, '', window.location.pathname);
          }
        }
      }
    }).catch(() => {
      if (!active) return;
      setUser(null);
      setAuthLoading(false);
      setGames([]);
    });

    return () => {
      active = false;
      ssoCheckedRef.current = false;
      if (cleanupBackgroundCheck) {
        cleanupBackgroundCheck();
      }
    };
  }, [playOnline]);

  // Poll for Google login status (packaged/electron mode)
  useEffect(() => {
    let active = true;
    let pollInterval: any = null;

    const startPolling = (token: string) => {
      setIsGooglePolling(true);
      if (pollInterval) clearInterval(pollInterval);
      pollInterval = setInterval(async () => {
        if (!active) return;
        try {
          const data = await authService.pollAuth(token);
          if (data.status === 'success' && data.sessionId) {
            clearInterval(pollInterval);
            localStorage.removeItem('retrosweeper_auth_pending_token');
            setIsGooglePolling(false);
            localStorage.setItem('retrosweeper_session_id', data.sessionId);
            
            const userData = await authService.checkSession();
            if (userData) {
              setUser(userData);
              loadGames();
            }
          } else if (data.status === 'error') {
            clearInterval(pollInterval);
            localStorage.removeItem('retrosweeper_auth_pending_token');
            setIsGooglePolling(false);
            setAuthError(data.error || 'Google Authentication failed.');
          }
        } catch (e) {
          console.error(e);
        }
      }, 2000);
    };

    const checkToken = () => {
      const token = localStorage.getItem('retrosweeper_auth_pending_token');
      if (token) {
        startPolling(token);
      }
    };

    const tokenInterval = setInterval(checkToken, 1000);
    return () => {
      active = false;
      if (pollInterval) clearInterval(pollInterval);
      clearInterval(tokenInterval);
    };
  }, []);

  // Poll game simulation loop
  useEffect(() => {
    if (currentGameId) {
      pollGame();
      pollIntervalRef.current = setInterval(pollGame, 2000);
    } else {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    }
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [currentGameId]);

  const loadGames = async () => {
    try {
      const data = await gameService.listGames();
      if (data.success) {
        setGames(data.games || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const pollGame = async () => {
    const { currentGameId: activeId } = stateRef.current;
    if (!activeId) return;
    try {
      const data = await gameService.getGame(activeId);
      if (data.success) {
        const nextState = data.game.gameState;
        setCurrentGame(nextState);
        setOwnerEmail(data.game.ownerEmail);
        setConnectedPlayers(data.connectedPlayers || []);

        const mySlot = nextState.players.find((p: any) => p.assignedEmail === user?.email || (user?.email === 'apprentice@local' && p.id === 'player_1'));
        if (mySlot && !stateRef.current.activeViewPlayerId) {
          setActiveViewPlayerId(mySlot.id);
        }

        if (nextState.status === 'setup') {
          const reqData = await gameService.fetchJoinRequests(activeId);
          if (reqData.success) {
            setJoinRequests(reqData.requests || []);
          }
        }
      } else {
        setCurrentGameId(null);
        setCurrentGame(null);
        setActiveViewPlayerId(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleLogout = async () => {
    await authService.logoutUser();
    setUser(null);
    setCurrentGameId(null);
    setCurrentGame(null);
    localStorage.removeItem('retrosweeper_session_id');

    const isPackaged = typeof window !== 'undefined' && 
                       (window.location.protocol === 'file:' || 
                        navigator.userAgent.toLowerCase().includes('electron'));
    if (!isPackaged && playOnline) {
      const getAuthUrl = () => {
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
          return 'http://localhost:19001';
        }
        return `${window.location.protocol}//auth.kbs-cloud.com`;
      };
      window.location.href = `${getAuthUrl()}/api/auth/logout?redirect_uri=${encodeURIComponent(window.location.origin)}`;
    }
  };

  const redirectToAuth = () => {
    const isPackaged = typeof window !== 'undefined' && 
                       (window.location.protocol === 'file:' || 
                        navigator.userAgent.toLowerCase().includes('electron'));
    
    if (isPackaged) {
      const token = Math.random().toString(36).substring(2, 15);
      localStorage.setItem('retrosweeper_auth_pending_token', token);
      redirectToSSO('retrosweeper', `source=electron&token=${token}`);
      setIsGooglePolling(true);
    } else {
      redirectToSSO('retrosweeper');
    }
  };

  const handleCreateGame = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = await gameService.createGame(createGameName, maxPlayers, boardWidth, boardHeight, mineCount);
      if (data.success) {
        setShowCreateModal(false);
        setCreateGameName('');
        setCurrentGameId(data.gameId);
        loadGames();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleJoinGame = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError('');
    setJoinSuccess('');
    if (!inviteCodeInput) return;

    try {
      const searchData = await gameService.listGames(inviteCodeInput.trim());
      const found = searchData.games?.find((g: any) => g.inviteCode === inviteCodeInput.trim().toUpperCase() || g.id === inviteCodeInput.trim());
      if (found) {
        const joinData = await gameService.joinGame(found.id);
        if (joinData.success) {
          setJoinSuccess('Connected to sector. Awaiting grid clearance slot.');
          setInviteCodeInput('');
          loadGames();
        } else {
          setJoinError('Lobby link refused.');
        }
      } else {
        setJoinError('Hazard sector code not found.');
      }
    } catch (e) {
      setJoinError('Link path timed out.');
    }
  };

  const handleAssignSlot = async (playerId: string, assignOptions: { email?: string | null, isAi?: boolean, isLocal?: boolean, name?: string }) => {
    if (!currentGameId) return;
    try {
      await gameService.assignSlot(currentGameId, playerId, assignOptions);
      pollGame();
    } catch (e) {
      console.error(e);
    }
  };

  const handleStartGame = () => {
    if (!currentGameId) return;
    gameService.performGameAction(currentGameId, { type: 'start' }, 'player_1')
      .then(pollGame)
      .catch(console.error);
  };

  const handleCellAction = async (actionType: 'reveal' | 'flag', x: number, y: number) => {
    if (!currentGameId || !currentGame) return;
    setGameActionError('');

    const mySlot = currentGame.players.find(p => p.assignedEmail === user?.email || (user?.email === 'apprentice@local' && p.id === 'player_1'));
    if (!mySlot) {
      setGameActionError('You are not assigned to a grid sweep channel.');
      return;
    }

    if (mySlot.glitchUntil > Date.now()) {
      setGameActionError('Terminal locked. cyber-detonation restructuring.');
      return;
    }

    try {
      const data = await gameService.performGameAction(currentGameId, {
        type: actionType,
        x,
        y
      }, mySlot.id);

      if (data.success) {
        const prevStatus = currentGame.status;
        const nextState = data.gameState;
        setCurrentGame(nextState);

        // Sound triggers
        if (!muted && typeof AudioContext !== 'undefined') {
          const ctx = new AudioContext();
          if (actionType === 'flag') {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
            gain.gain.setValueAtTime(0.08, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
            osc.start();
            osc.stop(ctx.currentTime + 0.12);
          } else {
            // Check if mine detonated
            const targetCell = nextState.grids[mySlot.id] ? nextState.grids[mySlot.id][y][x] : null;
            if (targetCell && targetCell.isMine && targetCell.isRevealed) {
              // DETONATION BOOM
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              osc.connect(gain);
              gain.connect(ctx.destination);
              osc.type = 'sawtooth';
              osc.frequency.setValueAtTime(110, ctx.currentTime);
              osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.6);
              gain.gain.setValueAtTime(0.25, ctx.currentTime);
              gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
              osc.start();
              osc.stop(ctx.currentTime + 0.6);
            } else {
              // Click safe chirp
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              osc.connect(gain);
              gain.connect(ctx.destination);
              osc.frequency.setValueAtTime(880, ctx.currentTime);
              gain.gain.setValueAtTime(0.05, ctx.currentTime);
              gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
              osc.start();
              osc.stop(ctx.currentTime + 0.08);
            }
          }
        }

        // Trigger stats push if won
        if (nextState.status === 'completed' && prevStatus !== 'completed') {
          const hasWon = nextState.winnerEmail === user.email;
          gameService.updateStats(hasWon).catch(console.error);
        }
      } else {
        setGameActionError(data.error || 'Action refused.');
      }
    } catch (e) {
      setGameActionError('Link sync error.');
    }
  };

  const handleResetGame = () => {
    if (!currentGameId) return;
    gameService.performGameAction(currentGameId, { type: 'reset' }, 'player_1')
      .then(pollGame)
      .catch(console.error);
  };

  const handleDeleteGame = async (gameId: string) => {
    if (confirm('Decommission this grid segment? All hazard records will be purged.')) {
      try {
        const data = await gameService.deleteGame(gameId);
        if (data.success) {
          loadGames();
        }
      } catch (e) {
        console.error(e);
      }
    }
  };

  if (authLoading) {
    return (
      <div className="loader-overlay">
        <div className="loader-container">
          <RefreshCw className="loader-icon spin-loader" />
          <div className="loader-text">{loaderText}</div>
        </div>
      </div>
    );
  }

  if (isGooglePolling) {
    return (
      <div className="auth-container">
        <div className="lab-grid" />
        <div className="glass-panel auth-card">
          <div className="auth-header">
            <h2 className="auth-title">ESTABLISHING LINK</h2>
            <p className="auth-subtitle">Trans-Node Authorization</p>
          </div>
          <p className="auth-desc">
            Please log in using your external web browser window.
          </p>
          <div className="loader-icon spin-loader" style={{ margin: '0 auto 24px auto' }} />
          <button 
            onClick={() => {
              localStorage.removeItem('retrosweeper_auth_pending_token');
              setIsGooglePolling(false);
            }}
            className="btn-sci-fi btn-danger auth-btn-login"
          >
            Cancel Authentication Request
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
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
  }

  const mySlot = currentGame?.players.find(p => p.assignedEmail === user?.email || (user?.email === 'apprentice@local' && p.id === 'player_1'));
  const isCurrentlyGlitched = mySlot && mySlot.glitchUntil > Date.now();

  return (
    <div className="app-container">
      <div className="lab-grid" />

      {/* Header bar */}
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

      {/* --- DASHBOARD LOBBIES / ARCHIVE VIEW --- */}
      {!currentGameId ? (
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
      ) : (
        /* --- ACTIVE SECTOR INTERFACE --- */
        <main className="game-layout">
          {/* Top Bar for Game info */}
          <div className="game-info-strip">
            <div>
              <span className="game-info-label">SECTOR: </span>
              <span className="game-info-value">{currentGame?.name}</span>
            </div>
            <div>
              <span className="game-info-label">GRID DIMENSIONS: </span>
              <span className="game-info-value">{currentGame?.width} x {currentGame?.height}</span>
            </div>
            <div>
              <span className="game-info-label">ACTIVE HAZARDS: </span>
              <span className="game-info-value" style={{ color: 'var(--accent-magenta)' }}>{currentGame?.mineCount} Mines</span>
            </div>
            <div>
              <span className="game-info-label">STATUS: </span>
              <span className={`badge-status ${currentGame?.status === 'playing' ? 'badge-status-turn' : 'badge-status-wait'}`}>
                {currentGame?.status.toUpperCase()}
              </span>
            </div>
          </div>

          <div className="game-grid-section">
            {gameActionError && <div className="game-error-banner">COMMUNICATIONS FAULT: {gameActionError}</div>}

            {currentGame?.status === 'setup' ? (
              <div className="glass-panel lobby-setup-container" style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '30px', margin: '0 auto', maxWidth: '600px', textAlign: 'center' }}>
                <div>
                  <h3 className="widget-title" style={{ fontSize: '20px' }}>GRID SWEEPER ROSTER</h3>
                  <p className="widget-subtitle">Verify connections and assign sweep channels before ignition</p>
                </div>

                <div className="lobby-slots-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {currentGame?.players.map(p => {
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
            ) : (
              <div className="play-grid-wrapper" style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '20px', height: '100%' }}>
                
                {/* Left side: Canvas game board */}
                <div className="board-outer-container" style={{ position: 'relative', display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
                  {currentGame && (
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', overflowX: 'auto', paddingBottom: '4px' }}>
                      <span style={{ fontSize: '12px', fontFamily: 'Share Tech Mono', color: 'rgba(255, 255, 255, 0.45)', display: 'flex', alignItems: 'center', marginRight: '8px' }}>
                        📡 SELECT SCAN CHANNEL:
                      </span>
                      {currentGame.players.filter(p => !isPlayerVacant(p, currentGame.status)).map(p => {
                        const isMe = p.id === mySlot?.id;
                        const isViewing = p.id === activeViewPlayerId;
                        const isGlitched = p.glitchUntil > Date.now();
                        
                        let borderCol = 'rgba(255, 255, 255, 0.1)';
                        let textCol = 'rgba(255, 255, 255, 0.6)';
                        if (isViewing) {
                          borderCol = '#00ffff';
                          textCol = '#00ffff';
                        } else if (isMe) {
                          borderCol = 'rgba(0, 255, 255, 0.3)';
                          textCol = 'rgba(0, 255, 255, 0.8)';
                        }
                        
                        let badgeText = '';
                        if (p.status === 'completed') badgeText = ' [CLR]';
                        else if (p.status === 'failed') badgeText = ' [OUT]';
                        else if (isGlitched) badgeText = ' [ERR]';

                        return (
                          <button
                            key={p.id}
                            onClick={() => setActiveViewPlayerId(p.id)}
                            className="btn-sci-fi"
                            style={{
                              padding: '4px 10px',
                              fontSize: '11px',
                              borderColor: borderCol,
                              color: textCol,
                              background: isViewing ? 'rgba(0, 255, 255, 0.05)' : 'transparent',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            {isMe ? 'Channel ' + p.id.split('_')[1] + ' (Me)' : 'Channel ' + p.id.split('_')[1] + (p.isAi ? ' (AI)' : ' (Human)')}
                            {badgeText && <span style={{ color: p.status === 'completed' ? '#10b981' : '#ff0055', fontWeight: 'bold' }}>{badgeText}</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {currentGame && (
                    <GameBoard 
                      gameState={currentGame}
                      myPlayerId={mySlot?.id || 'player_1'}
                      onCellAction={handleCellAction}
                      isMyTurn={true} // In Minesweeper sweepers play continuously
                      activeViewPlayerId={activeViewPlayerId || mySlot?.id || 'player_1'}
                    />
                  )}
                </div>

                {/* Right side: HUD Dashboard */}
                <div className="game-hud-panel" style={{ display: 'flex', flexDirection: 'column', gap: '20px', background: 'rgba(5, 3, 13, 0.6)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(0, 255, 255, 0.1)', height: '100%', minHeight: 0 }}>
                  <div>
                    <h3 className="widget-title">ACTIVE SWEEPERS</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px', overflowY: 'auto', maxHeight: '180px' }}>
                      {currentGame?.players.filter(p => !isPlayerVacant(p, currentGame.status)).map(p => {
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

                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                    <h3 className="widget-title">ACTIVITY MONITOR</h3>
                    <div className="activity-terminal" style={{ flex: 1, overflowY: 'auto', background: '#030107', padding: '10px', borderRadius: '4px', border: '1px solid rgba(0, 255, 255, 0.05)', fontSize: '11px', fontFamily: 'Share Tech Mono', color: '#00ffcc', lineHeight: '1.4' }}>
                      {currentGame?.history.map((log, index) => (
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
              </div>
            )}
          </div>
        </main>
      )}

      {/* --- CREATE NEW CRUCIBLE MODAL --- */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="glass-panel modal-card" style={{ maxWidth: '400px', width: '90%' }}>
            <div className="modal-header">
              <h3 className="modal-title">INITIALIZE SWEEP FIELD</h3>
              <button onClick={() => setShowCreateModal(false)} className="modal-close-btn"><X className="h-4 w-4" /></button>
            </div>
            <form onSubmit={handleCreateGame} className="modal-form" style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)' }}>FIELD NAME</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Sector 9" 
                  className="terminal-input"
                  value={createGameName}
                  onChange={e => setCreateGameName(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)' }}>SWEEPER PORTS (MAX PLAYERS)</label>
                <select 
                  className="terminal-input"
                  value={maxPlayers}
                  onChange={e => setMaxPlayers(parseInt(e.target.value))}
                >
                  <option value="1">1 Sweeper (Single Player)</option>
                  <option value="2">2 Sweepers</option>
                  <option value="3">3 Sweepers</option>
                  <option value="4">4 Sweepers</option>
                </select>
              </div>

              <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)' }}>GRID WIDTH</label>
                  <input 
                    type="number" 
                    required 
                    min="5" 
                    max="25"
                    className="terminal-input"
                    value={boardWidth}
                    onChange={e => setBoardWidth(parseInt(e.target.value))}
                  />
                </div>
                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)' }}>GRID HEIGHT</label>
                  <input 
                    type="number" 
                    required 
                    min="5" 
                    max="25"
                    className="terminal-input"
                    value={boardHeight}
                    onChange={e => setBoardHeight(parseInt(e.target.value))}
                  />
                </div>
              </div>

              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)' }}>HAZARD MINE COUNT</label>
                <input 
                  type="number" 
                  required 
                  min="1" 
                  max={Math.floor((boardWidth * boardHeight) * 0.4)}
                  className="terminal-input"
                  value={mineCount}
                  onChange={e => setMineCount(parseInt(e.target.value))}
                />
              </div>

              <button type="submit" className="btn-sci-fi btn-sci-fi-gold" style={{ width: '100%', marginTop: '10px', padding: '10px' }}>LAUNCH SECTOR MATRIX</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
