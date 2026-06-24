export function isOnlineMode(): boolean {
  return localStorage.getItem('retrosweeper_play_online') !== 'false';
}

export async function apiFetch(url: string, options: RequestInit = {}) {
  const getCookie = (name: string): string | null => {
    if (typeof document === 'undefined') return null;
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
    return null;
  };

  const cookieToken = getCookie('csrf_token') || '';
  const csrfToken = cookieToken || localStorage.getItem('retrosweeper_csrf_token') || '';
  const sessionId = localStorage.getItem('retrosweeper_session_id') || '';

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrfToken,
    ...(!isOnlineMode() ? { 'X-Guest-Name': 'apprentice@local' } : {}),
    ...(options.headers as Record<string, string>)
  };

  if (sessionId) {
    headers['X-Session-ID'] = sessionId;
  }

  // Detect local backend or standard relative endpoints
  const isPackaged = typeof window !== 'undefined' && 
                     (window.location.protocol === 'file:' || 
                      window.location.hostname === '' ||
                      navigator.userAgent.toLowerCase().includes('electron'));
  
  const origin = isPackaged ? 'http://localhost:28006' : '';
  const finalUrl = url.startsWith('/') ? `${origin}${url}` : url;

  return fetch(finalUrl, {
    credentials: 'include',
    ...options,
    headers
  });
}
