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

  // Zoom & Pan states
  const [zoom, setZoom] = useState(1.0);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [mobileActionMode, setMobileActionMode] = useState<'reveal' | 'flag'>('reveal');
  const [showHelp, setShowHelp] = useState(false);

  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const panStartRef = useRef({ x: 0, y: 0 });
  const touchStartDistRef = useRef<number | null>(null);
  const touchStartZoomRef = useRef<number>(1.0);

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
      const height = container.clientHeight || 400;

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

      // Reset zoom and panning when screen layout changes to keep centered
      setZoom(1.0);
      setPanX(0);
      setPanY(0);
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

  // Helper to clamp pan offsets to keep board within viewport
  const clampPan = (px: number, py: number, currentZoom: number) => {
    const { cellWidth, offsetLeft, offsetTop } = dimensions;
    const canvas = canvasRef.current;
    if (!canvas) return { x: px, y: py };

    const width = canvas.width / (window.devicePixelRatio || 1);
    const height = canvas.height / (window.devicePixelRatio || 1);

    const boardWidth = cellWidth * currentZoom * gameState.width;
    const boardHeight = cellWidth * currentZoom * gameState.height;

    let clampedX = px;
    let clampedY = py;

    if (boardWidth > width) {
      // Allow panning when zoomed, but don't let edges leave the screen
      const minPanX = width - boardWidth - offsetLeft - 20; // 20px padding
      const maxPanX = -offsetLeft + 20;
      clampedX = Math.max(minPanX, Math.min(maxPanX, px));
    } else {
      // Lock centered if it fits within the viewport width
      clampedX = 0;
    }

    if (boardHeight > height) {
      // Allow panning vertically, but clamp to edges
      const minPanY = height - boardHeight - offsetTop - 20; // 20px padding
      const maxPanY = -offsetTop + 20;
      clampedY = Math.max(minPanY, Math.min(maxPanY, py));
    } else {
      // Lock centered if it fits within the viewport height
      clampedY = 0;
    }

    return { x: clampedX, y: clampedY };
  };

  const updatePan = (px: number, py: number, z: number) => {
    const clamped = clampPan(px, py, z);
    setPanX(clamped.x);
    setPanY(clamped.y);
  };

  // Helper to adjust zoom centered on a specific point (mx, my)
  const adjustZoom = (newZoom: number, mx: number, my: number) => {
    const { cellWidth, offsetLeft, offsetTop } = dimensions;
    const ratio = newZoom / zoom;
    
    const newPanX = panX * ratio + (mx - offsetLeft) * (1 - ratio);
    const newPanY = panY * ratio + (my - offsetTop) * (1 - ratio);
    
    setZoom(newZoom);
    updatePan(newPanX, newPanY, newZoom);
  };

  // Zoom button handler
  const handleZoomBtn = (factor: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = rect.width / 2;
    const my = rect.height / 2;
    const newZoom = Math.max(0.5, Math.min(4.0, zoom * factor));
    adjustZoom(newZoom, mx, my);
  };

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const zoomFactor = 1.1;
    const newZoom = e.deltaY < 0 
      ? Math.min(4.0, zoom * zoomFactor) 
      : Math.max(0.5, zoom / zoomFactor);

    adjustZoom(newZoom, mx, my);
  };

  // Mouse Drag / Panning
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return; // Only drag with left click
    isDraggingRef.current = false;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    panStartRef.current = { x: panX, y: panY };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const { cellWidth, offsetLeft, offsetTop } = dimensions;
    const finalCellWidth = cellWidth * zoom;

    if (e.buttons === 1) { // Left button is pressed
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      if (Math.hypot(dx, dy) > 5) {
        isDraggingRef.current = true;
        updatePan(panStartRef.current.x + dx, panStartRef.current.y + dy, zoom);
        setHoveredX(null);
        setHoveredY(null);
      }
    } else {
      // Just hover
      const cellX = Math.floor((mx - offsetLeft - panX) / finalCellWidth);
      const cellY = Math.floor((my - offsetTop - panY) / finalCellWidth);

      if (cellX >= 0 && cellX < gameState.width && cellY >= 0 && cellY < gameState.height) {
        setHoveredX(cellX);
        setHoveredY(cellY);
      } else {
        setHoveredX(null);
        setHoveredY(null);
      }
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    if (!isDraggingRef.current) {
      if (activeViewPlayerId !== myPlayerId) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const { cellWidth, offsetLeft, offsetTop } = dimensions;
      const finalCellWidth = cellWidth * zoom;

      const cellX = Math.floor((mx - offsetLeft - panX) / finalCellWidth);
      const cellY = Math.floor((my - offsetTop - panY) / finalCellWidth);

      if (cellX >= 0 && cellX < gameState.width && cellY >= 0 && cellY < gameState.height) {
        onCellAction(mobileActionMode, cellX, cellY);
        setCursorX(cellX);
        setCursorY(cellY);
      }
    }
    isDraggingRef.current = false;
  };

  const handleMouseLeave = () => {
    setHoveredX(null);
    setHoveredY(null);
  };

  // Touch handlers for mobile pan & zoom
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1) {
      isDraggingRef.current = false;
      dragStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      panStartRef.current = { x: panX, y: panY };
    } else if (e.touches.length === 2) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      touchStartDistRef.current = dist;
      touchStartZoomRef.current = zoom;
      
      panStartRef.current = { x: panX, y: panY };
      const canvas = canvasRef.current;
      if (canvas) {
        dragStartRef.current = {
          x: (t1.clientX + t2.clientX) / 2,
          y: (t1.clientY + t2.clientY) / 2
        };
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1) {
      const dx = e.touches[0].clientX - dragStartRef.current.x;
      const dy = e.touches[0].clientY - dragStartRef.current.y;
      if (Math.hypot(dx, dy) > 5) {
        isDraggingRef.current = true;
        updatePan(panStartRef.current.x + dx, panStartRef.current.y + dy, zoom);
      }
    } else if (e.touches.length === 2 && touchStartDistRef.current !== null) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      
      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const mx = (t1.clientX + t2.clientX) / 2 - rect.left;
        const my = (t1.clientY + t2.clientY) / 2 - rect.top;
        
        const scale = dist / touchStartDistRef.current;
        const newZoom = Math.max(0.5, Math.min(4.0, touchStartZoomRef.current * scale));
        
        const midX = (t1.clientX + t2.clientX) / 2;
        const midY = (t1.clientY + t2.clientY) / 2;
        const dx = midX - dragStartRef.current.x;
        const dy = midY - dragStartRef.current.y;
        
        const ratio = newZoom / zoom;
        const newPanX = (panStartRef.current.x + dx) * ratio + (mx - offsetLeft) * (1 - ratio);
        const newPanY = (panStartRef.current.y + dy) * ratio + (my - offsetTop) * (1 - ratio);
        
        setZoom(newZoom);
        updatePan(newPanX, newPanY, newZoom);
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 0) {
      if (!isDraggingRef.current) {
        if (activeViewPlayerId !== myPlayerId) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        const rect = canvas.getBoundingClientRect();
        const mx = dragStartRef.current.x - rect.left;
        const my = dragStartRef.current.y - rect.top;

        const { cellWidth, offsetLeft, offsetTop } = dimensions;
        const finalCellWidth = cellWidth * zoom;

        const cellX = Math.floor((mx - offsetLeft - panX) / finalCellWidth);
        const cellY = Math.floor((my - offsetTop - panY) / finalCellWidth);

        if (cellX >= 0 && cellX < gameState.width && cellY >= 0 && cellY < gameState.height) {
          onCellAction(mobileActionMode, cellX, cellY);
          setCursorX(cellX);
          setCursorY(cellY);
        }
      }
      isDraggingRef.current = false;
      touchStartDistRef.current = null;
    }
  };

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
      const finalCellWidth = cellWidth * zoom;

      const targetGrid = gameState.grids[activeViewPlayerId] || [];

      // Draw individual cells
      for (let y = 0; y < gameState.height; y++) {
        for (let x = 0; x < gameState.width; x++) {
          const cell = targetGrid[y] ? targetGrid[y][x] : null;
          if (!cell) continue;
          
          // Apply zoom and panning offsets
          const cx = offsetLeft + panX + x * finalCellWidth;
          const cy = offsetTop + panY + y * finalCellWidth;

          // Clip rendering to canvas bounds to optimize
          if (cx + finalCellWidth < 0 || cx > width || cy + finalCellWidth < 0 || cy > height) {
            continue;
          }

          const isHovered = hoveredX === x && hoveredY === y;
          const isCursor = cursorX === x && cursorY === y;

          ctx.save();
          ctx.translate(cx, cy);

          if (!cell.isRevealed) {
            // Unrevealed Sector Style
            ctx.fillStyle = isHovered ? '#1c1736' : '#100c24';
            ctx.fillRect(1, 1, finalCellWidth - 2, finalCellWidth - 2);

            // Neon Borders
            ctx.strokeStyle = isCursor 
              ? '#ffff00' 
              : isHovered 
                ? 'rgba(0, 255, 255, 0.7)' 
                : 'rgba(0, 255, 255, 0.25)';
            ctx.lineWidth = isCursor || isHovered ? 2 : 1;
            ctx.strokeRect(1, 1, finalCellWidth - 2, finalCellWidth - 2);

            // Draw holographic warning flag beacon
            if (cell.isFlagged) {
              // Draw flag base
              ctx.fillStyle = '#ff0055';
              ctx.shadowColor = '#ff0055';
              ctx.shadowBlur = 10;
              
              // Flag shape
              ctx.beginPath();
              ctx.moveTo(finalCellWidth * 0.35, finalCellWidth * 0.8);
              ctx.lineTo(finalCellWidth * 0.65, finalCellWidth * 0.8);
              ctx.moveTo(finalCellWidth * 0.5, finalCellWidth * 0.8);
              ctx.lineTo(finalCellWidth * 0.5, finalCellWidth * 0.25);
              ctx.lineTo(finalCellWidth * 0.25, finalCellWidth * 0.45);
              ctx.lineTo(finalCellWidth * 0.5, finalCellWidth * 0.55);
              ctx.lineWidth = Math.max(1.5, finalCellWidth * 0.08);
              ctx.strokeStyle = '#ff0055';
              ctx.stroke();

              // Beacon top dot
              ctx.fillStyle = '#ff0055';
              ctx.beginPath();
              ctx.arc(finalCellWidth * 0.5, finalCellWidth * 0.25, Math.max(1, finalCellWidth * 0.05), 0, Math.PI * 2);
              ctx.fill();
            }
          } else {
            // Revealed Sector Style
            ctx.fillStyle = '#0a0718';
            ctx.fillRect(1, 1, finalCellWidth - 2, finalCellWidth - 2);

            ctx.strokeStyle = 'rgba(0, 255, 255, 0.08)';
            ctx.lineWidth = 1;
            ctx.strokeRect(1, 1, finalCellWidth - 2, finalCellWidth - 2);

            if (cell.isMine) {
              // Mine display (cyber-hazard)
              ctx.fillStyle = '#ff0055';
              ctx.shadowColor = '#ff0055';
              ctx.shadowBlur = 12;

              ctx.beginPath();
              ctx.arc(finalCellWidth * 0.5, finalCellWidth * 0.5, Math.max(0, finalCellWidth * 0.25), 0, Math.PI * 2);
              ctx.fill();

              // Draw cross lines for spikes
              ctx.strokeStyle = '#ff0055';
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.moveTo(finalCellWidth * 0.15, finalCellWidth * 0.5);
              ctx.lineTo(finalCellWidth * 0.85, finalCellWidth * 0.5);
              ctx.moveTo(finalCellWidth * 0.5, finalCellWidth * 0.15);
              ctx.lineTo(finalCellWidth * 0.5, finalCellWidth * 0.85);
              ctx.stroke();
            } else if (cell.neighborMines > 0) {
              // Draw text indicator
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.font = `bold ${Math.floor(finalCellWidth * 0.45)}px 'Share Tech Mono', monospace`;
              
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
              ctx.fillText(cell.neighborMines.toString(), finalCellWidth / 2, finalCellWidth / 2);
            }
          }
          ctx.restore();
        }
      }

      // Draw Cursor target highlight in setup / play modes
      if (gameState.status === 'playing') {
        const curX = offsetLeft + panX + cursorX * finalCellWidth;
        const curY = offsetTop + panY + cursorY * finalCellWidth;
        ctx.strokeStyle = 'rgba(255, 255, 0, 0.45)';
        ctx.lineWidth = 2;
        ctx.strokeRect(curX - 2, curY - 2, finalCellWidth + 4, finalCellWidth + 4);
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
  }, [gameState, cursorX, cursorY, hoveredX, hoveredY, dimensions, myPlayerId, activeViewPlayerId, zoom, panX, panY]);

  return (
    <div ref={containerRef} className="canvas-container" style={{ width: '100%', height: '100%', minHeight: 0, flex: 1, position: 'relative' }}>
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onWheel={handleWheel}
        onContextMenu={(e) => {
          e.preventDefault();
          if (activeViewPlayerId === myPlayerId) {
            const rect = e.currentTarget.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;

            const { cellWidth, offsetLeft, offsetTop } = dimensions;
            const finalCellWidth = cellWidth * zoom;

            const cellX = Math.floor((mx - offsetLeft - panX) / finalCellWidth);
            const cellY = Math.floor((my - offsetTop - panY) / finalCellWidth);

            if (cellX >= 0 && cellX < gameState.width && cellY >= 0 && cellY < gameState.height) {
              onCellAction('flag', cellX, cellY);
              setCursorX(cellX);
              setCursorY(cellY);
            }
          }
        }}
        style={{ display: 'block', background: '#05030d', borderRadius: '8px', boxShadow: 'inset 0 0 20px rgba(0,255,255,0.1)', cursor: isDraggingRef.current ? 'grabbing' : 'grab' }}
      />
      
      {/* Floating Control overlay for Zoom / Pan / Action Mode */}
      <div className="board-controls-overlay">
        {/* Mobile Action Mode Switcher */}
        <div className="control-group action-toggle-group">
          <button
            onClick={() => setMobileActionMode('reveal')}
            className={`control-btn ${mobileActionMode === 'reveal' ? 'active-reveal' : ''}`}
            title="Reveal Sector (Left Click / Tap)"
          >
            <span className="btn-icon">⛏️</span>
            <span className="btn-label">REVEAL</span>
          </button>
          <button
            onClick={() => setMobileActionMode('flag')}
            className={`control-btn ${mobileActionMode === 'flag' ? 'active-flag' : ''}`}
            title="Flag Hazard (Right Click / Tap)"
          >
            <span className="btn-icon">🚩</span>
            <span className="btn-label">FLAG</span>
          </button>
        </div>

        {/* Zoom Controls */}
        <div className="control-group zoom-controls-group">
          <button onClick={() => handleZoomBtn(1.2)} className="control-btn" title="Zoom In">
            <span>＋</span>
          </button>
          <button onClick={() => handleZoomBtn(1 / 1.2)} className="control-btn" title="Zoom Out">
            <span>－</span>
          </button>
          <button onClick={() => { setZoom(1.0); setPanX(0); setPanY(0); }} className="control-btn reset-btn" title="Reset View">
            <span>🔍 RESET</span>
          </button>
        </div>
      </div>
      
      {/* Keyboard Shortcuts Prompt */}
      {showHelp && (
        <div className="keyboard-shortcuts-prompt" style={{
          position: 'absolute',
          bottom: '40px',
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: '11px',
          color: 'rgba(0, 255, 255, 0.85)',
          fontFamily: "'Share Tech Mono', monospace",
          pointerEvents: 'none',
          textAlign: 'center',
          background: 'rgba(5, 3, 13, 0.95)',
          padding: '6px 14px',
          borderRadius: '4px',
          border: '1px solid rgba(0, 240, 255, 0.25)',
          boxShadow: '0 0 15px rgba(0, 240, 255, 0.15)',
          zIndex: 99
        }}>
          [Drag] Pan | [Pinch/Scroll] Zoom | [Mouse Left] Clear | [Mouse Right] Flag | [W/A/S/D] Move | [Space] Clear
        </div>
      )}

      {/* Help toggle button */}
      <div 
        className="help-toggle-btn"
        style={{
          position: 'absolute',
          bottom: '10px',
          right: '10px',
          width: '24px',
          height: '24px',
          borderRadius: '50%',
          border: '1px solid rgba(0, 240, 255, 0.3)',
          background: 'rgba(5, 3, 13, 0.85)',
          color: 'var(--accent-cyan)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: "'Share Tech Mono', monospace",
          fontSize: '13px',
          fontWeight: 'bold',
          cursor: 'pointer',
          zIndex: 100,
          pointerEvents: 'auto',
          userSelect: 'none',
          boxShadow: '0 0 8px rgba(0, 240, 255, 0.1)',
          transition: 'all 0.2s ease'
        }}
        onClick={() => setShowHelp(!showHelp)}
        onMouseEnter={() => setShowHelp(true)}
        onMouseLeave={() => setShowHelp(false)}
        title="Show Controls Help"
      >
        ?
      </div>
    </div>
  );
};
