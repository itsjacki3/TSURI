import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../hooks/useSettings';

export default function Login() {
  const { user, login } = useAuth();
  const settings = useSettings();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = `Sign In · KES {settings.hotel_name} Hotel Manager`;
  }, [settings.hotel_name]);

  if (user) return <Navigate to="/dashboard" replace />;

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    if (!email || !password) {
      setError('Enter both an email and a password.');
      return;
    }
    setBusy(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Invalid email address or password.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="brand">
          <div className="brand-mark">{(settings.hotel_name || 'T').charAt(0).toUpperCase()}</div>
          <div>
            <div className="brand-name">{settings.hotel_name}</div>
            <div className="brand-sub">Hotel Manager</div>
          </div>
        </div>
        <h2>Staff Sign In</h2>
        <p className="sub">Front desk &amp; management access only</p>

        {error && <div className="field-error">{error}</div>}

        <form onSubmit={onSubmit}>
          <div className="form-group">
            <label htmlFor="email">Work Email</label>
            <input
              className="form-input"
              type="email"
              id="email"
              placeholder="you@tsurigardens.example"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              className="form-input"
              type="password"
              id="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Signing In…' : 'Sign In'}
          </button>
        </form>
        <div className="auth-foot">Forgot your password? Contact your property administrator.</div>
      </div>
    </div>
  );
}
