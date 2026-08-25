import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Topbar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get('q') || '');

  const initial = (user?.name || 'G').charAt(0).toUpperCase();

  function onSearch(e) {
    e.preventDefault();
    navigate(`/search?q=${encodeURIComponent(q.trim())}`);
  }

  return (
    <div className="topbar">
      <form className="topbar-search" onSubmit={onSearch} role="search">
        <button type="submit" className="topbar-search-btn" aria-label="Search">&#128269;</button>
        <input
          type="text"
          className="topbar-search-input"
          placeholder="Search rooms, bookings, guests…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoComplete="off"
        />
      </form>
      <div className="topbar-right">
        <div className="icon-btn">&#128276;<span className="dot"></span></div>
        <div className="icon-btn">&#9993;</div>
        <div className="profile">
          <div className="avatar">{initial}</div>
          <div>
            <div className="profile-name">{user?.name || 'Guest'}</div>
            <div className="profile-role">{user?.role || ''}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
