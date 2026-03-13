/* =========================================================
   CONFIG
   ========================================================= */
const BASE_IMAGE_PUBLIC_URL = "./assets/map/base-public.webp"; // ligero (público)
const BASE_IMAGE_EDIT_URL   = "./assets/map/base.png";         // alta res (edición)

// Tus GeoJSON están guardados en coordenadas del mapa base.png (referencia histórica)
const DATA_COORD_WIDTH  = 11100;
const DATA_COORD_HEIGHT = 9250;

// Archivos de datos
const SECCIONES_TOP_URL = "./data/secciones-top.geojson"; // editor ?edit=secciones + PUBLICO secciones
const MANZANAS_URL      = "./data/secciones.geojson";     // MANZANAS
const NICHOS_ZONAS_URL  = "./data/nichos-zonas.geojson";  // zonas clickeables nichos

// Catálogos
const LOTES_INFO_URL    = "./data/lotes.json";
const PAQUETES_URL      = "./data/paquetes.json";

// Edit modes:
// ?edit=secciones  => EDITOR SECCIONES
// ?edit=manzanas   => EDITOR MANZANAS
// ?edit=lotes      => EDITOR LOTES
// ?edit=nichos     => EDITOR NICHOS
const editMode = new URLSearchParams(location.search).get("edit"); // null | "secciones" | "manzanas" | "lotes" | "nichos"
const isEditSecciones = editMode === "secciones";
const isEditManzanas  = editMode === "manzanas";
const isEditLotes     = editMode === "lotes";
const isEditNichos    = editMode === "nichos";
const IS_EDIT = !!editMode;

const BASE_IMAGE_URL = (isEditSecciones || isEditManzanas || isEditLotes || isEditNichos)
  ? BASE_IMAGE_EDIT_URL
  : BASE_IMAGE_PUBLIC_URL;

// Detectar móvil/tablet
const IS_MOBILE = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;

/* =========================================================
   UX: NOTIFICACIONES (sin pop-ups)
   - En index.html idealmente defines window.toast(msg)
   - Aquí usamos notify() en lugar de alert()
   - confirm() se mantiene para borrados/acciones críticas
   ========================================================= */
function notify(msg, ms = 1800){
  try {
    if (typeof window.toast === "function") return window.toast(msg, ms);
  } catch {}
  try { console.log("[INFO]", msg); } catch {}
}

/* =========================================================
   GLOBAL STATE
   ========================================================= */
let map;

let lotesInfo = {};
let paquetesInfo = {};

// RAW (coords base.png)
let seccionesTopRaw = null;   // SECCIONES
let manzanasRaw = null;       // MANZANAS
let nichosZonasRaw = null;    // NICHOS ZONAS

// Scaled a base actual (público)
let seccionesTopScaled = null; // SECCIONES escaladas
let manzanasScaled = null;     // MANZANAS escaladas
let lotesScaled = null;        // LOTES escalados
let nichosZonasScaled = null;  // NICHOS escaladas

let seccionesLayer = null;         // editor secciones
let seccionesLayerPublic = null;   // PUBLICO secciones
let manzanasLayer = null;          // público + editor manzanas
let lotesLayer = null;             // público + editor lotes
let nichosLayer = null;            // público nichos
let nichosLayerEdit = null;        // editor nichos

// Selección de nicho (modal)
let nichoSelection = { zonaId: null, cara: null, numero: null };

let currentSeccion = null;
let currentSeccionFeature = null;
let currentManzanaFeature = null;
let currentLotesRaw = null;
let currentLotesSeccion = null;      // editor LOTES: seccion cargada en memoria
let currentLotesSourceUrl = null;    // editor LOTES: fuente cargada

let showAllLots = false;

// escala data->imagen cargada (para público)
let COORD_SCALE_X = 1;
let COORD_SCALE_Y = 1;

// DOM
const $title = document.getElementById("panelTitle");
const $body  = document.getElementById("panelBody");

const $seccionSelect  = document.getElementById("sectionSelect");
const $manzanaSelect  = document.getElementById("manzanaSelect");

const $loteInput      = document.getElementById("searchInput");
const $searchBtn      = document.getElementById("searchBtn");
const $backBtn        = document.getElementById("backBtn");
const $toggleLotsBtn  = document.getElementById("toggleLotsBtn");

/* =========================================================
   HELPERS
   ========================================================= */
function setPanel(title, html){
  $title.textContent = title;
  $body.innerHTML = html;
}
function safe(v){ return (v === null || v === undefined) ? "" : String(v); }

async function loadJson(url){
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`No se pudo cargar: ${url}`);
  return await r.json();
}
function deepCopy(obj){ return JSON.parse(JSON.stringify(obj)); }

// CRS.Simple: lat=y, lng=x; GeoJSON: [x,y]=[lng,lat]
function xyToLatLng(xy){ return L.latLng(xy[1], xy[0]); }
function latLngToXY(ll){ return [ll.lng, ll.lat]; }

function distPixels(a,b){
  const dx = (a.lng - b.lng);
  const dy = (a.lat - b.lat);
  return Math.sqrt(dx*dx + dy*dy);
}

function isCircleFeature(f){
  return (
    f &&
    f.geometry &&
    f.geometry.type === "Point" &&
    f.properties &&
    f.properties.shape === "circle" &&
    typeof f.properties.radius === "number"
  );
}

