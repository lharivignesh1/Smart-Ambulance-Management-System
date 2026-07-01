 import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import {
  getFirestore, collection, getDocs, doc, setDoc, getDoc,
  deleteDoc, addDoc, onSnapshot, query, where,
  orderBy, updateDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword }
  from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";

/* ══════════════════════════════════════════
   FIREBASE CONFIG
══════════════════════════════════════════ */
const firebaseConfig = {
  apiKey: "AIzaSyCZid_xj0dIbcfwm8FkJ1tZi1jU7SS0tUM",
  authDomain: "ambulance-app-14fc3.firebaseapp.com",
  projectId: "ambulance-app-14fc3",
  storageBucket: "ambulance-app-14fc3.firebasestorage.app",
  messagingSenderId: "1089374242864",
  appId: "1:1089374242864:web:3e143bfe68052717a0c5f5"
};

const app  = initializeApp(firebaseConfig);
const db   = getFirestore(app);
const auth = getAuth(app);

/* ══════════════════════════════════════════
   DOM REFS
══════════════════════════════════════════ */
const hospitalAuth         = document.getElementById("hospitalAuth");
const hospitalForm         = document.getElementById("hospitalForm");
const driverPanel          = document.getElementById("driverPanel");
const backBtn              = document.getElementById("backBtn");
const email                = document.getElementById("email");
const password             = document.getElementById("password");
const hname                = document.getElementById("hname");
const beds                 = document.getElementById("beds");
const icu                  = document.getElementById("icu");
const specialists          = document.getElementById("specialists");
const locationOptions      = document.getElementById("locationOptions");
const manualInput          = document.getElementById("manualInput");
const manualLat            = document.getElementById("manualLat");
const manualLng            = document.getElementById("manualLng");
const hospitalLocationText = document.getElementById("hospitalLocationText");
const locationText         = document.getElementById("locationText");
const hospitalList         = document.getElementById("hospitalList");

/* ══════════════════════════════════════════
   STATE
══════════════════════════════════════════ */
let currentUser           = null;
let currentHospitalData   = null;
let userLat               = 0;
let userLng               = 0;
let map                   = null;
let selectedMarker        = null;
let ambulanceMarker       = null;
let routeLine             = null;
let animationTimeout      = null;
let userMarker            = null;
let allHospitals          = [];
let selectedEmergencyType = 'General';
let sosInterval           = null;
let alertsUnsubscribe     = null;

/* ══════════════════════════════════════════
   PARTICLE BACKGROUND
══════════════════════════════════════════ */
(function () {
  const c   = document.getElementById('canvas-bg');
  const ctx = c.getContext('2d');
  let W, H, particles = [];

  function resize() {
    W = c.width  = window.innerWidth;
    H = c.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  for (let i = 0; i < 60; i++) {
    particles.push({
      x:  Math.random() * W,
      y:  Math.random() * H,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      r:  Math.random() * 2 + 0.5,
      o:  Math.random() * 0.5 + 0.2
    });
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    particles.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0,245,212,${p.o})`;
      ctx.fill();
    });
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx   = particles[i].x - particles[j].x;
        const dy   = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 100) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(0,245,212,${0.08 * (1 - dist / 100)})`;
          ctx.lineWidth   = 0.5;
          ctx.stroke();
        }
      }
    }
    requestAnimationFrame(draw);
  }
  draw();
})();

/* ══════════════════════════════════════════
   TOAST
══════════════════════════════════════════ */
function toast(msg, isError = false) {
  const t = document.getElementById('toast');
  t.textContent       = msg;
  t.style.background  = isError ? '#2a0a0a' : '#0a2a1e';
  t.style.borderColor = isError ? '#e63946' : '#52b788';
  t.style.color       = isError ? '#e63946' : '#52b788';
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3500);
}

/* ══════════════════════════════════════════
   HERO — LIVE HOSPITAL COUNT
══════════════════════════════════════════ */
async function loadHospitalCount() {
  try {
    const snap = await getDocs(collection(db, "hospitals"));
    document.getElementById('stat-count').textContent = snap.size;
  } catch (e) {
    document.getElementById('stat-count').textContent = '?';
  }
}
loadHospitalCount();

