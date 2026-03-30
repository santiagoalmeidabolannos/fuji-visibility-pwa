/* ─────────────────────────────────────────────
   Fuji Visibility PWA — app.js
───────────────────────────────────────────── */

const API_URL = 'https://fuji-visibility-api.onrender.com/visibility';

// ── Service worker registration ──────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.warn('SW registration failed:', err);
    });
  });
}

// ── Score helpers ─────────────────────────────
function scoreLabel(n) {
  if (n >= 8) return 'Clear';
  if (n >= 5) return 'Partial';
  if (n >= 3) return 'Hazy';
  return 'Hidden';
}

function scoreIcon(n) {
  if (n >= 8) return 'sunny';
  if (n >= 5) return 'partly_cloudy_day';
  if (n >= 3) return 'cloudy';
  return 'foggy';
}

function scoreColor(n) {
  if (n >= 8) return { bg: 'bg-primary', text: 'text-white', label: 'text-primary' };
  if (n >= 5) return { bg: 'bg-[#d0c4bf]', text: 'text-[#201a17]', label: 'text-[#625a56]' };
  if (n >= 3) return { bg: 'bg-[#dce1fd]', text: 'text-[#585d75]', label: 'text-[#585d75]' };
  return { bg: 'bg-[#e5eeff]', text: 'text-[#414753]', label: 'text-outline' };
}

function scorePill(n) {
  const c = scoreColor(n);
  return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-label text-xs font-bold ${c.bg} ${c.text}">${n}/10</span>`;
}

// Best score for forecast day icon
function bestScore(day) {
  return Math.max(
    day.north?.morning?.score ?? 0, day.north?.afternoon?.score ?? 0,
    day.south?.morning?.score ?? 0, day.south?.afternoon?.score ?? 0
  );
}

// ── Date formatting ───────────────────────────
// API returns dates like "Mon, Mar 30" — use them directly

function formatDateHeader(dateStr) {
  // e.g. "Mon, Mar 30" → "Monday, March 30"
  const parts = dateStr.match(/^(\w+),\s+(\w+)\s+(\d+)$/);
  if (!parts) return dateStr;
  const days = { Mon:'Monday', Tue:'Tuesday', Wed:'Wednesday', Thu:'Thursday', Fri:'Friday', Sat:'Saturday', Sun:'Sunday' };
  const months = { Jan:'January', Feb:'February', Mar:'March', Apr:'April', May:'May', Jun:'June', Jul:'July', Aug:'August', Sep:'September', Oct:'October', Nov:'November', Dec:'December' };
  return `${days[parts[1]] ?? parts[1]}, ${months[parts[2]] ?? parts[2]} ${parts[3]}`;
}

function formatDateShort(dateStr) {
  // e.g. "Mon, Mar 30" → { weekday: "Mon", month: "Mar 30" }
  const parts = dateStr.match(/^(\w+),\s+(\w+\s+\d+)$/);
  if (!parts) return { weekday: dateStr, month: '' };
  return { weekday: parts[1], month: parts[2] };
}

function isToday(day) {
  return day.isToday === true;
}