function slugifySeccionPath(s){
  return (s || "")
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")  // quita acentos
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// Convención: data/lotes/<seccion_slug>/lotes.geojson
function getSharedLotesUrlForSeccion(seccion){
  const slug = slugifySeccionPath(seccion);
  return `./data/lotes/${slug}/lotes.geojson`;
}

// Decide qué archivo leer (compat: si manzana trae lotesFile, úsalo)
// Si NO trae lotesFile => usa el archivo compartido por sección
function getLotesUrlForManzana(manzanaFeature){
  const lf = (manzanaFeature?.properties?.lotesFile || "").toString().trim();
  if (lf) return lf;
  const sec = getPropSeccion(manzanaFeature);
  return getSharedLotesUrlForSeccion(sec);
}



// Color default para secciones
const DEFAULT_SECCION_COLOR = "#C9A227";
function getSeccionColor(feature){
  const c = feature?.properties?.color;
  if (typeof c === "string" && c.trim()) return c.trim();
  return DEFAULT_SECCION_COLOR;
}

/* =========================================================
   ROTACIÓN + IDs
   ========================================================= */
function degToRad(d){ return (d * Math.PI) / 180; }
function rotatePoint(x, y, deg){
  const r = degToRad(deg);
  const c = Math.cos(r);
  const s = Math.sin(r);
  return { x: x*c - y*s, y: x*s + y*c };
}



// IDs:
// - manzanas: A, B, C, ... Z, AA, AB...
// - lotes: 001, 002...
function numToLetters(n){ // 1->A, 2->B ... 26->Z, 27->AA...
  let out = "";
  while (n > 0){
    const r = (n - 1) % 26;
    out = String.fromCharCode(65 + r) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}
function lettersToNum(s){
  s = String(s || "").toUpperCase().trim();
  let n = 0;
  for (let i=0; i<s.length; i++){
    const c = s.charCodeAt(i) - 64; // A=1
    if (c < 1 || c > 26) return null;
    n = n * 26 + c;
  }
  return n;
}
function nextManzanaLetter(base, step){
  const n0 = lettersToNum(base);
  if (n0 === null) return `${base}-${step+1}`;
  return numToLetters(n0 + step);
}
function nextPaddedNumber(base, step, inc){
  const s = String(base || "").trim();
  const m = s.match(/^\d+$/);
  if (!m) return `${s}-${step+1}`;
  const pad = s.length;
  const n0 = Number(s);
  const val = n0 + step * (inc || 1);
  return String(val).padStart(pad, "0");
}

function makeRotatedRect(x0, y0, localX, localY, w, h, rotDeg){
  const corners = [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: h },
    { x: 0, y: h },
  ].map(pt => {
    const rotated = rotatePoint(pt.x + localX, pt.y + localY, rotDeg);
    return [x0 + rotated.x, y0 + rotated.y];
  });
  corners.push(corners[0]);
  return corners;
}

/* =========================================================
   COORD SCALE (solo para público: data->imagen cargada)
   ========================================================= */
function scaleCoordsRecursive(obj, sx, sy){
  if (Array.isArray(obj)){
    if (obj.length === 2 && typeof obj[0] === "number" && typeof obj[1] === "number"){
      const x = obj[0], y = obj[1];
      return [x * sx, y * sy];
    }
    return obj.map(v => scaleCoordsRecursive(v, sx, sy));
  }
  return obj;
}

function applyCoordScaleToGeoJSON(data, sx, sy){
  if (!data) return data;
  const radiusScale = (sx + sy) / 2;

  const scaleGeom = (geom) => {
    if (!geom || !geom.coordinates) return;
    geom.coordinates = scaleCoordsRecursive(geom.coordinates, sx, sy);
  };

  if (data.type === "FeatureCollection"){
    for (const f of (data.features || [])){
      if (f && f.geometry) scaleGeom(f.geometry);
      if (isCircleFeature(f) && typeof f.properties.radius === "number"){
        f.properties.radius = f.properties.radius * radiusScale;
      }
    }
  } else if (data.type === "Feature"){
    if (data.geometry) scaleGeom(data.geometry);
    if (isCircleFeature(data) && typeof data.properties.radius === "number"){
      data.properties.radius = data.properties.radius * radiusScale;
    }
  }
  return data;
}

/* =========================================================
   ANIMACIONES
   ========================================================= */
function flyToBoundsSmooth(bounds, durationSeconds, maxZoom = null){
  if (IS_MOBILE) {
    map.fitBounds(bounds, maxZoom !== null ? { maxZoom } : undefined);
    return;
  }
  try {
    map.flyToBounds(bounds, maxZoom !== null
      ? { animate: true, duration: durationSeconds, easeLinearity: 0.2, maxZoom }
      : { animate: true, duration: durationSeconds, easeLinearity: 0.2 }
    );
  } catch {
    map.fitBounds(bounds, maxZoom !== null ? { maxZoom } : undefined);
  }
}


// Para casos donde NO queremos hacer zoom (solo centrar)
function centerOnLayerNoZoom(layer, paddingPx = 0){
  try {
    const c = layer.getBounds ? layer.getBounds().getCenter() : (layer.getLatLng ? layer.getLatLng() : null);
    if (!c) return;
    if (paddingPx){
      // panInside intenta mantener el punto dentro de un margen
      try { map.panInside(c, { padding: [paddingPx, paddingPx] }); return; } catch {}
    }
    map.panTo(c);
  } catch {}
}

function pulseLayer(layer, baseStyle, pulseAdd){
  const ms = pulseAdd?.ms ?? 200;
  const weightAdd = pulseAdd?.weightAdd ?? 2;
  const fillAdd = pulseAdd?.fillAdd ?? 0.10;

  const pulseStyle = {
    ...baseStyle,
    weight: (baseStyle.weight ?? 1) + weightAdd,
    fillOpacity: Math.min(0.85, (baseStyle.fillOpacity ?? 0) + fillAdd)
  };

  try { layer.setStyle(pulseStyle); } catch {}
  setTimeout(() => {
    try { layer.setStyle(baseStyle); } catch {}
  }, ms);
}

/* =========================================================
   STYLES
   ========================================================= */
function hiddenStyle(){ return { weight: 2, opacity: 0, fillOpacity: 0 }; }

function hoverStyle(c){
  return {
    color: c || "#111827",
    weight: 2,
    opacity: 1,
    fillColor: c || "#111827",
    fillOpacity: 0.28
  };
}

function pinnedStyle(c){
  return {
    color: c || "#111827",
    weight: 3,
    opacity: 1,
    fillColor: c || "#111827",
    fillOpacity: 0.40
  };
}

// estilo selección múltiple (editor)
function multiSelectedStyle(){
  return {
    color: "#ef4444",
    weight: 3,
    opacity: 1,
    fillColor: "#ef4444",
    fillOpacity: 0.10,
    dashArray: "6 4"
  };
}

function styleByStatus(status){
  const s = (status || "").toLowerCase();
  if (s === "disponible") return { weight: 1, opacity: 1, fillOpacity: 0.30 };
  if (s === "ocupado")    return { weight: 1, opacity: 1, fillOpacity: 0.55 };
  if (s === "por construir") return { weight: 1, opacity: 1, dashArray: "4 4", fillOpacity: 0.20 };
  return { weight: 1, opacity: 1, fillOpacity: 0.25 };
}
function lotHiddenStyle(){ return { weight: 1, opacity: 0, fillOpacity: 0 }; }
function lotBaseStyle(status){ return showAllLots ? styleByStatus(status) : lotHiddenStyle(); }
function lotPinnedStyle(status){ const s = styleByStatus(status); return { ...s, weight: 2 }; }

function updateToggleLotsButton(){
  if (!$toggleLotsBtn) return;
  const enabled = !!currentManzanaFeature && !(isEditSecciones || isEditManzanas || isEditLotes || isEditNichos);
  $toggleLotsBtn.disabled = !enabled;
  $toggleLotsBtn.textContent = showAllLots ? "Ocultar lotes" : "Mostrar lotes";
}

/* =========================================================
   UI helpers (dropdowns)
   ========================================================= */
function getPropSeccion(f){
  return (f?.properties?.seccion || f?.properties?.id || "SIN-SECCION").toString().trim();
}
function getPropManzana(f){
  return (f?.properties?.manzana || f?.properties?.id || "").toString().trim();
}
function getPropNombre(f){
  return (f?.properties?.nombre || `${getPropSeccion(f)} - ${getPropManzana(f)}`).toString().trim();
}


// Editor LOTES: obtener filtros actuales desde UI
function getSelectedSeccion(){ return ($seccionSelect?.value || "").toString().trim(); }
function getSelectedManzana(){ return ($manzanaSelect?.value || "").toString().trim(); }

// Asegura contexto en lotes: seccion/manzana para poder copiar/pegar entre manzanas sin perder info
function ensureLoteContextProps(feature, seccion, manzana){
  if (!feature) return;
  if (!feature.properties) feature.properties = {};

  const sec = (seccion || feature.properties.seccion || getSelectedSeccion() || "").toString().trim();
  const man = (manzana || feature.properties.manzana || feature.properties.manzanaId || getSelectedManzana() || "").toString().trim();

  if (sec) feature.properties.seccion = sec;
  if (man){
    feature.properties.manzana = man;
    feature.properties.manzanaId = man;
  }
}

// Normaliza el dataset antes de copiar GeoJSON (para no perder manzana)
function normalizeLotesContext(fc){
  if (!fc || fc.type !== "FeatureCollection") return;
  const sec = getSelectedSeccion();
  const man = editor?.lotesFilterManzana || getSelectedManzana() || "";
  for (const f of (fc.features || [])){
    if (!f) continue;
    const hasMan = (f?.properties?.manzana || f?.properties?.manzanaId || "").toString().trim();
    const hasSec = (f?.properties?.seccion || "").toString().trim();
    ensureLoteContextProps(f, hasSec || sec, hasMan || (man || ""));
  }
}

function buildSeccionesList(features){
  const set = new Set();
  for (const f of features){ set.add(getPropSeccion(f)); }
  return Array.from(set).sort((a,b) => a.localeCompare(b, "es", { sensitivity:"base" }));
}

function buildManzanasListBySeccion(features, seccion){
  const out = [];
  for (const f of features){
    if (getPropSeccion(f) === seccion){ out.push(f); }
  }
  out.sort((fa, fb) => getPropManzana(fa).localeCompare(getPropManzana(fb), "es", { sensitivity:"base" }));
  return out;
}

function fillSeccionSelect(secciones){
  $seccionSelect.innerHTML = `<option value="">SECCIÓN...</option>`;
  for (const s of secciones){
    const opt = document.createElement("option");
    opt.value = s;
    opt.textContent = s;
    $seccionSelect.appendChild(opt);
  }
}

function fillManzanaSelect(manzanaFeatures){
  $manzanaSelect.innerHTML = `<option value="">MANZANA...</option>`;
  for (const f of manzanaFeatures){
    const m = getPropManzana(f);
    const n = getPropNombre(f);
    const opt = document.createElement("option");
    opt.value = m;
    opt.textContent = `${m} — ${n}`;
    $manzanaSelect.appendChild(opt);
  }
}

/* =========================================================
   Layer builders (polígono/círculo)
   ========================================================= */
function featureToLayerCircleAware(feature, latlng){
  if (isCircleFeature(feature)){
    const r = feature.properties.radius;
    return L.circle(latlng, { radius: r });
  }
  return L.circleMarker(latlng, { radius: 6, weight: 2, fillOpacity: 0.2 });
}

/* =========================================================
   Bounds helpers (círculos)
   ========================================================= */
function getBoundsForCircleFeature(feature, layer){
  const center = layer?.getLatLng ? layer.getLatLng() : xyToLatLng(feature.geometry.coordinates);
  const r = layer?.getRadius ? layer.getRadius() : feature.properties.radius;

  const sw = L.latLng(center.lat - r, center.lng - r);
  const ne = L.latLng(center.lat + r, center.lng + r);
  return L.latLngBounds(sw, ne);
}

function flyToManzanaFeature(feature, layer){
  const isC = isCircleFeature(feature);
  const pad = isC ? 1.10 : 0.20;
  const mz  = isC ? 2 : null;

  try {
    let b;
    if (isC) b = getBoundsForCircleFeature(feature, layer).pad(pad);
    else b = (layer?.getBounds ? layer.getBounds() : L.geoJSON(feature).getBounds()).pad(pad);
    flyToBoundsSmooth(b, 0.65, mz);
  } catch {}
}

/* =========================================================
   ================= PÚBLICO: SECCIONES → MANZANAS → LOTES =================
   ========================================================= */
let pinnedSeccionLayer = null;
let pinnedManzanaLayer = null;
let pinnedLotLayer = null;

function clearLotesLayer(){
  if (lotesLayer){ lotesLayer.remove(); lotesLayer = null; }
}
function clearManzanasLayer(){
  if (manzanasLayer){ manzanasLayer.remove(); manzanasLayer = null; }
}
function clearSeccionesLayerPublic(){
  if (seccionesLayerPublic){ seccionesLayerPublic.remove(); seccionesLayerPublic = null; }
  pinnedSeccionLayer = null;
}

function showPublicLevelSecciones(){
  currentSeccion = null;
  currentSeccionFeature = null;
  currentManzanaFeature = null;
  showAllLots = false;

  $seccionSelect.value = "";
  $manzanaSelect.innerHTML = `<option value="">MANZANA...</option>`;
  $loteInput.value = "";

  clearLotesLayer();
  clearManzanasLayer();
  clearSeccionesLayerPublic();
  updateToggleLotsButton();

  renderSeccionesLayerPublic();
}

function renderSeccionesLayerPublic(){
  if (!seccionesTopScaled || !seccionesTopScaled.features || seccionesTopScaled.features.length === 0){
    setPanel("Sin SECCIONES", `<p>No hay secciones en <code>data/secciones-top.geojson</code>. Agrega al menos 1.</p>`);
    return;
  }

  const fc = { type:"FeatureCollection", features: seccionesTopScaled.features };

  seccionesLayerPublic = L.geoJSON(fc, {
    style: (feature) => {
      const col = getSeccionColor(feature);
      return { ...hiddenStyle(), color: col, fillColor: col };
    },
    pointToLayer: (feature, latlng) => {
      const layer = featureToLayerCircleAware(feature, latlng);
      try {
        const col = getSeccionColor(feature);
        layer.setStyle({ ...hiddenStyle(), color: col, fillColor: col });
      } catch {}
      return layer;
    },
    onEachFeature: (feature, layer) => {
      const col = getSeccionColor(feature);

      layer.on("mouseover", () => {
        if (pinnedSeccionLayer !== layer) layer.setStyle(hoverStyle(col));
      });
      layer.on("mouseout", () => {
        if (pinnedSeccionLayer !== layer) layer.setStyle({ ...hiddenStyle(), color: col, fillColor: col });
      });

      layer.on("click", () => {
        if (pinnedSeccionLayer && pinnedSeccionLayer !== layer){
          const prevCol = getSeccionColor(pinnedSeccionLayer.feature);
          pinnedSeccionLayer.setStyle({ ...hiddenStyle(), color: prevCol, fillColor: prevCol });
        }
        pinnedSeccionLayer = layer;

        const base = pinnedStyle(col);
        layer.setStyle(base);
        pulseLayer(layer, base, { ms: 220 });

        selectSeccionPublic(feature, layer);
      });
    }
  }).addTo(map);

  setPanel("SECCIONES", `
    <p>1) Selecciona una <b>SECCIÓN</b> en el mapa.</p>
    <p>2) Luego seleccionarás una <b>MANZANA</b>.</p>
    <p>3) Después un <b>LOTE</b>.</p>
  `);
}

function selectSeccionPublic(feature, layer){
  const sec = getPropSeccion(feature);
  currentSeccion = sec;
  currentSeccionFeature = feature;

  $seccionSelect.value = sec;
  $manzanaSelect.value = "";
  $loteInput.value = "";

  try { flyToBoundsSmooth(layer.getBounds().pad(0.10), 0.65); } catch {}
  showPublicLevelManzanas(sec);
}

function showPublicLevelManzanas(seccion){
  currentSeccion = seccion;
  currentManzanaFeature = null;
  showAllLots = false;

  clearLotesLayer();
  clearManzanasLayer();
  updateToggleLotsButton();

  clearSeccionesLayerPublic();

  const manzanas = buildManzanasListBySeccion(manzanasScaled.features, seccion);
  fillManzanaSelect(manzanas);

  renderManzanasLayer(manzanas, {
    panelTitle: `SECCIÓN ${safe(seccion)}`,
    panelHtml: `<p>Selecciona una <b>MANZANA</b> en el mapa.</p>`
  });
}

function renderManzanasLayer(filteredFeatures, opts){
  if (manzanasLayer){ manzanasLayer.remove(); manzanasLayer = null; }
  pinnedManzanaLayer = null;
  currentManzanaFeature = null;
  clearLotesLayer();
  updateToggleLotsButton();

  const fc = { type:"FeatureCollection", features: filteredFeatures };

  manzanasLayer = L.geoJSON(fc, {
    style: () => hiddenStyle(),
    pointToLayer: (feature, latlng) => {
      const layer = featureToLayerCircleAware(feature, latlng);
      try { layer.setStyle(hiddenStyle()); } catch {}
      return layer;
    },
    onEachFeature: (feature, layer) => {
      layer.on("mouseover", () => {
        if (pinnedManzanaLayer !== layer) layer.setStyle(hoverStyle());
      });
      layer.on("mouseout", () => {
        if (pinnedManzanaLayer !== layer) layer.setStyle(hiddenStyle());
      });

      layer.on("click", async () => {
        if (pinnedManzanaLayer && pinnedManzanaLayer !== layer){
          pinnedManzanaLayer.setStyle(hiddenStyle());
        }
        pinnedManzanaLayer = layer;

        const base = pinnedStyle();
        layer.setStyle(base);
        pulseLayer(layer, base, { ms: 220 });

        await selectManzana(feature, layer);
      });
    }
  }).addTo(map);

  if (opts?.panelTitle){
    setPanel(opts.panelTitle, opts.panelHtml || "");
  } else {
    setPanel("Selección", `
      <p>1) Elige <b>SECCIÓN</b></p>
      <p>2) Elige <b>MANZANA</b></p>
      <p>3) Escribe <b>LOTE</b> (opcional) y presiona Buscar</p>
    `);
  }
}

async function selectManzana(feature, layer){
  currentManzanaFeature = feature;
  $manzanaSelect.value = getPropManzana(feature);
  flyToManzanaFeature(feature, layer);
  await loadLotesForCurrentManzana();
}

async function loadLotesForCurrentManzana(){
  clearLotesLayer();
  pinnedLotLayer = null;
  showAllLots = false;
  updateToggleLotsButton();

  if (!currentManzanaFeature){
    setPanel("Sin manzana", `<p>Primero selecciona una MANZANA.</p>`);
    return;
  }

  const lotesUrl = getLotesUrlForManzana(currentManzanaFeature);
  if (!lotesUrl){
    setPanel("MANZANA sin lotes", `<p>Esta manzana no tiene fuente de lotes.</p>`);
    return;
  }

  let raw;
  try { raw = await loadJson(lotesUrl); }
  catch {
    setPanel("Lotes no encontrados", `<p>No pude cargar: <code>${safe(lotesUrl)}</code></p>`);
    return;
  }

  // Si el archivo es compartido por sección, filtramos por properties.manzana
  const manzanaKey = getPropManzana(currentManzanaFeature);
  const hasManzanaProp = (raw.features || []).some(f => (f?.properties?.manzana || f?.properties?.manzanaId));

  let filtered = raw;
  if (hasManzanaProp){
    const feats = (raw.features || []).filter(f => {
      const pm = (f?.properties?.manzana || f?.properties?.manzanaId || "").toString().trim().toUpperCase();
      return pm === manzanaKey.toUpperCase();
    });
    filtered = { type:"FeatureCollection", features: feats };

    if (feats.length === 0){
      notify(`No encontré lotes con properties.manzana="${manzanaKey}" en ${lotesUrl}`, 2600);
    }
  }

  lotesScaled = deepCopy(filtered);
  applyCoordScaleToGeoJSON(lotesScaled, COORD_SCALE_X, COORD_SCALE_Y);

  lotesLayer = L.geoJSON(lotesScaled, {
    style: (feature) => lotBaseStyle(feature?.properties?.estatus),
    pointToLayer: (feature, latlng) => {
      const layer = featureToLayerCircleAware(feature, latlng);
      const st = feature?.properties?.estatus;
      try { layer.setStyle(lotBaseStyle(st)); } catch {}
      return layer;
    },
    onEachFeature: (feature, layer) => {
      const st = feature?.properties?.estatus;

      layer.on("mouseover", () => {
        if (pinnedLotLayer !== layer) layer.setStyle(styleByStatus(st));
      });
      layer.on("mouseout", () => {
        if (pinnedLotLayer !== layer) layer.setStyle(lotBaseStyle(st));
      });

      layer.on("click", () => {
        if (pinnedLotLayer && pinnedLotLayer !== layer){
          const prev = pinnedLotLayer.feature?.properties?.estatus;
          pinnedLotLayer.setStyle(lotBaseStyle(prev));
        }
        pinnedLotLayer = layer;

        const base = lotPinnedStyle(st);
        layer.setStyle(base);
        pulseLayer(layer, base, { ms: 200 });

        // En manzanas circulares (VIP): no hacer zoom extra al seleccionar lote; solo centrar
        if (isCircleFeature(currentManzanaFeature)) centerOnLayerNoZoom(layer, 120);
        else flyToBoundsSmooth(layer.getBounds().pad(0.30), 0.45);
        showLoteInfo(feature);
      });
    }
  }).addTo(map);

  updateToggleLotsButton();

  const sec = currentSeccion || getPropSeccion(currentManzanaFeature);
  const man = getPropManzana(currentManzanaFeature);
  setPanel(`SECCIÓN ${safe(sec)} — MANZANA ${safe(man)}`, `
    <p>Selecciona un lote o usa <b>Mostrar lotes</b>.</p>
    <p style="font-size:12px;color:#6b7280;">
      Fuente lotes: <code>${safe(lotesUrl)}</code>
      ${hasManzanaProp ? "(filtrado por manzana)" : "(sin filtro: archivo por manzana)"}
    </p>
  `);
}

function showLoteInfo(feature){
  const props = feature?.properties || {};
  const loteVal = (props.lote || props.id || "").toString();
  const status = (props.estatus || "").toString() || (lotesInfo[loteVal]?.estatus) || "desconocido";
  const paqueteKey = (props.paquete || null);

  let html = `
    <p><b>SECCIÓN:</b> ${safe(currentSeccion || getPropSeccion(currentManzanaFeature))}</p>
    <p><b>MANZANA:</b> ${safe(getPropManzana(currentManzanaFeature))}</p>
    <p><b>LOTE:</b> ${safe(loteVal)}</p>
    <p><b>Estatus:</b> ${safe(status)}</p>
  `;

  if (String(status).toLowerCase() === "disponible"){
    html += `<h3>Paquete</h3>`;
    if (!paqueteKey){
      html += `<p><i>Sin paquete asignado.</i></p>`;
    } else if (!paquetesInfo[paqueteKey]) {
      html += `<p><b>${safe(paqueteKey)}</b> (no definido en <code>data/paquetes.json</code>)</p>`;
    } else {
      const p = paquetesInfo[paqueteKey];
      html += `<p><b>${safe(p.nombre)}</b></p>`;
      html += `<ul>${(p.items||[]).map(it => `<li>${safe(it)}</li>`).join("")}</ul>`;
    }
  } else if (String(status).toLowerCase() === "ocupado"){
    html += `
      <button id="moreBtn" style="padding:8px 12px;border-radius:8px;border:1px solid #ccc;cursor:pointer;">
        Más información
      </button>
      <p style="font-size:12px;color:#666;">
        Nota: el saldo se conectará después con login + consulta segura.
      </p>
    `;
  }

  setPanel("Lote", html);
  const btn = document.getElementById("moreBtn");
  if (btn) btn.onclick = () => notify("Aquí irá el login + consulta segura del saldo.", 2200);
}

/* =========================================================
   NICHOS: selección dentro de la imagen (modal)
   ========================================================= */
const NICHOS_ROWS = ["A","B","C","D","E","F"]; // 6 filas
const NICHOS_COLS = 79;                        // 79 nichos por fila
const NICHOS_GRID_BOX = { left: 0.03, right: 0.97, top: 0.10, bottom: 0.95 };

function clamp01(v){ return v < 0 ? 0 : (v > 1 ? 1 : v); }

function getNichoPrefixFromZona(zonaFeature){
  const p = zonaFeature?.properties || {};
  const direct = (p.prefix || p.codigo || p.tipo || "").toString().trim().toUpperCase();
  if (direct === "PLN" || direct === "SPN") return direct;

  const id = (p.id || "").toString().trim().toUpperCase();
  if (id.startsWith("PLN")) return "PLN";
  if (id.startsWith("SPN")) return "SPN";
  return "PLN";
}

function nichoClickToGrid(rx, ry){
  rx = clamp01(rx);
  ry = clamp01(ry);

  const box = NICHOS_GRID_BOX;
  const gx = (rx - box.left) / (box.right - box.left);
  const gy = (ry - box.top) / (box.bottom - box.top);
  if (gx < 0 || gx > 1 || gy < 0 || gy > 1) return null;

  const col = Math.floor(gx * NICHOS_COLS) + 1;              // 1..79
  const rowIndex = Math.floor(gy * NICHOS_ROWS.length);      // 0..5

  const numero = Math.min(Math.max(col, 1), NICHOS_COLS);
  const filaIndex = Math.min(Math.max(rowIndex, 0), NICHOS_ROWS.length - 1);

  return { numero, filaIndex };
}

function buildNichoCode(prefix, numero, fila, cara){
  const suf = (cara === "convexo") ? "X" : "";
  return `${prefix}-${numero}-${fila}${suf}`;
}

function drawNichoHighlight(clickLayerEl, rx, ry){
  let hl = document.getElementById("nichoHighlight");
  if (!hl){
    hl = document.createElement("div");
    hl.id = "nichoHighlight";
    hl.style.position = "absolute";
    hl.style.border = "2px solid #ef4444";
    hl.style.borderRadius = "6px";
    hl.style.pointerEvents = "none";
    clickLayerEl.appendChild(hl);
  }

  const box = NICHOS_GRID_BOX;
  const gx = (rx - box.left) / (box.right - box.left);
  const gy = (ry - box.top) / (box.bottom - box.top);
  if (gx < 0 || gx > 1 || gy < 0 || gy > 1){
    hl.style.display = "none";
    return;
  }

  const cellW = (box.right - box.left) / NICHOS_COLS;
  const cellH = (box.bottom - box.top) / NICHOS_ROWS.length;

  const rectLeft = box.left + (Math.floor(gx * NICHOS_COLS) * cellW);
  const rectTop  = box.top  + (Math.floor(gy * NICHOS_ROWS.length) * cellH);

  hl.style.display = "block";
  hl.style.left = `${rectLeft * 100}%`;
  hl.style.top  = `${rectTop * 100}%`;
  hl.style.width  = `${cellW * 100}%`;
  hl.style.height = `${cellH * 100}%`;
}

function openNichoModal(zonaFeature){
  const modal = document.getElementById("nichoModal");
  const sub   = document.getElementById("nichoModalSub");
  const img   = document.getElementById("nichoImg");
  const layer = document.getElementById("nichoClickLayer");
  const hint  = document.getElementById("nichoHint");
  const debug = document.getElementById("nichoDebug");

  if (!modal || !sub || !img || !layer || !hint || !debug){
    notify("Falta el modal de nichos en index.html (IDs nichoModal, nichoImg, etc.).", 2600);
    return;
  }

  const zonaId = zonaFeature?.properties?.id || "SIN-ID";
  const prefix = getNichoPrefixFromZona(zonaFeature);

  nichoSelection = { zonaId, cara: null, numero: null };

  sub.textContent = `Zona: ${zonaId} (${prefix}) — Elige cara`;
  hint.textContent = "1) Elige cóncavo o convexo. 2) Luego da click en el nicho.";
  debug.textContent = "";

  img.style.display = "none";
  layer.style.display = "none";
  img.src = "";

  modal.style.display = "flex";

  const close = () => { modal.style.display = "none"; };
  const closeBtn = document.getElementById("nichoCloseBtn");
  if (closeBtn) closeBtn.onclick = close;
  modal.onclick = (e) => { if (e.target === modal) close(); };

  const setCara = (cara) => {
    nichoSelection.cara = cara;
    sub.textContent = `Zona: ${zonaId} (${prefix}) — Cara: ${cara} — Selecciona nicho`;

    const src = `./assets/nichos/${prefix}-${cara}.png`;

    img.src = src;
    img.onload = () => {
      img.style.display = "block";
      layer.style.display = "block";

      layer.style.width = img.naturalWidth + "px";
      layer.style.height = img.naturalHeight + "px";
      img.style.width = img.naturalWidth + "px";
      img.style.height = img.naturalHeight + "px";

      hint.textContent = `Da click sobre el nicho. Ejemplo: ${prefix}-68-${cara === "convexo" ? "AX" : "A"}`;
      debug.textContent = "";

      const oldHL = document.getElementById("nichoHighlight");
      if (oldHL) oldHL.remove();
    };
    img.onerror = () => {
      img.style.display = "none";
      layer.style.display = "none";
      hint.textContent = `No encontré la imagen: ${src}`;
      debug.textContent = "";
    };
  };

  const concBtn = document.getElementById("caraConcavoBtn");
  const convBtn = document.getElementById("caraConvexoBtn");
  if (concBtn) concBtn.onclick = () => setCara("concavo");
  if (convBtn) convBtn.onclick = () => setCara("convexo");

  layer.onclick = (ev) => {
    if (!nichoSelection.cara) return;

    const rect = layer.getBoundingClientRect();
    const rx = (ev.clientX - rect.left) / rect.width;
    const ry = (ev.clientY - rect.top) / rect.height;

    const cell = nichoClickToGrid(rx, ry);
    if (!cell){
      hint.textContent = "Click fuera del área de nichos. Intenta dentro del cuadro de nichos.";
      return;
    }

    const numero = cell.numero;
    const fila = NICHOS_ROWS[cell.filaIndex];
    const code = buildNichoCode(prefix, numero, fila, nichoSelection.cara);

    nichoSelection.numero = numero;

    drawNichoHighlight(layer, rx, ry);
    debug.textContent = `Seleccionado: ${code}`;

    setPanel("Nicho seleccionado", `
      <p><b>Código:</b> ${safe(code)}</p>
      <p><b>Zona:</b> ${safe(zonaId)}</p>
      <p><b>Cara:</b> ${safe(nichoSelection.cara)}</p>
    `);
  };
}

/* =========================================================
   BÚSQUEDA (SECCIÓN → MANZANA → LOTE)
   ========================================================= */
function findLotLayerByInput(loteInput){
  if (!lotesLayer) return null;
  const target = (loteInput || "").toString().trim().toLowerCase();
  if (!target) return null;

  let found = null;
  lotesLayer.eachLayer(layer => {
    const p = layer.feature?.properties || {};
    const v1 = (p.lote || "").toString().trim().toLowerCase();
    const v2 = (p.id || "").toString().trim().toLowerCase();
    if (v1 === target || v2 === target) found = layer;
  });
  return found;
}

async function ensureManzanaSelected(sec, man){
  if (!currentSeccion || currentSeccion !== sec){
    showPublicLevelManzanas(sec);
  }

  if (currentManzanaFeature && getPropSeccion(currentManzanaFeature) === sec && getPropManzana(currentManzanaFeature) === man){
    if (!lotesLayer) await loadLotesForCurrentManzana();
    return;
  }

  const f = (manzanasScaled?.features || []).find(x => getPropSeccion(x) === sec && getPropManzana(x) === man);
  if (!f){
    setPanel("No encontrada", `<p>No encontré la manzana <b>${safe(man)}</b> en <b>${safe(sec)}</b>.</p>`);
    return;
  }

  $seccionSelect.value = sec;
  showPublicLevelManzanas(sec);
  $manzanaSelect.value = man;

  currentManzanaFeature = f;
  await loadLotesForCurrentManzana();
  flyToManzanaFeature(f, null);
}

function setupSearch(){
  const run = async () => {
    const sec = ($seccionSelect.value || "").trim();
    const man = ($manzanaSelect.value || "").trim();
    const lote = ($loteInput.value || "").trim();

    if (!sec){ setPanel("Falta SECCIÓN", `<p>Primero elige una <b>SECCIÓN</b>.</p>`); return; }
    if (!man){ setPanel("Falta MANZANA", `<p>Ahora elige una <b>MANZANA</b> dentro de <b>${safe(sec)}</b>.</p>`); return; }

    await ensureManzanaSelected(sec, man);

    if (!lote) return;

    const layer = findLotLayerByInput(lote);
    if (!layer){
      setPanel("Lote no encontrado", `<p>No encontré el lote <b>${safe(lote)}</b> en <b>${safe(sec)} - ${safe(man)}</b>.</p>`);
      return;
    }

    if (isCircleFeature(currentManzanaFeature)) centerOnLayerNoZoom(layer, 120);
    else flyToBoundsSmooth(layer.getBounds().pad(0.35), 0.45);

    const st = layer.feature?.properties?.estatus;
    const base = lotPinnedStyle(st);
    layer.setStyle(base);
    pulseLayer(layer, base, { ms: 200 });

    showLoteInfo(layer.feature);
  };

  $searchBtn.onclick = run;
  $loteInput.addEventListener("keydown", (e) => { if (e.key === "Enter") run(); });
}

/* =========================================================
   DROPDOWNS (PUBLICO)
   ========================================================= */
function setupDropdowns(){
  $seccionSelect.onchange = () => {
    const sec = ($seccionSelect.value || "").trim();

    $loteInput.value = "";
    $manzanaSelect.value = "";
    currentManzanaFeature = null;
    clearLotesLayer();
    updateToggleLotsButton();

    if (!sec){
      showPublicLevelSecciones();
      return;
    }

    showPublicLevelManzanas(sec);
  };

  $manzanaSelect.onchange = async () => {
    const sec = ($seccionSelect.value || "").trim();
    const man = ($manzanaSelect.value || "").trim();
    $loteInput.value = "";
    if (!sec || !man) return;
    await ensureManzanaSelected(sec, man);
  };
}

/* =========================================================
   BOTONES (PUBLICO)
   ========================================================= */
function setupButtons(){
  $backBtn.onclick = () => {
    if (lotesLayer){
      clearLotesLayer();
      pinnedLotLayer = null;
      currentManzanaFeature = null;
      showAllLots = false;
      updateToggleLotsButton();
      if (currentSeccion) showPublicLevelManzanas(currentSeccion);
      else showPublicLevelSecciones();
      return;
    }

    if (manzanasLayer){
      showPublicLevelSecciones();
      return;
    }

    showPublicLevelSecciones();
  };

  if ($toggleLotsBtn){
    $toggleLotsBtn.onclick = () => {
      showAllLots = !showAllLots;
      updateToggleLotsButton();
      if (!lotesLayer) return;
      lotesLayer.eachLayer(layer => {
        const st = layer.feature?.properties?.estatus;
        if (pinnedLotLayer === layer) layer.setStyle(lotPinnedStyle(st));
        else layer.setStyle(lotBaseStyle(st));
      });
    };
  }
}

/* =========================================================
   ================= EDITOR CORE =================
   - Editar puntos / círculo
   - Borrar
   - Copiar/Pegar
   - Cuadrícula lotes y manzanas (rotación)
   - Mover CUADRÍCULA COMPLETA con 1 marcador
   - MULTI-SELECT + MOVE + SCALE por handles
   - NUEVO: selección simple abre por defecto “Mover/Escalar” (sin vértices)
           y se entra a vértices con botón “Editar puntos”.
   ========================================================= */
const editor = {
  mode: "edit",          // "edit" | "create" | "grid"
  drawShape: "polygon",  // "polygon" | "circle"

  // polygon draw
  polyPoints: [],
  polyMarkers: [],
  polyLine: null,
  polyPreview: null,

  // circle draw
  circleCenter: null,
  circleCenterMarker: null,
  circleRadiusMarker: null,
  circlePreview: null,
  circleRadius: null,

  // selection (single + multi)
  selectedLayer: null,
  selectedFeature: null,
  selectedIsCircle: false,
  originalGeometry: null,
  originalRadius: null,

  // circular repeat (lotes)
  circularArmed: false,
  circularPickingTemplate: false,
  circularConfig: null,

  // editor LOTES: filtro visual (no afecta el dataset)
  lotesFilterSeccion: null,
  lotesFilterManzana: null,

  // sub-mode for single selection: "transform" (default) | "vertices"
  editSubmode: "transform",

  // MULTI selection set
  selectedSet: new Set(), // stores feature references (object identity)
  selectedLayers: [],

  // vertex edit markers
  vertexMarkers: [],

  // group transform handles
  groupBoxLayer: null,
  groupCenterMarker: null,
  groupScaleMarker: null,
  groupTransformActive: false,
  groupCenterLL: null,
  groupScaleStart: null, // { baseDist, center, snapshot }

  // copy/paste
  clipboardFeature: null,
  pasteArmed: false,

  // grid state
  gridArmed: false,
  gridConfig: null,

  // last created grid group (for moving whole grid)
  lastGrid: null, // { datasetArr, features[], overlay, centerMarker, bounds, centerLL }

  iconVertex: L.divIcon({
    className: "",
    html: `<div style="width:10px;height:10px;border-radius:50%;background:#fff;border:2px solid #111;"></div>`,
    iconSize: [14,14],
    iconAnchor: [7,7]
  }),
  iconHandle: L.divIcon({
    className: "",
    html: `<div style="width:12px;height:12px;border-radius:50%;background:#111;border:2px solid #fff;"></div>`,
    iconSize: [16,16],
    iconAnchor: [8,8]
  }),
  iconCenter: L.divIcon({
    className: "",
    html: `<div style="width:14px;height:14px;border-radius:50%;background:#ef4444;border:2px solid #fff;box-shadow:0 0 0 1px #111;"></div>`,
    iconSize: [18,18],
    iconAnchor: [9,9]
  }),
  iconScale: L.divIcon({
    className: "",
    html: `<div style="width:14px;height:14px;border-radius:4px;background:#22c55e;border:2px solid #fff;box-shadow:0 0 0 1px #111;"></div>`,
    iconSize: [18,18],
    iconAnchor: [9,9]
  })
};

function editorClearPoly(){
  editor.polyPoints = [];
  editor.polyMarkers.forEach(m => map.removeLayer(m));
  editor.polyMarkers = [];
  if (editor.polyLine) map.removeLayer(editor.polyLine);
  if (editor.polyPreview) map.removeLayer(editor.polyPreview);
  editor.polyLine = null;
  editor.polyPreview = null;
  const el = document.getElementById("ptCount");
  if (el) el.textContent = "0";
}

function editorRefreshPolyPreview(){
  if (editor.polyLine) map.removeLayer(editor.polyLine);
  if (editor.polyPreview) map.removeLayer(editor.polyPreview);
  editor.polyLine = null;
  editor.polyPreview = null;

  if (editor.polyPoints.length >= 2){
    editor.polyLine = L.polyline(editor.polyPoints, { weight: 2 }).addTo(map);
  }
  if (editor.polyPoints.length >= 3){
    editor.polyPreview = L.polygon(editor.polyPoints, { weight: 2, fillOpacity: 0.12 }).addTo(map);
  }
}

function editorClearCircle(){
  editor.circleCenter = null;
  editor.circleRadius = null;

  if (editor.circleCenterMarker) map.removeLayer(editor.circleCenterMarker);
  if (editor.circleRadiusMarker) map.removeLayer(editor.circleRadiusMarker);
  if (editor.circlePreview) map.removeLayer(editor.circlePreview);

  editor.circleCenterMarker = null;
  editor.circleRadiusMarker = null;
  editor.circlePreview = null;
}

function clearGroupTransformUI(){
  if (editor.groupBoxLayer) { try { map.removeLayer(editor.groupBoxLayer); } catch {} }
  if (editor.groupCenterMarker) { try { map.removeLayer(editor.groupCenterMarker); } catch {} }
  if (editor.groupScaleMarker) { try { map.removeLayer(editor.groupScaleMarker); } catch {} }
  editor.groupBoxLayer = null;
  editor.groupCenterMarker = null;
  editor.groupScaleMarker = null;
  editor.groupTransformActive = false;
  editor.groupCenterLL = null;
  editor.groupScaleStart = null;
}

function clearMultiSelection(){
  editor.selectedSet.clear();
  editor.selectedLayers = [];
  clearGroupTransformUI();
}

function editorStopVertexEditing(){
  editor.vertexMarkers.forEach(m => map.removeLayer(m));
  editor.vertexMarkers = [];

  if (editor.circleCenterMarker && editor.selectedIsCircle) {
    try { map.removeLayer(editor.circleCenterMarker); } catch {}
    try { map.removeLayer(editor.circleRadiusMarker); } catch {}
    editor.circleCenterMarker = null;
    editor.circleRadiusMarker = null;
  }
}

function editorStopEditing(){
  editorStopVertexEditing();

  editor.selectedLayer = null;
  editor.selectedFeature = null;
  editor.selectedIsCircle = false;
  editor.originalGeometry = null;
  editor.originalRadius = null;
}

function ringToGeoJsonCoords(ringLatLng){
  const coords = ringLatLng.map(latLngToXY);
  if (coords.length) coords.push(coords[0]);
  return [coords];
}

/* ---------- DATASET ACTIVO POR MODO ---------- */
function getActiveEditDatasetArr(){
  if (isEditSecciones) return seccionesTopRaw?.features || null;
  if (isEditManzanas)  return manzanasRaw?.features || null;
  if (isEditLotes)     return currentLotesRaw?.features || null;
  if (isEditNichos)    return nichosZonasRaw?.features || null;
  return null;
}

function rerenderActiveEditor(){
  if (isEditSecciones) return rerenderSecciones_Edit();
  if (isEditManzanas)  return rerenderManzanas_Edit();
  if (isEditLotes)     return rerenderLotes_Edit();
  if (isEditNichos)    return rerenderNichos_Edit();
}

/* ---------- FEATURE ID helpers ---------- */
function getFeatureId(f){
  return (f?.properties?.id || f?.properties?.lote || f?.properties?.manzana || f?.properties?.seccion || "").toString().trim();
}
function setFeatureId(f, newId){
  if (!f?.properties) f.properties = {};
  f.properties.id = newId;
  if (f.properties.lote !== undefined) f.properties.lote = newId;
}
function ensureUniqueId(feature, arr){
  const base = getFeatureId(feature) || "item";
  const exists = (id) => arr.some(x => getFeatureId(x) === id);

  if (!exists(base)) { setFeatureId(feature, base); return; }
  let i = 1;
  while (exists(`${base}-copy-${i}`)) i++;
  setFeatureId(feature, `${base}-copy-${i}`);
}

/* ---------- BORRAR FEATURE (single o multi) ---------- */
function deleteSelectedFeature(){
  const arr = getActiveEditDatasetArr();
  if (!arr) return;

  const targets = (editor.selectedSet.size > 0)
    ? Array.from(editor.selectedSet)
    : (editor.selectedFeature ? [editor.selectedFeature] : []);

  if (!targets.length){
    notify("No hay figuras seleccionadas para borrar.", 1800);
    return;
  }

  let removed = 0;
  for (const feat of targets){
    let idx = arr.indexOf(feat);
    if (idx < 0){
      const id = getFeatureId(feat);
      if (id) idx = arr.findIndex(f => getFeatureId(f) === id);
    }
    if (idx >= 0){
      arr.splice(idx, 1);
      removed++;
    }
  }

  editorStopEditing();
  clearMultiSelection();
  rerenderActiveEditor();
  notify(`✅ Borradas ${removed} figura(s) (en memoria).`, 2200);
}

/* ---------- TRANSFORM HELPERS: translate + scale ---------- */
function transformPointAround(x, y, cx, cy, s){
  return [cx + (x - cx) * s, cy + (y - cy) * s];
}

function translateFeatureInPlace(feature, dx, dy){
  if (!feature?.geometry) return;

  if (feature.geometry.type === "Point"){
    const [x,y] = feature.geometry.coordinates;
    feature.geometry.coordinates = [x + dx, y + dy];
    return;
  }

  if (feature.geometry.type === "Polygon"){
    const coords = feature.geometry.coordinates || [];
    feature.geometry.coordinates = coords.map(ring => ring.map(([x,y]) => [x + dx, y + dy]));
    return;
  }
}

function rotatePointAround(x, y, cx, cy, deg){
  const r = degToRad(deg);
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const dx = x - cx;
  const dy = y - cy;
  return [
    cx + (dx * cos - dy * sin),
    cy + (dx * sin + dy * cos)
  ];
}

function rotateFeatureInPlace(feature, cx, cy, deg){
  if (!feature?.geometry) return;

  if (feature.geometry.type === "Point"){
    const [x,y] = feature.geometry.coordinates;
    const [nx,ny] = rotatePointAround(x,y,cx,cy,deg);
    feature.geometry.coordinates = [nx,ny];
    return;
  }

  if (feature.geometry.type === "Polygon"){
    const coords = feature.geometry.coordinates || [];
    feature.geometry.coordinates = coords.map(ring =>
      ring.map(([x,y]) => rotatePointAround(x,y,cx,cy,deg))
    );
    return;
  }
}

function scaleFeatureInPlace(feature, cx, cy, scale){
  if (!feature?.geometry) return;

  if (feature.geometry.type === "Point"){
    const [x,y] = feature.geometry.coordinates;
    const [nx, ny] = transformPointAround(x,y,cx,cy,scale);
    feature.geometry.coordinates = [nx, ny];
    if (isCircleFeature(feature) && typeof feature.properties.radius === "number"){
      feature.properties.radius = feature.properties.radius * scale;
    }
    return;
  }

  if (feature.geometry.type === "Polygon"){
    const coords = feature.geometry.coordinates || [];
    feature.geometry.coordinates = coords.map(ring => ring.map(([x,y]) => transformPointAround(x,y,cx,cy,scale)));
    return;
  }
}

function getFeatureCenterXY(feature){
  const b = boundsFromFeature(feature);
  if (!b) return null;
  const c = boundsCenter(b);
  return { cx: c.x, cy: c.y };
}



/* ---------- BOUNDS from features ---------- */
function expandBoundsWithXY(b, x, y){
  if (!b) return { minX:x, minY:y, maxX:x, maxY:y };
  if (x < b.minX) b.minX = x;
  if (y < b.minY) b.minY = y;
  if (x > b.maxX) b.maxX = x;
  if (y > b.maxY) b.maxY = y;
  return b;
}
function boundsFromFeature(feature){
  let b = null;
  if (!feature?.geometry) return null;

  if (feature.geometry.type === "Point"){
    const [x,y] = feature.geometry.coordinates;
    const r = feature.properties?.radius || 0;
    b = expandBoundsWithXY(b, x - r, y - r);
    b = expandBoundsWithXY(b, x + r, y + r);
    return b;
  }

  if (feature.geometry.type === "Polygon"){
    const ring = feature.geometry.coordinates?.[0] || [];
    for (const pt of ring){
      const [x,y] = pt;
      b = expandBoundsWithXY(b, x, y);
    }
    return b;
  }

  return null;
}
function boundsUnion(a,b){
  if (!a) return b;
  if (!b) return a;
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  };
}
function boundsFromFeatures(features){
  let b = null;
  for (const f of features){
    b = boundsUnion(b, boundsFromFeature(f));
  }
  return b;
}
function boundsCenter(b){
  return { x: (b.minX + b.maxX)/2, y: (b.minY + b.maxY)/2 };
}
function boundsToLatLngBounds(b, pad=0){
  if (!b) return null;
  const w = (b.maxX - b.minX);
  const h = (b.maxY - b.minY);
  const pX = w * pad;
  const pY = h * pad;
  const sw = L.latLng((b.minY - pY), (b.minX - pX));
  const ne = L.latLng((b.maxY + pY), (b.maxX + pX));
  return L.latLngBounds(sw, ne);
}

