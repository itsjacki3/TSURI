import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Chart,
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
} from 'chart.js';
import Layout from '../components/Layout';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../hooks/useSettings';

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip);

const REPORT_STATUS_LABEL = { pending: 'Under Review', flagged: 'Escalated', confirmed: 'Resolved' };
const RANGES = ['This Week', 'This Month', 'This Year', 'All Time'];

export default function Dashboard() {
  const { user } = useAuth();
  const settings = useSettings();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const [range, setRange] = useState('This Week');

  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    supabase
      .rpc('dashboard_stats')
      .then(({ data, error }) => {
        if (!mounted) return;
        if (error) {
          setError('Database error: ' + error.message);
          return;
        }
        setStats(data);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!stats || !canvasRef.current) return;
    const r = stats.revenue?.[range];
    if (!r) return;

    if (chartRef.current) {
      chartRef.current.data.labels = r.labels;
      chartRef.current.data.datasets[0].data = r.room;
      chartRef.current.data.datasets[1].data = r.service;
      chartRef.current.update();
      return;
    }

    chartRef.current = new Chart(canvasRef.current, {
      type: 'bar',
      data: {
        labels: r.labels,
        datasets: [
          { label: 'Room Revenue', data: r.room, backgroundColor: '#c8974e', borderRadius: 6, maxBarThickness: 34 },
          { label: 'Service & Amenities', data: r.service, backgroundColor: '#4f6f9c', borderRadius: 6, maxBarThickness: 34 },
        ],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false }, tooltip: { backgroundColor: '#16283f', padding: 10, cornerRadius: 8 } },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#8a8677', font: { size: 11 } } },
          y: { grid: { color: '#eeeae0' }, ticks: { color: '#8a8677', font: { size: 11 }, callback: (v) => 'KES ' + v } },
        },
      },
    });

    return () => {
      // Chart is destroyed on full unmount below; nothing to do per-range.
    };
  }, [stats, range]);

  useEffect(() => {
    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, []);

  const firstName = (user?.name || 'there').split(' ')[0];
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <Layout title="Dashboard">
      {error && (
        <div className="badge flagged" style={{ display: 'block', textAlign: 'center', marginBottom: 14, padding: 10 }}>
          {error}
        </div>
      )}

      <div className="welcome-plaque">
        <div>
          <h1>Welcome back, {firstName}</h1>
          <p>{settings.hotel_name} &middot; {today}</p>
        </div>
        <div className="plaque-stripe">
          <div>OCCUPANCY<span>{stats ? Math.round(stats.occupancy_pct) : 0}%</span></div>
          <div>ADR<span>KES {stats ? Math.round(stats.adr) : 0}</span></div>
          <div>RevPAR<span>KES {stats ? Math.round(stats.revpar) : 0}</span></div>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <div>
            <div className="section-title">Revenue</div>
            <div className="legend-dots">
              <span><i className="dot" style={{ background: '#c8974e' }}></i>Room Revenue</span>
              <span><i className="dot" style={{ background: '#4f6f9c' }}></i>Service &amp; Amenities</span>
            </div>
          </div>
          <select className="range" value={range} onChange={(e) => setRange(e.target.value)}>
            {RANGES.map((r) => <option key={r}>{r}</option>)}
          </select>
        </div>
        <canvas ref={canvasRef} height="90"></canvas>
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <div className="section-title">Recent Bookings</div>
          <Link className="view-all" to="/bookings">View All</Link>
        </div>
        <hr className="rule" />
        <table>
          <thead>
            <tr><th>Room</th><th>Guest</th><th>Rate</th><th>Room Type</th><th>Nights</th><th>Check-in</th><th style={{ textAlign: 'center' }}>Action</th></tr>
          </thead>
          <tbody>
            {(stats?.recent_bookings || []).map((b) => (
              <tr key={b.id}>
                <td><div className="cell-room"><div className="thumb"></div>Room {b.room_number} &middot; {b.floor_location}</div></td>
                <td><div className="guest"><div className="av">{(b.guest_name || '?').charAt(0)}</div>{b.guest_name}</div></td>
                <td>KES {Number(b.room_total).toFixed(2)}</td>
                <td>{b.room_type}</td>
                <td>{b.nights}</td>
                <td>{new Date(b.check_in).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}</td>
                <td><div className="row-actions"><Link className="ra-btn" to={`/bookings?edit=KES {b.id}`}>&#9998;</Link></div></td>
              </tr>
            ))}
            {stats && (stats.recent_bookings || []).length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--muted)', padding: 24 }}>No bookings yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="panel">
        <div className="card-head">
          <div className="section-title">Recent Incident Reports</div>
          <Link className="view-all" to="/reports">View All</Link>
        </div>
        <hr className="rule" />
        <table>
          <thead>
            <tr><th>Room</th><th>Reported By</th><th>Issue</th><th>Status</th><th style={{ textAlign: 'center' }}>Action</th></tr>
          </thead>
          <tbody>
            {(stats?.recent_reports || []).map((r) => (
              <tr key={r.id}>
                <td><div className="cell-room"><div className="thumb"></div>Room {r.room_number}</div></td>
                <td><div className="guest"><div className="av">{(r.guest_name || '-').charAt(0)}</div>{r.guest_name || 'Unknown'}</div></td>
                <td>{r.issue}</td>
                <td><span className={`badge KES {r.status}`}>{REPORT_STATUS_LABEL[r.status] || r.status}</span></td>
                <td><div className="row-actions"><Link className="ra-btn" to={`/reports?edit=KES {r.id}`}>&#9998;</Link></div></td>
              </tr>
            ))}
            {stats && (stats.recent_reports || []).length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted)', padding: 24 }}>No incident reports yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}
