import { NavLink } from 'react-router-dom';
import { useSettings } from '../hooks/useSettings';
import { useAuth } from '../context/AuthContext';

const navClass = ({ isActive }) => 'nav-item' + (isActive ? ' active' : '');

export default function Sidebar() {
  const settings = useSettings();
  const { logout } = useAuth();
  const hotelName = settings.hotel_name;

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">{(hotelName || 'T').charAt(0).toUpperCase()}</div>
        <div>
          <div className="brand-name">{hotelName}</div>
          <div className="brand-sub">Hotel Manager</div>
        </div>
      </div>

      <NavLink to="/dashboard" className={navClass}>
        <span className="ic">&#8962;</span> Dashboard
      </NavLink>

      <div className="nav-section-label">Operations</div>
      <NavLink to="/rooms" className={navClass}>
        <span className="ic">&#128273;</span> Room Management
      </NavLink>
      <NavLink to="/bookings" className={navClass}>
        <span className="ic">&#128197;</span> Reservations
      </NavLink>

      <div className="nav-section-label">Revenue</div>
      <NavLink to="/billing" className={navClass}>
        <span className="ic">&#128179;</span> Billing &amp; Invoices
      </NavLink>

      <div className="nav-section-label">People</div>
      <NavLink to="/guests" className={navClass}>
        <span className="ic">&#128100;</span> Guests
      </NavLink>
      <NavLink to="/staff" className={navClass}>
        <span className="ic">&#128101;</span> Staff &amp; Roles
      </NavLink>

      <div className="nav-section-label">System</div>
      <NavLink to="/reports" className={navClass}>
        <span className="ic">&#128681;</span> Incident Reports
      </NavLink>
      <NavLink to="/settings" className={navClass}>
        <span className="ic">&#9881;</span> Settings
      </NavLink>

      <a className="nav-item" href="#" onClick={(e) => { e.preventDefault(); logout(); }}>
        <span className="ic">&#8618;</span> Log Out
      </a>
    </aside>
  );
}