/* ---------- MULTI selection visuals ---------- */
function applyMultiSelectionStyle(){
  for (const lyr of editor.selectedLayers){
    try { lyr.setStyle(multiSelectedStyle()); } catch {}
  }
}

function rebuildSelectedLayersFromLayerGroup(layerGroup){
  editor.selectedLayers = [];
  if (!layerGroup) return;

  layerGroup.eachLayer(lyr => {
    const f = lyr.feature;
    if (f && editor.selectedSet.has(f)){
      editor.selectedLayers.push(lyr);
    }
  });
}

/* ---------- MODE: handles (move/scale) ---------- */
function showGroupTransformHandles(){
  clearGroupTransformUI();

  const feats = Array.from(editor.selectedSet);
  if (!feats.length) return;

  const b = boundsFromFeatures(feats);
  if (!b) return;

  const c = boundsCenter(b);
  const centerLL = L.latLng(c.y, c.x);

  const rect = [
    [b.minY, b.minX],
    [b.minY, b.maxX],
    [b.maxY, b.maxX],
    [b.maxY, b.minX]
  ].map(([y,x]) => L.latLng(y,x));

  editor.groupBoxLayer = L.polygon(rect, {
    weight: 2,
    color: "#ef4444",
    fillColor: "#ef4444",
    fillOpacity: 0.05,
    dashArray: "6 6"
  }).addTo(map);

  editor.groupCenterMarker = L.marker(centerLL, { draggable:true, icon: editor.iconCenter }).addTo(map);

  const scaleLL = L.latLng(b.minY, b.maxX);
  editor.groupScaleMarker = L.marker(scaleLL, { draggable:true, icon: editor.iconScale }).addTo(map);

  editor.groupTransformActive = true;
  editor.groupCenterLL = centerLL;

  let lastMove = editor.groupCenterMarker.getLatLng();
  editor.groupCenterMarker.on("drag", () => {
    const now = editor.groupCenterMarker.getLatLng();
    const dx = now.lng - lastMove.lng;
    const dy = now.lat - lastMove.lat;

    const latlngs = editor.groupBoxLayer.getLatLngs()[0] || editor.groupBoxLayer.getLatLngs();
    const moved = latlngs.map(p => L.latLng(p.lat + dy, p.lng + dx));
    editor.groupBoxLayer.setLatLngs([moved]);

    const sh = editor.groupScaleMarker.getLatLng();
    editor.groupScaleMarker.setLatLng(L.latLng(sh.lat + dy, sh.lng + dx));

    lastMove = now;
  });

  editor.groupCenterMarker.on("dragend", () => {
    const now = editor.groupCenterMarker.getLatLng();
    const dx = now.lng - editor.groupCenterLL.lng;
    const dy = now.lat - editor.groupCenterLL.lat;

    for (const f of feats){
      translateFeatureInPlace(f, dx, dy);
    }

    rerenderActiveEditor();
    notify("✅ Movido (en memoria).", 1200);
  });

  editor.groupScaleMarker.on("dragstart", () => {
    const cLL = editor.groupCenterMarker.getLatLng();
    const hLL = editor.groupScaleMarker.getLatLng();
    const baseDist = distPixels(cLL, hLL);
    editor.groupScaleStart = {
      baseDist: Math.max(baseDist, 1e-6),
      center: cLL,
      snapshot: feats.map(f => deepCopy(f))
    };
  });

  editor.groupScaleMarker.on("drag", () => {
    if (!editor.groupScaleStart) return;
    const cx = c.x, cy = c.y;
    const cLL = editor.groupScaleStart.center;
    const nowHandle = editor.groupScaleMarker.getLatLng();
    const d = distPixels(cLL, nowHandle);
    const s = d / editor.groupScaleStart.baseDist;

    const bb = b;
    const cornersXY = [
      [bb.minX, bb.minY],
      [bb.maxX, bb.minY],
      [bb.maxX, bb.maxY],
      [bb.minX, bb.maxY]
    ].map(([x,y]) => transformPointAround(x,y,cx,cy,s))
     .map(([x,y]) => L.latLng(y,x));

    editor.groupBoxLayer.setLatLngs([cornersXY]);
  });

  editor.groupScaleMarker.on("dragend", () => {
    if (!editor.groupScaleStart) return;

    const cLL = editor.groupScaleStart.center;
    const nowHandle = editor.groupScaleMarker.getLatLng();
    const d = distPixels(cLL, nowHandle);
    const s = d / editor.groupScaleStart.baseDist;

    const snapshot = editor.groupScaleStart.snapshot;

    for (let i=0; i<feats.length; i++){
      const f = feats[i];
      const snap = snapshot[i];
      f.geometry = deepCopy(snap.geometry);
      f.properties = deepCopy(snap.properties);
      scaleFeatureInPlace(f, cLL.lng, cLL.lat, s);
    }

    editor.groupScaleStart = null;
    rerenderActiveEditor();
    notify("✅ Escalado (en memoria).", 1400);
  });

  if (editor.selectedSet.size > 1){
    setPanel("Selección múltiple", `
      <p><b>${feats.length}</b> figura(s) seleccionada(s).</p>
      <p style="margin-top:8px">
        • <b>Arrastra el punto rojo</b> para mover todo.<br/>
        • <b>Arrastra el cuadro verde</b> para escalar todo.
      </p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;">
        <button id="btnMultiDelete" style="padding:8px 12px;border-radius:8px;border:1px solid #ef4444;background:#fff;color:#b91c1c;cursor:pointer;">Borrar seleccionados</button>
        <button id="btnMultiClear" style="padding:8px 12px;border-radius:8px;border:1px solid #ccc;cursor:pointer;">Limpiar selección</button>
        <button id="btnMultiCopyGeo" style="padding:8px 12px;border-radius:8px;border:1px solid #ccc;cursor:pointer;">Copiar GeoJSON</button>
      </div>
      <p style="font-size:12px;color:#6b7280;margin-top:10px;">
        Tip: usa <b>Ctrl/Cmd</b> o <b>Shift</b> + click para seleccionar varias.
      </p>
    `);

    const btnDel = document.getElementById("btnMultiDelete");
    if (btnDel) btnDel.onclick = () => {
      if (!confirm("¿Seguro que quieres borrar todas las figuras seleccionadas?")) return;
      deleteSelectedFeature();
    };
    const btnClr = document.getElementById("btnMultiClear");
    if (btnClr) btnClr.onclick = () => {
      clearMultiSelection();
      rerenderActiveEditor();
      notify("Selección limpiada.", 1200);
    };

    const btnCopy = document.getElementById("btnMultiCopyGeo");
    if (btnCopy) btnCopy.onclick = async () => {
      const ds = getEditDataset();
      const txt = JSON.stringify(ds?.data || { type:"FeatureCollection", features:[] }, null, 2);
      try {
        await navigator.clipboard.writeText(txt);
        notify("GeoJSON copiado. Pégalo en el archivo correspondiente.", 2000);
      } catch {
        setPanel("Copia manual", `<pre style="white-space:pre-wrap">${safe(txt)}</pre>`);
      }
    };
  }

  try { flyToBoundsSmooth(boundsToLatLngBounds(b, 0.10), 0.35); } catch {}
}

