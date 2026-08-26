/* PathPulse — real-time GPS tracker. Vanilla JS, browser Geolocation API only. */
'use strict';

const $ = (id) => document.getElementById(id);
const canvas = $('map');
const ctx = canvas.getContext('2d');

let watchId = null;
let points = [];
let startT = null;
let tracking = false;
let center = null;
let scaleMPerPx = 50;
const MAX_POINTS = 2000;

function toast(msg, ms = 2200) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), ms);
}

function toXY(p, ref) {
  const R = 6378137;
  const x = ((p.lng - ref.lng) * Math.PI / 180) * R * Math.cos(ref.lat * Math.PI / 180);
  const y = -((p.lat - ref.lat) * Math.PI / 180) * R;
  return { x, y };
}

function haversine(a, b) {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function totalDistance() {
  let d = 0;
  for (let i = 1; i < points.length; i++) d += haversine(points[i - 1], points[i]);
  return d;
}

function fmtTime(ms) {
  const s = Math.floor(ms / 1000);
  const h = String(Math.floor(s / 3600)).padStart(2, '0');
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return h === '00' ? m + ':' + ss : h + ':' + m + ':' + ss;
}

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  draw();
}

function draw() {
  const w = canvas.getBoundingClientRect().width;
  const h = canvas.getBoundingClientRect().height;
  ctx.clearRect(0, 0, w, h);

  if (!center) {
    ctx.fillStyle = 'rgba(255,255,255,.35)';
    ctx.font = '14px Segoe UI';
    ctx.textAlign = 'center';
    ctx.fillText('Start tracking to see your position', w / 2, h / 2);
    return;
  }

  const cx = w / 2, cy = h / 2;

  let cellPx = 80;
  const niceSteps = [10, 25, 50, 100, 250, 500, 1000, 2500];
  const targetM = scaleMPerPx * cellPx;
  const stepM = niceSteps.reduce((a, b) => (Math.abs(b - targetM) < Math.abs(a - targetM) ? b : a));
  const stepPx = stepM / scaleMPerPx;

  ctx.strokeStyle = 'rgba(99,140,255,.12)';
  ctx.lineWidth = 1;
  const ox = cx % stepPx, oy = cy % stepPx;
  for (let x = ox; x < w; x += stepPx) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  for (let y = oy; y < h; y += stepPx) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }

  if (points.length > 1) {
    ctx.strokeStyle = '#4f8cff';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i < points.length; i++) {
      const d = toXY(points[i], center);
      const sx = cx + d.x / scaleMPerPx, sy = cy + d.y / scaleMPerPx;
      if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
    }
    ctx.stroke();
  }

  const last = points[points.length - 1];
  if (last) {
    const d = toXY(last, center);
    const px = cx + d.x / scaleMPerPx, py = cy + d.y / scaleMPerPx;
    const accR = Math.min((last.acc || 0) / scaleMPerPx, Math.max(w, h));
    if (accR > 4) {
      ctx.fillStyle = 'rgba(79,140,255,.12)';
      ctx.strokeStyle = 'rgba(79,140,255,.45)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(px, py, accR, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    ctx.fillStyle = '#22d3ee';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(px, py, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }

  $('map-hint').textContent =
    'Grid cell ~ ' + (stepM >= 1000 ? (stepM / 1000) + ' km' : stepM + ' m') + ' · scroll to zoom · drag to pan';
}

canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  scaleMPerPx *= e.deltaY > 0 ? 1.15 : 1 / 1.15;
  scaleMPerPx = Math.max(0.5, Math.min(5000, scaleMPerPx));
  draw();
}, { passive: false });

let dragFrom = null;
canvas.addEventListener('pointerdown', (e) => { dragFrom = { x: e.clientX, y: e.clientY }; });
window.addEventListener('pointermove', (e) => {
  if (!dragFrom || !center) return;
  const dx = e.clientX - dragFrom.x, dy = e.clientY - dragFrom.y;
  if (Math.abs(dx) + Math.abs(dy) < 2) return;
  dragFrom = { x: e.clientX, y: e.clientY };
  const rad = Math.PI / 180;
  center.lng -= (dx * scaleMPerPx) / (111320 * Math.cos(center.lat * rad));
  center.lat += (dy * scaleMPerPx) / 110540;
  draw();
});
window.addEventListener('pointerup', () => { dragFrom = null; });

// ---- geolocation -----------------------------------------------------------

function updateReadouts(p) {
  $('st-lat').textContent = p.lat.toFixed(5);
  $('st-lng').textContent = p.lng.toFixed(5);
  $('st-alt').textContent = p.alt == null ? '—' : Math.round(p.alt);
  $('pill-acc').textContent = '± ' + Math.round(p.acc) + ' m';
  const kmh = ((p.speed || 0) * 3.6);
  $('pill-speed').textContent = kmh.toFixed(1) + ' km/h';
  $('st-dist').textContent =
    totalDistance() >= 1000 ? (totalDistance() / 1000).toFixed(2) + ' km' : Math.round(totalDistance()) + ' m';
  $('st-points').textContent = points.length;
}

