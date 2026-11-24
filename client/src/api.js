import axios from 'axios';

// In local development, defaults to '/api' (proxied by Vite).
// In production on Vercel, you can set VITE_API_URL=https://your-server.onrender.com
const envApiUrl = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/+$/, '') : '';
const baseURL = envApiUrl ? (envApiUrl.endsWith('/api') ? envApiUrl : `${envApiUrl}/api`) : '/api';

export const api = axios.create({
  baseURL,
  withCredentials: true,
  headers: { 'X-Requested-With': 'XMLHttpRequest' }
});

export const errMsg = (e) => {
  if (!e.response) {
    if (e.code === 'ERR_NETWORK' || e.message?.toLowerCase().includes('network')) {
      return 'Unable to reach backend server. Please verify the server is running on port 5000.';
    }
    return e.message || 'Connection failed. Please check your network and try again.';
  }
  if (e.response.status === 502 || e.response.status === 504) {
    return 'Backend server is not responding (502 Gateway Error). Please check server terminal.';
  }
  return e.response?.data?.errors?.[0]?.message || e.response?.data?.message || 'Something went wrong. Please try again.';
};

export const todayIST = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

export const addDays = (d, n) => {
  const x = new Date(d + 'T00:00:00Z');
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};

export const formatDatePretty = (dStr) => {
  if (!dStr) return '';
  const [y, m, d] = dStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC'
  });
};

export const getCalendarDays = (baseDate, count = 7) => {
  const days = [];
  const today = todayIST();
  for (let i = 0; i < count; i++) {
    const cur = addDays(baseDate, i);
    const [y, m, d] = cur.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    days.push({
      date: cur,
      dayName: dt.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }),
      dayNum: d,
      monthName: dt.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }),
      isToday: cur === today
    });
  }
  return days;
};
