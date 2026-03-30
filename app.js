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
  if (!dateStr) return 'Today';
  // e.g. "Mon, Mar 30" → "Monday, March 30"
  const parts = dateStr.match(/^(\w+),\s+(\w+)\s+(\d+)$/);
  if (!parts) return dateStr;
  const days = { Mon:'Monday', Tue:'Tuesday', Wed:'Wednesday', Thu:'Thursday', Fri:'Friday', Sat:'Saturday', Sun:'Sunday' };
  const months = { Jan:'January', Feb:'February', Mar:'March', Apr:'April', May:'May', Jun:'June', Jul:'July', Aug:'August', Sep:'September', Oct:'October', Nov:'November', Dec:'December' };
  return `${days[parts[1]] ?? parts[1]}, ${months[parts[2]] ?? parts[2]} ${parts[3]}`;
}

function formatDateShort(dateStr) {
  if (!dateStr) return { weekday: '—', month: '' };
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

  // Higher score = more opaque slot box (matches Stitch design: 95%→0.8, 12%→0.15)
  const slotOpacity = (score) => score != null ? Math.max(0.15, (score / 10) * 0.85).toFixed(2) : '0.15';

  // Slot text color: high=primary blue, mid=on-surface, low=muted
  const slotTextColor = (score, isNorth) => {
    if (isNorth) {
      if (score >= 7) return 'text-primary';
      if (score >= 4) return 'text-on-surface';
      return 'text-outline';
    } else {
      if (score >= 7) return 'text-[#4d4542]';
      if (score >= 4) return 'text-[#4d4542]';
      return 'text-[#4d4542]/40';
    }
  };

  // Card color palette — light cards only, slot boxes handle the opacity
  const cardTheme = (score, isNorth) => {
    if (score >= 8) return isNorth
      ? { bg: '#eff4ff', badge: 'bg-primary/10 text-primary',      icon: 'text-primary',   text: 'text-on-background', label: 'text-outline'      }
      : { bg: '#ece0db', badge: 'bg-[#4d4542]/10 text-[#4d4542]', icon: 'text-[#4d4542]', text: 'text-[#201a17]',     label: 'text-[#4d4542]/60' };
    if (score >= 5) return isNorth
      ? { bg: '#dce1fd', badge: 'bg-secondary/10 text-secondary',  icon: 'text-secondary', text: 'text-on-background', label: 'text-outline'      }
      : { bg: '#d0c4bf', badge: 'bg-[#4d4542]/10 text-[#4d4542]', icon: 'text-[#4d4542]', text: 'text-[#201a17]',     label: 'text-[#4d4542]/60' };
    if (score >= 3) return isNorth
      ? { bg: '#c0c5e0', badge: 'bg-secondary/10 text-secondary',  icon: 'text-secondary', text: 'text-on-background', label: 'text-outline'      }
      : { bg: '#b8b4c8', badge: 'bg-[#4d4542]/10 text-[#4d4542]', icon: 'text-[#4d4542]', text: 'text-[#201a17]',     label: 'text-[#4d4542]/60' };
    return isNorth
      ? { bg: '#d3e4fe', badge: 'bg-primary/10 text-primary',      icon: 'text-primary',   text: 'text-on-background', label: 'text-outline'      }
      : { bg: '#c8c4d8', badge: 'bg-[#4d4542]/10 text-[#4d4542]', icon: 'text-[#4d4542]', text: 'text-[#201a17]',     label: 'text-[#4d4542]/60' };
  };

  // Direction summary
  const dirSummary = (dir) => {
    const s = Math.max(dir.morning?.score ?? 0, dir.afternoon?.score ?? 0);
    if (s >= 8) return { icon: 'light_mode',        label: 'Clear',    desc: 'Excellent Clarity' };
    if (s >= 5) return { icon: 'partly_cloudy_day', label: 'Hazy',     desc: 'Partial View'      };
    if (s >= 3) return { icon: 'cloud',             label: 'Cloudy',   desc: 'Limited View'      };
    return             { icon: 'foggy',             label: 'Obscured', desc: 'Not Visible'       };
  };

  const slotBox = (slot, isNorth, labelCls) => {
    const score = slot?.score ?? null;
    const pct = score != null ? (score * 10) + '%' : '—';
    const bg = `rgba(255,255,255,${slotOpacity(score)})`;
    const textCls = slotTextColor(score, isNorth);
    return `<div style="border-radius:1rem;padding:12px;flex:1;background:${bg}">
      <p class="font-label text-[10px] ${labelCls} uppercase tracking-tighter" style="margin-bottom:4px">{SLOT}</p>
      <p class="font-headline font-extrabold text-xl ${textCls}">${pct}</p>
    </div>`;
  };

  // Fuji image — bottom-right background decoration, blends with card via mix-blend-mode
  const fujiSilhouette = `<div style="position:absolute;right:-40px;bottom:-40px;width:198px;height:198px;border-radius:50%;overflow:hidden;opacity:0.22;mix-blend-mode:multiply;pointer-events:none"><img src="/fuji.png" style="width:100%;height:100%;object-fit:cover;object-position:center center" alt="" /></div>`;

  const ns = dirSummary(north);
  const nt = cardTheme(Math.max(north.morning?.score ?? 0, north.afternoon?.score ?? 0), true);
  const northCard = `
    <div style="position:relative;overflow:hidden;border-radius:1.5rem;padding:1.5rem 1.5rem 0;display:flex;flex-direction:column;min-height:320px;background:${nt.bg}">
      ${fujiSilhouette}
      <div style="position:relative;z-index:10;display:flex;justify-content:space-between;align-items:flex-start">
        <span class="px-3 py-1 rounded-full font-label text-[10px] font-bold tracking-widest uppercase ${nt.badge}">North · Kawaguchiko</span>
        <div class="flex items-center gap-1 ${nt.icon}">
          <span class="material-symbols-outlined text-[18px]">${ns.icon}</span>
          <span class="font-headline font-bold text-sm">${ns.label}</span>
        </div>
      </div>
      <h3 style="position:relative;z-index:10;margin:24px 0 0" class="font-headline text-2xl font-bold ${nt.text}">${ns.desc}</h3>
      <div style="position:relative;z-index:10;display:flex;gap:12px;margin-top:auto;padding-top:24px;padding-bottom:1.5rem">
        ${slotBox(north.morning, true, nt.label).replace('{SLOT}', 'Morning')}
        ${slotBox(north.afternoon, true, nt.label).replace('{SLOT}', 'Afternoon')}
      </div>
    </div>`;

  const ss = dirSummary(south);
  const st = cardTheme(Math.max(south.morning?.score ?? 0, south.afternoon?.score ?? 0), false);
  const southCard = `
    <div style="position:relative;overflow:hidden;border-radius:1.5rem;padding:1.5rem 1.5rem 0;display:flex;flex-direction:column;min-height:320px;background:${st.bg}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <span class="px-3 py-1 rounded-full font-label text-[10px] font-bold tracking-widest uppercase ${st.badge}">South · Hakone</span>
        <div class="flex items-center gap-1 ${st.icon}">
          <span class="material-symbols-outlined text-[18px]">${ss.icon}</span>
          <span class="font-headline font-bold text-sm">${ss.label}</span>
        </div>
      </div>
      <h3 style="margin:24px 0 0" class="font-headline text-2xl font-bold ${st.text}">${ss.desc}</h3>
      <div style="display:flex;gap:12px;margin-top:auto;padding-top:24px;padding-bottom:1.5rem">
        ${slotBox(south.morning, false, st.label).replace('{SLOT}', 'Morning')}
        ${slotBox(south.afternoon, false, st.label).replace('{SLOT}', 'Afternoon')}
      </div>
    </div>`;

  el.innerHTML = `
    <div class="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 gap-2">
      <div>
        <p class="font-label text-sm uppercase tracking-[0.2em] text-outline mb-1">${formatDateHeader(day.date)}</p>
        <h1 class="font-headline text-5xl md:text-7xl font-extrabold tracking-tighter text-on-background">${headline}</h1>
      </div>
      <div class="text-right">
        <p class="font-label text-[10px] uppercase tracking-widest text-outline">Last Updated</p>
        <p id="hero-last-updated" class="font-headline font-bold text-primary text-sm">—</p>
      </div>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      ${northCard}
      ${southCard}
    </div>`;
}