/* ---------- SINGLE: editar puntos (vértices) ---------- */
function editorStartEditPolygonVertices(layer){
  editorStopVertexEditing();

  editor.selectedLayer = layer;
  editor.selectedFeature = layer.feature;
  editor.selectedIsCircle = false;
  editor.originalGeometry = deepCopy(layer.feature.geometry);

  const latlngs = layer.getLatLngs();
  const ring = Array.isArray(latlngs[0]) ? latlngs[0] : latlngs;

  let ring2 = ring;
  if (ring2.length >= 2){
    const a = ring2[0], b = ring2[ring2.length-1];
    if (Math.abs(a.lat-b.lat)<1e-9 && Math.abs(a.lng-b.lng)<1e-9) ring2 = ring2.slice(0, -1);
  }

  editor.vertexMarkers = ring2.map((p) => {
    const mk = L.marker(p, { draggable:true, icon: editor.iconVertex }).addTo(map);
    mk.on("drag", () => {
      const newRing = editor.vertexMarkers.map(m => m.getLatLng());
      layer.setLatLngs([newRing]);
    });
    mk.on("dragend", () => {
      const newRing = editor.vertexMarkers.map(m => m.getLatLng());
      layer.setLatLngs([newRing]);
      editor.selectedFeature.geometry.coordinates = ringToGeoJsonCoords(newRing);
      renderEditSelectedPanel();
      notify("Puntos actualizados (en memoria).", 900);
    });
    return mk;
  });

  renderEditSelectedPanel();
}

function editorStartEditCircleVertices(layer){
  editorStopVertexEditing();

  editor.selectedLayer = layer;
  editor.selectedFeature = layer.feature;
  editor.selectedIsCircle = true;

  editor.originalGeometry = deepCopy(layer.feature.geometry);
  editor.originalRadius = layer.feature.properties.radius;

  const center = layer.getLatLng();
  const radius = layer.feature.properties.radius;

  editor.circleCenterMarker = L.marker(center, { draggable:true, icon: editor.iconCenter }).addTo(map);

  const handle = L.latLng(center.lat, center.lng + radius);
  editor.circleRadiusMarker = L.marker(handle, { draggable:true, icon: editor.iconHandle }).addTo(map);

  const updateCircle = () => {
    const c = editor.circleCenterMarker.getLatLng();
    const h = editor.circleRadiusMarker.getLatLng();
    const r = distPixels(c, h);

    layer.setLatLng(c);
    layer.setRadius(r);

    editor.selectedFeature.geometry.coordinates = latLngToXY(c);
    editor.selectedFeature.properties.radius = r;

    renderEditSelectedPanel();
    notify("Círculo actualizado (en memoria).", 900);
  };

  editor.circleCenterMarker.on("drag", () => {
    const c = editor.circleCenterMarker.getLatLng();
    const r = layer.getRadius();
    editor.circleRadiusMarker.setLatLng(L.latLng(c.lat, c.lng + r));
    layer.setLatLng(c);
  });
  editor.circleCenterMarker.on("dragend", updateCircle);

  editor.circleRadiusMarker.on("drag", () => {
    const c = editor.circleCenterMarker.getLatLng();
    const h = editor.circleRadiusMarker.getLatLng();
    layer.setRadius(distPixels(c,h));
  });
  editor.circleRadiusMarker.on("dragend", updateCircle);

  renderEditSelectedPanel();
}

/* ---------- EDIT DATASET META ---------- */
function getEditDataset(){
  if (isEditSecciones) return { label:"SECCIONES", data: seccionesTopRaw, dest: SECCIONES_TOP_URL };
  if (isEditManzanas)  return { label:"MANZANAS",  data: manzanasRaw,     dest: MANZANAS_URL };
  if (isEditLotes)     return { label:"LOTES",     data: currentLotesRaw, dest: currentLotesSourceUrl || (getSelectedSeccion() ? getSharedLotesUrlForSeccion(getSelectedSeccion()) : "(elige SECCIÓN)") };
  if (isEditNichos)    return { label:"NICHOS",    data: nichosZonasRaw,  dest: NICHOS_ZONAS_URL };
  return null;
}

/* =========================================================
   PANEL: EDIT SELECTED (borrar + copy/paste)
   - Si editSubmode=transform: muestra botón “Editar puntos”
   - Si editSubmode=vertices: muestra botón “Mover/Escalar”
   ========================================================= */
function renderEditSelectedPanel(){
  const ds = getEditDataset();
  const kind = ds?.label || "ITEM";
  const currentId = getFeatureId(editor.selectedFeature) || "(sin id)";
  const showColor = isEditSecciones && editor.selectedFeature?.properties;
  const currentColor = showColor ? (editor.selectedFeature.properties.color || DEFAULT_SECCION_COLOR) : DEFAULT_SECCION_COLOR;

  // Editor LOTES: selector de manzana dentro del panel del lote
  let manzanaOptionsHtml = "";
  if (isEditLotes && editor.selectedFeature){
    const secForOpts = (editor.selectedFeature?.properties?.seccion || getSelectedSeccion() || "").toString().trim();
    const list = buildManzanasListBySeccion((manzanasRaw?.features || []), secForOpts);
    const curMan = (editor.selectedFeature?.properties?.manzana || editor.selectedFeature?.properties?.manzanaId || "").toString().trim();

    const opts = [
      `<option value="">(sin manzana)</option>`,
      ...list.map(f => {
        const m = getPropManzana(f);
        const sel = (m && curMan && m.toUpperCase() === curMan.toUpperCase()) ? "selected" : "";
        return `<option value="${safe(m)}" ${sel}>${safe(m)} — ${safe(getPropNombre(f))}</option>`;
      })
    ].join("");

    manzanaOptionsHtml = `
      <hr/>
      <label><b>Manzana del lote</b></label><br/>
      <select id="editLoteManzana" style="width:100%;padding:8px;margin:6px 0;border:1px solid #ccc;border-radius:8px;">${opts}</select>
      <p style="font-size:12px;color:#6b7280;margin-top:-2px;">Tip: esto permite copiar lotes entre manzanas sin cambiar de manzana arriba.</p>
    `;
  }


  const modeLabel = (editor.editSubmode === "vertices") ? "Edición de puntos" : "Mover/Escalar";

  setPanel(`Editar ${kind}: ${safe(currentId)}`, `
    <p><b>Modo:</b> ${safe(modeLabel)}</p>
    <p><b>Tipo:</b> ${editor.selectedIsCircle ? "Círculo" : "Polígono"}</p>
    <p style="font-size:12px;color:#666;">Destino: <b>${safe(ds?.dest || "")}</b></p>
    <p style="font-size:12px;color:#6b7280;margin-top:8px;">
      Tip multi: <b>Ctrl/Cmd</b> o <b>Shift</b> + click para seleccionar varios. (Multi usa solo mover/escalar).
    </p>

    <hr/>
    <label><b>Nombre / ID</b></label><br/>
    <input id="editIdInput" value="${safe(getFeatureId(editor.selectedFeature))}"
      style="width:100%;padding:8px;margin:6px 0;border:1px solid #ccc;border-radius:8px;" />

    ${manzanaOptionsHtml}

    ${showColor ? `
      <hr/>
      <label><b>Color de la sección</b></label><br/>
      <input id="editSeccionColor" type="color" value="${safe(currentColor)}"
        style="width:100%;height:44px;border:1px solid #ccc;border-radius:10px;padding:4px;cursor:pointer;" />
    ` : ""}


    <hr/>
    <label><b>Escalar (factor)</b></label><br/>
    <div style="display:flex;gap:8px;align-items:center;margin:6px 0;">
      <input id="scaleFactorInput" type="number" value="1" step="0.01"
        style="flex:1;padding:8px;border:1px solid #ccc;border-radius:8px;" />
      <button id="btnApplyScale"
        style="padding:8px 12px;border-radius:8px;border:1px solid #22c55e;background:#fff;color:#15803d;cursor:pointer;">
        Aplicar
      </button>
    </div>
    <p style="font-size:12px;color:#6b7280;margin-top:-2px;">
      Ejemplos: 1.10 = +10% · 0.90 = -10% · 2.00 = doble tamaño
    </p>


    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;">
      <button id="btnToggleMode" style="padding:8px 12px;border-radius:8px;border:1px solid #111;background:#fff;cursor:pointer;">
        ${editor.editSubmode === "vertices" ? "Mover/Escalar" : "Editar puntos"}
      </button>

      <button id="btnDeleteShape" style="padding:8px 12px;border-radius:8px;border:1px solid #ef4444;background:#fff;color:#b91c1c;cursor:pointer;">Borrar</button>
      <button id="btnCopyShape" style="padding:8px 12px;border-radius:8px;border:1px solid #ccc;cursor:pointer;">Copiar</button>
      <button id="btnPasteShape" style="padding:8px 12px;border-radius:8px;border:1px solid #ccc;cursor:pointer;">Pegar</button>
      <button id="btnCancelPaste" style="padding:8px 12px;border-radius:8px;border:1px solid #ccc;cursor:pointer;display:none;">Cancelar pegado</button>
      <button id="btnCopyGeo" style="padding:8px 12px;border-radius:8px;border:1px solid #ccc;cursor:pointer;">Copiar GeoJSON</button>
      <button id="btnBack" style="padding:8px 12px;border-radius:8px;border:1px solid #ccc;cursor:pointer;">Volver</button>
    </div>
  `);

  // Escalar por número (solo el objeto seleccionado)
  const btnApplyScale = document.getElementById("btnApplyScale");
  if (btnApplyScale){
    btnApplyScale.onclick = () => {
      if (!editor.selectedFeature) return notify("No hay figura seleccionada.", 1600);

      const raw = Number(document.getElementById("scaleFactorInput")?.value || 1);
      if (!isFinite(raw) || raw <= 0) return notify("Factor inválido. Usa un número > 0.", 2000);
      if (raw === 1) return notify("Factor = 1. No cambia nada.", 1400);

      const center = getFeatureCenterXY(editor.selectedFeature);
      if (!center) return notify("No pude calcular el centro de la figura.", 2000);

      // aplica escala respecto al centro del feature
      scaleFeatureInPlace(editor.selectedFeature, center.cx, center.cy, raw);

      // IMPORTANTE: re-render para ver cambios
      rerenderActiveEditor();
      notify(`✅ Escalado aplicado: x${raw}`, 1600);
    };
  }

  const $idInput = document.getElementById("editIdInput");
  if ($idInput){
    $idInput.oninput = () => {
      const newId = ($idInput.value || "").trim();
      if (!newId) return;
      setFeatureId(editor.selectedFeature, newId);
      $title.textContent = `Editar ${kind}: ${newId}`;
    };
  }



  // Editor LOTES: cambiar manzana del lote seleccionado
  const $editManSel = document.getElementById('editLoteManzana');
  if ($editManSel){
    $editManSel.onchange = () => {
      const man = ($editManSel.value || '').toString().trim();
      ensureLoteContextProps(editor.selectedFeature, getSelectedSeccion(), man);
      rerenderLotes_Edit();
      notify('Manzana actualizada (en memoria).', 1200);
    };
  }
  if (showColor){
    const $col = document.getElementById("editSeccionColor");
    if ($col){
      $col.oninput = () => {
        editor.selectedFeature.properties.color = $col.value;
        try { editor.selectedLayer.setStyle({ weight: 2, opacity: 1, fillOpacity: 0.06, fillColor: $col.value }); } catch {}
        notify("Color actualizado (en memoria).", 900);
      };
    }
  }

  const btnToggle = document.getElementById("btnToggleMode");
  if (btnToggle){
    btnToggle.onclick = () => {
      if (!editor.selectedLayer || !editor.selectedFeature) return;

      // Multi selection => no vertices
      if (editor.selectedSet.size > 1){
        notify("Para edición de puntos, selecciona solo 1 figura (sin Ctrl/Shift).", 2200);
        return;
      }

      if (editor.editSubmode === "vertices"){
        // pasar a transform
        editor.editSubmode = "transform";
        editorStopVertexEditing();
        rerenderActiveEditor();
        return;
      }

      // pasar a vertices
      editor.editSubmode = "vertices";
      clearGroupTransformUI();

      const layer = editor.selectedLayer;
      const feat = editor.selectedFeature;
      if (isCircleFeature(feat) && layer instanceof L.Circle) editorStartEditCircleVertices(layer);
      else editorStartEditPolygonVertices(layer);
    };
  }

  const btnDelete = document.getElementById("btnDeleteShape");
  if (btnDelete){
    btnDelete.onclick = () => {
      if (!confirm("¿Seguro que quieres borrar esta figura?")) return;
      deleteSelectedFeature();
    };
  }

  const btnCopyShape = document.getElementById("btnCopyShape");
  const btnPasteShape = document.getElementById("btnPasteShape");
  const btnCancelPaste = document.getElementById("btnCancelPaste");

  if (btnCopyShape) btnCopyShape.disabled = !editor.selectedFeature;
  if (btnPasteShape) btnPasteShape.disabled = !editor.clipboardFeature;

  if (btnCancelPaste){
    btnCancelPaste.style.display = editor.pasteArmed ? "inline-block" : "none";
    btnCancelPaste.onclick = () => {
      editor.pasteArmed = false;
      notify("Pegado cancelado.", 1200);
      renderEditSelectedPanel();
    };
  }

  if (btnCopyShape){
    btnCopyShape.onclick = () => {
      if (!editor.selectedFeature) return;
      editor.clipboardFeature = deepCopy(editor.selectedFeature);
      notify("Figura copiada. Presiona 'Pegar' y luego haz click en el mapa.", 2200);
      renderEditSelectedPanel();
    };
  }

  if (btnPasteShape){
    btnPasteShape.onclick = () => {
      if (!editor.clipboardFeature) return;
      editor.pasteArmed = true;
      notify("Modo PEGAR activado. Haz click en el mapa para colocar la copia.", 2200);
      renderEditSelectedPanel();
    };
  }

  document.getElementById("btnCopyGeo").onclick = async () => {
    const ds2 = getEditDataset();
    // Editor LOTES: asegurar que se copie con manzana
    if (isEditLotes && ds2?.data) { try { normalizeLotesContext(ds2.data); } catch {} }
    const txt = JSON.stringify(ds2?.data || { type:"FeatureCollection", features:[] }, null, 2);
    try {
      await navigator.clipboard.writeText(txt);
      notify("GeoJSON copiado. Pégalo en el archivo correspondiente.", 2200);
    } catch {
      setPanel("Copia manual", `<pre style="white-space:pre-wrap">${safe(txt)}</pre>`);
    }
  };

  document.getElementById("btnBack").onclick = () => {
    editorStopEditing();
    clearMultiSelection();
    editor.pasteArmed = false;
    if (isEditSecciones) renderEditSeccionesPanel();
    else if (isEditManzanas) renderEditManzanasPanel();
    else if (isEditLotes) renderEditLotesPanel();
    else renderEditNichosPanel();
  };
}