/* ══════════════════════════════════════════
   BACK
══════════════════════════════════════════ */
window.goBack = function () {
  if (alertsUnsubscribe) { alertsUnsubscribe(); alertsUnsubscribe = null; }

  document.body.classList.add('fade-out');
  setTimeout(() => {
    document.getElementById('heroSection').style.display  = 'flex';
    hospitalAuth.style.display   = 'none';
    hospitalForm.style.display   = 'none';
    driverPanel.style.display    = 'none';
    backBtn.style.display        = 'none';
    document.getElementById('driverAmbulance').style.display  = 'none';
    document.getElementById('etaBox').style.display           = 'none';
    document.getElementById('dispatchTimeline').style.display = 'none';
    document.getElementById('etaTimeNum').textContent         = '—';
    hospitalList.innerHTML = '';
    locationText.innerHTML = '';
    if (map) { map.remove(); map = null; }
    routeLine = selectedMarker = ambulanceMarker = null;
    if (animationTimeout) clearTimeout(animationTimeout);
    document.body.classList.remove('fade-out');
    document.body.classList.add('fade-in');
    setTimeout(() => document.body.classList.remove('fade-in'), 400);
  }, 400);
};

/* ══════════════════════════════════════════
   ROLE SELECTION
══════════════════════════════════════════ */
window.selectRole = function (role) {
  document.getElementById('heroSection').style.display = 'none';
  backBtn.style.display = 'inline-block';
  document.getElementById('driverAmbulance').style.display = 'none';

  if (role === 'hospital') {
    hospitalAuth.style.display = 'block';
    driverPanel.style.display  = 'none';
  } else {
    driverPanel.style.display  = 'block';
    hospitalAuth.style.display = 'none';
    document.getElementById('driverAmbulance').style.display = 'block';
  }
};

/* ══════════════════════════════════════════
   AUTH
══════════════════════════════════════════ */
window.signup = async function () {
  try {
    const u = await createUserWithEmailAndPassword(auth, email.value, password.value);
    currentUser = u.user;
    hospitalAuth.style.display = 'none';
    hospitalForm.style.display = 'block';
    await loadHospitalData();
    startAlertListener();
    toast('✅ Account created!');
  } catch (e) {
    if (e.code === 'auth/email-already-in-use') toast('Email already exists. Login instead.', true);
    else toast(e.message, true);
  }
};

window.login = async function () {
  try {
    const u = await signInWithEmailAndPassword(auth, email.value, password.value);
    currentUser = u.user;
    hospitalAuth.style.display = 'none';
    hospitalForm.style.display = 'block';
    await loadHospitalData();
    startAlertListener();
    toast('✅ Logged in!');
  } catch {
    toast('❌ Invalid login', true);
  }
};

/* ══════════════════════════════════════════
   SERVICE PILLS
══════════════════════════════════════════ */
function getServicePills() {
  const ids = ['trauma', 'cardio', 'burn', 'peds', 'neuro', 'ortho'];
  return ids.filter(id => document.getElementById('svc-' + id)?.classList.contains('active'));
}

function setServicePills(arr = []) {
  const ids = ['trauma', 'cardio', 'burn', 'peds', 'neuro', 'ortho'];
  ids.forEach(id => {
    const el = document.getElementById('svc-' + id);
    if (!el) return;
    if (arr.includes(id)) el.classList.add('active');
    else el.classList.remove('active');
    el.onclick = () => el.classList.toggle('active');
  });
}
setServicePills();

/* ══════════════════════════════════════════
   HOSPITAL DATA
══════════════════════════════════════════ */
async function loadHospitalData() {
  const snap = await getDoc(doc(db, "hospitals", currentUser.uid));
  specialists.innerHTML = '';
  if (snap.exists()) {
    const d = snap.data();
    currentHospitalData = d;
    hname.value = d.name || '';
    beds.value  = d.beds || '';
    icu.value   = d.icu  || '';
    document.getElementById('phone').value = d.phone || '';
    if (d.availStatus) document.getElementById('availStatus').value = d.availStatus;
    if (d.specialists) d.specialists.forEach(s => addSpecialistRow(s.name, s.field));
    setServicePills(d.services || []);
    userLat = d.lat || 0;
    userLng = d.lng || 0;
    if (userLat) hospitalLocationText.innerText = `📍 ${userLat.toFixed(4)}, ${userLng.toFixed(4)}`;
  }
}

function addSpecialistRow(name = '', field = '') {
  const div = document.createElement('div');
  div.className = 'spec-item';
  div.innerHTML = `
    <input class="docName"  value="${name}"  placeholder="Doctor Name"    style="margin:0">
    <input class="docField" value="${field}" placeholder="Specialization" style="margin:0">
    <button onclick="this.parentElement.remove()" class="btn-red btn-sm" style="margin:0;padding:7px 10px">✕</button>
  `;
  specialists.appendChild(div);
}
window.addSpecialist = () => addSpecialistRow();

