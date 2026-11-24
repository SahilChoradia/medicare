import { useCallback, useEffect, useState } from 'react';
import { api, errMsg, todayIST, addDays, formatDatePretty, getCalendarDays } from '../api';
import BookingModal from '../components/BookingModal';
import Suggest from '../components/Suggest';
import SuccessModal from '../components/SuccessModal';

export default function Home() {
  const [date, setDate] = useState(todayIST());
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [pick, setPick] = useState(null);
  const [done, setDone] = useState(null);
  const [tick, setTick] = useState(0);
  const [selectedService, setSelectedService] = useState('ALL');
  const [timeFilter, setTimeFilter] = useState('ALL'); // 'ALL' | 'MORNING' | 'AFTERNOON'
  const [viewMode, setViewMode] = useState('cards'); // 'cards' | 'matrix'

  const calendarDays = getCalendarDays(todayIST(), 7);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/availability', { params: { date } })
      .then((r) => {
        setData(r.data);
        setErr('');
      })
      .catch((e) => {
        setErr(errMsg(e));
      })
      .finally(() => {
        setLoading(false);
        setTick((t) => t + 1);
      });
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  // Filtered doctors by service if active
  const filteredDoctors = data?.doctors?.filter((doc) => {
    if (selectedService === 'ALL') return true;
    return doc.services?.some((s) => s._id === selectedService || s.name === selectedService);
  }) || [];

  // Filter slots by time of day if active
  const matchesTimeFilter = (slotStart) => {
    if (timeFilter === 'ALL') return true;
    const hour = parseInt(slotStart.split(':')[0], 10);
    if (timeFilter === 'MORNING') return hour < 13;
    if (timeFilter === 'AFTERNOON') return hour >= 13;
    return true;
  };

  return (
    <>
      {/* Hero & Date Selection Bar */}
      <section className="hero-header">
        <div className="hero-main">
          <div className="hero-text">
            <h1>Find & Book Doctor Appointments</h1>
            <p>
              Select your specialist, choose an available 2-hour consultation slot, and confirm in seconds.
            </p>
          </div>

          <div className="date-selector-container">
            <div className="date-input-wrapper">
              <label htmlFor="appt-date-picker">Date</label>
              <input
                id="appt-date-picker"
                type="date"
                value={date}
                min={todayIST()}
                max={addDays(todayIST(), 30)}
                onChange={(e) => e.target.value && setDate(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* 7-Day Quick Calendar Strip */}
        <div className="calendar-strip" role="group" aria-label="Quick Date Picker">
          {calendarDays.map((cd) => (
            <button
              key={cd.date}
              type="button"
              className={`day-pill ${date === cd.date ? 'active' : ''}`}
              onClick={() => setDate(cd.date)}
            >
              <span className="day-name">{cd.isToday ? 'Today' : cd.dayName}</span>
              <span className="day-number">{cd.dayNum}</span>
              <span className="day-month">{cd.monthName}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Success Confirmation Popup Dialog */}
      {done && (
        <SuccessModal
          done={done}
          onClose={() => setDone(null)}
        />
      )}

      {/* Error Banner with Retry */}
      {err && (
        <div role="alert" className="alert-banner error">
          <span className="alert-icon">⚠️</span>
          <div className="alert-content">
            <strong>Connection Notice</strong>
            <span>{err}</span>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
            onClick={load}
          >
            Retry
          </button>
        </div>
      )}

      {/* Controls & Filter Bar */}
      {data && (
        <div className="filter-bar">
          <div className="service-tabs" role="tablist">
            <button
              type="button"
              className={`service-tab ${selectedService === 'ALL' ? 'active' : ''}`}
              onClick={() => setSelectedService('ALL')}
            >
              All Specialties ({data.doctors.length})
            </button>
            {data.services.map((s) => (
              <button
                key={s._id}
                type="button"
                className={`service-tab ${selectedService === s._id ? 'active' : ''}`}
                onClick={() => setSelectedService(s._id)}
              >
                {s.name}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Time of Day Filter */}
            <div className="view-toggle" role="group" aria-label="Time of Day Filter">
              <button
                type="button"
                className={`view-toggle-btn ${timeFilter === 'ALL' ? 'active' : ''}`}
                onClick={() => setTimeFilter('ALL')}
              >
                All Times
              </button>
              <button
                type="button"
                className={`view-toggle-btn ${timeFilter === 'MORNING' ? 'active' : ''}`}
                onClick={() => setTimeFilter('MORNING')}
              >
                🌅 Morning
              </button>
              <button
                type="button"
                className={`view-toggle-btn ${timeFilter === 'AFTERNOON' ? 'active' : ''}`}
                onClick={() => setTimeFilter('AFTERNOON')}
              >
                ☀️ Afternoon
              </button>
            </div>

            {/* View Mode Toggle */}
            <div className="view-toggle" role="group" aria-label="View Mode">
              <button
                type="button"
                className={`view-toggle-btn ${viewMode === 'cards' ? 'active' : ''}`}
                onClick={() => setViewMode('cards')}
              >
                <span>🗂️</span> Cards View
              </button>
              <button
                type="button"
                className={`view-toggle-btn ${viewMode === 'matrix' ? 'active' : ''}`}
                onClick={() => setViewMode('matrix')}
              >
                <span>📊</span> Matrix Grid
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && !data && (
        <div className="skeleton-loader">
          <div className="skeleton-box"></div>
          <div className="skeleton-box"></div>
        </div>
      )}

      {/* View 1: Doctor Profile Cards View (Default, Mobile & Desktop Responsive) */}
      {data && viewMode === 'cards' && (
        <div className="doctors-grid">
          {filteredDoctors.map((doc) => {
            // Collect all unique slots for this doctor across the available grid
            const doctorSlotsMap = new Map();
            data.services.forEach((s) => {
              const slots = data.grid[s._id]?.[doc._id] || [];
              slots.forEach((sl) => {
                if (!doctorSlotsMap.has(sl.slotStart)) {
                  doctorSlotsMap.set(sl.slotStart, { ...sl, service: s });
                }
              });
            });

            // Filter by time of day if set, then sort chronologically
            const allDocSlots = Array.from(doctorSlotsMap.values())
              .filter((sl) => matchesTimeFilter(sl.slotStart))
              .sort((a, b) => a.slotStart.localeCompare(b.slotStart));

            // Initials for avatar
            const initials = doc.name.replace('Dr. ', '').split(' ').map((n) => n[0]).join('').slice(0, 2);

            return (
              <article key={doc._id} className="doctor-card">
                <div className="doctor-header">
                  <div className="doctor-avatar">{initials}</div>
                  <div className="doctor-info">
                    <h2>{doc.name}</h2>
                    <span className="specialty-badge">{doc.specialization}</span>
                  </div>
                </div>

                <div className="doctor-meta-pills">
                  <span className="meta-pill">
                    🕒 {doc.workingHours?.start || '09:00'} – {doc.workingHours?.end || '17:00'}
                  </span>
                  {doc.breaks?.length > 0 && (
                    <span className="meta-pill break-pill">
                      ☕ Break: {doc.breaks[0].start} – {doc.breaks[0].end}
                    </span>
                  )}
                </div>

                <div className="doctor-services-list">
                  {(doc.services || []).map((s) => (
                    <span key={s._id || s} className="service-tag">
                      {s.name || s}
                    </span>
                  ))}
                </div>

                <div className="slot-section-title">
                  Available Slots ({formatDatePretty(date)})
                  <span>2-Hour Consultations</span>
                </div>

                {allDocSlots.length === 0 ? (
                  <div className="no-slots-box">
                    No slots available {timeFilter !== 'ALL' ? `in the ${timeFilter.toLowerCase()}` : ''} on {date}.
                  </div>
                ) : (
                  <div className="doctor-slots">
                    {allDocSlots.map((sl) => {
                      const isAvailable = sl.status === 'available';
                      const matchedService = doc.services?.[0] || data.services[0];
                      return (
                        <button
                          key={sl.slotStart}
                          type="button"
                          className={`slot-btn ${sl.status}`}
                          disabled={!isAvailable}
                          aria-label={`${doc.name}, ${sl.slotStart} to ${sl.slotEnd}${
                            sl.status === 'booked' ? ', booked' : sl.status === 'past' ? ', past' : ''
                          }`}
                          onClick={() => {
                            setDone(null);
                            setPick({
                              doctor: doc,
                              service: sl.service || matchedService,
                              slot: sl,
                              date
                            });
                          }}
                        >
                          <span>{sl.slotStart} – {sl.slotEnd}</span>
                          <span className="slot-status-text">
                            {sl.status === 'available' ? 'Book' : sl.status === 'booked' ? 'Booked' : 'Past'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* View 2: Traditional Matrix Table View */}
      {data && viewMode === 'matrix' && (
        <div className="matrix-scroll-wrapper">
          <table className="styled-table">
            <thead>
              <tr>
                <th scope="col" className="service-matrix-th">Medical Service</th>
                {data.doctors.map((d) => (
                  <th scope="col" key={d._id} className="doctor-matrix-th">
                    <span className="th-doc-name">{d.name}</span>
                    <span className="th-doc-spec">{d.specialization}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.services.map((s) => (
                <tr key={s._id}>
                  <th scope="row" className="service-matrix-th">{s.name}</th>
                  {data.doctors.map((d) => {
                    const slots = (data.grid[s._id]?.[d._id] || []).filter((sl) => matchesTimeFilter(sl.slotStart));
                    return (
                      <td key={d._id}>
                        {!slots ? (
                          <span className="muted">N/A</span>
                        ) : slots.length === 0 ? (
                          <span className="muted">No slots</span>
                        ) : (
                          <div className="doctor-slots" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(115px, 1fr))' }}>
                            {slots.map((sl) => (
                              <button
                                key={sl.slotStart}
                                type="button"
                                className={`slot-btn ${sl.status}`}
                                disabled={sl.status !== 'available'}
                                aria-label={`${s.name} with ${d.name}, ${sl.slotStart} to ${sl.slotEnd}${
                                  sl.status === 'booked' ? ', booked' : ''
                                }`}
                                onClick={() => {
                                  setDone(null);
                                  setPick({ doctor: d, service: s, slot: sl, date });
                                }}
                              >
                                <span>{sl.slotStart} – {sl.slotEnd}</span>
                                <span className="slot-status-text">
                                  {sl.status === 'available' ? 'Book' : sl.status}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Smart Doctor Match Assistant */}
      <Suggest
        date={date}
        onPick={(p) => {
          setDone(null);
          setPick(p);
        }}
        refreshKey={tick}
      />

      {/* Booking Modal Dialog */}
      {pick && (
        <BookingModal
          pick={pick}
          onClose={() => setPick(null)}
          onConflict={load}
          onBooked={(b) => {
            setDone(b);
            setPick(null);
            load();
          }}
        />
      )}
    </>
  );
}
