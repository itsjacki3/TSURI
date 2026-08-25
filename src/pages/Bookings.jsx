import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import Modal from '../components/Modal';
import { supabase } from '../lib/supabaseClient';
import { useSettings } from '../hooks/useSettings';

const STATUS_LABEL = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  checkedin: 'Checked In',
  checkedout: 'Checked Out',
  cancelled: 'Cancelled',
};

const STATUS_CLASS = {
  pending: 'pending',
  confirmed: 'confirmed',
  checkedin: 'occupied',
  checkedout: 'checkedout',
  cancelled: 'flagged',
};

const EMPTY_FORM = {
  id: null,
  guest_id: '',
  room_id: '',
  check_in: '',
  check_out: '',
  status: 'confirmed',
  room_total: '',
  service_total: '0',
};

/*
 * A booking is considered to occupy a room for its date range when it is
 * pending, confirmed, or checked in.
 */
const ACTIVE_BOOKING_STATUSES = ['pending', 'confirmed', 'checkedin'];

/*
 * Convert a room status to lowercase and normalize spaces/hyphens.
 */
function normalizeRoomStatus(status) {
  return String(status || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

/*
 * Check whether two booking periods overlap.

 * Existing: existingCheckIn -> existingCheckOut
 * New:      newCheckIn      -> newCheckOut
 *
 * If:
 *
 * existingCheckIn < newCheckOut
 * AND
 * existingCheckOut > newCheckIn
 *
 * then the periods overlap.
 */
function datesOverlap(
  existingCheckIn,
  existingCheckOut,
  newCheckIn,
  newCheckOut
) {
  return (
    existingCheckIn < newCheckOut &&
    existingCheckOut > newCheckIn
  );
}

export default function Bookings() {
  const settings = useSettings();

  const [params, setParams] = useSearchParams();

  const [bookings, setBookings] = useState([]);
  const [guestsList, setGuestsList] = useState([]);
  const [roomsList, setRoomsList] = useState([]);

  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  /*
   * Load guests, rooms and bookings.
   *
   * IMPORTANT:
   * We now load room status as well.
   */
  async function load() {
    setLoading(true);

    const [
      { data: guestsData, error: guestsErr },
      { data: roomsData, error: roomsErr },
      { data: bookingsData, error: bookErr },
    ] = await Promise.all([
      supabase
        .from('guests')
        .select('id, full_name')
        .order('full_name'),

      supabase
        .from('rooms')
        .select('id, room_number, status')
        .order('room_number'),

      supabase
        .from('bookings')
        .select(
          `
            id,
            booking_ref,
            guest_id,
            room_id,
            check_in,
            check_out,
            status,
            room_total,
            service_total,
            grand_total,
            created_at,
            guests(full_name),
            rooms(
              room_number,
              status,
              room_types(name)
            )
          `
        )
        .order('created_at', { ascending: false }),
    ]);

    const firstError = guestsErr || roomsErr || bookErr;

    if (firstError) {
      setError('Database error: ' + firstError.message);
      setLoading(false);
      return;
    }

    setError(null);

    setGuestsList(guestsData || []);
    setRoomsList(roomsData || []);

    setBookings(
      (bookingsData || []).map((b) => ({
        ...b,
        guest_name: b.guests?.full_name,
        room_number: b.rooms?.room_number,
        room_type: b.rooms?.room_types?.name,
        room_status: b.rooms?.status,
      }))
    );

    setLoading(false);
  }

  useEffect(() => {
    load();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const editId = params.get('edit');

    if (editId && bookings.length) {
      const b = bookings.find((x) => String(x.id) === editId);

      if (b) {
        openEdit(b);
      }
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookings]);

  /*
   * Returns the rooms that can be selected for the current
   * check-in / check-out period.
   */
  function getAvailableRooms() {
    if (!form.check_in || !form.check_out) {
      /*
       * Before dates are selected, we still exclude rooms that are
       * currently occupied or out of order.
       */
      return roomsList.filter((room) => {
        const status = normalizeRoomStatus(room.status);

        return (
          status !== 'occupied' &&
          status !== 'out_of_order'
        );
      });
    }

    /*
     * Check that checkout is after check-in.
     */
    if (form.check_out <= form.check_in) {
      return [];
    }

    return roomsList.filter((room) => {
      const roomStatus = normalizeRoomStatus(room.status);

      /*
       * Never allow these rooms.
       */
      if (
        roomStatus === 'occupied' ||
        roomStatus === 'out_of_order'
      ) {
        return false;
      }

      /*
       * Find active bookings for this room.
       *
       * The current booking being edited is excluded from the
       * overlap check.
       */
      const roomHasOverlappingBooking = bookings.some((booking) => {
        if (Number(booking.room_id) !== Number(room.id)) {
          return false;
        }

        /*
         * When editing a booking, don't compare it against itself.
         */
        if (
          form.id &&
          Number(booking.id) === Number(form.id)
        ) {
          return false;
        }

        /*
         * Cancelled and checked-out bookings don't block
         * future reservations.
         */
        if (
          !ACTIVE_BOOKING_STATUSES.includes(
            booking.status
          )
        ) {
          return false;
        }

        return datesOverlap(
          booking.check_in,
          booking.check_out,
          form.check_in,
          form.check_out
        );
      });

      return !roomHasOverlappingBooking;
    });
  }

  /*
   * Whenever the dates change, make sure the selected room is
   * still available for those dates.
   */
  useEffect(() => {
    if (!modalOpen) return;

    const availableRooms = getAvailableRooms();

    const selectedStillAvailable = availableRooms.some(
      (room) => String(room.id) === String(form.room_id)
    );

    if (!selectedStillAvailable) {
      setForm((current) => ({
        ...current,
        room_id: availableRooms[0]?.id || '',
      }));
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    form.check_in,
    form.check_out,
    bookings,
    roomsList,
    modalOpen,
  ]);

  function openCreate() {
    setForm({
      ...EMPTY_FORM,
      guest_id: guestsList[0]?.id || '',
      room_id: '',
      status: 'confirmed',
    });

    setModalOpen(true);
  }

  function openEdit(b) {
    setForm({
      id: b.id,
      guest_id: b.guest_id,
      room_id: b.room_id,
      check_in: b.check_in,
      check_out: b.check_out,
      status: b.status,
      room_total: b.room_total,
      service_total: b.service_total,
    });

    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);

    if (params.get('edit')) {
      params.delete('edit');
      setParams(params, { replace: true });
    }
  }

  /*
   * Update the room status according to the booking status.
   */
  async function updateRoomStatus(roomId, bookingStatus) {
    let newRoomStatus = null;

    if (
      bookingStatus === 'pending' ||
      bookingStatus === 'confirmed'
    ) {
      newRoomStatus = 'reserved';
    } else if (bookingStatus === 'checkedin') {
      newRoomStatus = 'occupied';
    } else if (
      bookingStatus === 'checkedout' ||
      bookingStatus === 'cancelled'
    ) {
      newRoomStatus = 'vacant';
    }

    if (!newRoomStatus) {
      return null;
    }

    const { error } = await supabase
      .from('rooms')
      .update({ status: newRoomStatus })
      .eq('id', roomId);

    return error || null;
  }

  /*
   * Final availability check immediately before saving.
   *
   * This is important because another user may have created a
   * booking after this page was loaded.
   */
  async function verifyRoomAvailability() {
    if (!form.room_id || !form.check_in || !form.check_out) {
      return {
        available: false,
        message: 'Select a room, check-in date and check-out date.',
      };
    }

    if (form.check_out <= form.check_in) {
      return {
        available: false,
        message: 'Check-out date must be after the check-in date.',
      };
    }

    /*
     * Get the current room status from the database.
     */
    const {
      data: room,
      error: roomError,
    } = await supabase
      .from('rooms')
      .select('id, room_number, status')
      .eq('id', form.room_id)
      .single();

    if (roomError) {
      return {
        available: false,
        message: 'Could not verify room availability: ' + roomError.message,
      };
    }

    const roomStatus = normalizeRoomStatus(room.status);

    if (roomStatus === 'occupied') {
      return {
        available: false,
        message: `Room ${room.room_number} is currently occupied.`,
      };
    }

    if (roomStatus === 'out_of_order') {
      return {
        available: false,
        message: `Room ${room.room_number} is out of order.`,
      };
    }

    /*
     * Query active bookings for this room.
     *
     * We intentionally query the database again instead of trusting
     * the bookings already loaded into React.
     */
    let query = supabase
      .from('bookings')
      .select(
        'id, room_id, check_in, check_out, status'
      )
      .eq('room_id', form.room_id)
      .in('status', ACTIVE_BOOKING_STATUSES)
      .lt('check_in', form.check_out)
      .gt('check_out', form.check_in);

    if (form.id) {
      query = query.neq('id', form.id);
    }

    const {
      data: overlappingBookings,
      error: bookingError,
    } = await query;

    if (bookingError) {
      return {
        available: false,
        message:
          'Could not verify existing reservations: ' +
          bookingError.message,
      };
    }

    if (overlappingBookings?.length) {
      return {
        available: false,
        message: `Room ${room.room_number} is already reserved for part of that period.`,
      };
    }

    return {
      available: true,
      room,
    };
  }

  async function onSubmit(e) {
    e.preventDefault();

    setSaving(true);
    setError(null);

    /*
     * Validate dates.
     */
    if (!form.check_in || !form.check_out) {
      setError('Please select both check-in and check-out dates.');
      setSaving(false);
      return;
    }

    if (form.check_out <= form.check_in) {
      setError('Check-out date must be after check-in date.');
      setSaving(false);
      return;
    }

    /*
     * Validate room availability one final time.
     */
    const availability = await verifyRoomAvailability();

    if (!availability.available) {
      setError(availability.message);
      setSaving(false);

      /*
       * Refresh rooms/bookings in case another user changed
       * availability.
       */
      await load();

      return;
    }

    /*
     * For a new reservation, don't allow the user to create a
     * checked-out booking directly.
     *
     * Normally a new booking should start as confirmed.
     */
    const bookingStatus = form.id
      ? form.status
      : 'confirmed';

    const payload = {
      guest_id: Number(form.guest_id),
      room_id: Number(form.room_id),
      check_in: form.check_in,
      check_out: form.check_out,
      status: bookingStatus,
      room_total: Number(form.room_total),
      service_total: Number(form.service_total || 0),
    };

    let saveErr = null;
    let savedBookingId = form.id;

    if (form.id) {
      /*
       * If the booking is being moved to another room, first
       * remember the old room.
       */
      const oldBooking = bookings.find(
        (b) => Number(b.id) === Number(form.id)
      );

      const oldRoomId = oldBooking?.room_id;

      const { error } = await supabase
        .from('bookings')
        .update(payload)
        .eq('id', form.id);

      saveErr = error;

      if (!saveErr) {
        /*
         * Update the newly selected room.
         */
        const roomStatusError = await updateRoomStatus(
          form.room_id,
          bookingStatus
        );

        if (roomStatusError) {
          saveErr = roomStatusError;
        }
      }

      /*
       * If the booking was moved from one room to another,
       * release the old room.
       */
      if (
        !saveErr &&
        oldRoomId &&
        Number(oldRoomId) !== Number(form.room_id)
      ) {
        /*
         * Only make the old room vacant if it has no other
         * active booking.
         */
        const {
          data: otherBookings,
          error: otherBookingError,
        } = await supabase
          .from('bookings')
          .select('id')
          .eq('room_id', oldRoomId)
          .in('status', ACTIVE_BOOKING_STATUSES)
          .neq('id', form.id);

        if (!otherBookingError && !otherBookings?.length) {
          await supabase
            .from('rooms')
            .update({ status: 'vacant' })
            .eq('id', oldRoomId);
        }
      }
    } else {
      /*
       * Insert the booking first.
       */
      const {
        data: inserted,
        error: insErr,
      } = await supabase
        .from('bookings')
        .insert({
          ...payload,
          booking_ref: 'BK-PENDING',
        })
        .select('id')
        .single();

      if (insErr) {
        saveErr = insErr;
      } else if (inserted) {
        savedBookingId = inserted.id;

        /*
         * Generate the booking reference.
         */
        const ref =
          'BK-' +
          String(10230 + inserted.id).padStart(5, '0');

        const { error: refError } = await supabase
          .from('bookings')
          .update({ booking_ref: ref })
          .eq('id', inserted.id);

        if (refError) {
          saveErr = refError;
        }

        /*
         * Automatically reserve the room.
         */
        if (!saveErr) {
          const roomStatusError = await updateRoomStatus(
            form.room_id,
            bookingStatus
          );

          if (roomStatusError) {
            saveErr = roomStatusError;
          }
        }
      }
    }

    /*
     * If something failed, stop here.
     */
    if (saveErr) {
      setSaving(false);
      setError('Database error: ' + saveErr.message);
      return;
    }

    setSaving(false);

    closeModal();

    /*
     * Reload everything so the room immediately disappears
     * from the available-room list and the new status is shown.
     */
    await load();
  }

  async function onDelete(b) {
    if (
      !confirm(
        `Cancel and delete booking ${b.booking_ref}?`
      )
    ) {
      return;
    }

    setError(null);

    const { error: delErr } = await supabase
      .from('bookings')
      .delete()
      .eq('id', b.id);

    if (delErr) {
      setError('Database error: ' + delErr.message);
      return;
    }

    /*
     * Release the room if no other active booking uses it.
     */
    const { data: otherBookings, error: otherErr } =
      await supabase
        .from('bookings')
        .select('id')
        .eq('room_id', b.room_id)
        .in('status', ACTIVE_BOOKING_STATUSES);

    if (!otherErr && !otherBookings?.length) {
      await supabase
        .from('rooms')
        .update({ status: 'vacant' })
        .eq('id', b.room_id);
    }

    await load();
  }

  const availableRooms = getAvailableRooms();

  const totalBookings = bookings.length;

  const confirmedCount = bookings.filter(
    (b) => b.status === 'confirmed'
  ).length;

  const pendingCount = bookings.filter(
    (b) => b.status === 'pending'
  ).length;

  const checkedoutCount = bookings.filter(
    (b) => b.status === 'checkedout'
  ).length;

  return (
    <Layout title="Reservations">
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            Operations &rsaquo; <span>Reservations</span>
          </div>

          <h1>Bookings</h1>

          <p>
            Every reservation across {settings.hotel_name} —
            confirmed, pending and completed.
          </p>
        </div>

        <button
          className="btn btn-gold"
          type="button"
          onClick={openCreate}
        >
          + New Booking
        </button>
      </div>

      {error && (
        <div
          className="badge flagged"
          style={{
            display: 'block',
            textAlign: 'center',
            marginBottom: 14,
            padding: 10,
          }}
        >
          {error}
        </div>
      )}

      <div className="stat-row cols-4">
        <div className="stat-card">
          <div className="stat-icon">&#128197;</div>
          <div>
            <div className="stat-label">Total Bookings</div>
            <div className="stat-value">{totalBookings}</div>
          </div>
        </div>

        <div className="stat-card c2">
          <div className="stat-icon">&#9989;</div>
          <div>
            <div className="stat-label">Confirmed</div>
            <div className="stat-value">{confirmedCount}</div>
          </div>
        </div>

        <div className="stat-card c3">
          <div className="stat-icon">&#8987;</div>
          <div>
            <div className="stat-label">Pending</div>
            <div className="stat-value">{pendingCount}</div>
          </div>
        </div>

        <div className="stat-card c5">
          <div className="stat-icon">&#128100;</div>
          <div>
            <div className="stat-label">Checked Out</div>
            <div className="stat-value">{checkedoutCount}</div>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="card-head">
          <div className="section-title">All Bookings</div>
        </div>

        <hr className="rule" />

        <table>
          <thead>
            <tr>
              <th>Reference</th>
              <th>Guest</th>
              <th>Room</th>
              <th>Check-in</th>
              <th>Check-out</th>
              <th>Total</th>
              <th>Status</th>
              <th style={{ textAlign: 'center' }}>
                Action
              </th>
            </tr>
          </thead>

          <tbody>
            {bookings.map((b) => (
              <tr key={b.id}>
                <td>{b.booking_ref}</td>

                <td>
                  <div className="guest">
                    <div className="av">
                      {(b.guest_name || '?').charAt(0)}
                    </div>

                    {b.guest_name}
                  </div>
                </td>

                <td>
                  Room {b.room_number} &middot; {b.room_type}
                </td>

                <td>
                  {new Date(b.check_in).toLocaleDateString(
                    undefined,
                    {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    }
                  )}
                </td>

                <td>
                  {new Date(b.check_out).toLocaleDateString(
                    undefined,
                    {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    }
                  )}
                </td>

                <td>
                  {settings.currency || 'KES'}{' '}
                  {Number(b.grand_total).toFixed(2)}
                </td>

                <td>
                  <span
                    className={`badge ${
                      STATUS_CLASS[b.status] || ''
                    }`}
                  >
                    {STATUS_LABEL[b.status] || b.status}
                  </span>
                </td>

                <td>
                  <div className="row-actions">
                    <button
                      type="button"
                      className="ra-btn"
                      onClick={() => openEdit(b)}
                    >
                      &#9998;
                    </button>

                    <button
                      type="button"
                      className="ra-btn"
                      onClick={() => onDelete(b)}
                    >
                      &#128465;
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {!loading && bookings.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  style={{
                    textAlign: 'center',
                    color: 'var(--muted)',
                    padding: 24,
                  }}
                >
                  No bookings yet — create the first one above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={modalOpen}
        title={form.id ? 'Edit Booking' : 'New Booking'}
        onClose={closeModal}
      >
        <form onSubmit={onSubmit}>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="guest_id">Guest</label>

              <select
                className="form-select"
                id="guest_id"
                value={form.guest_id}
                onChange={(e) =>
                  setForm({
                    ...form,
                    guest_id: e.target.value,
                  })
                }
                required
              >
                {guestsList.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.full_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="check_in">Check-in</label>

              <input
                className="form-input"
                type="date"
                id="check_in"
                value={form.check_in}
                onChange={(e) =>
                  setForm({
                    ...form,
                    check_in: e.target.value,
                  })
                }
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="check_out">Check-out</label>

              <input
                className="form-input"
                type="date"
                id="check_out"
                value={form.check_out}
                onChange={(e) =>
                  setForm({
                    ...form,
                    check_out: e.target.value,
                  })
                }
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="room_id">
                Room
                {form.check_in && form.check_out && (
                  <span
                    style={{
                      marginLeft: 8,
                      fontSize: 12,
                      color: 'var(--muted)',
                    }}
                  >
                    ({availableRooms.length} available)
                  </span>
                )}
              </label>

              <select
                className="form-select"
                id="room_id"
                value={form.room_id}
                onChange={(e) =>
                  setForm({
                    ...form,
                    room_id: e.target.value,
                  })
                }
                required
              >
                <option value="" disabled>
                  {availableRooms.length
                    ? 'Select a room'
                    : 'No rooms available'}
                </option>

                {availableRooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    Room {r.room_number}
                  </option>
                ))}
              </select>

              {form.check_in &&
                form.check_out &&
                availableRooms.length === 0 && (
                  <small
                    style={{
                      color: 'var(--danger, #b42318)',
                      display: 'block',
                      marginTop: 6,
                    }}
                  >
                    No rooms are available for this period.
                  </small>
                )}
            </div>

            {/*
             * Status is intentionally NOT editable for a new
             * reservation.
             *
             * A new reservation automatically starts as confirmed.
             *
             * When you have a dedicated Check In / Check Out
             * workflow, those actions should change the status.
             */}
            {form.id && (
              <div className="form-group">
                <label htmlFor="status">Status</label>

                <select
                  className="form-select"
                  id="status"
                  value={form.status}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      status: e.target.value,
                    })
                  }
                >
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="checkedin">
                    Checked In
                  </option>
                  <option value="checkedout">
                    Checked Out
                  </option>
                  <option value="cancelled">
                    Cancelled
                  </option>
                </select>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="room_total">
                Room Total ({settings.currency || 'KES'})
              </label>

              <input
                className="form-input"
                type="number"
                step="0.01"
                id="room_total"
                value={form.room_total}
                onChange={(e) =>
                  setForm({
                    ...form,
                    room_total: e.target.value,
                  })
                }
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="service_total">
                Service Total ({settings.currency || 'KES'})
              </label>

              <input
                className="form-input"
                type="number"
                step="0.01"
                id="service_total"
                value={form.service_total}
                onChange={(e) =>
                  setForm({
                    ...form,
                    service_total: e.target.value,
                  })
                }
              />
            </div>
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-outline"
              onClick={closeModal}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={
                saving ||
                !form.room_id ||
                !form.check_in ||
                !form.check_out ||
                availableRooms.length === 0
              }
            >
              {saving ? 'Saving…' : 'Save Booking'}
            </button>
          </div>
        </form>
      </Modal>
    </Layout>
  );
}