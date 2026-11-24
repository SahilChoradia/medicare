import { useEffect, useState, useCallback, useRef } from 'react';
import { api, errMsg } from '../api';

const POPULAR_SERVICES = [
  'General Consultation',
  'Dental Checkup',
  'Skin Consultation',
  'X-Ray'
];

export default function Suggest({ date, onPick, refreshKey }) {
  const [service, setService] = useState('');
  const [time, setTime] = useState('');
  const [opts, setOpts] = useState([]);
  const [res, setRes] = useState(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [onlyMatching, setOnlyMatching] = useState(false);

  // Debounced service typeahead
  useEffect(() => {
    if (service.trim().length < 2) {
      setOpts([]);
      return;
    }
    const t = setTimeout(() => {
      api.get('/services', { params: { q: service.trim() } })
        .then((r) => setOpts(r.data.data))
        .catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [service]);

  // Execute search
  const doSearch = useCallback(async (svc, tm) => {
    const s = (svc !== undefined ? svc : service).trim();
    const t = tm !== undefined ? tm : time;
    if (!s) return;

    setErr('');
    setLoading(true);
    try {
      const r = await api.get('/suggestions', {
        params: {
          service: s,
          date,
          ...(t ? { time: t } : {})
        }
      });
      setRes(r.data.data);
    } catch (x) {
      setErr(errMsg(x));
    } finally {
      setLoading(false);
    }
  }, [service, time, date]);

  const handleSubmit = (e) => {
    e?.preventDefault();
    doSearch();
  };

  // Auto-search when time changes (if service is already filled)
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (service.trim().length >= 2) {
      const timer = setTimeout(() => {
        doSearch(service, time);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [time]); // eslint-disable-line

  // Click on a quick service chip
  const handleChipClick = (sName) => {
    setService(sName);
    doSearch(sName, time);
  };

  useEffect(() => {
    if (res) doSearch();
    /* eslint-disable-next-line */
  }, [refreshKey]);

  return (
    <section className="suggest-panel" aria-label="Smart Doctor Finder">
      <div className="suggest-header">
        <div className="suggest-icon-box">
          ✨
        </div>
        <div className="suggest-title-group">
          <h2>Smart Doctor & Slot Matcher</h2>
          <p>
            Tell us your required care and preferred time. We will match you directly to the best available 2-hour consultation slot.
          </p>
        </div>
      </div>

      <form className="suggest-form" onSubmit={handleSubmit}>
        <div className="form-field" style={{ flex: 2 }}>
          <label htmlFor="suggest-service">Service or Specialty</label>
          <input
            id="suggest-service"
            list="svc-options"
            value={service}
            onChange={(e) => setService(e.target.value)}
            placeholder="e.g. Dental Checkup, Skin Consultation, X-Ray..."
            required
            minLength={2}
          />
          <datalist id="svc-options">
            {opts.map((o) => (
              <option key={o._id} value={o.name} />
            ))}
          </datalist>

          <div className="quick-chips">
            <span>Quick Select:</span>
            {POPULAR_SERVICES.map((s) => (
              <button
                type="button"
                key={s}
                className="chip-btn"
                onClick={() => handleChipClick(s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="form-field">
          <label htmlFor="suggest-time">Preferred Time (Optional)</label>
          <input
            id="suggest-time"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          style={{ height: '44px', minWidth: '140px' }}
          disabled={loading}
        >
          {loading ? 'Finding…' : 'Find Doctors'}
        </button>
      </form>

      {/* Helper notice when time is entered */}
      {time && res && res.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem', padding: '0.5rem 0.75rem', background: '#f0fdfa', borderRadius: '8px', border: '1px solid #99f6e4', fontSize: '0.825rem' }}>
          <span style={{ color: '#0f766e', fontWeight: 600 }}>
            Showing slots ranked for preferred time: <strong>{time}</strong> (Fixed 2-hour consultations).
          </span>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.8rem', color: '#134e4a', fontWeight: 600 }}>
            <input
              type="checkbox"
              checked={onlyMatching}
              onChange={(e) => setOnlyMatching(e.target.checked)}
            />
            Show only matching slot
          </label>
        </div>
      )}

      {err && (
        <div role="alert" className="alert-banner error" style={{ marginTop: '1rem' }}>
          <span className="alert-icon">⚠️</span>
          <div className="alert-content">
            <strong>Search Issue</strong>
            <span>{err}</span>
          </div>
        </div>
      )}

      {res && res.length === 0 && (
        <div className="no-slots-box" style={{ marginTop: '1rem' }}>
          No free slots match <strong>"{service}"</strong> on {date}. Try another date or a different time.
        </div>
      )}

      {res && res.length > 0 && (
        <div className="suggest-results-grid">
          {res.map((r) => {
            const hasRequestedTime = Boolean(time);
            const bestSlot = r.slots[0];
            // Sort any remaining slots chronologically so they are clean and easy to read
            const otherSlots = r.slots.slice(1).sort((a, b) => a.slotStart.localeCompare(b.slotStart));

            const isExactMatch = r.exact || (bestSlot && (bestSlot.isExactMatch || bestSlot.coversTime));

            return (
              <article key={r.doctor._id + r.service._id} className="suggest-card">
                <div className="suggest-card-top">
                  <div className="suggest-card-doc">
                    <h3>{r.doctor.name}</h3>
                    <p>{r.service.name} · {r.doctor.specialization}</p>
                  </div>
                  {hasRequestedTime ? (
                    <span className={`match-badge ${isExactMatch ? 'exact' : ''}`}>
                      {isExactMatch ? '⭐ Exact Time Match' : '🕒 Closest Match'}
                    </span>
                  ) : (
                    <span className="match-badge exact">
                      Available Today
                    </span>
                  )}
                </div>

                {/* If a preferred time was inserted, show the BEST MATCH prominently */}
                {hasRequestedTime && bestSlot ? (
                  <>
                    <div className="featured-match-box">
                      <div className="featured-match-header">
                        <span className="featured-match-title">
                          {isExactMatch ? '🎯 Best Match for ' + time : '🕒 Closest Available Slot'}
                        </span>
                        <span className="featured-match-sub">
                          {isExactMatch
                            ? `Covers requested ${time} (2-Hour Slot)`
                            : `${bestSlot.distanceMinutes || 0} mins from ${time}`}
                        </span>
                      </div>

                      <button
                        type="button"
                        className="featured-slot-btn"
                        onClick={() => onPick({ doctor: r.doctor, service: r.service, slot: bestSlot, date })}
                      >
                        <span className="featured-slot-time">
                          {bestSlot.slotStart} – {bestSlot.slotEnd}
                        </span>
                        <span className="featured-slot-action">
                          Book This Slot →
                        </span>
                      </button>
                    </div>

                    {/* Secondary other slots on this date (if not hidden by toggle) */}
                    {!onlyMatching && otherSlots.length > 0 && (
                      <div className="other-slots-section">
                        <div className="other-slots-header">
                          <span className="other-slots-title">
                            Other available times on {date} ({otherSlots.length}):
                          </span>
                        </div>
                        <div className="doctor-slots">
                          {otherSlots.map((s) => (
                            <button
                              key={s.slotStart}
                              type="button"
                              className="slot-btn available"
                              onClick={() => onPick({ doctor: r.doctor, service: r.service, slot: s, date })}
                            >
                              <span>{s.slotStart} – {s.slotEnd}</span>
                              <span className="slot-status-text">Book Slot</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  /* If no preferred time was requested, show all available slots chronologically */
                  <>
                    <div className="slot-section-title">
                      Available 2-Hour Slots ({r.slots.length})
                    </div>
                    <div className="doctor-slots">
                      {r.slots
                        .slice()
                        .sort((a, b) => a.slotStart.localeCompare(b.slotStart))
                        .map((s) => (
                          <button
                            key={s.slotStart}
                            type="button"
                            className="slot-btn available"
                            onClick={() => onPick({ doctor: r.doctor, service: r.service, slot: s, date })}
                          >
                            <span>{s.slotStart} – {s.slotEnd}</span>
                            <span className="slot-status-text">Book Slot</span>
                          </button>
                        ))}
                    </div>
                  </>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
