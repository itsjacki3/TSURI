import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import Modal from '../components/Modal';
import { supabase } from '../lib/supabaseClient';

const STATUS_CLASS = { paid: 'available', pending: 'occupied', refunded: 'checkedout' };
const METHOD_LABEL = { card: 'Card', 'mobile money': 'Mobile Money', 'bank transfer': 'Bank Transfer', cash: 'Cash' };

const todayStr = () => new Date().toISOString().slice(0, 10);
const EMPTY_FORM = { id: null, booking_id: '', amount: '', payment_method: 'card', status: 'pending', issued_date: todayStr() };

export default function Billing() {
  const [invoices, setInvoices] = useState([]);
  const [bookingsList, setBookingsList] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const [{ data: bookingsData }, { data: invoicesData, error: invErr }] = await Promise.all([
      supabase.from('bookings').select('id, booking_ref, guests(full_name)').order('created_at', { ascending: false }),
      supabase
        .from('invoices')
        .select('id, invoice_number, booking_id, amount, payment_method, status, issued_date, bookings(booking_ref, guests(full_name))')
        .order('issued_date', { ascending: false }),
    ]);
    if (invErr) {
      setError('Database error: ' + invErr.message);
    } else {
      setError(null);
      setBookingsList((bookingsData || []).map((b) => ({ id: b.id, booking_ref: b.booking_ref, guest_name: b.guests?.full_name })));
      setInvoices((invoicesData || []).map((i) => ({
        ...i,
        booking_ref: i.bookings?.booking_ref,
        guest_name: i.bookings?.guests?.full_name,
      })));
      if (!form.booking_id && bookingsData?.length) setForm((f) => ({ ...f, booking_id: bookingsData[0].id }));
    }
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  function openCreate() {
    setForm({ ...EMPTY_FORM, booking_id: bookingsList[0]?.id || '' });
    setModalOpen(true);
  }

  function openEdit(i) {
    setForm({ id: i.id, booking_id: i.booking_id, amount: i.amount, payment_method: i.payment_method, status: i.status, issued_date: i.issued_date });
    setModalOpen(true);
  }

  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true);
    const base = {
      booking_id: Number(form.booking_id),
      amount: Number(form.amount),
      payment_method: form.payment_method,
      status: form.status,
      issued_date: form.issued_date,
    };

    let saveErr;
    if (form.id) {
      const paidDate = form.status === 'paid' ? (form.issued_date || todayStr()) : null;
      ({ error: saveErr } = await supabase.from('invoices').update({ ...base, paid_date: paidDate }).eq('id', form.id));
    } else {
      const { data: inserted, error: insErr } = await supabase
        .from('invoices')
        .insert({ ...base, invoice_number: 'INV-PENDING' })
        .select('id')
        .single();
      if (!insErr && inserted) {
        const number = 'INV-' + String(3390 + inserted.id).padStart(4, '0');
        ({ error: saveErr } = await supabase.from('invoices').update({ invoice_number: number }).eq('id', inserted.id));
      } else {
        saveErr = insErr;
      }
    }

    setSaving(false);
    if (saveErr) {
      setError('Database error: ' + saveErr.message);
      return;
    }
    setModalOpen(false);
    load();
  }

  async function onDelete(i) {
    if (!confirm(`Delete invoice KES {i.invoice_number}?`)) return;
    const { error: delErr } = await supabase.from('invoices').delete().eq('id', i.id);
    if (delErr) {
      setError('Database error: ' + delErr.message);
      return;
    }
    load();
  }

  const now = new Date();
  const revenueThisMonth = invoices
    .filter((i) => i.status === 'paid' && new Date(i.issued_date).getMonth() === now.getMonth() && new Date(i.issued_date).getFullYear() === now.getFullYear())
    .reduce((sum, i) => sum + Number(i.amount), 0);
  const paidCount = invoices.filter((i) => i.status === 'paid').length;
  const pendingCount = invoices.filter((i) => i.status === 'pending').length;
  const refundedCount = invoices.filter((i) => i.status === 'refunded').length;

  return (
    <Layout title="Billing & Invoices">
      <div className="page-header">
        <div>
          <div className="breadcrumb">Revenue &rsaquo; <span>Billing &amp; Invoices</span></div>
          <h1>Billing &amp; Invoices</h1>
          <p>Payments, pending charges and refunds across all guest folios.</p>
        </div>
        <button className="btn btn-gold" type="button" onClick={openCreate}>+ New Invoice</button>
      </div>

      {error && <div className="badge flagged" style={{ display: 'block', textAlign: 'center', marginBottom: 14, padding: 10 }}>{error}</div>}

      <div className="stat-row cols-4">
        <div className="stat-card"><div className="stat-icon">&#128179;</div><div><div className="stat-label">Revenue This Month</div><div className="stat-value">KES {Math.round(revenueThisMonth)}</div></div></div>
        <div className="stat-card c2"><div className="stat-icon">&#9989;</div><div><div className="stat-label">Paid Invoices</div><div className="stat-value">{paidCount}</div></div></div>
        <div className="stat-card c3"><div className="stat-icon">&#8987;</div><div><div className="stat-label">Pending</div><div className="stat-value">{pendingCount}</div></div></div>
        <div className="stat-card c5"><div className="stat-icon">&#8617;</div><div><div className="stat-label">Refunded</div><div className="stat-value">{refundedCount}</div></div></div>
      </div>

      <div className="panel">
        <div className="card-head"><div className="section-title">Invoices</div></div>
        <hr className="rule" />
        <table>
          <thead><tr><th>Invoice</th><th>Guest</th><th>Booking Ref</th><th>Amount</th><th>Method</th><th>Date</th><th>Status</th><th style={{ textAlign: 'center' }}>Action</th></tr></thead>
          <tbody>
            {invoices.map((i) => (
              <tr key={i.id}>
                <td>{i.invoice_number}</td>
                <td><div className="guest"><div className="av">{(i.guest_name || '?').charAt(0)}</div>{i.guest_name}</div></td>
                <td>{i.booking_ref}</td>
                <td>KES {Number(i.amount).toFixed(2)}</td>
                <td>{METHOD_LABEL[i.payment_method] || i.payment_method}</td>
                <td>{new Date(i.issued_date).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                <td><span className={`badge KES {STATUS_CLASS[i.status] || ''}`}>{i.status.charAt(0).toUpperCase() + i.status.slice(1)}</span></td>
                <td>
                  <div className="row-actions">
                    <button type="button" className="ra-btn" onClick={() => openEdit(i)}>&#9998;</button>
                    <button type="button" className="ra-btn" onClick={() => onDelete(i)}>&#128465;</button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && invoices.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--muted)', padding: 24 }}>No invoices yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} title={form.id ? 'Edit Invoice' : 'New Invoice'} onClose={() => setModalOpen(false)}>
        <form onSubmit={onSubmit}>
          <div className="form-grid">
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="booking_id">Booking</label>
              <select className="form-select" id="booking_id" value={form.booking_id} onChange={(e) => setForm({ ...form, booking_id: e.target.value })} required>
                {bookingsList.map((b) => <option key={b.id} value={b.id}>{b.booking_ref} — {b.guest_name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="amount">Amount (KES )</label>
              <input className="form-input" type="number" step="0.01" id="amount" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
            </div>
            <div className="form-group">
              <label htmlFor="payment_method">Payment Method</label>
              <select className="form-select" id="payment_method" value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })}>
                <option value="card">Card</option>
                <option value="mobile money">Mobile Money</option>
                <option value="bank transfer">Bank Transfer</option>
                <option value="cash">Cash</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="status">Status</label>
              <select className="form-select" id="status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="refunded">Refunded</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="issued_date">Issued Date</label>
              <input className="form-input" type="date" id="issued_date" value={form.issued_date} onChange={(e) => setForm({ ...form, issued_date: e.target.value })} required />
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save Invoice'}</button>
          </div>
        </form>
      </Modal>
    </Layout>
  );
}
