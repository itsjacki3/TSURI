import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import Modal from '../components/Modal';
import { supabase } from '../lib/supabaseClient';

const STATUS_CLASS = { active: 'available', 'on leave': 'maintenance', suspended: 'flagged' };

const EMPTY_FORM = { id: null, full_name: '', email: '', phone: '', department: '', role_id: '', status: 'active', password: '' };

export default function Staff() {
  const [staff, setStaff] = useState([]);
  const [rolesList, setRolesList] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const [{ data: rolesData }, { data: staffData, error: staffErr }] = await Promise.all([
      supabase.from('roles').select('id, name, description').order('name'),
      // staff_list() is a SECURITY DEFINER RPC that never returns password_hash
      // (see supabase/migration_react_client.sql) — the anon key has no direct
      // SELECT grant on the staff table itself.
      supabase.rpc('staff_list'),
    ]);
    if (staffErr) {
      setError('Database error: ' + staffErr.message);
    } else {
      setError(null);
      setRolesList(rolesData || []);
      setStaff(staffData || []);
      if (!form.role_id && rolesData?.length) setForm((f) => ({ ...f, role_id: rolesData[0].id }));
    }
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  function openCreate() {
    setForm({ ...EMPTY_FORM, role_id: rolesList[0]?.id || '' });
    setModalOpen(true);
  }

  function openEdit(s) {
    setForm({
      id: s.id,
      full_name: s.full_name,
      email: s.email,
      phone: s.phone || '',
      department: s.department || '',
      role_id: s.role_id,
      status: s.status,
      password: '',
    });
    setModalOpen(true);
  }

  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true);
    let rpcErr;
    if (form.id) {
      ({ error: rpcErr } = await supabase.rpc('staff_update', {
        p_id: form.id,
        p_role_id: Number(form.role_id),
        p_full_name: form.full_name.trim(),
        p_email: form.email.trim(),
        p_phone: form.phone.trim(),
        p_department: form.department.trim(),
        p_status: form.status,
        p_password: form.password || null,
      }));
    } else {
      ({ error: rpcErr } = await supabase.rpc('staff_create', {
        p_role_id: Number(form.role_id),
        p_full_name: form.full_name.trim(),
        p_email: form.email.trim(),
        p_phone: form.phone.trim(),
        p_department: form.department.trim(),
        p_status: form.status,
        p_password: form.password,
      }));
    }
    setSaving(false);
    if (rpcErr) {
      setError('Database error: ' + rpcErr.message);
      return;
    }
    setModalOpen(false);
    load();
  }

  async function onDelete(s) {
    if (!confirm(`Remove KES {s.full_name} from staff?`)) return;
    const { error: delErr } = await supabase.rpc('staff_delete', { p_id: s.id });
    if (delErr) {
      setError('Database error: ' + delErr.message);
      return;
    }
    load();
  }

  return (
    <Layout title="Staff & Roles">
      <div className="page-header">
        <div>
          <div className="breadcrumb">People &rsaquo; <span>Staff &amp; Roles</span></div>
          <h1>Staff &amp; Roles</h1>
          <p>Manage the team and what each role is allowed to see and do.</p>
        </div>
        <button className="btn btn-gold" type="button" onClick={openCreate}>+ Add Staff Member</button>
      </div>

      {error && <div className="badge flagged" style={{ display: 'block', textAlign: 'center', marginBottom: 14, padding: 10 }}>{error}</div>}

      <div className="row cols-7-5">
        <div className="panel">
          <div className="card-head"><div className="section-title">Team Directory</div></div>
          <hr className="rule" />
          <table>
            <thead><tr><th style={{ textAlign: 'center' }}>Profile</th><th>Name</th><th>Role</th><th>Department</th><th>Status</th><th style={{ textAlign: 'center' }}>Action</th></tr></thead>
            <tbody>
              {staff.map((s) => {
                const statusKey = (s.status || 'active').toLowerCase();
                const badgeClass = STATUS_CLASS[statusKey] || 'available';
                return (
                  <tr key={s.id}>
                    <td style={{ textAlign: 'center' }}><div className="av" style={{ margin: '0 auto' }}>{s.full_name.charAt(0)}</div></td>
                    <td>{s.full_name}</td>
                    <td>{s.role_name || '—'}</td>
                    <td>{s.department}</td>
                    <td><span className={`badge KES {badgeClass}`}>{(s.status || '').charAt(0).toUpperCase() + (s.status || '').slice(1)}</span></td>
                    <td>
                      <div className="row-actions">
                        <button type="button" className="ra-btn" onClick={() => openEdit(s)}>&#9998;</button>
                        <button type="button" className="ra-btn" onClick={() => onDelete(s)}>&#128465;</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!loading && staff.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 20, color: 'var(--muted)' }}>No staff records found.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="panel">
          <div className="card-head"><div className="section-title">Roles &amp; Permissions</div></div>
          <hr className="rule" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {rolesList.map((r) => (
              <div key={r.id} style={{ padding: '12px 14px', border: '1px solid var(--line)', borderRadius: 10 }}>
                <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 2 }}>{r.name}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{r.description}</div>
              </div>
            ))}
            {rolesList.length === 0 && <div style={{ color: 'var(--muted)', fontSize: 13 }}>No roles defined yet.</div>}
          </div>
        </div>
      </div>

      <Modal open={modalOpen} title={form.id ? 'Edit Staff Member' : 'Add Staff Member'} onClose={() => setModalOpen(false)}>
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
              <label htmlFor="department">Department</label>
              <input className="form-input" type="text" id="department" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
            </div>
            <div className="form-group">
              <label htmlFor="role_id">Role</label>
              <select className="form-select" id="role_id" value={form.role_id} onChange={(e) => setForm({ ...form, role_id: e.target.value })} required>
                {rolesList.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="status">Status</label>
              <select className="form-select" id="status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="active">Active</option>
                <option value="on leave">On Leave</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="password">Password <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(leave blank to keep current password when editing)</span></label>
              <input className="form-input" type="password" id="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save Staff Member'}</button>
          </div>
        </form>
      </Modal>
    </Layout>
  );
}
