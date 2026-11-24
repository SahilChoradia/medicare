import { useEffect, useRef } from 'react';
import { formatDatePretty } from '../api';

export default function SuccessModal({ done, onClose }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    if (dialogRef.current && !dialogRef.current.open) {
      dialogRef.current.showModal();
    }
  }, []);

  if (!done) return null;

  const shortId = done.id ? String(done.id).slice(-6).toUpperCase() : 'CONFIRMED';

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="success-popup-dialog"
      aria-labelledby="success-popup-title"
      role="dialog"
    >
      <div className="success-popup-container">
        {/* Top close button */}
        <button
          type="button"
          className="popup-close-btn"
          onClick={() => {
            dialogRef.current?.close();
            onClose();
          }}
          aria-label="Close confirmation"
        >
          ✕
        </button>

        {/* Animated Checkmark Badge */}
        <div className="success-popup-icon-wrapper">
          <div className="success-popup-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
        </div>

        <h2 id="success-popup-title" className="success-popup-title">
          Appointment Confirmed!
        </h2>
        <p className="success-popup-subtitle">
          Your appointment has been successfully booked and reserved in our clinic schedule.
        </p>

        {/* Receipt / Details Card */}
        <div className="success-receipt-card" role="status">
          <div className="receipt-row">
            <span className="receipt-label">Service</span>
            <span className="receipt-value primary-bold">{done.service}</span>
          </div>

          <div className="receipt-row">
            <span className="receipt-label">Specialist</span>
            <span className="receipt-value">{done.doctor}</span>
          </div>

          <div className="receipt-row">
            <span className="receipt-label">Date</span>
            <span className="receipt-value">{formatDatePretty(done.date) || done.date}</span>
          </div>

          <div className="receipt-row">
            <span className="receipt-label">Time Window</span>
            <span className="receipt-value highlight-time">
              {done.slotStart} – {done.slotEnd} (2 Hours)
            </span>
          </div>

          <div className="receipt-row">
            <span className="receipt-label">Patient Name</span>
            <span className="receipt-value">{done.patientName}</span>
          </div>

          <div className="receipt-row receipt-id-row">
            <span className="receipt-label">Booking Reference</span>
            <span className="receipt-id">#APT-{shortId}</span>
          </div>
        </div>

        {/* Clinic Reminder Notice */}
        <div className="success-clinic-notice">
          <span className="notice-icon">ℹ️</span>
          <span>Please arrive 10 minutes prior to your consultation. No advance payment is needed.</span>
        </div>

        {/* Actions */}
        <div className="success-popup-actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => window.print()}
          >
            🖨️ Print Receipt
          </button>
          <button
            type="button"
            className="btn btn-primary"
            style={{ minWidth: '130px' }}
            onClick={() => {
              dialogRef.current?.close();
              onClose();
            }}
          >
            Done
          </button>
        </div>
      </div>
    </dialog>
  );
}
