import React from 'react';

interface AuthPollingScreenProps {
  onCancel: () => void;
}

export const AuthPollingScreen: React.FC<AuthPollingScreenProps> = ({ onCancel }) => {
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
          onClick={onCancel}
          className="btn-sci-fi btn-danger auth-btn-login"
        >
          Cancel Authentication Request
        </button>
      </div>
    </div>
  );
};
