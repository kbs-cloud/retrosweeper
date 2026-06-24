import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw } from 'lucide-react';
import type { GameState } from './game/gameState';
import { isPlayerVacant } from './game/gameState';
import { authService, gameService } from './services';
import { startSSOBackgroundCheck, redirectToSSO } from './shared/auth/sso-helper';
import { GameBoard } from './components/GameBoard';
import { Header } from './components/Header';
import { AuthScreen } from './components/AuthScreen';
import { AuthPollingScreen } from './components/AuthPollingScreen';
import { Dashboard } from './components/Dashboard';
import { CreateGameModal } from './components/CreateGameModal';
import { LobbySetup } from './components/LobbySetup';
import { GameHUD } from './components/GameHUD';

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
  const [gameTab, setGameTab] = useState<'board' | 'hud'>('board');
  const [hudTab, setHudTab] = useState<'sweepers' | 'logs'>('sweepers');

  // Lobby lists
  const [joinRequests, setJoinRequests] = useState<any[]>([]);

  // Polling ref
  const pollIntervalRef = useRef<any>(null);
  const stateRef = useRef({ currentGameId, user, activeViewPlayerId });
  const terminalRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    stateRef.current = { currentGameId, user, activeViewPlayerId };
  }, [currentGameId, user, activeViewPlayerId]);

  // Scroll to bottom of terminal when game loads or new log entries arrive
  useEffect(() => {
    const scrollToBottom = () => {
      if (terminalRef.current) {
        terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
      }
    };
    scrollToBottom();
    const timeoutId = setTimeout(scrollToBottom, 50);
    return () => clearTimeout(timeoutId);
  }, [currentGameId, currentGame?.history.length, hudTab]);

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
      if (searchData.success === false) {
        setJoinError(searchData.error || 'Failed to search sector.');
        return;
      }
      const found = searchData.games?.find((g: any) => g.inviteCode === inviteCodeInput.trim().toUpperCase() || g.id === inviteCodeInput.trim());
      if (found) {
        const joinData = await gameService.joinGame(found.id);
        if (joinData.success) {
          setJoinSuccess('Connected to sector. Awaiting grid clearance slot.');
          setInviteCodeInput('');
          loadGames();
        } else {
          setJoinError(joinData.error || 'Lobby link refused.');
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
    return <AuthPollingScreen onCancel={() => {
      localStorage.removeItem('retrosweeper_auth_pending_token');
      setIsGooglePolling(false);
    }} />;
  }

  if (!user) {
    return <AuthScreen 
      authError={authError}
      playOnline={playOnline}
      setPlayOnline={setPlayOnline}
      redirectToAuth={redirectToAuth}
      setUser={setUser}
    />;
  }

  const mySlot = currentGame?.players.find(p => p.assignedEmail === user?.email || (user?.email === 'apprentice@local' && p.id === 'player_1'));

  return (
    <div className="app-container">
      <div className="lab-grid" />

      <Header 
        playOnline={playOnline}
        setPlayOnline={setPlayOnline}
        currentGameId={currentGameId}
        setCurrentGameId={setCurrentGameId}
        setCurrentGame={setCurrentGame}
        loadGames={loadGames}
        muted={muted}
        setMuted={setMuted}
        user={user}
        handleLogout={handleLogout}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        getHubUrl={getHubUrl}
      />

      {!currentGameId ? (
        <Dashboard 
          dashboardTab={dashboardTab}
          setDashboardTab={setDashboardTab}
          setShowCreateModal={setShowCreateModal}
          joinError={joinError}
          joinSuccess={joinSuccess}
          inviteCodeInput={inviteCodeInput}
          setInviteCodeInput={setInviteCodeInput}
          handleJoinGame={handleJoinGame}
          user={user}
          games={games}
          setCurrentGameId={setCurrentGameId}
          handleDeleteGame={handleDeleteGame}
        />
      ) : (
        <main className="game-layout">
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
              <LobbySetup 
                currentGame={currentGame}
                user={user}
                ownerEmail={ownerEmail}
                handleAssignSlot={handleAssignSlot}
                handleStartGame={handleStartGame}
              />
            ) : (
              <div className="play-grid-wrapper" style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '20px', height: '100%' }}>
                
                {/* Mobile Game View Tabs */}
                <div className="mobile-game-tabs" style={{ display: 'none' }}>
                  <button 
                    onClick={() => setGameTab('board')} 
                    className={`tab-btn ${gameTab === 'board' ? 'tab-btn-active' : ''}`}
                  >
                    📡 SCAN GRID
                  </button>
                  <button 
                    onClick={() => setGameTab('hud')} 
                    className={`tab-btn ${gameTab === 'hud' ? 'tab-btn-active' : ''}`}
                  >
                    📊 HUD MONITOR
                  </button>
                </div>

                {/* Left side: Canvas game board */}
                <div className={`board-outer-container ${gameTab === 'board' ? 'mobile-active-pane' : 'mobile-inactive-pane'}`} style={{ position: 'relative', display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
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
                      isMyTurn={true}
                      activeViewPlayerId={activeViewPlayerId || mySlot?.id || 'player_1'}
                    />
                  )}
                </div>

                <GameHUD 
                  gameTab={gameTab}
                  hudTab={hudTab}
                  setHudTab={setHudTab}
                  currentGame={currentGame}
                  mySlot={mySlot}
                  terminalRef={terminalRef}
                  handleResetGame={handleResetGame}
                  setCurrentGameId={setCurrentGameId}
                  setCurrentGame={setCurrentGame}
                  loadGames={loadGames}
                />
              </div>
            )}
          </div>
        </main>
      )}

      {showCreateModal && (
        <CreateGameModal 
          onClose={() => setShowCreateModal(false)}
          onCreateGame={handleCreateGame}
          createGameName={createGameName}
          setCreateGameName={setCreateGameName}
          maxPlayers={maxPlayers}
          setMaxPlayers={setMaxPlayers}
          boardWidth={boardWidth}
          setBoardWidth={setBoardWidth}
          boardHeight={boardHeight}
          setBoardHeight={setBoardHeight}
          mineCount={mineCount}
          setMineCount={setMineCount}
        />
      )}
    </div>
  );
}
