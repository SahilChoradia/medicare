import { useEffect, useRef, useState } from 'react';
import { api, errMsg, formatDatePretty } from '../api';

export default function BookingModal({ pick, onClose, onBooked, onConflict }) {
  const ref = useRef();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (ref.current && !ref.current.open) {
      ref.current.showModal();
    }
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      const r = await api.post('/appointments', {
        doctorId: pick.doctor._id,
        serviceId: pick.service._id,
        date: pick.date,
        slotStart: pick.slot.slotStart,
        patientName: name.trim(),
        patientPhone: phone.trim()
      });
      onBooked(r.data.data);
    } catch (x) {
      setErr(errMsg(x));
      if (x.response?.status === 409) {
        onConflict();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <dialog ref={ref} onClose={onClose} aria-labelledby="modal-title">
      <div className="modal-header">
        <button
          type="button"
          className="modal-close-btn"
          onClick={() => ref.current?.close()}
          aria-label="Close dialog"
        >
          ✕
        </button>
        <h2 id="modal-title">Confirm Appointment</h2>
        <p>Complete your booking with {pick.doctor.name}</p>
      </div>

      <form onSubmit={submit} className="modal-body">
        <div className="appointment-summary-card">
          <div className="summary-item">
            <label>Service</label>
            <span>{pick.service.name}</span>
          </div>
          <div className="summary-item">
            <label>Doctor</label>
            <span>{pick.doctor.name}</span>
          </div>
          <div className="summary-item">
            <label>Date</label>
            <span>{formatDatePretty(pick.date) || pick.date}</span>
          </div>
          <div className="summary-item">
            <label>Time Slot</label>
            <span>{pick.slot.slotStart} – {pick.slot.slotEnd} (2 hrs)</span>
          </div>
        </div>

        <div className="form-field">
          <label htmlFor="patient-name">Patient Full Name</label>
          <input
            id="patient-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Sahil Sharma"
            required
            minLength={2}
            maxLength={60}
            pattern="[A-Za-z .'\-]+"
            title="Letters and spaces only (2-60 characters)"
            autoFocus
          />
        </div>

        <div className="form-field">
          <label htmlFor="patient-phone">Mobile Phone Number</label>
          <input
            id="patient-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="e.g. 9876543210 or +919876543210"
            required
            inputMode="tel"
            pattern="\+?[0-9]{10,13}"
            title="10 to 13 digits (optional leading +)"
          />
        </div>

        {err && (
          <div role="alert" className="alert-banner error" style={{ margin: 0 }}>
            <span className="alert-icon">⚠️</span>
            <div className="alert-content">
              <strong>Booking Error</strong>
              <span>{err}</span>
            </div>
          </div>
        )}

        <div className="modal-actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => ref.current?.close()}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={busy}
          >
            {busy ? 'Booking Slot…' : 'Confirm & Book'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
