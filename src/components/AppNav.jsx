import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';

/**
 * Pill-style nav used on /history and /profile.
 */
export default function AppNav() {
  const { pathname } = useLocation();
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const onLogout = async () => {
    await signOut();
    navigate('/auth', { replace: true });
  };

  const linkClass = (target) => (pathname === target ? 'active' : '');

  return (
    <nav className="app-nav-bar">
      <Link to="/chat" className="app-nav-bar__logo serif">Meridian</Link>
      <div className="app-nav-bar__links">
        <Link to="/chat" className={linkClass('/chat')}>Chat</Link>
        <Link to="/profile" className={linkClass('/profile')}>Profile</Link>
        <Link to="/history" className={linkClass('/history')}>History</Link>
        <button type="button" className="btn-logout" onClick={onLogout}>Logout</button>
      </div>
    </nav>
  );
}
