import React, { useEffect, useRef, useState } from 'react';
import type { Cell, GameState, Player } from '../game/gameState';

interface GameBoardProps {
  gameState: GameState;
  myPlayerId: string;
  onCellAction: (actionType: 'reveal' | 'flag', x: number, y: number) => void;
  isMyTurn: boolean;
  activeViewPlayerId?: string;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export const GameBoard: React.FC<GameBoardProps> = ({
  gameState,
  myPlayerId,
  onCellAction,
  activeViewPlayerId = myPlayerId
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  
  // Cyber-cursor coordinates for keyboard controls
  const [cursorX, setCursorX] = useState(0);
  const [cursorY, setCursorY] = useState(0);

  // Mouse hover state
  const [hoveredX, setHoveredX] = useState<number | null>(null);
  const [hoveredY, setHoveredY] = useState<number | null>(null);

  // Animation particles
  const particlesRef = useRef<Particle[]>([]);

  // Screen shake & glitch variables
  const glitchRef = useRef({
    shakeAmount: 0,
    intensity: 0,
    active: false,
    textOffset: 0
  });

  const explodedPlayersRef = useRef<string[]>([]);

  // Calculate cell sizes
  const [dimensions, setDimensions] = useState({ cellWidth: 40, offsetLeft: 0, offsetTop: 0 });

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const code = e.key;
      let dx = 0;
      let dy = 0;

      if (code === 'ArrowLeft' || code === 'a' || code === 'A') dx = -1;
      else if (code === 'ArrowRight' || code === 'd' || code === 'D') dx = 1;
      else if (code === 'ArrowUp' || code === 'w' || code === 'W') dy = -1;
      else if (code === 'ArrowDown' || code === 's' || code === 'S') dy = 1;

      if (dx !== 0 || dy !== 0) {
        e.preventDefault();
        setCursorX(prev => Math.max(0, Math.min(gameState.width - 1, prev + dx)));
        setCursorY(prev => Math.max(0, Math.min(gameState.height - 1, prev + dy)));
      }

      if (code === ' ' || code === 'Enter') {
        e.preventDefault();
        if (activeViewPlayerId === myPlayerId) {
          onCellAction('reveal', cursorX, cursorY);
        }
      }

      if (code === 'f' || code === 'F') {
        e.preventDefault();
        if (activeViewPlayerId === myPlayerId) {
          onCellAction('flag', cursorX, cursorY);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cursorX, cursorY, gameState, onCellAction, activeViewPlayerId, myPlayerId]);

  // Handle explosions on mine hits
  useEffect(() => {
    if (gameState.status === 'setup' || !gameState.players || gameState.players.every(p => p.status !== 'failed')) {
      explodedPlayersRef.current = [];
      return;
    }

    const failedPlayers = gameState.players.filter(p => p.status === 'failed').map(p => p.id);
    const newFailedPlayers = failedPlayers.filter(id => !explodedPlayersRef.current.includes(id));
    
    if (newFailedPlayers.length > 0) {
      explodedPlayersRef.current = [...explodedPlayersRef.current, ...newFailedPlayers];

      // Spawn sparks
      const particles = particlesRef.current;
      const canvas = canvasRef.current;
      if (canvas) {
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        // Trigger screen shake
        glitchRef.current.shakeAmount = 15;
        glitchRef.current.intensity = 0.8;
        glitchRef.current.active = true;

        for (let i = 0; i < 40; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 2 + Math.random() * 8;
          particles.push({
            x: cx + (Math.random() - 0.5) * 200,
            y: cy + (Math.random() - 0.5) * 200,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 0,
            maxLife: 30 + Math.random() * 20,
            color: Math.random() > 0.5 ? '#ff007f' : '#ff5500',
            size: 2 + Math.random() * 4
          });
        }
      }
    }
  }, [gameState.players, gameState.status]);

  // Resize listener
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const dpr = window.devicePixelRatio || 1;
      const width = container.clientWidth;
      const height = Math.max(400, container.clientHeight || 500);

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      // Scale calculations
      const padding = 20;
      const boardWidth = width - padding * 2;
      const boardHeight = height - padding * 2;

      const cellW = Math.min(
        Math.floor(boardWidth / gameState.width),
        Math.floor(boardHeight / gameState.height),
        50
      );

      const offsetL = Math.floor((width - cellW * gameState.width) / 2);
      const offsetT = Math.floor((height - cellW * gameState.height) / 2);

      setDimensions({
        cellWidth: cellW,
        offsetLeft: offsetL,
        offsetTop: offsetT
      });
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    
    // Auto resize after small delay to let parent sizing lock
    const timer = setTimeout(handleResize, 100);

    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timer);
    };
  }, [gameState.width, gameState.height]);

  // Render loop
  useEffect(() => {
    let animFrameId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      const dpr = window.devicePixelRatio || 1;
      ctx.save();
      ctx.scale(dpr, dpr);

      const width = canvas.width / dpr;
      const height = canvas.height / dpr;

      // Handle Screen Shake
      let shakeX = 0;
      let shakeY = 0;
      if (glitchRef.current.shakeAmount > 0.1) {
        shakeX = (Math.random() - 0.5) * glitchRef.current.shakeAmount;
        shakeY = (Math.random() - 0.5) * glitchRef.current.shakeAmount;
        glitchRef.current.shakeAmount *= 0.9; // decay
      }

      ctx.clearRect(0, 0, width, height);

      // Background drawing (metallic mesh feel)
      ctx.fillStyle = '#05030d';
      ctx.fillRect(0, 0, width, height);

      // Draw subtle terminal scanning line effects
      ctx.strokeStyle = 'rgba(0, 255, 255, 0.03)';
      ctx.lineWidth = 1;
      for (let i = 0; i < height; i += 4) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(width, i);
        ctx.stroke();
      }

      // Draw gameboard grid centered
      ctx.translate(shakeX, shakeY);
      
      const { cellWidth, offsetLeft, offsetTop } = dimensions;

      const targetGrid = gameState.grids[activeViewPlayerId] || [];

      // Draw individual cells
      for (let y = 0; y < gameState.height; y++) {
        for (let x = 0; x < gameState.width; x++) {
          const cell = targetGrid[y] ? targetGrid[y][x] : null;
          if (!cell) continue;
          const cx = offsetLeft + x * cellWidth;
          const cy = offsetTop + y * cellWidth;

          const isHovered = hoveredX === x && hoveredY === y;
          const isCursor = cursorX === x && cursorY === y;

          ctx.save();
          ctx.translate(cx, cy);

          if (!cell.isRevealed) {
            // Unrevealed Sector Style
            ctx.fillStyle = isHovered ? '#1c1736' : '#100c24';
            ctx.fillRect(1, 1, cellWidth - 2, cellWidth - 2);

            // Neon Borders
            ctx.strokeStyle = isCursor 
              ? '#ffff00' 
              : isHovered 
                ? 'rgba(0, 255, 255, 0.7)' 
                : 'rgba(0, 255, 255, 0.25)';
            ctx.lineWidth = isCursor || isHovered ? 2 : 1;
            ctx.strokeRect(1, 1, cellWidth - 2, cellWidth - 2);

            // Draw holographic warning flag beacon
            if (cell.isFlagged) {
              // Draw flag base
              ctx.fillStyle = '#ff0055';
              ctx.shadowColor = '#ff0055';
              ctx.shadowBlur = 10;
              
              // Flag shape
              ctx.beginPath();
              ctx.moveTo(cellWidth * 0.35, cellWidth * 0.8);
              ctx.lineTo(cellWidth * 0.65, cellWidth * 0.8);
              ctx.moveTo(cellWidth * 0.5, cellWidth * 0.8);
              ctx.lineTo(cellWidth * 0.5, cellWidth * 0.25);
              ctx.lineTo(cellWidth * 0.25, cellWidth * 0.45);
              ctx.lineTo(cellWidth * 0.5, cellWidth * 0.55);
              ctx.lineWidth = 3;
              ctx.strokeStyle = '#ff0055';
              ctx.stroke();

              // Beacon top dot
              ctx.fillStyle = '#ff0055';
              ctx.beginPath();
              ctx.arc(cellWidth * 0.5, cellWidth * 0.25, 2, 0, Math.PI * 2);
              ctx.fill();
            }
          } else {
            // Revealed Sector Style
            ctx.fillStyle = '#0a0718';
            ctx.fillRect(1, 1, cellWidth - 2, cellWidth - 2);

            ctx.strokeStyle = 'rgba(0, 255, 255, 0.08)';
            ctx.lineWidth = 1;
            ctx.strokeRect(1, 1, cellWidth - 2, cellWidth - 2);

            if (cell.isMine) {
              // Mine display (cyber-hazard)
              ctx.fillStyle = '#ff0055';
              ctx.shadowColor = '#ff0055';
              ctx.shadowBlur = 12;

              ctx.beginPath();
              ctx.arc(cellWidth * 0.5, cellWidth * 0.5, Math.max(0, cellWidth * 0.25), 0, Math.PI * 2);
              ctx.fill();

              // Draw cross lines for spikes
              ctx.strokeStyle = '#ff0055';
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.moveTo(cellWidth * 0.15, cellWidth * 0.5);
              ctx.lineTo(cellWidth * 0.85, cellWidth * 0.5);
              ctx.moveTo(cellWidth * 0.5, cellWidth * 0.15);
              ctx.lineTo(cellWidth * 0.5, cellWidth * 0.85);
              ctx.stroke();
            } else if (cell.neighborMines > 0) {
              // Draw text indicator
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.font = `bold ${Math.floor(cellWidth * 0.45)}px 'Share Tech Mono', monospace`;
              
              // Colors matching retro styling
              let color = '#39ff14'; // 1 (Green)
              if (cell.neighborMines === 1) color = '#00ffff'; // Neon Blue
              else if (cell.neighborMines === 2) color = '#39ff14'; // Lime Green
              else if (cell.neighborMines === 3) color = '#ff007f'; // Magenta Crimson
              else if (cell.neighborMines === 4) color = '#bd00ff'; // Purple
              else if (cell.neighborMines >= 5) color = '#ff5500'; // Orange
              
              ctx.fillStyle = color;
              ctx.shadowColor = color;
              ctx.shadowBlur = 5;
              ctx.fillText(cell.neighborMines.toString(), cellWidth / 2, cellWidth / 2);
            }
          }
          ctx.restore();
        }
      }

      // Draw Cursor target highlight in setup / play modes
      if (gameState.status === 'playing') {
        const curX = offsetLeft + cursorX * cellWidth;
        const curY = offsetTop + cursorY * cellWidth;
        ctx.strokeStyle = 'rgba(255, 255, 0, 0.45)';
        ctx.lineWidth = 2;
        ctx.strokeRect(curX - 2, curY - 2, cellWidth + 4, cellWidth + 4);
      }

      // Draw and update explosion sparks
      const particles = particlesRef.current;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.1; // gravity
        p.life++;

        ctx.save();
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        const radius = Math.max(0, p.size * (1 - p.life / p.maxLife));
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        if (p.life >= p.maxLife) {
          particles.splice(i, 1);
        }
      }

      // Detonation CRT Lockout overlay
      const myPlayer = gameState.players.find(p => p.id === myPlayerId);
      const isCurrentlyGlitched = myPlayer && myPlayer.glitchUntil > Date.now();
      
      if (isCurrentlyGlitched) {
        // Red filter flash
        ctx.fillStyle = `rgba(255, 0, 85, ${0.12 + Math.random() * 0.1})`;
        ctx.fillRect(0, 0, width, height);

        // Draw warning message
        ctx.fillStyle = '#ff0055';
        ctx.shadowColor = '#ff0055';
        ctx.shadowBlur = 15;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = "bold 20px 'Share Tech Mono', monospace";
        
        const offset = (Math.random() - 0.5) * 6;
        ctx.fillText("CRITICAL DANGER: SYSTEM FAULT", width / 2 + offset, height / 2 - 20);
        ctx.font = "14px 'Share Tech Mono', monospace";
        ctx.fillStyle = '#00ffff';
        ctx.shadowColor = '#00ffff';
        ctx.fillText("Detonation feedback: Restructuring terminal nodes...", width / 2 - offset, height / 2 + 15);

        // Draw heavy glitch lines
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        for (let idx = 0; idx < 4; idx++) {
          const gy = Math.random() * height;
          const gh = 2 + Math.random() * 10;
          ctx.fillRect(0, gy, width, gh);
        }
      }
      if (activeViewPlayerId !== myPlayerId) {
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.4)';
        ctx.lineWidth = 1.5;
        
        const borderGap = 15;
        const cornerLen = 20;
        
        // Top Left
        ctx.beginPath();
        ctx.moveTo(borderGap, borderGap + cornerLen);
        ctx.lineTo(borderGap, borderGap);
        ctx.lineTo(borderGap + cornerLen, borderGap);
        ctx.stroke();
        
        // Top Right
        ctx.beginPath();
        ctx.moveTo(width - borderGap - cornerLen, borderGap);
        ctx.lineTo(width - borderGap, borderGap);
        ctx.lineTo(width - borderGap, borderGap + cornerLen);
        ctx.stroke();
        
        // Bottom Left
        ctx.beginPath();
        ctx.moveTo(borderGap, height - borderGap - cornerLen);
        ctx.lineTo(borderGap, height - borderGap);
        ctx.lineTo(borderGap + cornerLen, height - borderGap);
        ctx.stroke();
        
        // Bottom Right
        ctx.beginPath();
        ctx.moveTo(width - borderGap - cornerLen, height - borderGap);
        ctx.lineTo(width - borderGap, height - borderGap);
        ctx.lineTo(width - borderGap, height - borderGap - cornerLen);
        ctx.stroke();

        const targetPlayer = gameState.players.find(p => p.id === activeViewPlayerId);
        ctx.fillStyle = '#00ffff';
        ctx.shadowColor = '#00ffff';
        ctx.shadowBlur = 8;
        ctx.font = "11px 'Share Tech Mono', monospace";
        ctx.textAlign = 'left';
        const targetPlayerName = targetPlayer?.name || 'CHANNEL';
        ctx.fillText(`📡 FEED SECURED: ${targetPlayerName.toUpperCase()}`, borderGap + 10, borderGap + 20);
        
        if (Math.floor(Date.now() / 500) % 2 === 0) {
          ctx.fillStyle = '#ff0055';
          ctx.shadowColor = '#ff0055';
          ctx.beginPath();
          ctx.arc(width - borderGap - 20, borderGap + 16, 4, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#ff0055';
        ctx.shadowColor = '#ff0055';
        ctx.textAlign = 'right';
        ctx.fillText("LIVE SCAN", width - borderGap - 30, borderGap + 20);
      }

      ctx.restore();
      animFrameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animFrameId);
  }, [gameState, cursorX, cursorY, hoveredX, hoveredY, dimensions, myPlayerId, activeViewPlayerId]);

  // Click calculations
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>, action: 'reveal' | 'flag') => {
    if (activeViewPlayerId !== myPlayerId) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const { cellWidth, offsetLeft, offsetTop } = dimensions;

    const cellX = Math.floor((x - offsetLeft) / cellWidth);
    const cellY = Math.floor((y - offsetTop) / cellWidth);

    if (cellX >= 0 && cellX < gameState.width && cellY >= 0 && cellY < gameState.height) {
      onCellAction(action, cellX, cellY);
      setCursorX(cellX);
      setCursorY(cellY);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const { cellWidth, offsetLeft, offsetTop } = dimensions;

    const cellX = Math.floor((x - offsetLeft) / cellWidth);
    const cellY = Math.floor((y - offsetTop) / cellWidth);

    if (cellX >= 0 && cellX < gameState.width && cellY >= 0 && cellY < gameState.height) {
      setHoveredX(cellX);
      setHoveredY(cellY);
    } else {
      setHoveredX(null);
      setHoveredY(null);
    }
  };

  const handleMouseLeave = () => {
    setHoveredX(null);
    setHoveredY(null);
  };

  return (
    <div ref={containerRef} className="canvas-container" style={{ width: '100%', height: '100%', minHeight: 0, flex: 1, position: 'relative' }}>
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={(e) => handleCanvasClick(e, 'reveal')}
        onContextMenu={(e) => {
          e.preventDefault();
          handleCanvasClick(e, 'flag');
        }}
        style={{ display: 'block', background: '#05030d', borderRadius: '8px', boxShadow: 'inset 0 0 20px rgba(0,255,255,0.1)' }}
      />
      
      {/* Keyboard Shortcuts Prompt */}
      <div style={{
        position: 'absolute',
        bottom: '10px',
        left: '50%',
        transform: 'translateX(-50%)',
        fontSize: '11px',
        color: 'rgba(0, 255, 255, 0.45)',
        fontFamily: "'Share Tech Mono', monospace",
        pointerEvents: 'none',
        textAlign: 'center',
        background: 'rgba(5, 3, 13, 0.8)',
        padding: '4px 12px',
        borderRadius: '4px',
        border: '1px solid rgba(0, 255, 255, 0.1)'
      }}>
        [Mouse Left] Clear | [Mouse Right] Flag | [W/A/S/D / Arrows] Move | [Space] Clear | [F] Flag
      </div>
    </div>
  );
};
