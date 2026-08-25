import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import Modal from '../components/Modal';
import { supabase } from '../lib/supabaseClient';
import { useSettings } from '../hooks/useSettings';

const STATUS_LABEL = { vip: 'VIP', returning: 'Returning', new: 'New Guest' };
const STATUS_CLASS = { vip: 'occupied', returning: 'available', new: 'checkedout' };

const EMPTY_FORM = { id: null, full_name: '', email: '', phone: '', id_number: '', guest_type: 'new' };

export default function Guests() {
  const settings = useSettings();
  const [guests, setGuests] = useState([]);
  const [q, setQ] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  async function load(search = '') {
    setLoading(true);
    let query = supabase
      .from('guests')
      .select('id, full_name, email, phone, id_number, guest_type, created_at, bookings(nights)')
      .order('full_name');
    if (search) {
      query = query.or(`full_name.ilike.%KES {search}%,email.ilike.%KES {search}%,phone.ilike.%KES {search}%`);
    }
    const { data, error: err } = await query;
    if (err) {
      setError('Database error: ' + err.message);
    } else {
      setError(null);
      setGuests((data || []).map((g) => ({
        ...g,
        stays: g.bookings?.length || 0,
        nights_sum: (g.bookings || []).reduce((sum, b) => sum + (b.nights || 0), 0),
      })));
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function onSearchSubmit(e) {
    e.preventDefault();
    load(q.trim());
  }

  function onClearSearch() {
    setQ('');
    load('');
  }

  function openCreate() {
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(g) {
    setForm({ id: g.id, full_name: g.full_name, email: g.email, phone: g.phone || '', id_number: g.id_number || '', guest_type: g.guest_type });
    setModalOpen(true);
  }

  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      full_name: form.full_name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      id_number: form.id_number.trim(),
      guest_type: form.guest_type,
    };
    const { error: saveErr } = form.id
      ? await supabase.from('guests').update(payload).eq('id', form.id)
      : await supabase.from('guests').insert(payload);
    setSaving(false);
    if (saveErr) {
      setError('Database error: ' + saveErr.message);
      return;
    }
    setModalOpen(false);
    load(q);
  }

  async function onDelete(g) {
    if (!confirm(`Delete guest KES {g.full_name}? Their bookings will be removed too.`)) return;
    const { error: delErr } = await supabase.from('guests').delete().eq('id', g.id);
    if (delErr) {
      setError('Database error: ' + delErr.message);
      return;
    }
    load(q);
  }

  const totalGuests = guests.length;
  const vipGuests = guests.filter((g) => g.guest_type === 'vip').length;
  const returningGuests = guests.filter((g) => g.guest_type === 'returning').length;
  const now = new Date();
  const newThisMonth = guests.filter((g) => {
    const c = new Date(g.created_at);
    return c.getMonth() === now.getMonth() && c.getFullYear() === now.getFullYear();
  }).length;

  return (
    <Layout title="Guests">
      <div className="page-header">
        <div>
          <div className="breadcrumb">People &rsaquo; <span>Guests</span></div>
          <h1>Guests</h1>
          <p>Everyone who has stayed at or booked with {settings.hotel_name}.</p>
        </div>
        <button className="btn btn-gold" type="button" onClick={openCreate}>+ Add Guest</button>
      </div>

      {error && <div className="badge flagged" style={{ display: 'block', textAlign: 'center', marginBottom: 14, padding: 10 }}>{error}</div>}

      <div className="stat-row cols-4">
        <div className="stat-card"><div className="stat-icon">&#128100;</div><div><div className="stat-label">Total Guests</div><div className="stat-value">{totalGuests}</div></div></div>
        <div className="stat-card c2"><div className="stat-icon">&#127775;</div><div><div className="stat-label">VIP Guests</div><div className="stat-value">{vipGuests}</div></div></div>
        <div className="stat-card c3"><div className="stat-icon">&#8635;</div><div><div className="stat-label">Returning Guests</div><div className="stat-value">{returningGuests}</div></div></div>
        <div className="stat-card c5"><div className="stat-icon">&#10024;</div><div><div className="stat-label">New This Month</div><div className="stat-value">{newThisMonth}</div></div></div>
      </div>

      <div className="panel">
        <div className="card-head">
          <div className="section-title">All Guests</div>
          <form onSubmit={onSearchSubmit} style={{ display: 'flex', gap: 8 }}>
            <input className="form-input" style={{ width: 240 }} type="text" placeholder="Search guests…" value={q} onChange={(e) => setQ(e.target.value)} />
            <button type="submit" className="btn btn-outline">Search</button>
            {q !== '' && <button type="button" className="btn btn-outline" onClick={onClearSearch}>Clear</button>}
          </form>
        </div>
        <hr className="rule" />
        <table>
          <thead><tr><th style={{ textAlign: 'center' }}>Profile</th><th>Name</th><th>Email</th><th>Phone</th><th style={{ textAlign: 'center' }}>Stays</th><th style={{ textAlign: 'center' }}>Nights</th><th>Status</th><th style={{ textAlign: 'center' }}>Action</th></tr></thead>
          <tbody>
            {guests.map((g) => (
              <tr key={g.id}>
                <td style={{ textAlign: 'center' }}><div className="av" style={{ margin: '0 auto' }}>{g.full_name.charAt(0)}</div></td>
                <td>{g.full_name}</td>
                <td>{g.email}</td>
                <td>{g.phone}</td>
                <td style={{ textAlign: 'center' }}>{g.stays}</td>
                <td style={{ textAlign: 'center' }}>{g.nights_sum}</td>
                <td><span className={`badge KES {STATUS_CLASS[g.guest_type] || ''}`}>{STATUS_LABEL[g.guest_type] || g.guest_type}</span></td>
                <td>
                  <div className="row-actions">
                    <button type="button" className="ra-btn" onClick={() => openEdit(g)}>&#9998;</button>
                    <button type="button" className="ra-btn" onClick={() => onDelete(g)}>&#128465;</button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && guests.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--muted)', padding: 24 }}>No guests found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} title={form.id ? 'Edit Guest' : 'Add Guest'} onClose={() => setModalOpen(false)}>
        <form onSubmit={onSubmit}>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="full_name">Full Name</label>
              <input className="form-input" type="text" id="full_name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
            </div>
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input className="form-input" type="email" id="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </div>
            <div className="form-group">
              <label htmlFor="phone">Phone</label>
              <input className="form-input" type="text" id="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="form-group">
              <label htmlFor="id_number">ID Number</label>
              <input className="form-input" type="text" id="id_number" value={form.id_number} onChange={(e) => setForm({ ...form, id_number: e.target.value })} />
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="guest_type">Guest Type</label>
              <select className="form-select" id="guest_type" value={form.guest_type} onChange={(e) => setForm({ ...form, guest_type: e.target.value })}>
                <option value="new">New</option>
                <option value="returning">Returning</option>
                <option value="vip">VIP</option>
              </select>
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save Guest'}</button>
          </div>
        </form>
      </Modal>
    </Layout>
  );
}
