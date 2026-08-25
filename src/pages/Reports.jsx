import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import Modal from '../components/Modal';
import { supabase } from '../lib/supabaseClient';

const STATUS_LABEL = { pending: 'Under Review', flagged: 'Escalated', confirmed: 'Resolved' };

export default function Reports() {
  const [params, setParams] = useSearchParams();
  const [reports, setReports] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ id: null, issue: '', status: 'pending' });
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error: err } = await supabase
      .from('incident_reports')
      .select('id, issue, status, created_at, rooms(room_number), guests(full_name)')
      .order('created_at', { ascending: false });
    if (err) {
      setError('Database error: ' + err.message);
    } else {
      setError(null);
      setReports((data || []).map((r) => ({ ...r, room_number: r.rooms?.room_number, guest_name: r.guests?.full_name })));
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const editId = params.get('edit');
    if (editId && reports.length) {
      const r = reports.find((x) => String(x.id) === editId);
      if (r) openEdit(r);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reports]);

  function openEdit(r) {
    setForm({ id: r.id, issue: r.issue, status: r.status });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    if (params.get('edit')) {
      params.delete('edit');
      setParams(params, { replace: true });
    }
  }

  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true);
    const resolvedAt = form.status === 'confirmed' ? new Date().toISOString() : null;
    const { error: saveErr } = await supabase
      .from('incident_reports')
      .update({ issue: form.issue.trim(), status: form.status, resolved_at: resolvedAt })
      .eq('id', form.id);
    setSaving(false);
    if (saveErr) {
      setError('Database error: ' + saveErr.message);
      return;
    }
    closeModal();
    load();
  }

  async function onDelete(r) {
    if (!confirm('Delete this incident report?')) return;
    const { error: delErr } = await supabase.from('incident_reports').delete().eq('id', r.id);
    if (delErr) {
      setError('Database error: ' + delErr.message);
      return;
    }
    load();
  }

  const visible = statusFilter ? reports.filter((r) => r.status === statusFilter) : reports;

  return (
    <Layout title="Incident Reports">
      <div className="page-header">
        <div>
          <div className="breadcrumb">System &rsaquo; <span>Incident Reports</span></div>
          <h1>Incident Reports</h1>
          <p>Guest-reported issues, maintenance flags and how they were resolved.</p>
        </div>
      </div>

      {error && <div className="badge flagged" style={{ display: 'block', textAlign: 'center', marginBottom: 14, padding: 10 }}>{error}</div>}

      <div className="panel">
        <div className="card-head">
          <div className="section-title">All Reports</div>
          <select className="range" style={{ width: 'auto' }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All Statuses</option>
            <option value="pending">Under Review</option>
            <option value="flagged">Escalated</option>
            <option value="confirmed">Resolved</option>
          </select>
        </div>
        <hr className="rule" />
        <table>
          <thead><tr><th>Room</th><th>Reported By</th><th>Issue</th><th>Date</th><th>Status</th><th style={{ textAlign: 'center' }}>Action</th></tr></thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.id}>
                <td><div className="cell-room"><div className="thumb"></div>Room {r.room_number}</div></td>
                <td><div className="guest"><div className="av">{(r.guest_name || '-').charAt(0)}</div>{r.guest_name || 'Unknown'}</div></td>
                <td>{r.issue}</td>
                <td>{new Date(r.created_at).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                <td><span className={`badge KES {r.status}`}>{STATUS_LABEL[r.status] || r.status}</span></td>
                <td>
                  <div className="row-actions">
                    <button type="button" className="ra-btn" onClick={() => openEdit(r)}>&#9998;</button>
                    <button type="button" className="ra-btn" onClick={() => onDelete(r)}>&#128465;</button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && reports.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: 24 }}>No incident reports yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Reports are only ever created by guests, so there is no Add form here — same as the original app. */}
      <Modal open={modalOpen} title="Edit Incident Report" onClose={closeModal}>
        <form onSubmit={onSubmit}>
          <div className="form-group">
            <label htmlFor="issue">Issue</label>
            <textarea className="form-input" id="issue" rows={3} value={form.issue} onChange={(e) => setForm({ ...form, issue: e.target.value })} required />
          </div>
          <div className="form-group">
            <label htmlFor="status">Status</label>
            <select className="form-select" id="status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="pending">Under Review</option>
              <option value="flagged">Escalated</option>
              <option value="confirmed">Resolved</option>
            </select>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={closeModal}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</button>
          </div>
        </form>
      </Modal>
    </Layout>
  );
}
