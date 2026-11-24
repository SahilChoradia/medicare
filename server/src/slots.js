const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const toStr = (m) => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
// Fixed 2-hour slots from working hours; any slot overlapping a break is dropped.
function generateSlots(wh, breaks = []) {
  const out = []; const end = toMin(wh.end);
  for (let s = toMin(wh.start); s + 120 <= end; s += 120) {
    const e = s + 120;
    if (breaks.some((b) => s < toMin(b.end) && e > toMin(b.start))) continue;
    out.push({ slotStart: toStr(s), slotEnd: toStr(e) });
  }
  return out;
}
function nowIST() {
  const d = new Date();
  return {
    date: d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }),
    time: d.toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false }),
  };
}
function addDays(date, n) { const d = new Date(date + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
module.exports = { generateSlots, nowIST, addDays, toMin };