window.saveHospital = async function () {
  if (!hname.value) { toast('Enter hospital name!', true); return; }
  hospitalLocationText.innerHTML = '⏳ Saving...';

  const docNames  = document.getElementsByClassName('docName');
  const docFields = document.getElementsByClassName('docField');
  const specialistsArr = [];
  for (let i = 0; i < docNames.length; i++) {
    if (docNames[i].value || docFields[i].value) {
      specialistsArr.push({ name: docNames[i].value || 'NIL', field: docFields[i].value || 'NIL' });
    }
  }

  const data = {
    name:        hname.value,
    beds:        Number(beds.value) || 0,
    icu:         Number(icu.value)  || 0,
    specialists: specialistsArr,
    lat:         userLat,
    lng:         userLng,
    phone:       document.getElementById('phone').value || '',
    availStatus: document.getElementById('availStatus').value || 'available',
    services:    getServicePills()
  };
  await setDoc(doc(db, "hospitals", currentUser.uid), data);
  currentHospitalData = data;
  hospitalLocationText.innerHTML = '';
  toast('✅ Hospital data saved!');
};

window.deleteHospital = async function () {
  await deleteDoc(doc(db, "hospitals", currentUser.uid));
  toast('🗑 Hospital deleted', true);
};

/* ══════════════════════════════════════════
   LOCATION — HOSPITAL FORM
══════════════════════════════════════════ */
window.openLocationOptions = () => locationOptions.style.display = 'block';
window.manualLocation      = () => manualInput.style.display     = 'block';

window.autoLocation = function () {
  navigator.geolocation.getCurrentPosition(
    pos => {
      userLat = pos.coords.latitude;
      userLng = pos.coords.longitude;
      hospitalLocationText.innerText = `📍 Auto: ${userLat.toFixed(4)}, ${userLng.toFixed(4)}`;
      toast('📍 Location detected!');
    },
    () => toast('❌ Location permission denied', true)
  );
};

window.saveManualLocation = function () {
  userLat = parseFloat(manualLat.value);
  userLng = parseFloat(manualLng.value);
  hospitalLocationText.innerText = `📍 Manual: ${userLat}, ${userLng}`;
  toast('📍 Location saved!');
};

/* ══════════════════════════════════════════
   DISTANCE
══════════════════════════════════════════ */
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