/* =========================================================
   GRID GROUP: mover la última cuadrícula
   ========================================================= */
function clearLastGridOverlay(){
  if (editor.lastGrid?.overlay){
    try { map.removeLayer(editor.lastGrid.overlay); } catch {}
  }
  if (editor.lastGrid?.centerMarker){
    try { map.removeLayer(editor.lastGrid.centerMarker); } catch {}
  }
  editor.lastGrid = null;
}

function activateGridGroup(datasetArr, features){
  clearLastGridOverlay();
  if (!datasetArr || !features || features.length === 0) return;

  const b = boundsFromFeatures(features);
  if (!b) return;

  const llb = boundsToLatLngBounds(b, 0.06);
  const c = boundsCenter(b);

  const rect = [
    [b.minY, b.minX],
    [b.minY, b.maxX],
    [b.maxY, b.maxX],
    [b.maxY, b.minX]
  ].map(([y,x]) => L.latLng(y,x));

  const overlay = L.polygon(rect, {
    weight: 2,
    color: "#ef4444",
    fillColor: "#ef4444",
    fillOpacity: 0.06,
    dashArray: "6 6"
  }).addTo(map);

  const centerMarker = L.marker(L.latLng(c.y, c.x), { draggable:true, icon: editor.iconCenter }).addTo(map);

  let last = centerMarker.getLatLng();

  centerMarker.on("drag", () => {
    const now = centerMarker.getLatLng();
    const dx = now.lng - last.lng;
    const dy = now.lat - last.lat;

    const latlngs = overlay.getLatLngs()[0] || overlay.getLatLngs();
    const moved = latlngs.map(p => L.latLng(p.lat + dy, p.lng + dx));
    overlay.setLatLngs([moved]);

    last = now;
  });

  centerMarker.on("dragend", () => {
    const now = centerMarker.getLatLng();
    const prevCenter = editor.lastGrid?.centerLL || L.latLng(c.y, c.x);
    const dx = now.lng - prevCenter.lng;
    const dy = now.lat - prevCenter.lat;

    for (const f of features){
      translateFeatureInPlace(f, dx, dy);
    }

    rerenderActiveEditor();
    activateGridGroup(datasetArr, features);
    notify("✅ Cuadrícula movida (guardado en memoria). Usa 'Copiar GeoJSON' para pegar en tu archivo.", 2200);
  });

  editor.lastGrid = {
    datasetArr,
    features,
    overlay,
    centerMarker,
    bounds: b,
    centerLL: L.latLng(c.y, c.x),
  };

  try { flyToBoundsSmooth(llb, 0.45); } catch {}
}

function activateLastGridIfAny(){
  if (editor.lastGrid?.datasetArr && editor.lastGrid?.features?.length){
    activateGridGroup(editor.lastGrid.datasetArr, editor.lastGrid.features);
  } else {
    notify("No hay una cuadrícula reciente para seleccionar.", 2000);
  }
}

/* =========================================================
   EDIT PANELS
   ========================================================= */
function renderEditSeccionesPanel(){
  editor.mode = "edit";
  editor.drawShape = "polygon";
  editor.gridArmed = false;
  editor.gridConfig = null;
  editor.pasteArmed = false;

  editorClearPoly();
  editorClearCircle();
  editorStopEditing();
  clearMultiSelection();

  setPanel("Edición: SECCIONES", `
    <p>Editor de <b>SECCIONES</b>.</p>
    <p style="font-size:12px;color:#6b7280;">
      Click normal: selecciona y permite <b>mover/escalar</b>.<br/>
      Botón “Editar puntos” para modificar vértices.<br/>
      Multi-select: <b>Ctrl/Cmd</b> o <b>Shift</b> + click (mover/escalar en grupo).
    </p>

    <div style="display:flex;gap:8px;flex-wrap:wrap;">
      <button id="btnEdit" style="padding:8px 12px;border-radius:8px;border:1px solid #ccc;cursor:pointer;">Editar existente</button>
      <button id="btnCreate" style="padding:8px 12px;border-radius:8px;border:1px solid #ccc;cursor:pointer;">Crear nueva</button>
      <button id="btnCopy" style="padding:8px 12px;border-radius:8px;border:1px solid #ccc;cursor:pointer;">Copiar GeoJSON</button>
      <button id="btnExit" style="padding:8px 12px;border-radius:8px;border:1px solid #ccc;cursor:pointer;">Salir</button>
    </div>

    <hr/>
    <div id="editBody"></div>

    <p style="font-size:12px;color:#666;margin-top:10px;">
      Destino: <b>${safe(SECCIONES_TOP_URL)}</b>
    </p>
  `);

  const $editBody = document.getElementById("editBody");

  document.getElementById("btnEdit").onclick = () => {
    editor.mode = "edit";
    editorClearPoly(); editorClearCircle();
    editorStopEditing();
    clearMultiSelection();
    $editBody.innerHTML = `<p><b>Editar:</b> clic en una sección para seleccionar.</p>`;
    rerenderSecciones_Edit();
  };

  document.getElementById("btnCreate").onclick = () => {
    editor.mode = "create";
    editorStopEditing();
    clearMultiSelection();
    clearGroupTransformUI();
    editorClearPoly(); editorClearCircle();

    $editBody.innerHTML = `
      <p><b>Crear sección:</b> elige forma:</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;">
        <button id="btnPoly" style="padding:8px 12px;border-radius:8px;border:1px solid #ccc;cursor:pointer;">Polígono</button>
        <button id="btnCircle" style="padding:8px 12px;border-radius:8px;border:1px solid #ccc;cursor:pointer;">Círculo</button>
        <button id="btnClear" style="padding:8px 12px;border-radius:8px;border:1px solid #ccc;cursor:pointer;">Limpiar</button>
      </div>

      <p><b>Puntos (polígono):</b> <span id="ptCount">0</span></p>

      <label><b>SECCIÓN</b></label><br/>
      <input id="newSeccion" placeholder="Ej. SAN ANDRES" style="width:100%;padding:8px;margin:6px 0;border:1px solid #ccc;border-radius:8px;" />

      <label><b>Nombre (opcional)</b></label><br/>
      <input id="newNombre" placeholder="Ej. Zona SAN ANDRES" style="width:100%;padding:8px;margin:6px 0;border:1px solid #ccc;border-radius:8px;" />

      <label><b>Color</b></label><br/>
      <input id="newColor" type="color" value="${DEFAULT_SECCION_COLOR}"
        style="width:100%;height:44px;border:1px solid #ccc;border-radius:10px;padding:4px;cursor:pointer;" />

      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">
        <button id="btnSaveNew" style="padding:8px 12px;border-radius:8px;border:1px solid #ccc;cursor:pointer;">Guardar</button>
      </div>
    `;

    document.getElementById("btnPoly").onclick = () => { editor.drawShape = "polygon"; };
    document.getElementById("btnCircle").onclick = () => { editor.drawShape = "circle"; };
    document.getElementById("btnClear").onclick = () => { editorClearPoly(); editorClearCircle(); };

    document.getElementById("btnSaveNew").onclick = () => {
      const seccion = (document.getElementById("newSeccion").value || "").trim();
      const nombre  = (document.getElementById("newNombre").value || "").trim();
      const color   = (document.getElementById("newColor").value || "").trim() || DEFAULT_SECCION_COLOR;

      if (!seccion) return notify("Falta SECCIÓN.", 2000);

      const props = { seccion, nombre: nombre || seccion, id: seccion, color };

      let feature = null;
      if (editor.drawShape === "polygon"){
        if (editor.polyPoints.length < 3) return notify("Polígono: mínimo 3 puntos.", 2200);
        feature = { type:"Feature", geometry:{ type:"Polygon", coordinates:ringToGeoJsonCoords(editor.polyPoints) }, properties: props };
      } else {
        if (!editor.circleCenter || typeof editor.circleRadius !== "number") return notify("Círculo: clic centro y luego borde.", 2200);
        feature = { type:"Feature", geometry:{ type:"Point", coordinates: latLngToXY(editor.circleCenter) }, properties:{ ...props, shape:"circle", radius: editor.circleRadius } };
      }

      seccionesTopRaw.features.push(feature);
      editorClearPoly(); editorClearCircle();
      rerenderSecciones_Edit();
      notify("✅ Sección creada (en memoria). Usa 'Copiar GeoJSON' para pegar en el archivo.", 2400);
    };

    rerenderSecciones_Edit();
  };

  document.getElementById("btnCopy").onclick = async () => {
    const txt = JSON.stringify(seccionesTopRaw || { type:"FeatureCollection", features:[] }, null, 2);
    try {
      await navigator.clipboard.writeText(txt);
      notify("GeoJSON copiado. Pégalo en data/secciones-top.geojson.", 2400);
    } catch {
      setPanel("Copia manual", `<pre style="white-space:pre-wrap">${safe(txt)}</pre>`);
    }
  };

  document.getElementById("btnExit").onclick = () => location.href = "./";
  document.getElementById("btnEdit").click();
}

function renderEditManzanasPanel(){
  editor.mode = "edit";
  editor.drawShape = "polygon";
  editor.gridArmed = false;
  editor.gridConfig = null;
  editor.pasteArmed = false;

  editorClearPoly(); editorClearCircle(); editorStopEditing();
  clearMultiSelection();

  setPanel("Edición: MANZANAS", `
    <p>Editor de <b>MANZANAS</b> (IDs: A, B, C...).</p>
    <p style="font-size:12px;color:#6b7280;">
      Click normal: selecciona y permite <b>mover/escalar</b>. “Editar puntos” para vértices.<br/>
      Multi-select: <b>Ctrl/Cmd</b> o <b>Shift</b> + click.
    </p>

    <div style="display:flex;gap:8px;flex-wrap:wrap;">
      <button id="btnEdit" style="padding:8px 12px;border-radius:8px;border:1px solid #ccc;cursor:pointer;">Editar existente</button>
      <button id="btnCreate" style="padding:8px 12px;border-radius:8px;border:1px solid #ccc;cursor:pointer;">Crear 1 manzana</button>
      <button id="btnGrid" style="padding:8px 12px;border-radius:8px;border:1px solid #111;cursor:pointer;">Crear cuadrícula</button>
      <button id="btnSelectGrid" style="padding:8px 12px;border-radius:8px;border:1px solid #ef4444;color:#b91c1c;background:#fff;cursor:pointer;">Seleccionar última cuadrícula</button>
      <button id="btnCopy" style="padding:8px 12px;border-radius:8px;border:1px solid #ccc;cursor:pointer;">Copiar GeoJSON</button>
      <button id="btnExit" style="padding:8px 12px;border-radius:8px;border:1px solid #ccc;cursor:pointer;">Salir</button>
    </div>

    <hr/>
    <div id="editBody"></div>

    <p style="font-size:12px;color:#666;margin-top:10px;">
      Destino: <b>${safe(MANZANAS_URL)}</b>
    </p>
  `);

  const $editBody = document.getElementById("editBody");

  document.getElementById("btnSelectGrid").onclick = () => activateLastGridIfAny();

  document.getElementById("btnEdit").onclick = () => {
    editor.mode = "edit";
    editorClearPoly(); editorClearCircle();
    editorStopEditing();
    clearMultiSelection();
    $editBody.innerHTML = `<p><b>Editar:</b> clic en una manzana para seleccionar.</p>`;
    rerenderManzanas_Edit();
  };

  document.getElementById("btnCreate").onclick = () => {
    editor.mode = "create";
    editorStopEditing();
    clearMultiSelection();
    clearGroupTransformUI();
    editorClearPoly(); editorClearCircle();

    $editBody.innerHTML = `
      <p><b>Crear 1 manzana:</b> elige forma:</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;">
        <button id="btnPoly" style="padding:8px 12px;border-radius:8px;border:1px solid #ccc;cursor:pointer;">Polígono</button>
        <button id="btnCircle" style="padding:8px 12px;border-radius:8px;border:1px solid #ccc;cursor:pointer;">Círculo</button>
        <button id="btnClear" style="padding:8px 12px;border-radius:8px;border:1px solid #ccc;cursor:pointer;">Limpiar</button>
      </div>

      <p><b>Puntos (polígono):</b> <span id="ptCount">0</span></p>

      <label><b>SECCIÓN</b></label><br/>
      <input id="newSeccion" placeholder="Ej. SAN ANDRES" style="width:100%;padding:8px;margin:6px 0;border:1px solid #ccc;border-radius:8px;" />

      <label><b>MANZANA</b> (A, B, C...)</label><br/>
      <input id="newManzana" placeholder="Ej. A" style="width:100%;padding:8px;margin:6px 0;border:1px solid #ccc;border-radius:8px;" />

      <label><b>Nombre (opcional)</b></label><br/>
      <input id="newNombre" placeholder="Ej. SAN ANDRES - A" style="width:100%;padding:8px;margin:6px 0;border:1px solid #ccc;border-radius:8px;" />

      <label><b>Archivo de lotes</b></label><br/>
      <input id="newLotesFile" placeholder="Ej. ./data/lotes/lotes-SAN ANDRES-A.geojson" style="width:100%;padding:8px;margin:6px 0;border:1px solid #ccc;border-radius:8px;" />

      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">
        <button id="btnSaveNew" style="padding:8px 12px;border-radius:8px;border:1px solid #ccc;cursor:pointer;">Guardar</button>
      </div>
    `;

    document.getElementById("btnPoly").onclick = () => { editor.drawShape = "polygon"; };
    document.getElementById("btnCircle").onclick = () => { editor.drawShape = "circle"; };
    document.getElementById("btnClear").onclick = () => { editorClearPoly(); editorClearCircle(); };

    document.getElementById("btnSaveNew").onclick = () => {
      const seccion = (document.getElementById("newSeccion").value || "").trim();
      const manzana = (document.getElementById("newManzana").value || "").trim().toUpperCase();
      const nombre  = (document.getElementById("newNombre").value || "").trim();
      const lotesFileIn = (document.getElementById("newLotesFile").value || "").trim();

      if (!seccion) return notify("Falta SECCIÓN.", 2000);
      if (!manzana) return notify("Falta MANZANA.", 2000);

      const lotesFile = lotesFileIn || `./data/lotes/lotes-${seccion}-${manzana}.geojson`;
      const props = { seccion, manzana, nombre: nombre || `${seccion} - ${manzana}`, lotesFile, id: `${seccion}-${manzana}` };

      let feature = null;
      if (editor.drawShape === "polygon"){
        if (editor.polyPoints.length < 3) return notify("Polígono: mínimo 3 puntos.", 2200);
        feature = { type:"Feature", geometry:{ type:"Polygon", coordinates:ringToGeoJsonCoords(editor.polyPoints) }, properties: props };
      } else {
        if (!editor.circleCenter || typeof editor.circleRadius !== "number") return notify("Círculo: clic centro y luego borde.", 2200);
        feature = { type:"Feature", geometry:{ type:"Point", coordinates: latLngToXY(editor.circleCenter) }, properties:{ ...props, shape:"circle", radius: editor.circleRadius } };
      }

      manzanasRaw.features.push(feature);
      editorClearPoly(); editorClearCircle();
      rerenderManzanas_Edit();
      notify("✅ Manzana creada (en memoria). Usa 'Copiar GeoJSON' para guardar.", 2400);
    };

    rerenderManzanas_Edit();
  };

  document.getElementById("btnGrid").onclick = () => {
    editor.mode = "grid";
    editor.gridArmed = true;
    editor.gridConfig = { target: "manzanas" };
    editorStopEditing();
    clearMultiSelection();
    clearGroupTransformUI();
    editorClearPoly(); editorClearCircle();

    $editBody.innerHTML = `
      <p><b>Crear cuadrícula de MANZANAS (con rotación)</b></p>
      <p style="color:#6b7280;font-size:12px;">
        1) Configura filas/columnas/tamaño/espacios/rotación. 2) Presiona <b>Armar</b>.
        3) Da <b>1 click</b> en el mapa para colocar la esquina superior-izquierda.
      </p>

      <label><b>SECCIÓN</b></label><br/>
      <input id="mGridSeccion" placeholder="Ej. SAN ANDRES" style="width:100%;padding:8px;margin:6px 0;border:1px solid #ccc;border-radius:8px;" />

      <label><b>Filas</b></label><br/>
      <input id="mGridRows" type="number" value="3" min="1" style="width:100%;padding:8px;margin:6px 0;border:1px solid #ccc;border-radius:8px;" />

      <label><b>Columnas</b></label><br/>
      <input id="mGridCols" type="number" value="5" min="1" style="width:100%;padding:8px;margin:6px 0;border:1px solid #ccc;border-radius:8px;" />

      <label><b>Ancho (px)</b></label><br/>
      <input id="mGridW" type="number" value="220" min="1" style="width:100%;padding:8px;margin:6px 0;border:1px solid #ccc;border-radius:8px;" />

      <label><b>Alto (px)</b></label><br/>
      <input id="mGridH" type="number" value="160" min="1" style="width:100%;padding:8px;margin:6px 0;border:1px solid #ccc;border-radius:8px;" />

      <label><b>Espacio X (px)</b></label><br/>
      <input id="mGridGapX" type="number" value="20" min="0" style="width:100%;padding:8px;margin:6px 0;border:1px solid #ccc;border-radius:8px;" />

      <label><b>Espacio Y (px)</b></label><br/>
      <input id="mGridGapY" type="number" value="20" min="0" style="width:100%;padding:8px;margin:6px 0;border:1px solid #ccc;border-radius:8px;" />

      <label><b>Rotación (grados)</b></label><br/>
      <input id="mGridRot" type="number" value="0" step="0.1" style="width:100%;padding:8px;margin:6px 0;border:1px solid #ccc;border-radius:8px;" />

      <label><b>Manzana inicial</b> (A)</label><br/>
      <input id="mGridStart" value="A" style="width:100%;padding:8px;margin:6px 0;border:1px solid #ccc;border-radius:8px;" />

      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">
        <button id="btnArmManzGrid" style="padding:8px 12px;border-radius:8px;border:1px solid #111;cursor:pointer;">Armar</button>
        <button id="btnCancelManzGrid" style="padding:8px 12px;border-radius:8px;border:1px solid #ccc;cursor:pointer;">Cancelar</button>
      </div>

      <p id="mGridHint" style="margin-top:10px;color:#6b7280;font-size:12px;"></p>
    `;

    const hint = document.getElementById("mGridHint");

    document.getElementById("btnCancelManzGrid").onclick = () => {
      editor.gridArmed = false;
      editor.gridConfig = null;
      notify("Cuadrícula cancelada.", 1400);
      renderEditManzanasPanel();
    };

    document.getElementById("btnArmManzGrid").onclick = () => {
      const seccion = (document.getElementById("mGridSeccion").value || "").trim();
      const rows = Number(document.getElementById("mGridRows").value || 0);
      const cols = Number(document.getElementById("mGridCols").value || 0);
      const w = Number(document.getElementById("mGridW").value || 0);
      const h = Number(document.getElementById("mGridH").value || 0);
      const gapX = Number(document.getElementById("mGridGapX").value || 0);
      const gapY = Number(document.getElementById("mGridGapY").value || 0);
      const rot = Number(document.getElementById("mGridRot").value || 0);
      const start = (document.getElementById("mGridStart").value || "").trim().toUpperCase();

      if (!seccion) return notify("Falta SECCIÓN.", 2000);
      if (!rows || !cols || w <= 0 || h <= 0) return notify("Revisa filas/columnas/ancho/alto.", 2200);
      if (!start) return notify("Falta manzana inicial.", 2000);

      editor.gridConfig = { target:"manzanas", seccion, rows, cols, w, h, gapX, gapY, rot, start };
      editor.gridArmed = true;

      if (hint) hint.textContent = "✅ Listo. Ahora da 1 click en el mapa para colocar la esquina superior-izquierda.";
      notify("Cuadrícula armada. Click en el mapa para colocar.", 2200);
    };

    rerenderManzanas_Edit();
  };

  document.getElementById("btnCopy").onclick = async () => {
    const txt = JSON.stringify(manzanasRaw || { type:"FeatureCollection", features:[] }, null, 2);
    try {
      await navigator.clipboard.writeText(txt);
      notify("GeoJSON copiado. Pégalo en data/secciones.geojson.", 2400);
    } catch {
      setPanel("Copia manual", `<pre style="white-space:pre-wrap">${safe(txt)}</pre>`);
    }
  };

  document.getElementById("btnExit").onclick = () => location.href = "./";
  document.getElementById("btnEdit").click();
}