function onPos(pos) {
  const c = pos.coords;
  const p = {
    lat: c.latitude, lng: c.longitude,
    acc: c.accuracy == null ? 0 : c.accuracy,
    alt: c.altitude, speed: c.speed, t: Date.now(),
  };

  if (!tracking) {
    points = [p];
    center = { lat: p.lat, lng: p.lng };
    scaleMPerPx = Math.max(1, p.acc / 40);
    updateReadouts(p); draw();
    return;
  }

  const last = points[points.length - 1];
  if (last && haversine(last, p) < 0.5 && p.acc > 50) return; // GPS jitter guard
  if (points.length >= MAX_POINTS) points.shift();
  points.push(p);
  updateReadouts(p); draw();
}

function onErr(err) {
  const msgs = {
    1: 'Permission denied — allow location access and retry.',
    2: 'Position unavailable — are you indoors?',
    3: 'Timeout — weak GPS signal.',
  };
  toast(msgs[err.code] || err.message, 3500);
  stopTracking();
}

function startTracking() {
  if (!('geolocation' in navigator)) { toast('Geolocation not supported in this browser.'); return; }
  tracking = true;
  startT = Date.now();
  points = [];
  watchId = navigator.geolocation.watchPosition(onPos, onErr, {
    enableHighAccuracy: true, maximumAge: 1000, timeout: 15000,
  });
  $('btn-start').textContent = '⏸ Stop';
  $('btn-start').classList.remove('primary');
  $('btn-start').style.background = 'linear-gradient(90deg,#fb7185,#f43f5e)';
  ['btn-center', 'btn-share', 'btn-gpx', 'btn-clear'].forEach((id) => { $(id).disabled = false; });
  $('pill-status').textContent = '● live';
  $('pill-status').classList.add('live');
  const tick = setInterval(() => {
    if (!tracking) { clearInterval(tick); return; }
    $('st-time').textContent = fmtTime(Date.now() - startT);
  }, 500);
}

function stopTracking() {
  tracking = false;
  if (watchId != null) { navigator.geolocation.clearWatch(watchId); watchId = null; }
  $('btn-start').textContent = '▶ Start tracking';
  $('btn-start').classList.add('primary');
  $('btn-start').style.background = '';
  $('pill-status').textContent = '● idle';
  $('pill-status').classList.remove('live');
}

// ---- exports & actions -----------------------------------------------------

function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

function exportGpx() {
  if (points.length === 0) return;
  const pts = points.map((p) =>
    '      <trkpt lat="' + p.lat + '" lng="' + p.lng + '">' +
    (p.alt != null ? '<ele>' + p.alt + '</ele>' : '') +
    '<time>' + new Date(p.t).toISOString() + '</time></trkpt>'
  ).join('\n');
  const gpx =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<gpx version="1.1" creator="PathPulse" xmlns="http://www.topografix.com/GPX/1/1">\n' +
    '  <trk><name>PathPulse track ' + new Date().toISOString().slice(0, 10) + '</name>\n' +
    '    <trkseg>\n' + pts + '\n    </trkseg>\n  </trk>\n</gpx>';
  download('pathpulse-' + Date.now() + '.gpx', gpx, 'application/gpx+xml');
  toast('GPX exported (' + points.length + ' points)');
}

function sharePin() {
  const last = points[points.length - 1];
  if (!last) return;
  const url = 'https://www.google.com/maps?q=' + last.lat + ',' + last.lng;
  if (navigator.share) {
    navigator.share({ title: 'My location', url }).catch(() => {});
  } else {
    navigator.clipboard.writeText(url).then(() => toast('Google Maps link copied!'));
  }
}

$('btn-start').addEventListener('click', () => (tracking ? stopTracking() : startTracking()));
$('btn-center').addEventListener('click', () => {
  const last = points[points.length - 1];
  if (last) { center = { lat: last.lat, lng: last.lng }; draw(); }
});
$('btn-share').addEventListener('click', sharePin);
$('btn-gpx').addEventListener('click', exportGpx);
$('btn-clear').addEventListener('click', () => {
  points = []; startT = null;
  ['st-dist', 'st-points', 'st-time'].forEach((id) => { $(id).textContent = id === 'st-dist' ? '0 m' : id === 'st-time' ? '00:00' : '0'; });
  draw(); toast('Track cleared');
});

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// restore last session preview (positions only, never uploaded anywhere)
try {
  const saved = JSON.parse(localStorage.getItem('pathpulse_last') || 'null');
} catch (_) { /* ignore */ }

const _origStop = stopTracking;
stopTracking = function () {
  try { localStorage.setItem('pathpulse_last', JSON.stringify(points.slice(-200))); } catch (_) {}
  _origStop();
};