// ── SVG mood ──────────────────────────────────
function updateFujiSVG(score) {
  const svg        = document.getElementById('fuji-svg');
  const hazeOverlay = document.getElementById('haze-overlay');
  const atmosHaze  = document.getElementById('atmos-haze');
  const stars      = document.getElementById('stars');
  const skyTop     = document.getElementById('sky-stop-top');
  const skyBottom  = document.getElementById('sky-stop-bottom');

  if (!svg) return;

  if (score >= 8) {
    // Clear — deep blue sky, no haze, stars visible
    skyTop.setAttribute('stop-color', '#0d1b2e');
    skyBottom.setAttribute('stop-color', '#1e4976');
    hazeOverlay.setAttribute('opacity', '0');
    atmosHaze.setAttribute('opacity', '0');
    stars.setAttribute('opacity', '1');
  } else if (score >= 5) {
    // Hazy — muted dusk blues
    skyTop.setAttribute('stop-color', '#1c2b3a');
    skyBottom.setAttribute('stop-color', '#2e5068');
    hazeOverlay.setAttribute('opacity', '0.35');
    atmosHaze.setAttribute('opacity', '0.2');
    stars.setAttribute('opacity', '0.3');
  } else if (score >= 3) {
    // Poor — grey-blue
    skyTop.setAttribute('stop-color', '#2a2e38');
    skyBottom.setAttribute('stop-color', '#3a4050');
    hazeOverlay.setAttribute('opacity', '0.6');
    atmosHaze.setAttribute('opacity', '0.45');
    stars.setAttribute('opacity', '0');
  } else {
    // Obscured — heavy haze
    skyTop.setAttribute('stop-color', '#383838');
    skyBottom.setAttribute('stop-color', '#4a4a4a');
    hazeOverlay.setAttribute('opacity', '0.85');
    atmosHaze.setAttribute('opacity', '0.7');
    stars.setAttribute('opacity', '0');
  }
}

// ── Today card render ─────────────────────────
function renderTodayCard(day) {
  const el = document.getElementById('today-card');
  if (!el) return;

  const north = day.north ?? {};
  const south = day.south ?? {};
  const topScore = Math.max(
    north.morning?.score ?? 0, north.afternoon?.score ?? 0,
    south.morning?.score ?? 0, south.afternoon?.score ?? 0
  );

  updateFujiSVG(topScore);

  const headline = topScore >= 8 ? 'VISIBLE' : topScore >= 5 ? 'PARTIAL' : topScore >= 3 ? 'HAZY' : 'NOT VISIBLE';

  const dirCard = (label, dir) => `
    <div class="relative overflow-hidden rounded-3xl bg-surface-container-low p-6 flex flex-col justify-between min-h-[180px]">
      <span class="px-3 py-1 rounded-full bg-primary/10 text-primary font-label text-[10px] font-bold tracking-widest uppercase self-start">${label}</span>
      <div class="flex gap-3 mt-4">
        <div class="bg-white/80 backdrop-blur-md rounded-2xl p-3 flex-1">
          <p class="font-label text-[10px] text-outline uppercase tracking-tighter mb-1">Morning</p>
          <p class="font-headline font-extrabold text-lg text-primary">${dir.morning?.score != null ? dir.morning.score + '/10' : '—'}</p>
          <p class="font-label text-[9px] text-outline mt-0.5">${dir.morning?.status ?? ''}</p>
        </div>
        <div class="bg-white/50 backdrop-blur-md rounded-2xl p-3 flex-1">
          <p class="font-label text-[10px] text-outline uppercase tracking-tighter mb-1">Afternoon</p>
          <p class="font-headline font-extrabold text-lg text-on-surface">${dir.afternoon?.score != null ? dir.afternoon.score + '/10' : '—'}</p>
          <p class="font-label text-[9px] text-outline mt-0.5">${dir.afternoon?.status ?? ''}</p>
        </div>
      </div>
    </div>`;

  el.innerHTML = `
    <div class="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 gap-2">
      <div>
        <p class="font-label text-sm uppercase tracking-[0.2em] text-outline mb-1">${formatDateHeader(day.date)}</p>
        <h1 class="font-headline text-5xl md:text-7xl font-extrabold tracking-tighter text-on-background">${headline}</h1>
      </div>
      <span class="px-3 py-1 rounded-full bg-primary/10 text-primary font-label text-[10px] font-bold tracking-widest uppercase">Today</span>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      ${dirCard('North · Kawaguchiko', north)}
      ${dirCard('South · Hakone', south)}
    </div>`;
}