function renderEditNichosPanel(){
  editor.mode = "edit";
  editor.drawShape = "polygon";
  editor.gridArmed = false;
  editor.gridConfig = null;
  editor.pasteArmed = false;

  editorClearPoly(); editorClearCircle(); editorStopEditing();
  clearMultiSelection();

  setPanel("Edición: NICHOS", `
    <p>Editor de <b>Zonas de Nichos</b>.</p>
    <p style="font-size:12px;color:#6b7280;">
      Click normal: selecciona y permite <b>mover/escalar</b>. “Editar puntos” para vértices.<br/>
      Multi-select: <b>Ctrl/Cmd</b> o <b>Shift</b> + click.
    </p>

    <div style="display:flex;gap:8px;flex-wrap:wrap;">
      <button id="btnEdit" style="padding:8px 12px;border-radius:8px;border:1px solid #ccc;cursor:pointer;">Editar existente</button>
      <button id="btnCreate" style="padding:8px 12px;border-radius:8px;border:1px solid #ccc;cursor:pointer;">Crear nueva</button>
      <button id="btnCopy" style="padding:8px 12px;border-radius:8px;border:1px solid #ccc;cursor:pointer;">Copiar GeoJSON</button>
      <button id="btnExit" style="padding:8px 12px;border-radius:8px;border:1px solid #ccc;cursor:pointer;">Salir</button>
    </div>

    <hr/>
    <div id="editBody"></div>

    <p style="font-size:12px;color:#666;margin-top:10px;">
      Destino: <b>${safe(NICHOS_ZONAS_URL)}</b>
    </p>
  `);

  const $editBody = document.getElementById("editBody");

  document.getElementById("btnEdit").onclick = () => {
    editor.mode = "edit";
    editorClearPoly(); editorClearCircle();
    editorStopEditing();
    clearMultiSelection();
    $editBody.innerHTML = `<p><b>Editar:</b> clic en una zona de nichos para seleccionar.</p>`;
    rerenderNichos_Edit();
  };

  document.getElementById("btnCreate").onclick = () => {
    editor.mode = "create";
    editorStopEditing();
    clearMultiSelection();
    clearGroupTransformUI();
    editorClearPoly(); editorClearCircle();

    $editBody.innerHTML = `
      <p><b>Crear zona de nichos:</b></p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;">
        <button id="btnPoly" style="padding:8px 12px;border-radius:8px;border:1px solid #ccc;cursor:pointer;">Polígono</button>
        <button id="btnCircle" style="padding:8px 12px;border-radius:8px;border:1px solid #ccc;cursor:pointer;">Círculo</button>
        <button id="btnClear" style="padding:8px 12px;border-radius:8px;border:1px solid #ccc;cursor:pointer;">Limpiar</button>
      </div>

      <p><b>Puntos (polígono):</b> <span id="ptCount">0</span></p>

      <label><b>ID zona</b></label><br/>
      <input id="newZonaId" placeholder="Ej. PLN" style="width:100%;padding:8px;margin:6px 0;border:1px solid #ccc;border-radius:8px;" />

      <label><b>Prefijo</b> (PLN o SPN)</label><br/>
      <select id="newPrefix" style="width:100%;padding:8px;margin:6px 0;border:1px solid #ccc;border-radius:8px;">
        <option>PLN</option>
        <option>SPN</option>
      </select>

      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">
        <button id="btnSaveNew" style="padding:8px 12px;border-radius:8px;border:1px solid #ccc;cursor:pointer;">Guardar zona</button>
      </div>
    `;

    document.getElementById("btnPoly").onclick = () => { editor.drawShape = "polygon"; };
    document.getElementById("btnCircle").onclick = () => { editor.drawShape = "circle"; };
    document.getElementById("btnClear").onclick = () => { editorClearPoly(); editorClearCircle(); };

    document.getElementById("btnSaveNew").onclick = () => {
      const id = (document.getElementById("newZonaId").value || "").trim();
      const prefix = (document.getElementById("newPrefix").value || "PLN").trim();
      if (!id) return notify("Falta ID zona.", 2000);

      const props = { id, prefix };

      let feature = null;
      if (editor.drawShape === "polygon"){
        if (editor.polyPoints.length < 3) return notify("Polígono: mínimo 3 puntos.", 2200);
        feature = { type:"Feature", geometry:{ type:"Polygon", coordinates:ringToGeoJsonCoords(editor.polyPoints) }, properties: props };
      } else {
        if (!editor.circleCenter || typeof editor.circleRadius !== "number") return notify("Círculo: clic centro y luego borde.", 2200);
        feature = { type:"Feature", geometry:{ type:"Point", coordinates: latLngToXY(editor.circleCenter) }, properties:{ ...props, shape:"circle", radius: editor.circleRadius } };
      }

      nichosZonasRaw.features.push(feature);
      editorClearPoly(); editorClearCircle();
      rerenderNichos_Edit();
      notify("✅ Zona creada (en memoria). Usa 'Copiar GeoJSON' para pegar en el archivo.", 2400);
    };

    rerenderNichos_Edit();
  };

  document.getElementById("btnCopy").onclick = async () => {
    const txt = JSON.stringify(nichosZonasRaw || { type:"FeatureCollection", features:[] }, null, 2);
    try {
      await navigator.clipboard.writeText(txt);
      notify("GeoJSON copiado. Pégalo en data/nichos-zonas.geojson.", 2400);
    } catch {
      setPanel("Copia manual", `<pre style="white-space:pre-wrap">${safe(txt)}</pre>`);
    }
  };

  document.getElementById("btnExit").onclick = () => location.href = "./";
  document.getElementById("btnEdit").click();
}

function renderEditLotesPanel(){
  // NOTA: en editor LOTES, el dataset es por SECCIÓN (archivo compartido).
  // La MANZANA es solo un filtro visual.
  editor.drawShape = 'polygon';
  editor.gridArmed = false;
  editor.gridConfig = null;
  editor.pasteArmed = false;

  // Si estás en circular y vuelves aquí, regresamos a modo edit.
  if (editor.mode !== 'circular') editor.mode = 'edit';
  editor.circularArmed = false;
  editor.circularPickingTemplate = false;

  editorClearPoly(); editorClearCircle(); editorStopEditing();
  clearMultiSelection();

  const sec = getSelectedSeccion();
  const filterMan = editor.lotesFilterManzana || getSelectedManzana() || '';
  const lotesFile = currentLotesSourceUrl || (sec ? getSharedLotesUrlForSeccion(sec) : '(elige SECCIÓN)');

  setPanel('Edición: LOTES', `
    <p><b>SECCIÓN</b>: ${safe(sec || '(elige SECCIÓN arriba)')}</p>
    <p><b>Filtro MANZANA</b>: ${safe(filterMan || '(todas)')}</p>
    <p style="font-size:12px;color:#6b7280;">
      • El archivo de lotes es <b>por SECCIÓN</b> (no se borra al cambiar de manzana).<br/>
      • La manzana solo filtra lo que ves. Para asignar manzana a un lote: selecciónalo y usa el selector en el panel.
    </p>

    <div style="display:flex;gap:8px;flex-wrap:wrap;">
      <button id="btnEdit" style="padding:8px 12px;border-radius:8px;border:1px solid #ccc;cursor:pointer;">Editar existente</button>
      <button id="btnCreate" style="padding:8px 12px;border-radius:8px;border:1px solid #ccc;cursor:pointer;">Crear 1 lote</button>
      <button id="btnGrid" style="padding:8px 12px;border-radius:8px;border:1px solid #111;cursor:pointer;">Crear cuadrícula</button>
      <button id="btnCirc" style="padding:8px 12px;border-radius:8px;border:1px solid #111;cursor:pointer;">Repetir circular</button>
      <button id="btnSelectGrid" style="padding:8px 12px;border-radius:8px;border:1px solid #ef4444;color:#b91c1c;background:#fff;cursor:pointer;">Seleccionar último grupo</button>
      <button id="btnCopy" style="padding:8px 12px;border-radius:8px;border:1px solid #ccc;cursor:pointer;">Copiar GeoJSON</button>
      <button id="btnExit" style="padding:8px 12px;border-radius:8px;border:1px solid #ccc;cursor:pointer;">Salir</button>
    </div>

    <hr/>
    <div id="editBody"></div>

    <p style="font-size:12px;color:#666;margin-top:10px;">
      Destino: <b>${safe(lotesFile)}</b>
    </p>
  `);

  const $editBody = document.getElementById('editBody');

  // Seleccionar último grupo
  document.getElementById('btnSelectGrid').onclick = () => activateLastGridIfAny();

  // Editar
  document.getElementById('btnEdit').onclick = () => {
    editor.mode = 'edit';
    editorClearPoly(); editorClearCircle();
    editorStopEditing();
    clearMultiSelection();
    $editBody.innerHTML = `<p><b>Editar:</b> clic en un lote para seleccionar.</p>`;
    rerenderLotes_Edit();
  };

  // Crear 1 lote
  document.getElementById('btnCreate').onclick = () => {
    if (!getSelectedSeccion()) return notify('Primero elige una SECCIÓN arriba.', 2200);
    editor.mode = 'create';
    editorStopEditing();
    clearMultiSelection();
    clearGroupTransformUI();
    editorClearPoly(); editorClearCircle();

    const sec2 = getSelectedSeccion();
    const list = buildManzanasListBySeccion(manzanasRaw.features, sec2);
    const options = ['<option value="">(sin manzana)</option>'].concat(
      list.map(f => {
        const m = getPropManzana(f);
        return `<option value="${safe(m)}" ${m===filterMan?'selected':''}>${safe(m)}</option>`;
      })
    ).join('');

    $editBody.innerHTML = `
      <p><b>Crear 1 lote:</b> elige forma:</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;">
        <button id="btnPoly" style="padding:8px 12px;border-radius:8px;border:1px solid #ccc;cursor:pointer;">Polígono</button>
        <button id="btnCircle" style="padding:8px 12px;border-radius:8px;border:1px solid #ccc;cursor:pointer;">Círculo</button>
        <button id="btnClear" style="padding:8px 12px;border-radius:8px;border:1px solid #ccc;cursor:pointer;">Limpiar</button>
      </div>

      <p><b>Puntos (polígono):</b> <span id="ptCount">0</span></p>

      <label><b>MANZANA</b></label><br/>
      <select id="newLoteManzana" style="width:100%;padding:8px;margin:6px 0;border:1px solid #ccc;border-radius:8px;">${options}</select>

      <label><b>LOTE</b></label><br/>
      <input id="newLote" placeholder="Ej. 001" style="width:100%;padding:8px;margin:6px 0;border:1px solid #ccc;border-radius:8px;" />

      <label><b>Estatus</b></label><br/>
      <select id="newStatus" style="width:100%;padding:8px;margin:6px 0;border:1px solid #ccc;border-radius:8px;">
        <option>disponible</option>
        <option>ocupado</option>
        <option>por construir</option>
      </select>

      <label><b>Paquete (opcional)</b></label><br/>
      <input id="newPkg" placeholder="Ej. PAQ-STD" style="width:100%;padding:8px;margin:6px 0;border:1px solid #ccc;border-radius:8px;" />

      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">
        <button id="btnSaveNew" style="padding:8px 12px;border-radius:8px;border:1px solid #ccc;cursor:pointer;">Guardar</button>
      </div>
    `;

    document.getElementById('btnPoly').onclick = () => { editor.drawShape = 'polygon'; };
    document.getElementById('btnCircle').onclick = () => { editor.drawShape = 'circle'; };
    document.getElementById('btnClear').onclick = () => { editorClearPoly(); editorClearCircle(); };

    document.getElementById('btnSaveNew').onclick = () => {
      if (!currentLotesRaw) currentLotesRaw = { type:'FeatureCollection', features:[] };
      const lote = (document.getElementById('newLote').value || '').trim();
      if (!lote) return notify('Falta LOTE.', 2000);
      const estatus = document.getElementById('newStatus').value;
      const paquete = (document.getElementById('newPkg').value || '').trim() || null;
      const manzana = (document.getElementById('newLoteManzana').value || '').trim();

      const props = { lote, id: lote, estatus, paquete };
      const feature = { type:'Feature', geometry:null, properties: props };

      if (editor.drawShape === 'polygon'){
        if (editor.polyPoints.length < 3) return notify('Polígono: mínimo 3 puntos.', 2200);
        feature.geometry = { type:'Polygon', coordinates:ringToGeoJsonCoords(editor.polyPoints) };
      } else {
        if (!editor.circleCenter || typeof editor.circleRadius !== 'number') return notify('Círculo: clic centro y luego borde.', 2200);
        feature.geometry = { type:'Point', coordinates: latLngToXY(editor.circleCenter) };
        feature.properties.shape = 'circle';
        feature.properties.radius = editor.circleRadius;
      }

      ensureLoteContextProps(feature, sec2, manzana);
      currentLotesRaw.features.push(feature);
      editorClearPoly(); editorClearCircle();
      rerenderLotes_Edit();
      notify('✅ Lote creado (en memoria). Usa "Copiar GeoJSON" para guardar.', 2400);
    };

    rerenderLotes_Edit();
  };

  // Cuadrícula lotes
  document.getElementById('btnGrid').onclick = () => {
    if (!getSelectedSeccion()) return notify('Primero elige una SECCIÓN arriba.', 2200);
    editor.mode = 'grid';
    editor.gridArmed = true;
    editor.gridConfig = { target: 'lotes' };
    editorStopEditing();
    clearMultiSelection();
    clearGroupTransformUI();
    editorClearPoly(); editorClearCircle();

    const sec2 = getSelectedSeccion();
    const list = buildManzanasListBySeccion(manzanasRaw.features, sec2);
    const options = ['<option value="">(sin manzana)</option>'].concat(
      list.map(f => {
        const m = getPropManzana(f);
        return `<option value="${safe(m)}" ${m===filterMan?'selected':''}>${safe(m)}</option>`;
      })
    ).join('');

    $editBody.innerHTML = `
      <p><b>Crear cuadrícula de LOTES (con rotación)</b></p>
      <p style="color:#6b7280;font-size:12px;">
        1) Configura filas/columnas/tamaño/espacios/rotación. 2) Presiona <b>Armar</b>.
        3) Da <b>1 click</b> en el mapa para colocar la esquina superior-izquierda.
      </p>

      <label><b>MANZANA</b> (se asigna a todos los lotes creados)</label><br/>
      <select id="gridManzana" style="width:100%;padding:8px;margin:6px 0;border:1px solid #ccc;border-radius:8px;">${options}</select>

      <label><b>Filas</b></label><br/>
      <input id="gridRows" type="number" value="5" min="1" style="width:100%;padding:8px;margin:6px 0;border:1px solid #ccc;border-radius:8px;" />

      <label><b>Columnas</b></label><br/>
      <input id="gridCols" type="number" value="10" min="1" style="width:100%;padding:8px;margin:6px 0;border:1px solid #ccc;border-radius:8px;" />

      <label><b>Ancho (px)</b></label><br/>
      <input id="gridW" type="number" value="80" min="1" style="width:100%;padding:8px;margin:6px 0;border:1px solid #ccc;border-radius:8px;" />

      <label><b>Alto (px)</b></label><br/>
      <input id="gridH" type="number" value="40" min="1" style="width:100%;padding:8px;margin:6px 0;border:1px solid #ccc;border-radius:8px;" />

      <label><b>Espacio X (px)</b></label><br/>
      <input id="gridGapX" type="number" value="10" min="0" style="width:100%;padding:8px;margin:6px 0;border:1px solid #ccc;border-radius:8px;" />

      <label><b>Espacio Y (px)</b></label><br/>
      <input id="gridGapY" type="number" value="10" min="0" style="width:100%;padding:8px;margin:6px 0;border:1px solid #ccc;border-radius:8px;" />

      <label><b>Rotación (grados)</b></label><br/>
      <input id="gridRot" type="number" value="0" step="0.1" style="width:100%;padding:8px;margin:6px 0;border:1px solid #ccc;border-radius:8px;" />

      <label><b>Lote inicial</b> (ej. 001)</label><br/>
      <input id="gridStart" value="001" style="width:100%;padding:8px;margin:6px 0;border:1px solid #ccc;border-radius:8px;" />

      <label><b>Incremento</b></label><br/>
      <input id="gridInc" type="number" value="1" min="1" style="width:100%;padding:8px;margin:6px 0;border:1px solid #ccc;border-radius:8px;" />

      <label><b>Estatus</b></label><br/>
      <select id="gridStatus" style="width:100%;padding:8px;margin:6px 0;border:1px solid #ccc;border-radius:8px;">
        <option>disponible</option>
        <option>ocupado</option>
        <option>por construir</option>
      </select>

      <label><b>Paquete (opcional)</b></label><br/>
      <input id="gridPkg" placeholder="Ej. PAQ-STD" style="width:100%;padding:8px;margin:6px 0;border:1px solid #ccc;border-radius:8px;" />

      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">
        <button id="btnArmGrid" style="padding:8px 12px;border-radius:8px;border:1px solid #111;cursor:pointer;">Armar</button>
        <button id="btnCancelGrid" style="padding:8px 12px;border-radius:8px;border:1px solid #ccc;cursor:pointer;">Cancelar</button>
      </div>

      <p id="gridHint" style="margin-top:10px;color:#6b7280;font-size:12px;"></p>
    `;

    const hint = document.getElementById('gridHint');

    document.getElementById('btnCancelGrid').onclick = () => {
      editor.gridArmed = false;
      editor.gridConfig = null;
      editor.mode = 'edit';
      notify('Cuadrícula cancelada.', 1400);
      renderEditLotesPanel();
    };

    document.getElementById('btnArmGrid').onclick = () => {
      const rows = Number(document.getElementById('gridRows').value || 0);
      const cols = Number(document.getElementById('gridCols').value || 0);
      const w = Number(document.getElementById('gridW').value || 0);
      const h = Number(document.getElementById('gridH').value || 0);
      const gapX = Number(document.getElementById('gridGapX').value || 0);
      const gapY = Number(document.getElementById('gridGapY').value || 0);
      const rot = Number(document.getElementById('gridRot').value || 0);
      const start = (document.getElementById('gridStart').value || '').trim();
      const inc = Number(document.getElementById('gridInc').value || 1);
      const estatus = document.getElementById('gridStatus').value;
      const paquete = (document.getElementById('gridPkg').value || '').trim() || null;
      const manzana = (document.getElementById('gridManzana').value || '').trim();

      if (!rows || !cols || w <= 0 || h <= 0) return notify('Revisa filas/columnas/ancho/alto.', 2200);
      if (!start) return notify('Falta lote inicial.', 2000);

      editor.gridConfig = { target:'lotes', rows, cols, w, h, gapX, gapY, rot, start, inc, estatus, paquete, seccion: sec2, manzana };
      editor.gridArmed = true;

      if (hint) hint.textContent = '✅ Listo. Ahora da 1 click en el mapa para colocar la esquina superior-izquierda.';
      notify('Cuadrícula armada. Click en el mapa para colocar.', 2200);
    };

    rerenderLotes_Edit();
  };

  // Repetir circular
  document.getElementById('btnCirc').onclick = () => {
    if (!getSelectedSeccion()) return notify('Primero elige una SECCIÓN arriba.', 2200);

    editor.mode = 'circular';
    editor.circularArmed = false;
    editor.circularPickingTemplate = true;
    editor.circularConfig = {
      target: 'lotes_circular',
      count: 12,
      degrees: 360,
      startDeg: null,
      includeOriginal: true,
      template: null,
      seccion: getSelectedSeccion(),
      manzana: editor.lotesFilterManzana || ''
    };

    notify('Modo circular: haz click en 1 lote para usarlo como plantilla.', 2400);
    renderCircularRepeatPanel();
    rerenderLotes_Edit();
  };

  // Copiar GeoJSON
  document.getElementById('btnCopy').onclick = async () => {
    const fc = deepCopy(currentLotesRaw || { type:'FeatureCollection', features:[] });
    try { normalizeLotesContext(fc); } catch {}
    const txt = JSON.stringify(fc, null, 2);
    try {
      await navigator.clipboard.writeText(txt);
      notify('GeoJSON copiado. Pégalo en el archivo de lotes de la sección.', 2400);
    } catch {
      setPanel('Copia manual', `<pre style="white-space:pre-wrap">${safe(txt)}</pre>`);
    }
  };

  document.getElementById('btnExit').onclick = () => location.href = './';

  // estado inicial
  document.getElementById('btnEdit').click();
}

