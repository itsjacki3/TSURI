import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import { supabase } from '../lib/supabaseClient';

export default function Search() {
  const [params] = useSearchParams();
  const q = (params.get('q') || '').trim();

  const [rooms, setRooms] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [guests, setGuests] = useState([]);
  const [staff, setStaff] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!q) {
      setRooms([]); setBookings([]); setGuests([]); setStaff([]); setInvoices([]);
      setReady(true);
      return;
    }
    setReady(false);
    const like = `%${q}%`;

    async function run() {
      const [roomsRes, bookingsRes, guestsRes, staffRes, invoicesRes] = await Promise.all([
        supabase.from('rooms').select('id, room_number, status, nightly_rate, floor_location, room_types(name)')
          .or(`room_number.ilike.${like},floor_location.ilike.${like}`).order('room_number').limit(10),
        supabase.from('bookings').select('id, booking_ref, status, check_in, check_out, guests(full_name), rooms(room_number)')
          .or(`booking_ref.ilike.${like}`).order('created_at', { ascending: false }).limit(10),
        supabase.from('guests').select('id, full_name, email, phone, guest_type')
          .or(`full_name.ilike.${like},email.ilike.${like},phone.ilike.${like}`).order('full_name').limit(10),
        supabase.rpc('staff_list').then(({ data, error }) => ({
          data: (data || []).filter((s) =>
            s.full_name.toLowerCase().includes(q.toLowerCase()) ||
            (s.email || '').toLowerCase().includes(q.toLowerCase()) ||
            (s.department || '').toLowerCase().includes(q.toLowerCase())
          ).slice(0, 10),
          error,
        })),
        supabase.from('invoices').select('id, invoice_number, amount, status, bookings(booking_ref, guests(full_name))')
          .or(`invoice_number.ilike.${like}`).order('issued_date', { ascending: false }).limit(10),
      ]);

      setRooms((roomsRes.data || []).map((r) => ({ ...r, type_name: r.room_types?.name })));
      setBookings((bookingsRes.data || []).map((b) => ({ ...b, guest_name: b.guests?.full_name, room_number: b.rooms?.room_number })));
      setGuests(guestsRes.data || []);
      setStaff(staffRes.data || []);
      setInvoices((invoicesRes.data || []).map((i) => ({ ...i, guest_name: i.bookings?.guests?.full_name, booking_ref: i.bookings?.booking_ref })));
      setReady(true);
    }
    run();
  }, [q]);

  const totalResults = rooms.length + bookings.length + guests.length + staff.length + invoices.length;

  return (
    <Layout title="Search Results">
      <div className="page-header">
        <div>
          <div className="breadcrumb">Search</div>
          <h1>Search Results</h1>
          <p className="search-summary">
            {q === ''
              ? 'Type something into the search bar above to look across rooms, bookings, guests, staff and invoices.'
     : `${totalResults} result${totalResults === 1 ? '' : 's'} for "${q}"`}
          </p>
        </div>
      </div>

      {ready && q !== '' && totalResults === 0 && (
        <div className="panel search-empty">No matches found for "{q}". Try a room number, guest name, or booking reference.</div>
      )}

      {rooms.length > 0 && (
        <div className="panel" style={{ marginBottom: 16 }}>
          <div className="card-head"><div className="section-title">Rooms</div><Link className="view-all" to="/rooms">Open Room Management</Link></div>
          <hr className="rule" />
          <table>
            <thead><tr><th>Room</th><th>Type</th><th>Rate / Night</th><th>Location</th><th>Status</th></tr></thead>
            <tbody>
              {rooms.map((r) => (
                <tr key={r.id}>
                  <td><div className="cell-room"><div className="thumb"></div>Room {r.room_number}</div></td>
                  <td>{r.type_name}</td>
                  <td>KES {Number(r.nightly_rate).toFixed(2)}</td>
                  <td>{r.floor_location}</td>
                  <td><span className={`badge KES {r.status}`}>{r.status.charAt(0).toUpperCase() + r.status.slice(1)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {bookings.length > 0 && (
        <div className="panel" style={{ marginBottom: 16 }}>
          <div className="card-head"><div className="section-title">Bookings</div><Link className="view-all" to="/bookings">Open Reservations</Link></div>
          <hr className="rule" />
          <table>
            <thead><tr><th>Reference</th><th>Guest</th><th>Room</th><th>Check-in</th><th>Check-out</th><th>Status</th></tr></thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.id}>
                  <td>{b.booking_ref}</td>
                  <td><div className="guest"><div className="av">{(b.guest_name || '?').charAt(0)}</div>{b.guest_name}</div></td>
                  <td>Room {b.room_number}</td>
                  <td>{new Date(b.check_in).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                  <td>{new Date(b.check_out).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                  <td><span className={`badge KES {b.status}`}>{b.status.charAt(0).toUpperCase() + b.status.slice(1)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {guests.length > 0 && (
        <div className="panel" style={{ marginBottom: 16 }}>
          <div className="card-head"><div className="section-title">Guests</div><Link className="view-all" to="/guests">Open Guests</Link></div>
          <hr className="rule" />
          <table>
            <thead><tr><th style={{ textAlign: 'center' }}>Profile</th><th>Name</th><th>Email</th><th>Phone</th><th>Type</th></tr></thead>
            <tbody>
              {guests.map((g) => (
                <tr key={g.id}>
                  <td style={{ textAlign: 'center' }}><div className="av" style={{ margin: '0 auto' }}>{g.full_name.charAt(0)}</div></td>
                  <td>{g.full_name}</td>
                  <td>{g.email}</td>
                  <td>{g.phone}</td>
                  <td><span className="badge available">{g.guest_type.charAt(0).toUpperCase() + g.guest_type.slice(1)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {staff.length > 0 && (
        <div className="panel" style={{ marginBottom: 16 }}>
          <div className="card-head"><div className="section-title">Staff</div><Link className="view-all" to="/staff">Open Staff &amp; Roles</Link></div>
          <hr className="rule" />
          <table>
            <thead><tr><th>Name</th><th>Role</th><th>Department</th><th>Status</th></tr></thead>
            <tbody>
              {staff.map((s) => (
                <tr key={s.id}>
                  <td><div className="guest"><div className="av">{s.full_name.charAt(0)}</div>{s.full_name}</div></td>
                  <td>{s.role_name || '—'}</td>
                  <td>{s.department}</td>
                  <td>{(s.status || '').charAt(0).toUpperCase() + (s.status || '').slice(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {invoices.length > 0 && (
        <div className="panel">
          <div className="card-head"><div className="section-title">Invoices</div><Link className="view-all" to="/billing">Open Billing</Link></div>
          <hr className="rule" />
          <table>
            <thead><tr><th>Invoice</th><th>Guest</th><th>Booking Ref</th><th>Amount</th><th>Status</th></tr></thead>
            <tbody>
              {invoices.map((i) => (
                <tr key={i.id}>
                  <td>{i.invoice_number}</td>
                  <td><div className="guest"><div className="av">{(i.guest_name || '?').charAt(0)}</div>{i.guest_name}</div></td>
                  <td>{i.booking_ref}</td>
                  <td>KES {Number(i.amount).toFixed(2)}</td>
                  <td><span className={`badge KES {i.status === 'paid' ? 'available' : i.status === 'pending' ? 'occupied' : 'checkedout'}`}>{i.status.charAt(0).toUpperCase() + i.status.slice(1)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  );
}