// ── Forecast card render ──────────────────────
function renderForecastCard(day) {
  const { weekday, month } = formatDateShort(day.date);
  const top = bestScore(day);
  const c = scoreColor(top);
  const icon = scoreIcon(top);
  const label = scoreLabel(top);

  // Forecast cards — from Stitch design:
  // High (8-10): #eff4ff light blue,  primary icon
  // Med  (5-7):  #d0c4bf warm beige,  tertiary icon
  // Low  (3-4):  #c0c5e0 slate blue,  secondary icon
  // None (0-2):  #c0c5e0 slate blue opacity 70%, secondary icon
  const fcLabel = top >= 8 ? 'High' : top >= 5 ? 'Med' : top >= 3 ? 'Low' : 'None';
  const fcStyles = top >= 8
    ? { bg: '#eff4ff', textColor: '#0b1c30', dateColor: 'text-outline',   iconBg: 'bg-primary',    iconText: 'text-white',     lblColor: 'text-primary'   }
    : top >= 5
    ? { bg: '#eff4ff', textColor: '#0b1c30', dateColor: 'text-outline',   iconBg: 'bg-[#d0c4bf]', iconText: 'text-[#201a17]', lblColor: 'text-[#625a56]' }
    : top >= 3
    ? { bg: '#c0c5e0', textColor: '#0b1c30', dateColor: 'text-[#414753]', iconBg: 'bg-[#dce1fd]', iconText: 'text-secondary',  lblColor: 'text-secondary' }
    : { bg: '#c0c5e0', textColor: '#727785', dateColor: 'text-outline',   iconBg: 'bg-[#dce1fd]', iconText: 'text-secondary',  lblColor: 'text-outline',  opacity: '0.7' };

  return `
    <article class="rounded-2xl p-4 flex flex-col items-center text-center space-y-3" style="background:${fcStyles.bg};color:${fcStyles.textColor};opacity:${fcStyles.opacity ?? 1}">
      <p class="font-label text-[10px] ${fcStyles.dateColor} font-bold tracking-widest uppercase">${weekday} ${month.split(' ')[1]}</p>
      <div class="w-11 h-11 rounded-full flex items-center justify-center ${fcStyles.iconBg} ${fcStyles.iconText}">
        <span class="material-symbols-outlined text-[20px]">${icon}</span>
      </div>
      <div>
        <p class="font-headline font-extrabold text-xl" style="color:inherit">${fcLabel}</p>
        <p class="font-label text-[10px] ${fcStyles.lblColor} uppercase font-bold">${label}</p>
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

  // Timestamps
  const ts = data.meta?.lastScraped ?? data.updated_at ?? data.updated ?? null;
  if (ts) {
    const d = new Date(ts);
    const formatted = !isNaN(d)
      ? d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })
      : ts;
    const footerEl = document.getElementById('last-updated');
    if (footerEl) footerEl.textContent = `Updated ${formatted}`;
    // Hero last updated (JST time only)
    const heroEl = document.getElementById('hero-last-updated');
    if (heroEl && !isNaN(d)) {
      heroEl.textContent = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Tokyo', timeZoneName: 'short' });
    }
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