function renderCircularRepeatPanel(){
  const $editBody = document.getElementById('editBody');
  if (!$editBody) return;

  const cfg = editor.circularConfig || { count: 12, degrees: 360, startDeg: null, includeOriginal: true, template: null };
  const tplId = cfg.template ? (getFeatureId(cfg.template) || '(sin id)') : null;

  $editBody.innerHTML = `
    <div style="border:1px solid #e5e7eb;border-radius:12px;padding:10px;background:#fff;">
      <p style="margin:0 0 6px 0;"><b>Repetir circular</b></p>
      <p style="margin:0 0 10px 0;color:#6b7280;font-size:12px;">
        1) Define <b>Copias (X)</b> y <b>Grados (Y)</b>.<br/>
        2) Click en 1 lote para escoger la <b>plantilla</b>.<br/>
        3) Presiona <b>Armar</b> y luego haz <b>1 click</b> en el mapa para poner el <b>centro</b>.
      </p>

      <label><b>Copias (X)</b></label><br/>
      <input id="circCount" type="number" value="${safe(cfg.count ?? 12)}" min="1"
        style="width:100%;padding:8px;margin:6px 0;border:1px solid #ccc;border-radius:8px;" />

      <label><b>Grados totales (Y)</b></label><br/>
      <input id="circDegrees" type="number" value="${safe(cfg.degrees ?? 360)}" step="1"
        style="width:100%;padding:8px;margin:6px 0;border:1px solid #ccc;border-radius:8px;" />

      <label><b>Ángulo inicial (opcional)</b></label><br/>
      <input id="circStartDeg" type="number" value="${cfg.startDeg ?? ''}"
        placeholder="vacío = calcular con centro→plantilla"
        style="width:100%;padding:8px;margin:6px 0;border:1px solid #ccc;border-radius:8px;" />

      <label style="display:flex;gap:8px;align-items:center;margin-top:8px;">
        <input id="circIncludeOriginal" type="checkbox" ${cfg.includeOriginal !== false ? 'checked' : ''} />
        <span>Incluir la plantilla como una de las copias</span>
      </label>

      <div style="margin-top:10px;padding:10px;border:1px dashed #d1d5db;border-radius:10px;">
        <div style="font-size:12px;color:#6b7280;">Plantilla seleccionada:</div>
        <div style="font-weight:700;">${tplId ? safe(tplId) : 'NINGUNA (haz click en un lote)'}</div>
      </div>

      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;">
        <button id="btnArmCirc" style="padding:8px 12px;border-radius:8px;border:1px solid #111;cursor:pointer;">Armar</button>
        <button id="btnCancelCirc" style="padding:8px 12px;border-radius:8px;border:1px solid #ccc;cursor:pointer;">Cancelar</button>
      </div>

      <p id="circHint" style="margin-top:10px;color:#6b7280;font-size:12px;"></p>
    </div>
  `;

  const hint = document.getElementById('circHint');
  const setHint = (msg) => { if (hint) hint.textContent = msg; };

  document.getElementById('btnCancelCirc').onclick = () => {
    editor.mode = 'edit';
    editor.circularArmed = false;
    editor.circularPickingTemplate = false;
    editor.circularConfig = null;
    notify('Repetición circular cancelada.', 1400);
    renderEditLotesPanel();
  };

  document.getElementById('btnArmCirc').onclick = () => {
    const count = Number(document.getElementById('circCount').value || 0);
    const degrees = Number(document.getElementById('circDegrees').value || 0);
    const startDegRaw = (document.getElementById('circStartDeg').value || '').trim();
    const includeOriginal = !!document.getElementById('circIncludeOriginal').checked;

    if (!count || count < 1) return notify('Copias debe ser >= 1.', 2200);
    if (!isFinite(degrees)) return notify('Grados inválidos.', 2200);

    const startDeg = startDegRaw === '' ? null : Number(startDegRaw);
    if (startDegRaw !== '' && !isFinite(startDeg)) return notify('Ángulo inicial inválido.', 2200);

    cfg.count = count;
    cfg.degrees = degrees;
    cfg.startDeg = startDeg;
    cfg.includeOriginal = includeOriginal;

    if (!cfg.template){
      editor.circularPickingTemplate = true;
      editor.circularArmed = false;
      setHint('⚠️ Falta plantilla: haz click en 1 lote para usarlo como plantilla.');
      return;
    }

    editor.circularPickingTemplate = false;
    editor.circularArmed = true;
    setHint('✅ Armado. Ahora da 1 click en el mapa para colocar el CENTRO.');
    notify('Repetición circular armada. Click en el mapa para colocar el centro.', 2200);
  };

  // hint inicial
  if (!cfg.template) setHint('Paso 1: haz click en 1 lote para elegir la plantilla.');
  else setHint('Plantilla lista. Ajusta X/Y y presiona Armar.');
}
/* =========================================================
   EDIT RENDERERS + CLICK HANDLER
   ========================================================= */
function isMultiKeyEvent(ev){
  const oe = ev?.originalEvent;
  return !!(oe?.ctrlKey || oe?.metaKey || oe?.shiftKey);
}

function handleEditorFeatureClick(feature, layer, ev){
  // MODO CIRCULAR (editor LOTES): el click en un lote selecciona la PLANTILLA
  if (isEditLotes && editor.mode === 'circular'){
    if (!editor.circularConfig) editor.circularConfig = { target: 'lotes_circular' };

    // Si estamos esperando plantilla, este click la asigna
    if (editor.circularPickingTemplate){
      editor.circularConfig.template = deepCopy(feature);
      editor.circularPickingTemplate = false;
      notify(`Plantilla seleccionada: ${getFeatureId(feature) || '(sin id)'}. Ajusta X/Y y presiona Armar.`, 2600);
      renderCircularRepeatPanel();
      return;
    }

    // Si ya hay plantilla pero aún no está armado, mantenemos el panel
    if (!editor.circularArmed){
      renderCircularRepeatPanel();
      return;
    }
    // Si está armado, el siguiente paso es click en el mapa (no aquí)
    return;
  }

  if (editor.mode !== "edit") return;

  const multiKey = isMultiKeyEvent(ev);

  // Multi toggle selection
  if (multiKey){
    editorStopEditing();            // salir de vértices si estabas ahí
    editor.editSubmode = "transform";
    editor.pasteArmed = false;

    if (editor.selectedSet.has(feature)) editor.selectedSet.delete(feature);
    else editor.selectedSet.add(feature);

    // si queda 0, limpia handles
    if (editor.selectedSet.size === 0){
      clearGroupTransformUI();
      rerenderActiveEditor();
      notify("Selección vacía.", 900);
      return;
    }

    rerenderActiveEditor(); // esto re-arma selectedLayers y handles
    return;
  }

  // Single selection: por default TRANSFORM (mover/escalar) sin vértices
  editorStopEditing();
  clearMultiSelection();
  editor.editSubmode = "transform";
  editor.pasteArmed = false;

  editor.selectedFeature = feature;
  editor.selectedLayer = layer;
  editor.selectedIsCircle = isCircleFeature(feature) && (layer instanceof L.Circle);

  editor.selectedSet.add(feature);
  editor.selectedLayers = [layer];

  rerenderActiveEditor(); // re-pinta estilo y crea handles + panel
}

function rerenderSecciones_Edit(){
  if (seccionesLayer){ seccionesLayer.remove(); seccionesLayer = null; }
  editorStopVertexEditing();
  clearGroupTransformUI();

  seccionesLayer = L.geoJSON(seccionesTopRaw || { type:"FeatureCollection", features:[] }, {
    style: (feature) => ({ weight: 2, opacity: 1, fillOpacity: 0.06, fillColor: getSeccionColor(feature) }),
    interactive: (editor.mode === "edit"),
    pointToLayer: (feature, latlng) => {
      const layer = featureToLayerCircleAware(feature, latlng);
      try { layer.setStyle({ weight:2, opacity:1, fillOpacity:0.06, fillColor: getSeccionColor(feature) }); } catch {}
      return layer;
    },
    onEachFeature: (feature, layer) => {
      layer.on("click", (ev) => handleEditorFeatureClick(feature, layer, ev));
    }
  }).addTo(map);

  rebuildSelectedLayersFromLayerGroup(seccionesLayer);
  applyMultiSelectionStyle();
  if (editor.selectedSet.size > 0){
    showGroupTransformHandles();
    if (editor.selectedSet.size === 1 && editor.editSubmode === "transform"){
      renderEditSelectedPanel();
    }
  }
}

function rerenderManzanas_Edit(){
  if (manzanasLayer){ manzanasLayer.remove(); manzanasLayer = null; }
  editorStopVertexEditing();
  clearGroupTransformUI();

  manzanasLayer = L.geoJSON(manzanasRaw || { type:"FeatureCollection", features:[] }, {
    style: { weight: 2, opacity: 1, fillOpacity: 0.06 },
    interactive: (editor.mode === "edit"),
    pointToLayer: (feature, latlng) => {
      const layer = featureToLayerCircleAware(feature, latlng);
      try { layer.setStyle({ weight:2, opacity:1, fillOpacity:0.06 }); } catch {}
      return layer;
    },
    onEachFeature: (feature, layer) => {
      layer.on("click", (ev) => handleEditorFeatureClick(feature, layer, ev));
    }
  }).addTo(map);

  rebuildSelectedLayersFromLayerGroup(manzanasLayer);
  applyMultiSelectionStyle();
  if (editor.selectedSet.size > 0){
    showGroupTransformHandles();
    if (editor.selectedSet.size === 1 && editor.editSubmode === "transform"){
      renderEditSelectedPanel();
    }
  }
}

function rerenderLotes_Edit(){
  if (lotesLayer){ lotesLayer.remove(); lotesLayer = null; }
  editorStopVertexEditing();
  clearGroupTransformUI();
  if (!currentLotesRaw) return;

  // FILTRO VISUAL: por manzana (y opcionalmente por seccion)
  const filterSec = (editor.lotesFilterSeccion || getSelectedSeccion() || '').toString().trim();
  const filterMan = (editor.lotesFilterManzana || getSelectedManzana() || '').toString().trim();

  let feats = (currentLotesRaw.features || []).slice();
  if (filterSec){
    feats = feats.filter(f => (f?.properties?.seccion || '').toString().trim() === filterSec);
  }
  if (filterMan){
    feats = feats.filter(f => {
      const pm = (f?.properties?.manzana || f?.properties?.manzanaId || '').toString().trim();
      return pm.toUpperCase() === filterMan.toUpperCase();
    });
  }

  const fc = { type: 'FeatureCollection', features: feats };

  lotesLayer = L.geoJSON(fc, {
    style: (feature) => ({ ...styleByStatus(feature?.properties?.estatus), fillOpacity: 0.10 }),
    interactive: (editor.mode === 'edit' || (isEditLotes && editor.mode === 'circular' && editor.circularPickingTemplate)),
    pointToLayer: (feature, latlng) => {
      const layer = featureToLayerCircleAware(feature, latlng);
      try { layer.setStyle({ ...styleByStatus(feature?.properties?.estatus), fillOpacity: 0.10 }); } catch {}
      return layer;
    },
    onEachFeature: (feature, layer) => {
      layer.on('click', (ev) => handleEditorFeatureClick(feature, layer, ev));
    }
  }).addTo(map);

  rebuildSelectedLayersFromLayerGroup(lotesLayer);
  applyMultiSelectionStyle();
  if (editor.selectedSet.size > 0){
    showGroupTransformHandles();
    if (editor.selectedSet.size === 1 && editor.editSubmode === 'transform' && editor.mode === 'edit'){
      renderEditSelectedPanel();
    }
  }
}


