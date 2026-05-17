const MAX_HISTORY_POINTS = 20;
const EARTH_RADIUS_METERS = 6371000;

const startButton = document.getElementById('startTracking');
const stopButton = document.getElementById('stopTracking');
const statusText = document.getElementById('statusText');
const latitudeEl = document.getElementById('latitude');
const longitudeEl = document.getElementById('longitude');
const accuracyEl = document.getElementById('accuracy');
const speedEl = document.getElementById('speed');
const updatedAtEl = document.getElementById('updatedAt');
const shareLink = document.getElementById('shareLink');
const historyList = document.getElementById('historyList');

let watchId = null;
let lastPosition = null;
const historyTrail = [];

function formatNumber(value, digits = 6) {
  return Number.isFinite(value) ? value.toFixed(digits) : '—';
}

function calculateSpeedMetersPerSecond(currentPosition) {
  if (Number.isFinite(currentPosition.coords.speed)) {
    return currentPosition.coords.speed;
  }

  if (!lastPosition) {
    return null;
  }

  const timeDeltaSeconds =
    (currentPosition.timestamp - lastPosition.timestamp) / 1000;

  if (timeDeltaSeconds <= 0.1) {
    return null;
  }

  const toRadians = (degrees) => (degrees * Math.PI) / 180;

  const lat1 = toRadians(lastPosition.coords.latitude);
  const lat2 = toRadians(currentPosition.coords.latitude);
  const deltaLat = lat2 - lat1;
  const deltaLon =
    toRadians(currentPosition.coords.longitude - lastPosition.coords.longitude);

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distanceMeters = EARTH_RADIUS_METERS * c;

  return distanceMeters / timeDeltaSeconds;
}

function updateShareLink(latitude, longitude) {
  const mapsUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
  shareLink.href = mapsUrl;
  shareLink.textContent = mapsUrl;
}

function appendHistoryPoint(position, speedMps) {
  const point = {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy,
    speedMps,
    timestamp: position.timestamp,
  };
  historyTrail.unshift(point);

  const li = document.createElement('li');
  const mapsUrl = `https://www.google.com/maps?q=${point.latitude},${point.longitude}`;
  const speedText = Number.isFinite(point.speedMps)
    ? `${point.speedMps.toFixed(2)} m/s (${(point.speedMps * 3.6).toFixed(2)} km/h)`
    : 'Unavailable';
  const details = document.createTextNode(
    `${new Date(point.timestamp).toLocaleTimeString()} — ` +
      `Lat: ${point.latitude.toFixed(6)}, Lng: ${point.longitude.toFixed(6)}, ` +
      `Accuracy: ±${point.accuracy.toFixed(1)} m, Speed: ${speedText} (`
  );
  const mapLink = document.createElement('a');
  mapLink.href = mapsUrl;
  mapLink.target = '_blank';
  mapLink.rel = 'noopener noreferrer';
  mapLink.textContent = 'Open in Google Maps';

  li.appendChild(details);
  li.appendChild(mapLink);
  li.appendChild(document.createTextNode(')'));
  historyList.prepend(li);

  if (historyTrail.length > MAX_HISTORY_POINTS) {
    historyTrail.length = MAX_HISTORY_POINTS;
    if (historyList.lastElementChild) {
      historyList.removeChild(historyList.lastElementChild);
    }
  }
}

function onLocationSuccess(position) {
  const speedMps = calculateSpeedMetersPerSecond(position);

  statusText.textContent = 'Tracking';
  latitudeEl.textContent = formatNumber(position.coords.latitude);
  longitudeEl.textContent = formatNumber(position.coords.longitude);
  accuracyEl.textContent = Number.isFinite(position.coords.accuracy)
    ? `±${position.coords.accuracy.toFixed(1)} m`
    : '—';
  speedEl.textContent = Number.isFinite(speedMps)
    ? `${speedMps.toFixed(2)} m/s (${(speedMps * 3.6).toFixed(2)} km/h)`
    : 'Unavailable';
  updatedAtEl.textContent = new Date(position.timestamp).toLocaleString();

  updateShareLink(position.coords.latitude, position.coords.longitude);
  appendHistoryPoint(position, speedMps);
  lastPosition = position;
}

function onLocationError(error) {
  statusText.textContent = `Error (${error.code}): ${error.message}`;
}

function startTracking() {
  if (!('geolocation' in navigator)) {
    statusText.textContent = 'Geolocation is not supported in this browser.';
    return;
  }

  if (watchId !== null) {
    return;
  }

  statusText.textContent = 'Requesting location permission...';
  watchId = navigator.geolocation.watchPosition(onLocationSuccess, onLocationError, {
    enableHighAccuracy: true,
    maximumAge: 0,
    timeout: 15000,
  });

  startButton.disabled = true;
  stopButton.disabled = false;
}

function stopTracking() {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }

  statusText.textContent = 'Tracking stopped';
  startButton.disabled = false;
  stopButton.disabled = true;
}

startButton.addEventListener('click', startTracking);
stopButton.addEventListener('click', stopTracking);