/* ══════════════════════════════════════════
   MAP
══════════════════════════════════════════ */
function initMap(lat, lng) {
  if (map) map.remove();
  map = L.map('map').setView([lat, lng], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png').addTo(map);
  const carIcon = L.icon({ iconUrl: 'https://cdn-icons-png.flaticon.com/512/684/684908.png', iconSize: [45, 45], iconAnchor: [22, 22] });
  if (userMarker) map.removeLayer(userMarker);
  userMarker = L.marker([lat, lng], { icon: carIcon }).addTo(map).bindPopup('🚗 Your Location').openPopup();
}

/* ══════════════════════════════════════════
   WEATHER
══════════════════════════════════════════ */
async function fetchWeather(lat, lng) {
  try {
    const res  = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true&hourly=visibility`);
    const data = await res.json();
    const w    = data.current_weather;
    const icons = { 0:'☀️',1:'🌤',2:'⛅',3:'☁️',45:'🌫',48:'🌫',61:'🌧',63:'🌧',80:'🌦',95:'⛈' };
    document.getElementById('weatherIcon').textContent  = icons[w.weathercode] || '🌡';
    document.getElementById('weatherTemp').textContent  = `${w.temperature}°C`;
    document.getElementById('weatherDesc').textContent  = `Wind: ${w.windspeed} km/h`;
    const visib = data.hourly?.visibility?.[0];
    document.getElementById('weatherVisib').textContent = visib ? `${(visib / 1000).toFixed(1)} km` : '—';
    document.getElementById('weatherWidget').style.display = 'flex';
  } catch (e) {}
}

/* ══════════════════════════════════════════
   DRIVER — GET LOCATION
══════════════════════════════════════════ */
window.getLocation = function () {
  locationText.innerHTML = '⏳ Detecting location...';
  navigator.geolocation.getCurrentPosition(
    pos => {
      userLat = pos.coords.latitude;
      userLng = pos.coords.longitude;
      locationText.innerHTML = `📍 ${userLat.toFixed(5)}, ${userLng.toFixed(5)}`;
      initMap(userLat, userLng);
      loadHospitals();
      fetchWeather(userLat, userLng);
    },
    () => toast('❌ Location denied', true)
  );
};

/* ══════════════════════════════════════════
   EMERGENCY TYPE
══════════════════════════════════════════ */
window.selectEmergency = function (el) {
  document.querySelectorAll('.etype-pill').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
  selectedEmergencyType = el.textContent.replace(/[^\w ]/g, '').trim();
};

/* ══════════════════════════════════════════
   SHOW ROUTE
══════════════════════════════════════════ */
window.showRoute = async function (lat, lng, name) {
  if (!map) return;
  if (routeLine)        map.removeLayer(routeLine);
  if (selectedMarker)   map.removeLayer(selectedMarker);
  if (animationTimeout) clearTimeout(animationTimeout);

  try {
    const res   = await fetch(`https://router.project-osrm.org/route/v1/driving/${userLng},${userLat};${lng},${lat}?overview=full&geometries=geojson`);
    const data  = await res.json();
    const route = data.routes[0];
    const routePath  = route.geometry.coordinates.map(c => [c[1], c[0]]);
    const etaMinutes = Math.round(route.duration / 60);
    const distKm     = (route.distance / 1000).toFixed(1);

    document.getElementById('etaTimeNum').textContent = `${etaMinutes} min`;
    document.getElementById('etaDest').textContent    = `To ${name} · ${distKm} km`;
    document.getElementById('etaBox').style.display   = 'block';

    routeLine = L.polyline(routePath, { color: '#e63946', weight: 5, opacity: 0.85 }).addTo(map);
    map.fitBounds(routeLine.getBounds());

    const selIcon = L.icon({ iconUrl: 'https://cdn-icons-png.flaticon.com/512/2966/2966327.png', iconSize: [50, 50] });
    selectedMarker = L.marker([lat, lng], { icon: selIcon }).addTo(map).bindPopup(`🏥 ${name}`).openPopup();

    animateAmbulance(routePath);
    highlightCard(lat, lng);
    startDispatchTimeline(name, etaMinutes);
    toast(`Route to ${name} loaded!`);
  } catch (e) {
    toast('❌ Route failed', true);
  }
};

/* ══════════════════════════════════════════
   DISPATCH TIMELINE
══════════════════════════════════════════ */
function startDispatchTimeline(hospName, eta) {
  document.getElementById('dispatchTimeline').style.display = 'block';
  const items = document.getElementById('timelineItems');
  const now   = new Date();
  const fmt   = d => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const add   = t => fmt(new Date(now.getTime() + t * 60000));
  items.innerHTML = `
    <div class="tl-item done">
      <div class="tl-time">${fmt(now)}</div>
      <div class="tl-text">📍 Location detected · Request sent</div>
    </div>
    <div class="tl-item active">
      <div class="tl-time">${add(1)}</div>
      <div class="tl-text">🚑 Ambulance dispatched to your location</div>
    </div>
    <div class="tl-item">
      <div class="tl-time">${add(Math.round(eta * 0.5))}</div>
      <div class="tl-text">🚧 En route to ${hospName}</div>
    </div>
    <div class="tl-item">
      <div class="tl-time">${add(eta)}</div>
      <div class="tl-text">🏥 Estimated arrival at ${hospName}</div>
    </div>
  `;
}

/* ══════════════════════════════════════════
   HIGHLIGHT CARD
══════════════════════════════════════════ */
function highlightCard(lat, lng) {
  document.querySelectorAll('.hosp-card').forEach(c => {
    c.style.border    = '1px solid rgba(0,245,212,0.25)';
    c.style.boxShadow = 'none';
  });
  const sel = document.querySelector(`[data-lat='${lat}'][data-lng='${lng}']`);
  if (sel) {
    sel.style.border    = '2px solid var(--red)';
    sel.style.boxShadow = '0 0 20px rgba(230,57,70,0.3)';
    sel.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

/* ══════════════════════════════════════════
   AVAILABILITY HELPERS
══════════════════════════════════════════ */
function availColor(s) {
  return { available:'#52b788', limited:'#f4a261', full:'#e63946', emergency_only:'#9d4edd' }[s] || '#52b788';
}
function availLabel(s) {
  return { available:'Available', limited:'Limited', full:'Full', emergency_only:'Emergency Only' }[s] || 'Available';
}

/* ══════════════════════════════════════════
   LOAD & RENDER HOSPITALS
══════════════════════════════════════════ */
async function loadHospitals() {
  hospitalList.innerHTML = '<p style="color:var(--muted);text-align:center;padding:20px">⏳ Loading hospitals...</p>';
  const snap = await getDocs(collection(db, "hospitals"));
  allHospitals = [];
  snap.forEach(d => {
    const data = d.data();
    data._id = d.id;
    if (data.lat && data.lng) {
      data.distance = getDistance(userLat, userLng, data.lat, data.lng);
      allHospitals.push(data);
    }
  });
  allHospitals.sort((a, b) => a.distance - b.distance);
  renderHospitals(allHospitals);
}

function renderHospitals(arr) {
  hospitalList.innerHTML = '';
  if (!arr.length) {
    hospitalList.innerHTML = '<p style="color:var(--muted);text-align:center;padding:20px">No hospitals found.</p>';
    return;
  }
  arr.forEach((d, i) => {
    const spec = d.specialists
      ?.map(s => `<span style="font-size:12px;background:rgba(0,245,212,0.1);border:1px solid var(--border);padding:2px 8px;border-radius:8px;margin:2px">👨‍⚕️ ${s.name} · ${s.field}</span>`)
      .join('') || '';
    const svcBadges = (d.services || [])
      .map(s => `<span style="font-size:11px;background:rgba(255,255,255,0.06);padding:2px 7px;border-radius:6px;color:var(--muted)">✦ ${s}</span>`)
      .join('');
    const color    = availColor(d.availStatus);
    const avBedPct = d.beds ? Math.min(100, Math.round((Number(d.icu || 0) / Math.max(1, Number(d.beds))) * 100)) : 0;
    const icuBadge  = d.icu > 0 ? `<span class="hosp-badge badge-icu">ICU: ${d.icu}</span>` : '';
    const nearBadge = i === 0   ? `<span class="hosp-badge badge-nearest">🏆 Nearest</span>` : '';
    const callBtn   = d.phone   ? `<button class="btn-sm" onclick="event.stopPropagation();window.open('tel:${d.phone}')" style="background:rgba(82,183,136,0.2);border:1px solid #52b788;color:#52b788">📞 Call</button>` : '';

    const card = document.createElement('div');
    card.className = 'hosp-card';
    card.setAttribute('data-lat',   d.lat);
    card.setAttribute('data-lng',   d.lng);
    card.setAttribute('data-avail', d.availStatus || 'available');
    card.setAttribute('data-beds',  d.beds || 0);
    card.onclick = () => window.showRoute(d.lat, d.lng, d.name);
    card.innerHTML = `
      <div class="hosp-card-header">
        <div class="hosp-name">${d.name || 'Unknown'}</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">${nearBadge}${icuBadge}</div>
      </div>
      <div class="hosp-meta">
        <div class="hosp-meta-item">📍 <strong>${d.distance.toFixed(2)} km</strong></div>
        <div class="hosp-meta-item">🛏 Beds: <strong>${d.beds || 0}</strong></div>
        <div class="hosp-meta-item">🔬 ICU: <strong>${d.icu || 0}</strong></div>
        <div class="hosp-meta-item" style="color:${color}">● ${availLabel(d.availStatus)}</div>
      </div>
      <div class="avail-bar"><div class="avail-fill" style="width:${avBedPct}%;background:${color}"></div></div>
      ${spec      ? `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:10px">${spec}</div>` : ''}
      ${svcBadges ? `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:8px">${svcBadges}</div>` : ''}
      <div class="hosp-actions">
        <button class="btn-sm btn-cyan"  onclick="event.stopPropagation();window.showRoute(${d.lat},${d.lng},'${(d.name||'').replace(/'/g,"\\'")}')">🗺 Route</button>
        <button class="btn-sm btn-green" onclick="event.stopPropagation();window.navigate(${d.lat},${d.lng})">🧭 Navigate</button>
        ${callBtn}
      </div>
    `;
    hospitalList.appendChild(card);

    const hIcon = L.icon({ iconUrl: 'https://cdn-icons-png.flaticon.com/512/2966/2966327.png', iconSize: [36, 36] });
    L.marker([d.lat, d.lng], { icon: hIcon }).addTo(map)
      .bindPopup(`<b>${d.name}</b><br>🛏 ${d.beds} | ICU: ${d.icu}<br>● ${availLabel(d.availStatus)}`);
  });
}

/* ══════════════════════════════════════════
   FILTER
══════════════════════════════════════════ */
window.filterHospitals = function (type) {
  document.querySelectorAll('[id^="f-"]').forEach(b => b.classList.remove('active-filter'));
  document.getElementById('f-' + type)?.classList.add('active-filter');
  let filtered = [...allHospitals];
  if (type === 'icu')            filtered = filtered.filter(h => Number(h.icu) > 0);
  else if (type === 'available') filtered = filtered.filter(h => h.availStatus === 'available' || !h.availStatus);
  else if (type === 'nearest')   filtered = filtered.slice(0, 3);
  renderHospitals(filtered);
};

/* ══════════════════════════════════════════
   AMBULANCE ANIMATION
══════════════════════════════════════════ */
function animateAmbulance(path) {
  if (ambulanceMarker) map.removeLayer(ambulanceMarker);
  const aIcon = L.icon({ iconUrl: 'ambulance.png', iconSize: [40, 40] });
  ambulanceMarker = L.marker(path[0], { icon: aIcon }).addTo(map).bindPopup('🚑 Ambulance');
  let i = 0;
  function move() {
    if (i >= path.length) { ambulanceMarker.bindPopup('🏥 Arrived!').openPopup(); return; }
    ambulanceMarker.setLatLng(path[i]); i++;
    animationTimeout = setTimeout(move, 30);
  }
  move();
}

window.navigate = (lat, lng) => window.open(`https://www.google.com/maps?q=${lat},${lng}`);

/* ══════════════════════════════════════════════════════════════
   ████████████  REAL SOS ALERT SYSTEM  ████████████
   
   HOW IT WORKS:
   1. Driver presses SOS → 3 second countdown
   2. After countdown → writes alert document to Firestore
      collection "sos_alerts" targeting nearest 2 hospitals
   3. Hospital dashboard has onSnapshot() listener running
      → detects the new document instantly (< 1 second)
   4. Hospital sees popup + hears beep alert
   5. Hospital clicks Accept → status updated to "acknowledged"
   6. Hospital clicks Reject → status updated to "rejected"
   7. Inbox shows full history of all alerts
══════════════════════════════════════════════════════════════ */

/* ── SEND SOS TO FIREBASE ── */
async function sendSOSToFirebase() {
  if (!userLat || !userLng) {
    toast('❌ Get your location first!', true);
    return;
  }
  if (!allHospitals.length) {
    toast('❌ No hospitals loaded. Detect location first.', true);
    return;
  }

  // Target 2 nearest hospitals
  const targets = allHospitals.slice(0, 2);

  for (const hosp of targets) {
    await addDoc(collection(db, "sos_alerts"), {
      hospitalId:    hosp._id,
      hospitalName:  hosp.name,
      driverLat:     userLat,
      driverLng:     userLng,
      emergencyType: selectedEmergencyType,
      status:        "pending",
      timestamp:     serverTimestamp(),
      locationText:  `${userLat.toFixed(5)}, ${userLng.toFixed(5)}`
    });
  }

  toast(`🚨 SOS sent to ${targets.map(h => h.name).join(' & ')}!`);

  // Auto-route to nearest
  const nearest = allHospitals[0];
  window.showRoute(nearest.lat, nearest.lng, nearest.name);
}

/* ── SOS COUNTDOWN BUTTON ── */
window.triggerSOS = function () {
  if (!userLat || !userLng) {
    toast('❌ Detect your location first!', true);
    return;
  }
  const modal = document.getElementById('sosModal');
  modal.classList.add('active');
  let count = 3;
  document.getElementById('sosTimer').textContent = '0' + count;

  sosInterval = setInterval(async () => {
    count--;
    document.getElementById('sosTimer').textContent = count < 10 ? '0' + count : String(count);
    if (count <= 0) {
      clearInterval(sosInterval);
      modal.classList.remove('active');
      await sendSOSToFirebase();   // 🔥 REAL alert written to Firestore here
    }
  }, 1000);
};

window.cancelSOS = function () {
  clearInterval(sosInterval);
  document.getElementById('sosModal').classList.remove('active');
  toast('SOS cancelled.');
};

/* ══════════════════════════════════════════════════════════════
   HOSPITAL SIDE — REAL-TIME ALERT LISTENER
   Starts when hospital logs in.
   Uses onSnapshot() — fires every time a new "pending" alert
   is written for this hospital.
══════════════════════════════════════════════════════════════ */
function startAlertListener() {
  if (!currentUser) return;
  if (alertsUnsubscribe) alertsUnsubscribe();

  const alertsQuery = query(
    collection(db, "sos_alerts"),
    where("hospitalId", "==", currentUser.uid),
    where("status",     "==", "pending"),
    orderBy("timestamp", "desc")
  );

  alertsUnsubscribe = onSnapshot(alertsQuery, (snapshot) => {
    snapshot.docChanges().forEach(change => {
      if (change.type === "added") {
        // New incoming SOS → show popup + sound
        showAlertPopup(change.doc.data(), change.doc.id);
        updateAlertBadge();
      }
    });
    renderAlertInbox();
  });
}

/* ── ALERT POPUP (shown to hospital when SOS arrives) ── */
function showAlertPopup(alertData, alertId) {
  playAlertSound();

  // Remove any existing popup with same id
  document.getElementById('alertPopup_' + alertId)?.remove();

  const popup = document.createElement('div');
  popup.id = 'alertPopup_' + alertId;
  popup.style.cssText = `
    position:fixed; top:80px; right:20px; z-index:99999;
    background:#0a0f1e; border:2px solid #e63946;
    border-radius:18px; padding:24px 28px; max-width:340px; width:90%;
    animation:modal-in 0.3s ease;
    box-shadow: 0 0 40px rgba(230,57,70,0.4);
  `;
  popup.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">
      <span style="font-size:32px">🚨</span>
      <div>
        <div style="font-family:'Rajdhani',sans-serif;font-size:20px;font-weight:700;color:#e63946;letter-spacing:1px">INCOMING SOS</div>
        <div style="font-size:12px;color:rgba(232,244,248,0.55)">Emergency alert received now</div>
      </div>
      <button onclick="this.parentElement.parentElement.remove()"
        style="margin-left:auto;background:transparent;border:none;color:rgba(232,244,248,0.4);font-size:18px;cursor:pointer;padding:0">✕</button>
    </div>
    <div style="background:rgba(230,57,70,0.1);border:1px solid rgba(230,57,70,0.3);border-radius:10px;padding:12px;margin-bottom:14px">
      <div style="font-size:13px;margin-bottom:5px">🏷 Type: <strong style="color:#e63946">${alertData.emergencyType || 'General'}</strong></div>
      <div style="font-size:13px;margin-bottom:5px">📍 Driver: <strong style="color:#e8f4f8">${alertData.locationText}</strong></div>
      <div style="font-size:13px">🕐 <strong style="color:#e8f4f8">Just now</strong></div>
    </div>
    <div style="display:flex;gap:8px">
      <button onclick="acknowledgeAlert('${alertId}','${alertData.driverLat}','${alertData.driverLng}')"
        style="flex:1;background:linear-gradient(135deg,#2d6a4f,#1b4332);border:none;border-radius:10px;padding:11px;color:#fff;font-family:'Rajdhani',sans-serif;font-size:15px;font-weight:700;cursor:pointer;transition:all 0.2s">
        ✅ Accept
      </button>
      <button onclick="rejectAlert('${alertId}')"
        style="flex:1;background:linear-gradient(135deg,#e63946,#c1121f);border:none;border-radius:10px;padding:11px;color:#fff;font-family:'Rajdhani',sans-serif;font-size:15px;font-weight:700;cursor:pointer;transition:all 0.2s">
        ✕ Reject
      </button>
    </div>
  `;
  document.body.appendChild(popup);

  // Auto-dismiss after 60 seconds
  setTimeout(() => { if (popup.parentNode) popup.remove(); }, 60000);
}

/* ── ACCEPT ALERT ── */
window.acknowledgeAlert = async function (alertId, driverLat, driverLng) {
  try {
    await updateDoc(doc(db, "sos_alerts", alertId), { status: "acknowledged" });
    document.getElementById('alertPopup_' + alertId)?.remove();
    toast('✅ Alert accepted! Dispatching ambulance...');
    updateAlertBadge();
    renderAlertInbox();
    showDriverOnHospitalMap(parseFloat(driverLat), parseFloat(driverLng));
  } catch (e) {
    toast('Error updating alert', true);
  }
};

/* ── REJECT ALERT ── */
window.rejectAlert = async function (alertId) {
  try {
    await updateDoc(doc(db, "sos_alerts", alertId), { status: "rejected" });
    document.getElementById('alertPopup_' + alertId)?.remove();
    toast('Alert rejected.', true);
    updateAlertBadge();
    renderAlertInbox();
  } catch (e) {
    toast('Error updating alert', true);
  }
};

/* ── RENDER ALERT INBOX IN HOSPITAL DASHBOARD ── */
async function renderAlertInbox() {
  const inboxEl = document.getElementById('alertInbox');
  if (!inboxEl || !currentUser) return;

  try {
    const q    = query(collection(db, "sos_alerts"), where("hospitalId", "==", currentUser.uid), orderBy("timestamp", "desc"));
    const snap = await getDocs(q);

    if (snap.empty) {
      inboxEl.innerHTML = '<p style="color:rgba(232,244,248,0.55);font-size:13px;text-align:center;padding:10px">No alerts yet. They will appear here in real time.</p>';
      return;
    }

    inboxEl.innerHTML = '';
    snap.forEach(d => {
      const a   = d.data();
      const id  = d.id;
      const statusColor = { pending:'#f4a261', acknowledged:'#52b788', rejected:'#e63946' }[a.status] || '#888';
      const statusLabel = { pending:'⏳ Pending', acknowledged:'✅ Accepted', rejected:'✕ Rejected' }[a.status] || a.status;
      const time = a.timestamp?.toDate
        ? a.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : 'Just now';

      inboxEl.innerHTML += `
        <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(0,245,212,0.2);border-radius:12px;padding:12px 14px;margin-bottom:8px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
            <span style="font-family:'Rajdhani',sans-serif;font-size:16px;font-weight:700;color:#e63946">🚨 ${a.emergencyType || 'General'}</span>
            <span style="font-size:11px;padding:2px 8px;border-radius:8px;background:${statusColor}22;color:${statusColor};border:1px solid ${statusColor}">${statusLabel}</span>
          </div>
          <div style="font-size:12px;color:rgba(232,244,248,0.55);margin-bottom:8px">
            📍 ${a.locationText} &nbsp;·&nbsp; 🕐 ${time}
          </div>
          ${a.status === 'pending' ? `
            <div style="display:flex;gap:6px">
              <button onclick="acknowledgeAlert('${id}','${a.driverLat}','${a.driverLng}')"
                class="btn-green btn-sm" style="margin:0;flex:1">✅ Accept</button>
              <button onclick="rejectAlert('${id}')"
                class="btn-red btn-sm" style="margin:0;flex:1">✕ Reject</button>
            </div>
          ` : `
            <button onclick="window.open('https://www.google.com/maps?q=${a.driverLat},${a.driverLng}')"
              class="btn-cyan btn-sm" style="margin:0">🗺 View Driver on Maps</button>
          `}
        </div>
      `;
    });
  } catch (e) { console.warn('Inbox render error:', e); }
}

/* ── SHOW DRIVER LOCATION ON A MINI MAP IN HOSPITAL PANEL ── */
function showDriverOnHospitalMap(driverLat, driverLng) {
  const mapEl = document.getElementById('hospitalMiniMap');
  if (!mapEl) return;
  mapEl.style.display = 'block';

  if (window._hospMap) { window._hospMap.remove(); window._hospMap = null; }

  window._hospMap = L.map('hospitalMiniMap').setView([driverLat, driverLng], 14);
  L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png').addTo(window._hospMap);

  const dIcon = L.icon({ iconUrl: 'https://cdn-icons-png.flaticon.com/512/684/684908.png', iconSize: [40, 40] });
  L.marker([driverLat, driverLng], { icon: dIcon })
    .addTo(window._hospMap)
    .bindPopup('🚨 Patient / Driver Location')
    .openPopup();

  if (userLat && userLng) {
    const hIcon = L.icon({ iconUrl: 'https://cdn-icons-png.flaticon.com/512/2966/2966327.png', iconSize: [38, 38] });
    L.marker([userLat, userLng], { icon: hIcon }).addTo(window._hospMap).bindPopup('🏥 Your Hospital');

    fetch(`https://router.project-osrm.org/route/v1/driving/${userLng},${userLat};${driverLng},${driverLat}?overview=full&geometries=geojson`)
      .then(r => r.json())
      .then(data => {
        const path = data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
        const line = L.polyline(path, { color: '#e63946', weight: 4, opacity: 0.8 }).addTo(window._hospMap);
        window._hospMap.fitBounds(line.getBounds());
        const etaMin = Math.round(data.routes[0].duration / 60);
        toast(`🚑 Ambulance ETA to patient: ~${etaMin} min`);
      })
      .catch(() => {});
  }
}

/* ── UPDATE ALERT BADGE COUNT ── */
async function updateAlertBadge() {
  if (!currentUser) return;
  try {
    const q    = query(collection(db, "sos_alerts"), where("hospitalId", "==", currentUser.uid), where("status", "==", "pending"));
    const snap = await getDocs(q);
    const badge = document.getElementById('alertBadge');
    if (badge) {
      badge.textContent   = snap.size;
      badge.style.display = snap.size > 0 ? 'inline-flex' : 'none';
    }
  } catch (e) {}
}

/* ── ALERT BEEP SOUND (Web Audio API — no file needed) ── */
function playAlertSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.3, 0.6].forEach(delay => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      osc.type            = 'square';
      gain.gain.setValueAtTime(0.3, ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.25);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime  + delay + 0.25);
    });
  } catch (e) {}
}