function rerenderNichos_Edit(){
  if (nichosLayerEdit){ nichosLayerEdit.remove(); nichosLayerEdit = null; }
  editorStopVertexEditing();
  clearGroupTransformUI();

  nichosLayerEdit = L.geoJSON(nichosZonasRaw || { type:"FeatureCollection", features:[] }, {
    style: { weight: 2, opacity: 1, fillOpacity: 0.06 },
    interactive: (editor.mode === "edit"),
    pointToLayer: (feature, latlng) => {
      const layer = featureToLayerCircleAware(feature, latlng);
      try { layer.setStyle({ weight:2, opacity:1, fillOpacity:0.06 }); } catch {}
      return layer;
    },
    onEachFeature: (feature, layer) => {
      layer.on("click", (ev) => handleEditorFeatureClick(feature, layer, ev));
    }
  }).addTo(map);

  rebuildSelectedLayersFromLayerGroup(nichosLayerEdit);
  applyMultiSelectionStyle();
  if (editor.selectedSet.size > 0){
    showGroupTransformHandles();
    if (editor.selectedSet.size === 1 && editor.editSubmode === "transform"){
      renderEditSelectedPanel();
    }
  }
}

/* =========================================================
   MAP CLICK HANDLER (CREATE + PASTE + GRID)
   ========================================================= */
let mapClickAttached = false;
function attachEditorMapClick(){
  if (mapClickAttached) return;
  mapClickAttached = true;

  map.on("click", (e) => {
    if (!(isEditSecciones || isEditManzanas || isEditLotes || isEditNichos)) return;

    // PEGAR
    if (editor.pasteArmed && editor.clipboardFeature){
      const arr = getActiveEditDatasetArr();
      if (!arr) return notify("No hay dataset activo para pegar.", 2200);

      const temp = deepCopy(editor.clipboardFeature);

      const b = boundsFromFeature(temp);
      const c = boundsCenter(b || {minX:0,minY:0,maxX:0,maxY:0});
      const dx = e.latlng.lng - c.x;
      const dy = e.latlng.lat - c.y;

      translateFeatureInPlace(temp, dx, dy);
      ensureUniqueId(temp, arr);

      if (isEditLotes) {
        // Si estás filtrando por manzana, la copia pegada hereda esa manzana si no trae una
        ensureLoteContextProps(temp, getSelectedSeccion(), (temp?.properties?.manzana || temp?.properties?.manzanaId || editor.lotesFilterManzana || getSelectedManzana()));
      }
      arr.push(temp);

      editor.pasteArmed = false;
      rerenderActiveEditor();
      notify("✅ Pegado. Selecciona la figura para cambiar ID si quieres.", 2200);
      return;
    }

    // GRID LOTES
    if (isEditLotes && editor.mode === "grid" && editor.gridArmed && editor.gridConfig?.target === "lotes"){
      const cfg = editor.gridConfig;
      const arr = getActiveEditDatasetArr();
      if (!arr) return notify("No hay dataset de lotes cargado.", 2200);

      const x0 = e.latlng.lng;
      const y0 = e.latlng.lat;

      const created = [];
      for (let r=0; r<cfg.rows; r++){
        for (let c=0; c<cfg.cols; c++){
          const localX = c * (cfg.w + cfg.gapX);
          const localY = r * (cfg.h + cfg.gapY);

          const loteId = nextPaddedNumber(cfg.start, (r*cfg.cols + c), cfg.inc);
          const corners = makeRotatedRect(x0, y0, localX, localY, cfg.w, cfg.h, cfg.rot);

          const feature = {
            type:"Feature",
            geometry:{ type:"Polygon", coordinates:[corners] },
            properties:{ id:loteId, lote:loteId, estatus:cfg.estatus, paquete:cfg.paquete }
          };

          // contexto seccion/manzana
          ensureLoteContextProps(feature, cfg.seccion || getSelectedSeccion(), cfg.manzana || editor.lotesFilterManzana || getSelectedManzana());

          arr.push(feature);
          created.push(feature);
        }
      }

      editor.gridArmed = false;
      rerenderLotes_Edit();

      activateGridGroup(arr, created);
      notify(`✅ Cuadrícula LOTES creada (${cfg.rows}x${cfg.cols}). Arrastra el punto rojo para mover TODO.`, 2600);
      return;
    }

    // GRID MANZANAS
    if (isEditManzanas && editor.mode === "grid" && editor.gridArmed && editor.gridConfig?.target === "manzanas"){
      const cfg = editor.gridConfig;
      const arr = getActiveEditDatasetArr();
      if (!arr) return notify("No hay dataset de manzanas cargado.", 2200);

      const x0 = e.latlng.lng;
      const y0 = e.latlng.lat;

      const created = [];
      let idx = 0;
      for (let r=0; r<cfg.rows; r++){
        for (let c=0; c<cfg.cols; c++){
          const localX = c * (cfg.w + cfg.gapX);
          const localY = r * (cfg.h + cfg.gapY);

          const manzanaId = nextManzanaLetter(cfg.start, idx);
          const corners = makeRotatedRect(x0, y0, localX, localY, cfg.w, cfg.h, cfg.rot);

          const lotesFile = `./data/lotes/lotes-${cfg.seccion}-${manzanaId}.geojson`;

          const feature = {
            type:"Feature",
            geometry:{ type:"Polygon", coordinates:[corners] },
            properties:{
              id: `${cfg.seccion}-${manzanaId}`,
              seccion: cfg.seccion,
              manzana: manzanaId,
              nombre: `${cfg.seccion} - ${manzanaId}`,
              lotesFile
            }
          };

          arr.push(feature);
          created.push(feature);
          idx++;
        }
      }

      editor.gridArmed = false;
      rerenderManzanas_Edit();

      activateGridGroup(arr, created);
      notify(`✅ Cuadrícula MANZANAS creada (${cfg.rows}x${cfg.cols}). Arrastra el punto rojo para mover TODO.`, 2600);
      return;
    }

    // CIRCULAR LOTES (repetir plantilla alrededor de un centro)
    if (isEditLotes && editor.mode === "circular" && editor.circularArmed && editor.circularConfig?.target === "lotes_circular"){
      const cfg = editor.circularConfig;
      const arr = getActiveEditDatasetArr();
      if (!arr) return notify("No hay dataset de lotes cargado.", 2200);

      const centerX = e.latlng.lng;
      const centerY = e.latlng.lat;

      const tpl = deepCopy(cfg.template);

      // centro de la plantilla (para calcular radio / ángulo base)
      const tplCenter = getFeatureCenterXY(tpl);
      if (!tplCenter) return notify("No pude calcular centro de la plantilla.", 2200);

      const dx = tplCenter.cx - centerX;
      const dy = tplCenter.cy - centerY;

      // ángulo base (si no se especifica)
      let baseAngleDeg = cfg.startDeg;
      if (baseAngleDeg === null){
        baseAngleDeg = Math.atan2(dy, dx) * 180 / Math.PI; // centro->plantilla
      }

      // si count=1 => solo 1 copia
      const count = cfg.count;
      const totalDeg = cfg.degrees;
      const step = (count <= 1) ? 0 : (totalDeg / (count - 1));

      const created = [];
      for (let i=0; i<count; i++){
        const ang = baseAngleDeg + step * i;

        // copia desde plantilla
        const f = deepCopy(tpl);

        // 1) mover plantilla para que su centro esté en el radio correcto desde el nuevo centro
        //    (o sea: colocarla en la posición "base" relativa al centro click)
        //    ya está en coords absolutas; la rotaremos alrededor del centro click
        rotateFeatureInPlace(f, centerX, centerY, (ang - baseAngleDeg));

        // ids únicos
        ensureUniqueId(f, arr);

        // Asegurar contexto seccion/manzana (para copiar entre manzanas sin perder propiedad)
        ensureLoteContextProps(f, (cfg.seccion || getSelectedSeccion()), (f?.properties?.manzana || f?.properties?.manzanaId || cfg.manzana || editor.lotesFilterManzana || getSelectedManzana()));

        // incluir o no el original
        if (!cfg.includeOriginal && i === 0){
          continue;
        }

        arr.push(f);
        created.push(f);
      }

      editor.circularArmed = false;
      // editor.mode se mantiene en edit al rerender
      editor.mode = "edit";
      editor.circularConfig = null;

      rerenderLotes_Edit();
      activateGridGroup(arr, created); // reutilizamos overlay/marker para mover el grupo recién creado
      notify(`✅ Repetición circular creada (${created.length} copia(s)).`, 2400);
      return;
    }


    // CREATE normal
    if (editor.mode !== "create") return;

    if (editor.drawShape === "polygon"){
      editor.polyPoints.push(e.latlng);
      const mk = L.marker(e.latlng, { icon: editor.iconVertex }).addTo(map);
      editor.polyMarkers.push(mk);
      editorRefreshPolyPreview();
      const el = document.getElementById("ptCount");
      if (el) el.textContent = String(editor.polyPoints.length);
      return;
    }

    // circle create: click center, then click edge
    if (!editor.circleCenter){
      editor.circleCenter = e.latlng;
      editor.circleCenterMarker = L.marker(e.latlng, { icon: editor.iconVertex }).addTo(map);
      return;
    }

    const r = distPixels(editor.circleCenter, e.latlng);
    editor.circleRadius = r;

    if (editor.circlePreview) map.removeLayer(editor.circlePreview);
    editor.circlePreview = L.circle(editor.circleCenter, { radius: r, weight:2, fillOpacity:0.12 }).addTo(map);

    if (editor.circleRadiusMarker) map.removeLayer(editor.circleRadiusMarker);
    editor.circleRadiusMarker = L.marker(e.latlng, { icon: editor.iconHandle }).addTo(map);
  });
}

/* =========================================================
   INIT
   ========================================================= */
async function main(){
  map = L.map("map", {
    crs: L.CRS.Simple,
    minZoom: -3,
    maxZoom: (isEditSecciones || isEditManzanas || isEditLotes || isEditNichos) ? 6 : 4,
    zoomAnimation: !IS_MOBILE,
    fadeAnimation: false,
    markerZoomAnimation: !IS_MOBILE,
    preferCanvas: true
  });

  try { lotesInfo = await loadJson(LOTES_INFO_URL); } catch { lotesInfo = {}; }
  try { paquetesInfo = await loadJson(PAQUETES_URL); } catch { paquetesInfo = {}; }

  const img = new Image();
  img.onload = async () => {
    try {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const bounds = [[0,0],[h,w]];

      // scale solo en PUBLICO (por si DATA_COORD_* no coincide)
      COORD_SCALE_X = w / DATA_COORD_WIDTH;
      COORD_SCALE_Y = h / DATA_COORD_HEIGHT;

      L.imageOverlay(BASE_IMAGE_URL, bounds).addTo(map);
      map.fitBounds(bounds);

      attachEditorMapClick();

      // cargar datasets base
      manzanasRaw = await loadJson(MANZANAS_URL);
      try { seccionesTopRaw = await loadJson(SECCIONES_TOP_URL); }
      catch { seccionesTopRaw = { type:"FeatureCollection", features: [] }; }

      try { nichosZonasRaw = await loadJson(NICHOS_ZONAS_URL); }
      catch { nichosZonasRaw = { type:"FeatureCollection", features: [] }; }

      // ====== EDIT SECCIONES ======
      if (isEditSecciones){
        if ($toggleLotsBtn) $toggleLotsBtn.disabled = true;
        if ($searchBtn) $searchBtn.disabled = true;

        $seccionSelect.innerHTML = `<option value="">(Edición SECCIONES)</option>`;
        $manzanaSelect.innerHTML = `<option value="">(Edición SECCIONES)</option>`;

        rerenderSecciones_Edit();
        renderEditSeccionesPanel();
        return;
      }

      // ====== EDIT MANZANAS ======
      if (isEditManzanas){
        if ($toggleLotsBtn) $toggleLotsBtn.disabled = true;
        if ($searchBtn) $searchBtn.disabled = true;

        $seccionSelect.innerHTML = `<option value="">(Edición MANZANAS)</option>`;
        $manzanaSelect.innerHTML = `<option value="">(Edición MANZANAS)</option>`;

        rerenderManzanas_Edit();
        renderEditManzanasPanel();
        return;
      }

      // ====== EDIT NICHOS ======
      if (isEditNichos){
        if ($toggleLotsBtn) $toggleLotsBtn.disabled = true;
        if ($searchBtn) $searchBtn.disabled = true;

        $seccionSelect.innerHTML = `<option value="">(Edición NICHOS)</option>`;
        $manzanaSelect.innerHTML = `<option value="">(Edición NICHOS)</option>`;

        rerenderNichos_Edit();
        renderEditNichosPanel();
        return;
      }

      // ====== EDIT LOTES ======
      if (isEditLotes){
        if ($toggleLotsBtn) $toggleLotsBtn.disabled = true;
        if ($searchBtn) $searchBtn.disabled = true;

        const secciones = buildSeccionesList(manzanasRaw.features);
        fillSeccionSelect(secciones);
        $manzanaSelect.innerHTML = `<option value="">(Todas las manzanas)</option>`;

        // helpers: carga/actualiza dataset de lotes por SECCIÓN (archivo compartido)
        const loadLotesForSeccion = async (sec) => {
          const s = (sec || '').trim();
          currentLotesSeccion = s || null;
          editor.lotesFilterSeccion = s || null;
          editor.lotesFilterManzana = null;
          currentManzanaFeature = null;

          if (!s){
            currentLotesRaw = { type: 'FeatureCollection', features: [] };
            currentLotesSourceUrl = null;
            rerenderLotes_Edit();
            renderEditLotesPanel();
            return;
          }

          const url = getSharedLotesUrlForSeccion(s);
          currentLotesSourceUrl = url;
          try { currentLotesRaw = await loadJson(url); }
          catch { currentLotesRaw = { type: 'FeatureCollection', features: [] }; }

          // Asegura que al menos tengan seccion (para copiado / filtros)
          try { normalizeLotesContext(currentLotesRaw); } catch {}

          // refrescar lista de manzanas de esa sección
          const list = buildManzanasListBySeccion(manzanasRaw.features, s);
          $manzanaSelect.innerHTML = `<option value="">(Todas las manzanas)</option>`;
          for (const f of list){
            const m = getPropManzana(f);
            const n = getPropNombre(f);
            const opt = document.createElement('option');
            opt.value = m;
            opt.textContent = `${m} — ${n}`;
            $manzanaSelect.appendChild(opt);
          }

          rerenderLotes_Edit();
          renderEditLotesPanel();

          // zoom a la sección (si existe en secciones-top)
          try {
            const secFeat = (seccionesTopRaw?.features || []).find(sf => getPropSeccion(sf) === s);
            if (secFeat){
              const tmp = L.geoJSON(secFeat);
              flyToBoundsSmooth(tmp.getBounds().pad(0.12), 0.65);
            }
          } catch {}
        };

        $seccionSelect.onchange = async () => {
          const sec = ($seccionSelect.value || '').trim();
          await loadLotesForSeccion(sec);
        };

        // MANZANA en editor LOTES es solo filtro visual (no recarga archivo ni borra cambios)
        $manzanaSelect.onchange = () => {
          const sec = getSelectedSeccion();
          const man = getSelectedManzana();

          editor.lotesFilterSeccion = sec || null;
          editor.lotesFilterManzana = man || null;

          if (sec && man){
            currentManzanaFeature = manzanasRaw.features.find(x => getPropSeccion(x) === sec && getPropManzana(x) === man) || null;
            try {
              if (currentManzanaFeature){
                const tmp = L.geoJSON(currentManzanaFeature);
                flyToBoundsSmooth(tmp.getBounds().pad(0.15), 0.55);
              }
            } catch {}
          } else {
            currentManzanaFeature = null;
          }

          rerenderLotes_Edit();
          renderEditLotesPanel();
        };

        // panel inicial
        renderEditLotesPanel();
        return;
      }

// ====== NORMAL (público) ======
      seccionesTopScaled = deepCopy(seccionesTopRaw);
      applyCoordScaleToGeoJSON(seccionesTopScaled, COORD_SCALE_X, COORD_SCALE_Y);

      manzanasScaled = deepCopy(manzanasRaw);
      applyCoordScaleToGeoJSON(manzanasScaled, COORD_SCALE_X, COORD_SCALE_Y);

      // Nichos capa pública (independiente)
      try {
        nichosZonasScaled = deepCopy(nichosZonasRaw);
        applyCoordScaleToGeoJSON(nichosZonasScaled, COORD_SCALE_X, COORD_SCALE_Y);

        if (nichosLayer) { nichosLayer.remove(); nichosLayer = null; }

        nichosLayer = L.geoJSON(nichosZonasScaled, {
          style: { weight: 2, opacity: 0, fillOpacity: 0 },
          onEachFeature: (feature, layer) => {
            layer.on("mouseover", () => layer.setStyle({ weight: 2, opacity: 1, fillOpacity: 0.05 }));
            layer.on("mouseout",  () => layer.setStyle({ weight: 2, opacity: 0, fillOpacity: 0 }));
            layer.on("click", () => openNichoModal(feature));
          }
        }).addTo(map);
      } catch (e) {
        console.warn("Nichos no cargados:", e);
      }

      const secciones = buildSeccionesList(
        seccionesTopScaled.features.length
          ? seccionesTopScaled.features
          : (manzanasScaled?.features || [])
      );
      fillSeccionSelect(secciones);
      $manzanaSelect.innerHTML = `<option value="">MANZANA...</option>`;

      showPublicLevelSecciones();
      setupDropdowns();
      setupSearch();
      setupButtons();
      updateToggleLotsButton();

      if (!IS_EDIT) notify("Listo.", 900);

    } catch (err) {
      console.error(err);
      setPanel("Error en app.js", `<pre style="white-space:pre-wrap;color:#b91c1c;">${safe(err?.stack || err)}</pre>`);
    }
  };

  img.onerror = () => {
    setPanel("Error", `<p>No pude cargar el mapa base: <code>${safe(BASE_IMAGE_URL)}</code></p>`);
  };

  img.src = BASE_IMAGE_URL;
}

main();