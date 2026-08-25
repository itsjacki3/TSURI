import { useState } from 'react';
import Layout from '../components/Layout';
import { supabase } from '../lib/supabaseClient';
import { useSettings, invalidateSettingsCache } from '../hooks/useSettings';

export default function SettingsPage() {
  const settings = useSettings();
  const [form, setForm] = useState(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  // Seed the local form once settings have loaded, without clobbering edits in progress.
  if (form === null && settings) {
    setForm({
      hotelName: settings.hotel_name,
      hotelEmail: settings.booking_email,
      checkinTime: settings.checkin_time,
      checkoutTime: settings.checkout_time,
      currency: settings.currency,
      timezone: settings.timezone,
    });
  }

  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    const rows = [
      { setting_key: 'hotel_name', setting_value: form.hotelName.trim() },
      { setting_key: 'booking_email', setting_value: form.hotelEmail.trim() },
      { setting_key: 'checkin_time', setting_value: form.checkinTime },
      { setting_key: 'checkout_time', setting_value: form.checkoutTime },
      { setting_key: 'currency', setting_value: form.currency },
      { setting_key: 'timezone', setting_value: form.timezone },
    ];
    const { error: saveErr } = await supabase.from('settings').upsert(rows, { onConflict: 'setting_key' });
    setSaving(false);
    if (saveErr) {
      setError('Database error: ' + saveErr.message);
      return;
    }
    setError(null);
    setSaved(true);
    invalidateSettingsCache();
  }

  if (!form) return null;

  return (
    <Layout title="Settings">
      <div className="page-header">
        <div>
          <div className="breadcrumb">System &rsaquo; <span>Settings</span></div>
          <h1>Property Settings</h1>
          <p>General details used across the guest-facing site and staff dashboard.</p>
        </div>
      </div>

      {error && <div className="badge flagged" style={{ display: 'block', textAlign: 'center', marginBottom: 14, padding: 10 }}>{error}</div>}
      {saved && <div className="badge confirmed" style={{ display: 'inline-block', padding: '10px 16px', marginBottom: 16 }}>Settings saved.</div>}

      <div className="panel">
        <div className="section-title" style={{ marginBottom: 14 }}>General</div>
        <hr className="rule" />
        <form onSubmit={onSubmit}>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="hotelName">Property Name</label>
              <input className="form-input" type="text" id="hotelName" value={form.hotelName} onChange={(e) => setForm({ ...form, hotelName: e.target.value })} />
            </div>
            <div className="form-group">
              <label htmlFor="hotelEmail">Booking Contact Email</label>
              <input className="form-input" type="email" id="hotelEmail" value={form.hotelEmail} onChange={(e) => setForm({ ...form, hotelEmail: e.target.value })} />
            </div>
            <div className="form-group">
              <label htmlFor="checkinTime">Standard Check-in Time</label>
              <input className="form-input" type="time" id="checkinTime" value={form.checkinTime} onChange={(e) => setForm({ ...form, checkinTime: e.target.value })} />
            </div>
            <div className="form-group">
              <label htmlFor="checkoutTime">Standard Check-out Time</label>
              <input className="form-input" type="time" id="checkoutTime" value={form.checkoutTime} onChange={(e) => setForm({ ...form, checkoutTime: e.target.value })} />
            </div>
            <div className="form-group">
              <label htmlFor="currency">Currency</label>
              <select className="form-select" id="currency" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                <option value="KES">KES (Ksh )</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="timezone">Timezone</label>
              <select className="form-select" id="timezone" value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })}>
                <option value="Africa/Nairobi">Africa/Nairobi</option>
                <option value="UTC">UTC</option>
              </select>
            </div>
          </div>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</button>
        </form>
      </div>
    </Layout>
  );
}
