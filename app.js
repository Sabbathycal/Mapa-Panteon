/* =========================================================
   CONFIG
   ========================================================= */
const BASE_IMAGE_PUBLIC_URL = "./assets/map/base-public.webp"; // ligero (público)
const BASE_IMAGE_EDIT_URL   = "./assets/map/base.png";         // alta res (edición)

// Tus GeoJSON están guardados en coordenadas del mapa base.png
const DATA_COORD_WIDTH  = 11045;
const DATA_COORD_HEIGHT = 9079;

// Archivos de datos
const SECCIONES_TOP_URL = "./data/secciones-top.geojson"; // editor ?edit=secciones + PUBLICO secciones
const MANZANAS_URL      = "./data/secciones.geojson";     // MANZANAS
const NICHOS_ZONAS_URL  = "./data/nichos-zonas.geojson";  // zonas clickeables nichos (FeatureCollection)

// Catálogos
const LOTES_INFO_URL    = "./data/lotes.json";
const PAQUETES_URL      = "./data/paquetes.json";

// Edit modes:
// ?edit=secciones  => EDITOR SECCIONES
// ?edit=manzanas   => EDITOR MANZANAS
// ?edit=lotes      => EDITOR LOTES
const editMode = new URLSearchParams(location.search).get("edit"); // null | "secciones" | "manzanas" | "lotes"
const isEditSecciones = editMode === "secciones";
const isEditManzanas  = editMode === "manzanas";
const isEditLotes     = editMode === "lotes";

const BASE_IMAGE_URL = (isEditSecciones || isEditManzanas || isEditLotes) ? BASE_IMAGE_EDIT_URL : BASE_IMAGE_PUBLIC_URL;

// Detectar móvil/tablet
const IS_MOBILE = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;

/* =========================================================
   GLOBAL STATE
   ========================================================= */
let map;

let lotesInfo = {};
let paquetesInfo = {};

// RAW (coords base.png)
let seccionesTopRaw = null;   // SECCIONES
let manzanasRaw = null;       // MANZANAS

// Scaled a base actual (público)
let seccionesTopScaled = null; // SECCIONES escaladas
let manzanasScaled = null;     // MANZANAS escaladas
let lotesScaled = null;        // LOTES escalados

let seccionesLayer = null;         // editor secciones
let seccionesLayerPublic = null;   // PUBLICO secciones
let manzanasLayer = null;          // público + editor manzanas
let lotesLayer = null;             // público + editor lotes

// NICHOS
let nichosZonasRaw = null;
let nichosZonasScaled = null;
let nichosLayer = null;

// Selección de nicho (modal)
let nichoSelection = { zonaId: null, cara: null, numero: null };

let currentSeccion = null;
let currentSeccionFeature = null;
let currentManzanaFeature = null;
let currentLotesRaw = null;

let showAllLots = false;

// escala data->imagen cargada
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

// Color default para secciones
const DEFAULT_SECCION_COLOR = "#C9A227"; // dorado suave
function getSeccionColor(feature){
  const c = feature?.properties?.color;
  if (typeof c === "string" && c.trim()) return c.trim();
  return DEFAULT_SECCION_COLOR;
}

/* =========================================================
   COORD SCALE
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
  const enabled = !!currentManzanaFeature && !(isEditSecciones || isEditManzanas || isEditLotes);
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
  const pad = isC ? 0.55 : 0.20;
  const mz  = isC ? 3 : null;

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

  const lotesFile = currentManzanaFeature?.properties?.lotesFile;
  if (!lotesFile){
    setPanel("MANZANA sin lotesFile", `<p>Esta manzana no tiene <b>lotesFile</b>.</p>`);
    return;
  }

  let raw;
  try { raw = await loadJson(lotesFile); }
  catch { raw = { type:"FeatureCollection", features: [] }; }

  lotesScaled = deepCopy(raw);
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

        flyToBoundsSmooth(layer.getBounds().pad(0.30), 0.45);
        showLoteInfo(feature);
      });
    }
  }).addTo(map);

  updateToggleLotsButton();

  const sec = currentSeccion || getPropSeccion(currentManzanaFeature);
  const man = getPropManzana(currentManzanaFeature);
  setPanel(`SECCIÓN ${safe(sec)} — MANZANA ${safe(man)}`, `
    <p>Selecciona un lote o usa <b>Mostrar lotes</b>.</p>
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
  if (btn) btn.onclick = () => alert("Aquí irá el login + consulta segura del saldo.");
}

/* =========================================================
   NICHOS: GRID SETTINGS + HELPERS
   ========================================================= */
// Filas base: A-F (6 filas). Si en realidad son 5 filas, deja ["A","B","C","D","E"].
const NICHOS_ROWS = ["A","B","C","D","E","F"];
const NICHOS_COLS = 79;

// Caja útil (0..1) — ajustable después
const NICHOS_GRID_BOX = { left: 0.06, right: 0.94, top: 0.12, bottom: 0.92 };

function getNichoPrefixFromZona(zonaFeature){
  const p = zonaFeature?.properties || {};
  const direct = (p.prefix || p.codigo || p.tipo || "").toString().trim().toUpperCase();
  if (direct === "PLN" || direct === "SPN") return direct;

  const id = (p.id || "").toString().trim().toUpperCase();
  if (id.startsWith("PLN")) return "PLN";
  if (id.startsWith("SPN")) return "SPN";
  return "PLN";
}