// ── Forecast card render ──────────────────────
function renderForecastCard(day) {
  const { weekday, month } = formatDateShort(day.date);
  const top = bestScore(day);
  const c = scoreColor(top);
  const icon = scoreIcon(top);
  const label = scoreLabel(top);

  return `
    <article class="bg-surface-container-low rounded-2xl p-4 flex flex-col items-center text-center space-y-3">
      <p class="font-label text-[10px] text-outline font-bold tracking-widest uppercase">${weekday} ${month}</p>
      <div class="w-11 h-11 rounded-full ${c.bg} flex items-center justify-center ${c.text}">
        <span class="material-symbols-outlined text-[20px]">${icon}</span>
      </div>
      <div>
        <p class="font-headline font-extrabold text-base">${top > 0 ? top + '/10' : '—'}</p>
        <p class="font-label text-[10px] ${c.label} uppercase font-bold">${label}</p>
      </div>
    </article>`;
}

// ── Render all forecast data ──────────────────
function renderData(data) {
  const forecast = data.forecast ?? [];

  // Find today's entry (first entry, or the one matching today's date)
  const todayEntry = forecast.find(d => isToday(d)) ?? forecast[0];
  if (todayEntry) renderTodayCard(todayEntry);

  // Remaining days go to the 7-day list (skip today)
  const remaining = forecast.filter(d => d !== todayEntry);
  const listEl = document.getElementById('forecast-list');
  if (listEl) {
    listEl.innerHTML = remaining.length
      ? remaining.map(renderForecastCard).join('')
      : '<p class="last-updated" style="padding:12px 2px">No forecast data available.</p>';
  }

  // Footer timestamp
  const ts = data.meta?.lastScraped ?? data.updated_at ?? data.updated ?? null;
  const lastUpdEl = document.getElementById('last-updated');
  if (lastUpdEl && ts) {
    const d = new Date(ts);
    lastUpdEl.textContent = `Updated ${d.toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short'
    })}`;
  }

  // Push widget data to cache via SW message
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller && todayEntry) {
    const widgetPayload = {
      north_morning:  todayEntry.north?.morning?.score  ?? null,
      south_morning:  todayEntry.south?.morning?.score  ?? null,
      north_afternoon: todayEntry.north?.afternoon?.score ?? null,
      south_afternoon: todayEntry.south?.afternoon?.score ?? null,
      date:    todayEntry.date,
      updated: ts,
    };
    navigator.serviceWorker.controller.postMessage({
      type: 'STORE_WIDGET_DATA',
      payload: widgetPayload,
    });
  }
}

// ── Offline / error state ─────────────────────
function renderError(offline) {
  const todayEl = document.getElementById('today-card');
  const listEl  = document.getElementById('forecast-list');
  const msg = offline
    ? '<span class="error-icon" aria-hidden="true">⛅</span><p>You\'re offline. Connect to the internet to see the latest forecast.</p>'
    : '<span class="error-icon" aria-hidden="true">⚠</span><p>Could not load forecast data. Please try again later.</p>';

  if (todayEl) todayEl.innerHTML = `<div class="error-state">${msg}</div>`;
  if (listEl)  listEl.innerHTML  = '';
}

// ── Network badge ─────────────────────────────
function setOfflineBadge(offline) {
  const badge = document.getElementById('network-badge');
  if (!badge) return;
  badge.classList.toggle('hidden', !offline);
}

// ── Fetch with cache fallback ─────────────────
async function loadForecast() {
  const offline = !navigator.onLine;
  setOfflineBadge(offline);

  try {
    const res = await fetch(API_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    renderData(data);
  } catch (err) {
    // Network failed — try SW cache via a plain fetch (cache-first for API in offline)
    try {
      const cached = await fetch(API_URL);
      if (!cached.ok) throw new Error('cache miss');
      const data = await cached.json();
      renderData(data);
      setOfflineBadge(true);
    } catch {
      renderError(offline);
    }
  }
}

// ── Online / offline listeners ────────────────
window.addEventListener('online',  () => { setOfflineBadge(false); loadForecast(); });
window.addEventListener('offline', () => setOfflineBadge(true));

// ── Boot ──────────────────────────────────────
loadForecast();
