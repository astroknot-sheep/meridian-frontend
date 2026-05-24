import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function ProfileDropdown() {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const btnRef = useRef(null);
  const { session, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const onClickOutside = (e) => {
      if (open && wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onEscape = (e) => {
      if (e.key === 'Escape' && open) {
        setOpen(false);
        btnRef.current?.focus();
      }
    };
    document.addEventListener('click', onClickOutside);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('click', onClickOutside);
      document.removeEventListener('keydown', onEscape);
    };
  }, [open]);

  const onLogout = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen(false);
    await signOut();
    navigate('/auth', { replace: true });
  };

  const email = session?.user?.email || '';

  return (
    <div className="profile-icon-wrapper" ref={wrapRef}>
      <button
        ref={btnRef}
        className="profile-icon-btn"
        aria-label="Profile menu"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        type="button"
      >
        <svg className="profile-icon-svg" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c0-4.418 3.582-8 8-8s8 3.582 8 8" />
        </svg>
      </button>
      <div className={`profile-dropdown ${open ? 'active' : ''}`}>
        <div className="dropdown-user-info">
          <div className="dropdown-user-label">Signed in as</div>
          <div className="dropdown-user-email">{email || 'Loading…'}</div>
        </div>
        <div className="dropdown-divider" />
        <Link to="/profile" className="dropdown-item" onClick={() => setOpen(false)}>
          <svg className="dropdown-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          Profile
        </Link>
        <Link to="/history" className="dropdown-item" onClick={() => setOpen(false)}>
          <svg className="dropdown-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          History
        </Link>
        <div className="dropdown-divider" />
        <button className="dropdown-item logout-item" onClick={onLogout} type="button">
          <svg className="dropdown-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Logout
        </button>
      </div>
    </div>
  );
}
