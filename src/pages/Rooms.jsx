import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import Modal from '../components/Modal';
import { supabase } from '../lib/supabaseClient';
import { useSettings } from '../hooks/useSettings';

const STATUS_LABEL = {
  available: 'Available',
  occupied: 'Occupied',
  reserved: 'Reserved',
  maintenance: 'Housekeeping',
  outoforder: 'Out of Order',
};

const EMPTY_FORM = { id: null, room_number: '', room_type_id: '', floor_location: '', nightly_rate: '', status: 'available' };

export default function Rooms() {
  const settings = useSettings();
  const [rooms, setRooms] = useState([]);
  const [roomTypes, setRoomTypes] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const [{ data: typesData, error: typesErr }, { data: roomsData, error: roomsErr }] = await Promise.all([
      supabase.from('room_types').select('id, name').order('name'),
      supabase
        .from('rooms')
        .select('id, room_number, room_type_id, floor_location, nightly_rate, status, room_types(name)')
        .order('room_number'),
    ]);
    if (typesErr || roomsErr) {
      setError('Database error: ' + (typesErr?.message || roomsErr?.message));
    } else {
      setError(null);
      setRoomTypes(typesData || []);
      setRooms((roomsData || []).map((r) => ({ ...r, type_name: r.room_types?.name })));
      if (!form.room_type_id && typesData?.length) {
        setForm((f) => ({ ...f, room_type_id: typesData[0].id }));
      }
    }
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  function openCreate() {
    setForm({ ...EMPTY_FORM, room_type_id: roomTypes[0]?.id || '' });
    setModalOpen(true);
  }

  function openEdit(r) {
    setForm({
      id: r.id,
      room_number: r.room_number,
      room_type_id: r.room_type_id,
      floor_location: r.floor_location || '',
      nightly_rate: r.nightly_rate,
      status: r.status,
    });
    setModalOpen(true);
  }

  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      room_number: form.room_number.trim(),
      room_type_id: Number(form.room_type_id),
      floor_location: form.floor_location.trim(),
      nightly_rate: Number(form.nightly_rate),
      status: form.status,
    };
    const { error: saveErr } = form.id
      ? await supabase.from('rooms').update(payload).eq('id', form.id)
      : await supabase.from('rooms').insert(payload);
    setSaving(false);
    if (saveErr) {
      setError('Database error: ' + saveErr.message);
      return;
    }
    setModalOpen(false);
    load();
  }

  async function onDelete(r) {
    if (!confirm(`Remove Room KES {r.room_number}? This cannot be undone.`)) return;
    const { error: delErr } = await supabase.from('rooms').delete().eq('id', r.id);
    if (delErr) {
      setError('Database error: ' + delErr.message);
      return;
    }
    load();
  }

  const visibleRooms = statusFilter ? rooms.filter((r) => r.status === statusFilter) : rooms;

  return (
    <Layout title="Room Management">
      <div className="page-header">
        <div>
          <div className="breadcrumb">Operations &rsaquo; <span>Room Management</span></div>
          <h1>Rooms</h1>
          <p>All rooms across {settings.hotel_name}, their type, nightly rate and current status.</p>
        </div>
        <button className="btn btn-gold" type="button" onClick={openCreate}>+ Add Room</button>
      </div>

      {error && <div className="badge flagged" style={{ display: 'block', textAlign: 'center', marginBottom: 14, padding: 10 }}>{error}</div>}

      <div className="panel">
        <div className="card-head">
          <div className="section-title">All Rooms ({rooms.length})</div>
          <select className="range" style={{ width: 'auto' }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All Statuses</option>
            <option value="available">Available</option>
            <option value="occupied">Occupied</option>
            <option value="reserved">Reserved</option>
            <option value="maintenance">Housekeeping</option>
            <option value="outoforder">Out of Order</option>
          </select>
        </div>
        <hr className="rule" />
        <table>
          <thead><tr><th>Room</th><th>Type</th><th>Rate / Night</th><th>Location</th><th>Status</th><th style={{ textAlign: 'center' }}>Action</th></tr></thead>
          <tbody>
            {visibleRooms.map((r) => (
              <tr key={r.id}>
                <td><div className="cell-room"><div className="thumb"></div>Room {r.room_number}</div></td>
                <td>{r.type_name}</td>
                <td>KES {Number(r.nightly_rate).toFixed(2)}</td>
                <td>{r.floor_location}</td>
                <td><span className={`badge KES {r.status}`}>{STATUS_LABEL[r.status] || r.status}</span></td>
                <td>
                  <div className="row-actions">
                    <button type="button" className="ra-btn" onClick={() => openEdit(r)}>&#9998;</button>
                    <button type="button" className="ra-btn" onClick={() => onDelete(r)}>&#128465;</button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && rooms.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: 24 }}>No rooms yet — add your first one above.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} title={form.id ? 'Edit Room' : 'Add a Room'} onClose={() => setModalOpen(false)}>
        <form onSubmit={onSubmit}>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="room_number">Room Number</label>
              <input className="form-input" type="text" id="room_number" value={form.room_number}
                onChange={(e) => setForm({ ...form, room_number: e.target.value })} required />
            </div>
            <div className="form-group">
              <label htmlFor="room_type_id">Room Type</label>
              <select className="form-select" id="room_type_id" value={form.room_type_id}
                onChange={(e) => setForm({ ...form, room_type_id: e.target.value })} required>
                {roomTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="nightly_rate">Nightly Rate (KES )</label>
              <input className="form-input" type="number" step="0.01" id="nightly_rate" value={form.nightly_rate}
                onChange={(e) => setForm({ ...form, nightly_rate: e.target.value })} required />
            </div>
            <div className="form-group">
              <label htmlFor="status">Status</label>
              <select className="form-select" id="status" value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="available">Available</option>
                <option value="occupied">Occupied</option>
                <option value="reserved">Reserved</option>
                <option value="maintenance">Housekeeping</option>
                <option value="outoforder">Out of Order</option>
              </select>
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="floor_location">Location</label>
              <input className="form-input" type="text" id="floor_location" placeholder="e.g. 2nd Floor, Garden Wing"
                value={form.floor_location} onChange={(e) => setForm({ ...form, floor_location: e.target.value })} />
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save Room'}</button>
          </div>
        </form>
      </Modal>
    </Layout>
  );
}