function clamp01(v){
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

function nichoClickToGrid(rx, ry){
  rx = clamp01(rx);
  ry = clamp01(ry);

  const box = NICHOS_GRID_BOX;
  const gx = (rx - box.left) / (box.right - box.left);
  const gy = (ry - box.top) / (box.bottom - box.top);

  if (gx < 0 || gx > 1 || gy < 0 || gy > 1) return null;

  const col = Math.floor(gx * NICHOS_COLS) + 1;
  const rowIndex = Math.floor(gy * NICHOS_ROWS.length);

  const colClamped = Math.min(Math.max(col, 1), NICHOS_COLS);
  const rowClamped = Math.min(Math.max(rowIndex, 0), NICHOS_ROWS.length - 1);

  return { col: colClamped, rowIndex: rowClamped };
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

/* =========================================================
   NICHOS MODAL
   ========================================================= */
function openNichoModal(zonaFeature){
  const modal = document.getElementById("nichoModal");
  const sub   = document.getElementById("nichoModalSub");
  const img   = document.getElementById("nichoImg");
  const layer = document.getElementById("nichoClickLayer");
  const hint  = document.getElementById("nichoHint");
  const debug = document.getElementById("nichoDebug");

  if (!modal || !sub || !img || !layer || !hint || !debug){
    alert("Falta el modal de nichos en index.html (IDs nichoModal, nichoImg, etc.).");
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

    // Ajusta aquí si tus imágenes tienen otro patrón
    const src = `./assets/nichos/${prefix}-${cara}.png`;

    img.src = src;
    img.onload = () => {
      img.style.display = "block";
      layer.style.display = "block";
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
      hint.textContent = "Click fuera del área de nichos (zona útil). Intenta dentro del cuadro.";
      return;
    }

    const numero = cell.col;
    const fila = NICHOS_ROWS[cell.rowIndex];
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

    flyToBoundsSmooth(layer.getBounds().pad(0.35), 0.45);

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
   ================= EDITOR (SECCIONES / MANZANAS / LOTES) =================
   Polígono o Círculo + COPY/PASTE + BORRAR + MOVER FIGURA
   ========================================================= */
const editor = {
  mode: "edit",
  drawShape: "polygon",

  polyPoints: [],
  polyMarkers: [],
  polyLine: null,
  polyPreview: null,

  circleCenter: null,
  circleCenterMarker: null,
  circleRadiusMarker: null,
  circlePreview: null,
  circleRadius: null,

  selectedLayer: null,
  selectedFeature: null,
  selectedIsCircle: false,

  originalGeometry: null,
  originalRadius: null,

  vertexMarkers: [],

  // ====== MOVE whole shape ======
  centerMoveMarker: null,   // marker draggable para mover el polígono
  moveEnabled: true,        // por defecto sí (puedes apagar en UI)

  // ====== COPY / PASTE ======
  clipboardFeature: null,
  clipboardMeta: null,
  pasteArmed: false,

  // dataset actual (para borrar / insertar)
  selectedDatasetArr: null,

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

function editorStopEditing(){
  editor.vertexMarkers.forEach(m => map.removeLayer(m));
  editor.vertexMarkers = [];

  if (editor.circleCenterMarker && editor.mode === "edit" && editor.selectedIsCircle) {
    map.removeLayer(editor.circleCenterMarker);
    map.removeLayer(editor.circleRadiusMarker);
    editor.circleCenterMarker = null;
    editor.circleRadiusMarker = null;
  }

  if (editor.centerMoveMarker){
    map.removeLayer(editor.centerMoveMarker);
    editor.centerMoveMarker = null;
  }

  editor.selectedLayer = null;
  editor.selectedFeature = null;
  editor.selectedIsCircle = false;
  editor.originalGeometry = null;
  editor.originalRadius = null;

  editor.selectedDatasetArr = null;
}

function ringToGeoJsonCoords(ringLatLng){
  const coords = ringLatLng.map(latLngToXY);
  if (coords.length) coords.push(coords[0]);
  return [coords];
}

/* =========================================================
   COPY / PASTE HELPERS
   ========================================================= */
function getFeatureCenterXY(feature, layer){
  try {
    if (isCircleFeature(feature)){
      return feature.geometry.coordinates; // [x,y]
    }
    if (layer && layer.getBounds){
      const b = layer.getBounds();
      const c = b.getCenter();
      return [c.lng, c.lat];
    }
    const ring = feature.geometry?.coordinates?.[0] || [];
    if (!ring.length) return [0,0];
    let sx=0, sy=0, n=0;
    for (const [x,y] of ring){ sx+=x; sy+=y; n++; }
    return [sx/n, sy/n];
  } catch {
    return [0,0];
  }
}

function translateFeature(feature, dx, dy){
  const f = deepCopy(feature);

  if (f.geometry?.type === "Point"){
    const [x,y] = f.geometry.coordinates;
    f.geometry.coordinates = [x + dx, y + dy];
    return f;
  }

  if (f.geometry?.type === "Polygon"){
    const coords = f.geometry.coordinates || [];
    f.geometry.coordinates = coords.map(ring => ring.map(([x,y]) => [x + dx, y + dy]));
    return f;
  }

  return f;
}

function getActiveEditDataset(){
  if (isEditSecciones) return seccionesTopRaw?.features || null;
  if (isEditManzanas)  return manzanasRaw?.features || null;
  if (isEditLotes)     return currentLotesRaw?.features || null;
  return null;
}

function rerenderActiveEditor(){
  if (isEditSecciones) return rerenderSecciones_Edit();
  if (isEditManzanas)  return rerenderManzanas_Edit();
  if (isEditLotes)     return rerenderLotes_Edit();
}

/* =========================================================
   BORRAR feature del dataset activo
   ========================================================= */
function deleteSelectedFeature(){
  const arr = editor.selectedDatasetArr || getActiveEditDataset();
  if (!arr || !editor.selectedFeature) return;

  // buscar por referencia, si no, por id
  const idxRef = arr.indexOf(editor.selectedFeature);
  let idx = idxRef;

  if (idx < 0){
    const id = (editor.selectedFeature?.properties?.id ||
                editor.selectedFeature?.properties?.lote ||
                editor.selectedFeature?.properties?.manzana ||
                editor.selectedFeature?.properties?.seccion ||
                "").toString();
    if (id){
      idx = arr.findIndex(f => {
        const fid = (f?.properties?.id || f?.properties?.lote || f?.properties?.manzana || f?.properties?.seccion || "").toString();
        return fid === id;
      });
    }
  }

  if (idx < 0){
    alert("No pude encontrar la figura en el dataset para borrarla.");
    return;
  }

  arr.splice(idx, 1);
  editorStopEditing();
  rerenderActiveEditor();
  alert("Figura borrada en memoria. Copia el GeoJSON y pégalo en tu archivo.");
}

/* =========================================================
   MOVER figura completa (polígono)
   ========================================================= */
function installPolygonMoveHandle(layer){
  if (!editor.moveEnabled) return;

  // quitar anterior si existe
  if (editor.centerMoveMarker){
    map.removeLayer(editor.centerMoveMarker);
    editor.centerMoveMarker = null;
  }

  const centerXY = getFeatureCenterXY(layer.feature, layer); // [x,y]
  const centerLL = L.latLng(centerXY[1], centerXY[0]);

  editor.centerMoveMarker = L.marker(centerLL, {
    draggable: true,
    icon: editor.iconCenter
  }).addTo(map);

  let last = editor.centerMoveMarker.getLatLng();

  const applyDelta = (newLL) => {
    const dx = newLL.lng - last.lng;
    const dy = newLL.lat - last.lat;

    // mover layer
    const latlngs = layer.getLatLngs();
    const ring = Array.isArray(latlngs[0]) ? latlngs[0] : latlngs;
    const moved = ring.map(p => L.latLng(p.lat + dy, p.lng + dx));
    layer.setLatLngs([moved]);

    // mover marcadores de vertices
    editor.vertexMarkers.forEach(m => {
      const p = m.getLatLng();
      m.setLatLng(L.latLng(p.lat + dy, p.lng + dx));
    });

    last = newLL;
  };

  editor.centerMoveMarker.on("drag", () => {
    applyDelta(editor.centerMoveMarker.getLatLng());
  });

  editor.centerMoveMarker.on("dragend", () => {
    // guardar en feature.geometry
    const newRing = editor.vertexMarkers.map(m => m.getLatLng());
    editor.selectedFeature.geometry.coordinates = ringToGeoJsonCoords(newRing);
    renderEditSelectedPanel(); // refresca panel
  });
}

/* =========================================================
   EDIT START
   ========================================================= */
function editorStartEditPolygon(layer){
  editorStopEditing();

  editor.selectedLayer = layer;
  editor.selectedFeature = layer.feature;
  editor.selectedIsCircle = false;
  editor.originalGeometry = deepCopy(layer.feature.geometry);
  editor.selectedDatasetArr = getActiveEditDataset();

  const latlngs = layer.getLatLngs();
  const ring = Array.isArray(latlngs[0]) ? latlngs[0] : latlngs;

  let ring2 = ring;
  if (ring2.length >= 2){
    const a = ring2[0], b = ring2[ring2.length-1];
    if (Math.abs(a.lat-b.lat)<1e-9 && Math.abs(a.lng-b.lng)<1e-9) ring2 = ring2.slice(0, -1);
  }

  editor.vertexMarkers = ring2.map((p) => {
    const mk = L.marker(p, { draggable: true, icon: editor.iconVertex }).addTo(map);
    mk.on("drag", () => {
      const newRing = editor.vertexMarkers.map(m => m.getLatLng());
      layer.setLatLngs([newRing]);
    });
    mk.on("dragend", () => {
      const newRing = editor.vertexMarkers.map(m => m.getLatLng());
      layer.setLatLngs([newRing]);
      editor.selectedFeature.geometry.coordinates = ringToGeoJsonCoords(newRing);
      renderEditSelectedPanel();
    });
    return mk;
  });

  // Handle para mover la figura completa (sin cambiar puntos)
  installPolygonMoveHandle(layer);

  renderEditSelectedPanel();
}

function editorStartEditCircle(layer){
  editorStopEditing();

  editor.selectedLayer = layer;
  editor.selectedFeature = layer.feature;
  editor.selectedIsCircle = true;

  editor.originalGeometry = deepCopy(layer.feature.geometry);
  editor.originalRadius = layer.feature.properties.radius;
  editor.selectedDatasetArr = getActiveEditDataset();

  const center = layer.getLatLng();
  const radius = layer.feature.properties.radius;

  // Para círculo: el centro YA sirve para mover toda la figura
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

function getEditDataset(){
  if (isEditSecciones) return { label:"SECCIONES", data: seccionesTopRaw, dest: SECCIONES_TOP_URL };
  if (isEditManzanas)  return { label:"MANZANAS",  data: manzanasRaw,     dest: MANZANAS_URL };
  if (isEditLotes)     return { label:"LOTES",     data: currentLotesRaw, dest: currentManzanaFeature?.properties?.lotesFile || "(sin manzana)" };
  return null;
}

/* =========================================================
   EDIT SELECTED PANEL (incluye borrar + copy/paste)
   ========================================================= */
function renderEditSelectedPanel(){
  const ds = getEditDataset();
  const kind = ds?.label || "ITEM";
  const id = (editor.selectedFeature?.properties?.id ||
              editor.selectedFeature?.properties?.manzana ||
              editor.selectedFeature?.properties?.seccion ||
              editor.selectedFeature?.properties?.lote ||
              "(sin id)");

  const showColor = isEditSecciones && editor.selectedFeature?.properties;
  const currentColor = showColor ? (editor.selectedFeature.properties.color || DEFAULT_SECCION_COLOR) : DEFAULT_SECCION_COLOR;

  setPanel(`Editar ${kind}: ${safe(id)}`, `
    <p><b>Tipo:</b> ${editor.selectedIsCircle ? "Círculo" : "Polígono"}</p>
    <p style="font-size:12px;color:#666;">
      ${editor.selectedIsCircle ? "Arrastra el centro rojo para mover el círculo. Arrastra el punto negro para cambiar el radio." :
                                 "Arrastra el centro rojo para mover la figura completa. Arrastra puntos blancos para cambiar vértices."}
    </p>
    <p style="font-size:12px;color:#666;">Destino: <b>${safe(ds?.dest || "")}</b></p>

    ${showColor ? `
      <hr/>
      <label><b>Color de la sección</b></label><br/>
      <input id="editSeccionColor" type="color" value="${safe(currentColor)}"
        style="width:100%;height:44px;border:1px solid #ccc;border-radius:10px;padding:4px;cursor:pointer;" />
      <p style="font-size:12px;color:#666;margin-top:6px;">
        Este color se guardará en <code>properties.color</code> y se verá en el mapa público.
      </p>
    ` : ""}

    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">
      <button id="btnDeleteShape" style="padding:8px 12px;border-radius:8px;border:1px solid #ef4444;background:#fff;color:#b91c1c;cursor:pointer;">
        Borrar figura
      </button>

      <button id="btnCopyShape" style="padding:8px 12px;border-radius:8px;border:1px solid #ccc;cursor:pointer;">
        Copiar figura
      </button>
      <button id="btnPasteShape" style="padding:8px 12px;border-radius:8px;border:1px solid #ccc;cursor:pointer;">
        Pegar figura
      </button>
      <button id="btnCancelPaste" style="padding:8px 12px;border-radius:8px;border:1px solid #ccc;cursor:pointer;display:none;">
        Cancelar pegado
      </button>

      <button id="btnSaveEdit" style="padding:8px 12px;border-radius:8px;border:1px solid #ccc;cursor:pointer;">Guardar cambios</button>
      <button id="btnCancelEdit" style="padding:8px 12px;border-radius:8px;border:1px solid #ccc;cursor:pointer;">Cancelar</button>
      <button id="btnCopyGeo" style="padding:8px 12px;border-radius:8px;border:1px solid #ccc;cursor:pointer;">Copiar GeoJSON</button>
      <button id="btnBack" style="padding:8px 12px;border-radius:8px;border:1px solid #ccc;cursor:pointer;">Volver</button>
    </div>
  `);

  // Color live update (solo secciones)
  if (showColor){
    const $col = document.getElementById("editSeccionColor");
    if ($col){
      $col.oninput = () => {
        editor.selectedFeature.properties.color = $col.value;
        try {
          editor.selectedLayer.setStyle({ weight: 2, opacity: 1, fillOpacity: 0.06, fillColor: $col.value });
        } catch {}
      };
    }
  }

  // BORRAR
  const btnDelete = document.getElementById("btnDeleteShape");
  if (btnDelete){
    btnDelete.onclick = () => {
      if (!confirm("¿Seguro que quieres borrar esta figura?")) return;
      deleteSelectedFeature();
    };
  }

  // COPY / PASTE
  const btnCopyShape = document.getElementById("btnCopyShape");
  const btnPasteShape = document.getElementById("btnPasteShape");
  const btnCancelPaste = document.getElementById("btnCancelPaste");

  if (btnCopyShape) btnCopyShape.disabled = !editor.selectedFeature;
  if (btnPasteShape) btnPasteShape.disabled = !editor.clipboardFeature;

  if (btnCancelPaste){
    btnCancelPaste.style.display = editor.pasteArmed ? "inline-block" : "none";
    btnCancelPaste.onclick = () => {
      editor.pasteArmed = false;
      alert("Pegado cancelado.");
      renderEditSelectedPanel();
    };
  }

  if (btnCopyShape){
    btnCopyShape.onclick = () => {
      if (!editor.selectedFeature) return;
      editor.clipboardFeature = deepCopy(editor.selectedFeature);
      editor.clipboardMeta = { dataset: (isEditSecciones ? "SECCIONES" : isEditManzanas ? "MANZANAS" : "LOTES") };
      alert("Figura copiada. Ahora presiona 'Pegar figura' y luego haz click en el mapa.");
      renderEditSelectedPanel();
    };
  }

  if (btnPasteShape){
    btnPasteShape.onclick = () => {
      if (!editor.clipboardFeature) return;
      editor.pasteArmed = true;
      alert("Modo PEGAR activado. Haz click en el mapa para colocar la copia (puedes pegar varias veces).");
      renderEditSelectedPanel();
    };
  }

  // Guardar / Cancelar / Copiar GeoJSON / Volver
  document.getElementById("btnSaveEdit").onclick = () => {
    alert("Guardado en memoria. Copia el GeoJSON y pégalo en tu archivo.");
  };

  document.getElementById("btnCancelEdit").onclick = () => {
    if (editor.selectedFeature && editor.originalGeometry){
      editor.selectedFeature.geometry = deepCopy(editor.originalGeometry);

      if (editor.selectedIsCircle){
        editor.selectedFeature.properties.radius = editor.originalRadius;

        const cxy = editor.selectedFeature.geometry.coordinates;
        const c = xyToLatLng(cxy);
        editor.selectedLayer.setLatLng(c);
        editor.selectedLayer.setRadius(editor.originalRadius);
      } else {
        const coords = editor.selectedFeature.geometry.coordinates?.[0] || [];
        let ring = coords.map(xyToLatLng);
        if (ring.length >= 2){
          const a = ring[0], b = ring[ring.length-1];
          if (Math.abs(a.lat-b.lat)<1e-9 && Math.abs(a.lng-b.lng)<1e-9) ring.pop();
        }
        editor.selectedLayer.setLatLngs([ring]);

        // también reset markers
        editor.vertexMarkers.forEach((m, i) => {
          if (ring[i]) m.setLatLng(ring[i]);
        });

        // reset move marker
        installPolygonMoveHandle(editor.selectedLayer);
      }
    }
    alert("Cancelado (revertido en memoria).");
    renderEditSelectedPanel();
  };

  document.getElementById("btnCopyGeo").onclick = async () => {
    const ds2 = getEditDataset();
    const txt = JSON.stringify(ds2?.data || { type:"FeatureCollection", features:[] }, null, 2);
    try {
      await navigator.clipboard.writeText(txt);
      alert("Copiado. Pégalo en el archivo correspondiente (reemplazando contenido).");
    } catch {
      setPanel("Copia manual", `<pre style="white-space:pre-wrap">${safe(txt)}</pre>`);
    }
  };

  document.getElementById("btnBack").onclick = () => {
    editorStopEditing();
    if (isEditSecciones) renderEditSeccionesPanel();
    else if (isEditManzanas) renderEditManzanasPanel();
    else renderEditLotesPanel();
  };
}

/* =========================================================
   EDIT panels
   ========================================================= */
function renderEditSeccionesPanel(){
  editor.mode = "edit";
  editor.drawShape = "polygon";
  editorClearPoly();
  editorClearCircle();
  editorStopEditing();

  setPanel("Edición: SECCIONES", `
    <p>Editor de <b>SECCIONES</b>. Puedes usar polígono o círculo.</p>

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
    $editBody.innerHTML = `<p><b>Editar:</b> clic en una sección para editar (polígono o círculo). Puedes cambiar color.</p>`;
    rerenderSecciones_Edit();
  };

  document.getElementById("btnCreate").onclick = () => {
    editor.mode = "create";
    editorStopEditing();
    editorClearPoly(); editorClearCircle();

    $editBody.innerHTML = `
      <p><b>Crear:</b> elige forma:</p>
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
        <button id="btnSaveNew" style="padding:8px 12px;border-radius:8px;border:1px solid #ccc;cursor:pointer;">Guardar nueva</button>
      </div>
    `;

    document.getElementById("btnPoly").onclick = () => { editor.drawShape = "polygon"; };
    document.getElementById("btnCircle").onclick = () => { editor.drawShape = "circle"; };
    document.getElementById("btnClear").onclick = () => { editorClearPoly(); editorClearCircle(); };

    document.getElementById("btnSaveNew").onclick = () => {
      const seccion = (document.getElementById("newSeccion").value || "").trim();
      const nombre  = (document.getElementById("newNombre").value || "").trim();
      const color   = (document.getElementById("newColor").value || "").trim() || DEFAULT_SECCION_COLOR;

      if (!seccion) return alert("Falta SECCIÓN.");

      const props = { seccion, nombre: nombre || seccion, id: seccion, color };

      let feature = null;
      if (editor.drawShape === "polygon"){
        if (editor.polyPoints.length < 3) return alert("Polígono: mínimo 3 puntos.");
        feature = { type:"Feature", geometry:{ type:"Polygon", coordinates:ringToGeoJsonCoords(editor.polyPoints) }, properties: props };
      } else {
        if (!editor.circleCenter || typeof editor.circleRadius !== "number") return alert("Círculo: clic centro y luego borde.");
        feature = { type:"Feature", geometry:{ type:"Point", coordinates: latLngToXY(editor.circleCenter) }, properties:{ ...props, shape:"circle", radius: editor.circleRadius } };
      }

      seccionesTopRaw.features.push(feature);
      editorClearPoly(); editorClearCircle();
      rerenderSecciones_Edit();
      alert("Sección creada en memoria. Copia el GeoJSON y pégalo en data/secciones-top.geojson");
    };

    rerenderSecciones_Edit();
  };

  document.getElementById("btnCopy").onclick = async () => {
    const txt = JSON.stringify(seccionesTopRaw || { type:"FeatureCollection", features:[] }, null, 2);
    try {
      await navigator.clipboard.writeText(txt);
      alert("Copiado. Pégalo en data/secciones-top.geojson (reemplazando contenido).");
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
  editorClearPoly(); editorClearCircle(); editorStopEditing();

  setPanel("Edición: MANZANAS", `
    <p>Editor de <b>MANZANAS</b>. Puedes usar polígono o círculo.</p>

    <div style="display:flex;gap:8px;flex-wrap:wrap;">
      <button id="btnEdit" style="padding:8px 12px;border-radius:8px;border:1px solid #ccc;cursor:pointer;">Editar existente</button>
      <button id="btnCreate" style="padding:8px 12px;border-radius:8px;border:1px solid #ccc;cursor:pointer;">Crear nueva</button>
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

  document.getElementById("btnEdit").onclick = () => {
    editor.mode = "edit";
    editorClearPoly(); editorClearCircle();
    $editBody.innerHTML = `<p><b>Editar:</b> clic en una manzana para editar (polígono o círculo).</p>`;
    rerenderManzanas_Edit();
  };

  document.getElementById("btnCreate").onclick = () => {
    editor.mode = "create";
    editorStopEditing();
    editorClearPoly(); editorClearCircle();

    $editBody.innerHTML = `
      <p><b>Crear:</b> elige forma:</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;">
        <button id="btnPoly" style="padding:8px 12px;border-radius:8px;border:1px solid #ccc;cursor:pointer;">Polígono</button>
        <button id="btnCircle" style="padding:8px 12px;border-radius:8px;border:1px solid #ccc;cursor:pointer;">Círculo</button>
        <button id="btnClear" style="padding:8px 12px;border-radius:8px;border:1px solid #ccc;cursor:pointer;">Limpiar</button>
      </div>

      <p><b>Puntos (polígono):</b> <span id="ptCount">0</span></p>

      <label><b>SECCIÓN</b></label><br/>
      <input id="newSeccion" placeholder="Ej. SAN ANDRES" style="width:100%;padding:8px;margin:6px 0;border:1px solid #ccc;border-radius:8px;" />

      <label><b>MANZANA</b></label><br/>
      <input id="newManzana" placeholder="Ej. A" style="width:100%;padding:8px;margin:6px 0;border:1px solid #ccc;border-radius:8px;" />

      <label><b>Nombre (opcional)</b></label><br/>
      <input id="newNombre" placeholder="Ej. SAN ANDRES - A" style="width:100%;padding:8px;margin:6px 0;border:1px solid #ccc;border-radius:8px;" />

      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">
        <button id="btnSaveNew" style="padding:8px 12px;border-radius:8px;border:1px solid #ccc;cursor:pointer;">Guardar nueva</button>
      </div>
    `;

    document.getElementById("btnPoly").onclick = () => { editor.drawShape = "polygon"; };
    document.getElementById("btnCircle").onclick = () => { editor.drawShape = "circle"; };
    document.getElementById("btnClear").onclick = () => { editorClearPoly(); editorClearCircle(); };

    document.getElementById("btnSaveNew").onclick = () => {
      const seccion = (document.getElementById("newSeccion").value || "").trim();
      const manzana = (document.getElementById("newManzana").value || "").trim();
      const nombre  = (document.getElementById("newNombre").value || "").trim();

      if (!seccion) return alert("Falta SECCIÓN.");
      if (!manzana) return alert("Falta MANZANA.");

      const lotesFile = `./data/lotes/lotes-${seccion}-${manzana}.geojson`;
      const props = { seccion, manzana, nombre: nombre || `${seccion} - ${manzana}`, lotesFile, id: `${seccion}-${manzana}` };

      let feature = null;
      if (editor.drawShape === "polygon"){
        if (editor.polyPoints.length < 3) return alert("Polígono: mínimo 3 puntos.");
        feature = { type:"Feature", geometry:{ type:"Polygon", coordinates:ringToGeoJsonCoords(editor.polyPoints) }, properties: props };
      } else {
        if (!editor.circleCenter || typeof editor.circleRadius !== "number") return alert("Círculo: clic centro y luego borde.");
        feature = { type:"Feature", geometry:{ type:"Point", coordinates: latLngToXY(editor.circleCenter) }, properties:{ ...props, shape:"circle", radius: editor.circleRadius } };
      }

      manzanasRaw.features.push(feature);
      editorClearPoly(); editorClearCircle();
      rerenderManzanas_Edit();
      alert("Manzana creada en memoria. Copia el GeoJSON y pégalo en data/secciones.geojson");
    };

    rerenderManzanas_Edit();
  };

  document.getElementById("btnCopy").onclick = async () => {
    const txt = JSON.stringify(manzanasRaw || { type:"FeatureCollection", features:[] }, null, 2);
    try {
      await navigator.clipboard.writeText(txt);
      alert("Copiado. Pégalo en data/secciones.geojson (reemplazando contenido).");
    } catch {
      setPanel("Copia manual", `<pre style="white-space:pre-wrap">${safe(txt)}</pre>`);
    }
  };

  document.getElementById("btnExit").onclick = () => location.href = "./";
  document.getElementById("btnEdit").click();
}

function renderEditLotesPanel(){
  editor.mode = "edit";
  editor.drawShape = "polygon";
  editorClearPoly(); editorClearCircle(); editorStopEditing();

  const lotesFile = currentManzanaFeature?.properties?.lotesFile || "(elige manzana)";

  setPanel("Edición: LOTES", `
    <p>Primero elige SECCIÓN y MANZANA arriba.</p>

    <div style="display:flex;gap:8px;flex-wrap:wrap;">
      <button id="btnEdit" style="padding:8px 12px;border-radius:8px;border:1px solid #ccc;cursor:pointer;">Editar existente</button>
      <button id="btnCreate" style="padding:8px 12px;border-radius:8px;border:1px solid #ccc;cursor:pointer;">Crear nuevo</button>
      <button id="btnCopy" style="padding:8px 12px;border-radius:8px;border:1px solid #ccc;cursor:pointer;">Copiar GeoJSON</button>
      <button id="btnExit" style="padding:8px 12px;border-radius:8px;border:1px solid #ccc;cursor:pointer;">Salir</button>
    </div>

    <hr/>
    <div id="editBody"></div>

    <p style="font-size:12px;color:#666;margin-top:10px;">
      Destino: <b>${safe(lotesFile)}</b>
    </p>
  `);

  const $editBody = document.getElementById("editBody");

  document.getElementById("btnEdit").onclick = () => {
    editor.mode = "edit";
    editorClearPoly(); editorClearCircle();
    $editBody.innerHTML = `<p><b>Editar:</b> clic en un lote para editar (polígono o círculo).</p>`;
    rerenderLotes_Edit();
  };

  document.getElementById("btnCreate").onclick = () => {
    if (!currentManzanaFeature) return alert("Primero elige una MANZANA.");

    editor.mode = "create";
    editorStopEditing();
    editorClearPoly(); editorClearCircle();

    $editBody.innerHTML = `
      <p><b>Crear:</b> elige forma:</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;">
        <button id="btnPoly" style="padding:8px 12px;border-radius:8px;border:1px solid #ccc;cursor:pointer;">Polígono</button>
        <button id="btnCircle" style="padding:8px 12px;border-radius:8px;border:1px solid #ccc;cursor:pointer;">Círculo</button>
        <button id="btnClear" style="padding:8px 12px;border-radius:8px;border:1px solid #ccc;cursor:pointer;">Limpiar</button>
      </div>

      <p><b>Puntos (polígono):</b> <span id="ptCount">0</span></p>

      <label><b>LOTE</b></label><br/>
      <input id="newLote" placeholder="Ej. 12" style="width:100%;padding:8px;margin:6px 0;border:1px solid #ccc;border-radius:8px;" />

      <label><b>Estatus</b></label><br/>
      <select id="newStatus" style="width:100%;padding:8px;margin:6px 0;border:1px solid #ccc;border-radius:8px;">
        <option>disponible</option>
        <option>ocupado</option>
        <option>por construir</option>
      </select>

      <label><b>Paquete (opcional)</b></label><br/>
      <input id="newPkg" placeholder="Ej. PAQ-STD" style="width:100%;padding:8px;margin:6px 0;border:1px solid #ccc;border-radius:8px;" />

      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">
        <button id="btnSaveNew" style="padding:8px 12px;border-radius:8px;border:1px solid #ccc;cursor:pointer;">Guardar nuevo</button>
      </div>
    `;

    document.getElementById("btnPoly").onclick = () => { editor.drawShape = "polygon"; };
    document.getElementById("btnCircle").onclick = () => { editor.drawShape = "circle"; };
    document.getElementById("btnClear").onclick = () => { editorClearPoly(); editorClearCircle(); };

    document.getElementById("btnSaveNew").onclick = () => {
      const lote = (document.getElementById("newLote").value || "").trim();
      if (!lote) return alert("Falta LOTE.");
      const estatus = document.getElementById("newStatus").value;
      const paquete = (document.getElementById("newPkg").value || "").trim() || null;

      const props = { lote, id: lote, estatus, paquete };

      let feature = null;
      if (editor.drawShape === "polygon"){
        if (editor.polyPoints.length < 3) return alert("Polígono: mínimo 3 puntos.");
        feature = { type:"Feature", geometry:{ type:"Polygon", coordinates:ringToGeoJsonCoords(editor.polyPoints) }, properties: props };
      } else {
        if (!editor.circleCenter || typeof editor.circleRadius !== "number") return alert("Círculo: clic centro y luego borde.");
        feature = { type:"Feature", geometry:{ type:"Point", coordinates: latLngToXY(editor.circleCenter) }, properties:{ ...props, shape:"circle", radius: editor.circleRadius } };
      }

      currentLotesRaw.features.push(feature);
      editorClearPoly(); editorClearCircle();
      rerenderLotes_Edit();
      alert("Lote creado en memoria. Copia el GeoJSON y pégalo en el archivo de lotes.");
    };

    rerenderLotes_Edit();
  };

  document.getElementById("btnCopy").onclick = async () => {
    const txt = JSON.stringify(currentLotesRaw || { type:"FeatureCollection", features:[] }, null, 2);
    try {
      await navigator.clipboard.writeText(txt);
      alert("Copiado. Pégalo en el archivo de lotes (reemplazando contenido).");
    } catch {
      setPanel("Copia manual", `<pre style="white-space:pre-wrap">${safe(txt)}</pre>`);
    }
  };

  document.getElementById("btnExit").onclick = () => location.href = "./";
  document.getElementById("btnEdit").click();
}

/* =========================================================
   EDIT renderers
   ========================================================= */
function rerenderManzanas_Edit(){
  if (manzanasLayer){ manzanasLayer.remove(); manzanasLayer = null; }
  editorStopEditing();

  manzanasLayer = L.geoJSON(manzanasRaw || { type:"FeatureCollection", features:[] }, {
    style: { weight: 2, opacity: 1, fillOpacity: 0.06 },
    interactive: (editor.mode === "edit"),
    pointToLayer: (feature, latlng) => {
      const layer = featureToLayerCircleAware(feature, latlng);
      try { layer.setStyle({ weight:2, opacity:1, fillOpacity:0.06 }); } catch {}
      return layer;
    },
    onEachFeature: (feature, layer) => {
      layer.on("click", () => {
        if (editor.mode !== "edit") return;
        if (isCircleFeature(feature) && layer instanceof L.Circle) editorStartEditCircle(layer);
        else editorStartEditPolygon(layer);
      });
    }
  }).addTo(map);
}

function rerenderLotes_Edit(){
  if (lotesLayer){ lotesLayer.remove(); lotesLayer = null; }
  editorStopEditing();
  if (!currentLotesRaw) return;

  lotesLayer = L.geoJSON(currentLotesRaw, {
    style: (feature) => ({ ...styleByStatus(feature?.properties?.estatus), fillOpacity: 0.10 }),
    interactive: (editor.mode === "edit"),
    pointToLayer: (feature, latlng) => {
      const layer = featureToLayerCircleAware(feature, latlng);
      try { layer.setStyle({ ...styleByStatus(feature?.properties?.estatus), fillOpacity: 0.10 }); } catch {}
      return layer;
    },
    onEachFeature: (feature, layer) => {
      layer.on("click", () => {
        if (editor.mode !== "edit") return;
        if (isCircleFeature(feature) && layer instanceof L.Circle) editorStartEditCircle(layer);
        else editorStartEditPolygon(layer);
      });
    }
  }).addTo(map);
}

function rerenderSecciones_Edit(){
  if (seccionesLayer){ seccionesLayer.remove(); seccionesLayer = null; }
  editorStopEditing();

  seccionesLayer = L.geoJSON(seccionesTopRaw || { type:"FeatureCollection", features:[] }, {
    style: (feature) => ({ weight: 2, opacity: 1, fillOpacity: 0.06, fillColor: getSeccionColor(feature) }),
    interactive: (editor.mode === "edit"),
    pointToLayer: (feature, latlng) => {
      const layer = featureToLayerCircleAware(feature, latlng);
      try { layer.setStyle({ weight:2, opacity:1, fillOpacity:0.06, fillColor: getSeccionColor(feature) }); } catch {}
      return layer;
    },
    onEachFeature: (feature, layer) => {
      layer.on("click", () => {
        if (editor.mode !== "edit") return;
        if (isCircleFeature(feature) && layer instanceof L.Circle) editorStartEditCircle(layer);
        else editorStartEditPolygon(layer);
      });
    }
  }).addTo(map);
}

/* =========================================================
   Map click handler for CREATE + PASTE
   ========================================================= */
let mapClickAttached = false;
function attachEditorMapClick(){
  if (mapClickAttached) return;
  mapClickAttached = true;

  map.on("click", (e) => {
    if (!(isEditSecciones || isEditManzanas || isEditLotes)) return;

    // 1) PEGAR tiene prioridad
    if (editor.pasteArmed && editor.clipboardFeature){
      const arr = getActiveEditDataset();
      if (!arr) return alert("No hay dataset activo para pegar.");

      const center = getFeatureCenterXY(editor.clipboardFeature, null);
      const target = [e.latlng.lng, e.latlng.lat];

      const dx = target[0] - center[0];
      const dy = target[1] - center[1];

      const pasted = translateFeature(editor.clipboardFeature, dx, dy);

      // Evitar id duplicado si existe: agrega sufijo
      if (pasted?.properties){
        const baseId = pasted.properties.id || pasted.properties.lote || pasted.properties.manzana || pasted.properties.seccion || "copy";
        pasted.properties.id = `${baseId}-copy-${Date.now()}`;
        if (pasted.properties.lote) pasted.properties.lote = pasted.properties.id;
      }

      arr.push(pasted);
      rerenderActiveEditor();
      return; // sigue en modo paste para pegar varias veces
    }

    // 2) Modo create normal
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
    maxZoom: (isEditSecciones || isEditManzanas || isEditLotes) ? 6 : 4,
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

      COORD_SCALE_X = w / DATA_COORD_WIDTH;
      COORD_SCALE_Y = h / DATA_COORD_HEIGHT;

      L.imageOverlay(BASE_IMAGE_URL, bounds).addTo(map);
      map.fitBounds(bounds);

      attachEditorMapClick();

      manzanasRaw = await loadJson(MANZANAS_URL);

      try { seccionesTopRaw = await loadJson(SECCIONES_TOP_URL); }
      catch { seccionesTopRaw = { type:"FeatureCollection", features: [] }; }

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

      // ====== EDIT LOTES ======
      if (isEditLotes){
        if ($toggleLotsBtn) $toggleLotsBtn.disabled = true;
        if ($searchBtn) $searchBtn.disabled = true;

        const secciones = buildSeccionesList(manzanasRaw.features);
        fillSeccionSelect(secciones);
        $manzanaSelect.innerHTML = `<option value="">MANZANA...</option>`;

        $seccionSelect.onchange = () => {
          const sec = ($seccionSelect.value || "").trim();
          const list = buildManzanasListBySeccion(manzanasRaw.features, sec);
          fillManzanaSelect(list);
        };

        $manzanaSelect.onchange = async () => {
          const sec = ($seccionSelect.value || "").trim();
          const man = ($manzanaSelect.value || "").trim();
          if (!sec || !man) return;

          const f = manzanasRaw.features.find(x => getPropSeccion(x) === sec && getPropManzana(x) === man);
          currentManzanaFeature = f;
          if (!f) return;

          const lotesFile = f.properties?.lotesFile;
          if (!lotesFile) return alert("Esta manzana no tiene lotesFile.");

          try { currentLotesRaw = await loadJson(lotesFile); }
          catch { currentLotesRaw = { type:"FeatureCollection", features:[] }; }

          rerenderLotes_Edit();
          renderEditLotesPanel();

          const temp = L.geoJSON(f);
          flyToBoundsSmooth(temp.getBounds().pad(0.15), 0.65);
        };

        renderEditLotesPanel();
        return;
      }

      // ====== NORMAL (público) ======
      seccionesTopScaled = deepCopy(seccionesTopRaw);
      applyCoordScaleToGeoJSON(seccionesTopScaled, COORD_SCALE_X, COORD_SCALE_Y);

      manzanasScaled = deepCopy(manzanasRaw);
      applyCoordScaleToGeoJSON(manzanasScaled, COORD_SCALE_X, COORD_SCALE_Y);

      // === NICHOS (capa independiente) ===
      try {
        nichosZonasRaw = await loadJson(NICHOS_ZONAS_URL);
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