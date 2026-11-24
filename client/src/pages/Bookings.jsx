import { useCallback, useEffect, useState } from 'react';
import { api, errMsg, todayIST, addDays } from '../api';

export default function Bookings() {
  const [f, setF] = useState({ date: todayIST(), doctor: '', service: '', sort: 'asc', page: 1 });
  const [rows, setRows] = useState({ data: [], pages: 1, total: 0 });
  const [doctors, setDoctors] = useState([]);
  const [services, setServices] = useState([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [cancelModalId, setCancelModalId] = useState(null);

  // Load doctors and services once
  useEffect(() => {
    api.get('/doctors').then((r) => setDoctors(r.data.data)).catch(() => {});
    api.get('/services').then((r) => setServices(r.data.data)).catch(() => {});
  }, []);

  // Load appointments based on filters
  const load = useCallback(() => {
    setLoading(true);
    const params = Object.fromEntries(Object.entries(f).filter(([, v]) => v !== ''));
    api.get('/admin/appointments', { params })
      .then((r) => {
        setRows(r.data);
        setErr('');
      })
      .catch((e) => {
        setErr(errMsg(e));
      })
      .finally(() => {
        setLoading(false);
      });
  }, [f]);

  useEffect(() => {
    load();
  }, [load]);

  const set = (k, v) => setF((p) => ({ ...p, [k]: v, page: k === 'page' ? v : 1 }));

  const confirmCancel = async () => {
    if (!cancelModalId) return;
    try {
      await api.patch(`/admin/appointments/${cancelModalId}/cancel`);
      setCancelModalId(null);
      load();
    } catch (e) {
      setErr(errMsg(e));
      setCancelModalId(null);
    }
  };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2rem', margin: 0 }}>Appointments Management Dashboard</h1>
          <p className="muted" style={{ margin: '0.2rem 0 0 0' }}>Monitor bookings, filter by date, and manage slot availability in real time.</p>
        </div>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={load}
          disabled={loading}
        >
          {loading ? 'Refreshing…' : '🔄 Refresh Data'}
        </button>
      </div>

      {/* Metrics Bar */}
      <div className="staff-stats-grid">
        <div className="stat-card">
          <div className="stat-icon primary">📅</div>
          <div className="stat-info">
            <h3>Total Bookings</h3>
            <div className="stat-value">{rows.total || 0}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon accent">🩺</div>
          <div className="stat-info">
            <h3>Registered Doctors</h3>
            <div className="stat-value">{doctors.length}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon warning">🏥</div>
          <div className="stat-info">
            <h3>Services Offered</h3>
            <div className="stat-value">{services.length}</div>
          </div>
        </div>
      </div>

      {/* Filter Row */}
      <div className="hero-header" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', gap: '0.35rem', alignSelf: 'center', marginRight: '0.5rem' }}>
            <button
              type="button"
              className={`chip-btn ${f.date === todayIST() ? 'active' : ''}`}
              style={{ padding: '0.4rem 0.85rem' }}
              onClick={() => set('date', todayIST())}
            >
              Today
            </button>
            <button
              type="button"
              className={`chip-btn ${f.date === addDays(todayIST(), 1) ? 'active' : ''}`}
              style={{ padding: '0.4rem 0.85rem' }}
              onClick={() => set('date', addDays(todayIST(), 1))}
            >
              Tomorrow
            </button>
            <button
              type="button"
              className={`chip-btn ${f.date === '' ? 'active' : ''}`}
              style={{ padding: '0.4rem 0.85rem' }}
              onClick={() => set('date', '')}
            >
              All Dates
            </button>
          </div>

          <div className="form-field" style={{ minWidth: '150px' }}>
            <label htmlFor="f-date">Date</label>
            <input
              id="f-date"
              type="date"
              value={f.date}
              onChange={(e) => set('date', e.target.value)}
            />
          </div>

          <div className="form-field" style={{ minWidth: '160px' }}>
            <label htmlFor="f-doctor">Doctor</label>
            <select id="f-doctor" value={f.doctor} onChange={(e) => set('doctor', e.target.value)}>
              <option value="">All Doctors</option>
              {doctors.map((d) => (
                <option key={d._id} value={d._id}>{d.name}</option>
              ))}
            </select>
          </div>

          <div className="form-field" style={{ minWidth: '160px' }}>
            <label htmlFor="f-service">Service</label>
            <select id="f-service" value={f.service} onChange={(e) => set('service', e.target.value)}>
              <option value="">All Services</option>
              {services.map((s) => (
                <option key={s._id} value={s._id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div className="form-field" style={{ minWidth: '140px' }}>
            <label htmlFor="f-order">Order</label>
            <select id="f-order" value={f.sort} onChange={(e) => set('sort', e.target.value)}>
              <option value="asc">Earliest First</option>
              <option value="desc">Latest First</option>
            </select>
          </div>
        </div>
      </div>

      {err && (
        <div role="alert" className="alert-banner error">
          <span className="alert-icon">⚠️</span>
          <div className="alert-content">
            <strong>Error</strong>
            <span>{err}</span>
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && !rows.data.length && (
        <div className="skeleton-loader" style={{ marginBottom: '1.5rem' }}>
          <div className="skeleton-box"></div>
        </div>
      )}

      {/* Appointments Data Table */}
      <div className="matrix-scroll-wrapper">
        <table className="styled-table">
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Time Slot</th>
              <th scope="col">Patient</th>
              <th scope="col">Phone</th>
              <th scope="col">Doctor</th>
              <th scope="col">Service</th>
              <th scope="col">Status</th>
              <th scope="col">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.data.map((a) => (
              <tr key={a._id}>
                <td><strong>{a.date}</strong></td>
                <td>{a.slotStart} – {a.slotEnd}</td>
                <td><strong>{a.patientName}</strong></td>
                <td>{a.patientPhone}</td>
                <td>{a.doctor?.name || '—'}</td>
                <td>{a.service?.name || '—'}</td>
                <td>
                  <span className={`status-badge ${a.status}`}>
                    {a.status === 'booked' ? '● Confirmed' : '✕ Cancelled'}
                  </span>
                </td>
                <td>
                  {a.status === 'booked' && (
                    <button
                      type="button"
                      className="btn btn-danger"
                      style={{ padding: '0.3rem 0.75rem', fontSize: '0.8rem' }}
                      onClick={() => setCancelModalId(a._id)}
                    >
                      Cancel
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!rows.data.length && !loading && (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--muted)' }}>
                  No appointments found matching the selected filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={f.page <= 1}
          onClick={() => set('page', f.page - 1)}
        >
          ← Previous
        </button>

        <span style={{ fontSize: '0.875rem', color: 'var(--muted)', fontWeight: 600 }}>
          Page {rows.page || 1} of {rows.pages || 1} ({rows.total || 0} total bookings)
        </span>

        <button
          type="button"
          className="btn btn-ghost"
          disabled={f.page >= rows.pages}
          onClick={() => set('page', f.page + 1)}
        >
          Next →
        </button>
      </div>

      {/* Styled Cancel Confirmation Dialog */}
      {cancelModalId && (
        <dialog open style={{ display: 'block', margin: 'auto', position: 'fixed', inset: 0, zIndex: 100 }}>
          <div className="modal-header" style={{ background: '#b91c1c' }}>
            <h2 style={{ color: '#fff', fontSize: '1.25rem', margin: 0 }}>Cancel Appointment?</h2>
            <p style={{ color: '#fee2e2', margin: '0.25rem 0 0' }}>This will immediately release the 2-hour slot for other patients.</p>
          </div>
          <div className="modal-body">
            <p style={{ margin: 0, color: 'var(--ink)' }}>Are you sure you want to cancel this booking? This action cannot be undone.</p>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setCancelModalId(null)}
              >
                Keep Booking
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={confirmCancel}
              >
                Yes, Cancel Slot
              </button>
            </div>
          </div>
        </dialog>
      )}
    </>
  );
}
