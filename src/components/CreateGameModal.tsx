import React from 'react';
import { X } from 'lucide-react';

interface CreateGameModalProps {
  onClose: () => void;
  onCreateGame: (e: React.FormEvent) => void;
  createGameName: string;
  setCreateGameName: (name: string) => void;
  maxPlayers: number;
  setMaxPlayers: (players: number) => void;
  boardWidth: number;
  setBoardWidth: (width: number) => void;
  boardHeight: number;
  setBoardHeight: (height: number) => void;
  mineCount: number;
  setMineCount: (count: number) => void;
}

export const CreateGameModal: React.FC<CreateGameModalProps> = ({
  onClose,
  onCreateGame,
  createGameName,
  setCreateGameName,
  maxPlayers,
  setMaxPlayers,
  boardWidth,
  setBoardWidth,
  boardHeight,
  setBoardHeight,
  mineCount,
  setMineCount
}) => {
  return (
    <div className="modal-overlay">
      <div className="glass-panel modal-card" style={{ maxWidth: '400px', width: '90%' }}>
        <div className="modal-header">
          <h3 className="modal-title">INITIALIZE SWEEP FIELD</h3>
          <button type="button" onClick={onClose} className="modal-close-btn"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={onCreateGame} className="modal-form" style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
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
  );
};
