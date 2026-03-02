/* =========================================================
   CONFIG
   ========================================================= */
const BASE_IMAGE_PUBLIC_URL = "./assets/map/base-public.webp"; // ligero (público)
const BASE_IMAGE_EDIT_URL   = "./assets/map/base.png";         // 600dpi (edición)

// Tus GeoJSON están guardados en coordenadas del mapa 600dpi (base.png)
const DATA_COORD_WIDTH  = 21600;
const DATA_COORD_HEIGHT = 14400;

// Archivos de datos
const SECCIONES_TOP_URL = "./data/secciones-top.geojson"; // editor ?edit=secciones
const MANZANAS_URL      = "./data/secciones.geojson";     // tu archivo actual (ahora son MANZANAS)

// Catálogos
const LOTES_INFO_URL    = "./data/lotes.json";
const PAQUETES_URL      = "./data/paquetes.json";

// Edit modes:
// ?edit=secciones  => EDITOR SECCIONES (nuevo)
// ?edit=manzanas   => EDITOR MANZANAS (antes ?edit=sections)
// ?edit=lotes       => EDITOR LOTES (igual)
const editMode = new URLSearchParams(location.search).get("edit"); // null | "secciones" | "manzanas" | "lotes"
const isEditSecciones = editMode === "secciones";
const isEditManzanas  = editMode === "manzanas";
const isEditLotes     = (editMode === "lotes" || editMode === "lotes"); // tolerante

const BASE_IMAGE_URL = (isEditSecciones || isEditManzanas || isEditLotes) ? BASE_IMAGE_EDIT_URL : BASE_IMAGE_PUBLIC_URL;

// Detectar móvil/tablet
const IS_MOBILE = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;

/* =========================================================
   GLOBAL STATE
   ========================================================= */
let map;

let lotesInfo = {};
let paquetesInfo = {};

// RAW (600 coords)
let seccionesTopRaw = null;   // SECCIONES (nuevo)
let manzanasRaw = null;       // MANZANAS

// Scaled a base actual (público)
let manzanasScaled = null;    // MANZANAS escaladas
let lotesScaled = null;       // LOTES escalados

let seccionesLayer = null;    // para editor secciones
let manzanasLayer = null;     // público + editor manzanas
let lotesLayer = null;        // público + editor lotes

let currentSeccion = null;          // "ORO"
let currentManzanaFeature = null;   // feature seleccionada (scaled en público, raw en edit)
let currentLotesRaw = null;         // lotes raw del archivo de esa manzana (en edit lotes)

let showAlllotes = false;

// escala 600->baseActual
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
const $togglelotesBtn  = document.getElementById("togglelotesBtn");

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

/* =========================================================
   COORD SCALE (para que público use base-public sin desalinear)
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
   ANIMACIONES (en móvil se apagan para estabilidad)
   - Cambiado: soporta maxZoom para evitar zoom extremo en círculos
   ========================================================= */
function flyToBoundsSmooth(bounds, durationSeconds, maxZoom = null){
  const opt = { animate: true, duration: durationSeconds, easeLinearity: 0.2 };
  if (maxZoom !== null) opt.maxZoom = maxZoom;

  if (IS_MOBILE) {
    map.fitBounds(bounds, maxZoom !== null ? { maxZoom } : undefined);
    return;
  }

  try {
    map.flyToBounds(bounds, opt);
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
function hoverStyle(){  return { weight: 2, opacity: 1, fillOpacity: 0.08 }; }
function pinnedStyle(){ return { weight: 3, opacity: 1, fillOpacity: 0.12 }; }

function styleByStatus(status){
  const s = (status || "").toLowerCase();
  if (s === "disponible") return { weight: 1, opacity: 1, fillOpacity: 0.30 };
  if (s === "ocupado")    return { weight: 1, opacity: 1, fillOpacity: 0.55 };
  if (s === "por construir") return { weight: 1, opacity: 1, dashArray: "4 4", fillOpacity: 0.20 };
  return { weight: 1, opacity: 1, fillOpacity: 0.25 };
}
function lotHiddenStyle(){ return { weight: 1, opacity: 0, fillOpacity: 0 }; }
function lotBaseStyle(status){ return showAlllotes ? styleByStatus(status) : lotHiddenStyle(); }
function lotPinnedStyle(status){ const s = styleByStatus(status); return { ...s, weight: 2 }; }

function updateTogglelotesButton(){
  if (!$togglelotesBtn) return;
  const enabled = !!currentManzanaFeature && !(isEditSecciones || isEditManzanas || isEditLotes);
  $togglelotesBtn.disabled = !enabled;
  $togglelotesBtn.textContent = showAlllotes ? "Ocultar lotes" : "Mostrar lotes";
}

/* =========================================================
   UI helpers (dropdowns)
   ========================================================= */
function getPropSeccion(f){
  return (f?.properties?.seccion || "SIN-SECCION").toString().trim();
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
   ================= PÚBLICO: MANZANAS + LOTES =================
   ========================================================= */
let pinnedManzanaLayer = null;
let pinnedLotLayer = null;

function clearLotesLayer(){
  if (lotesLayer){ lotesLayer.remove(); lotesLayer = null; }
}

function renderManzanasLayer(filteredFeatures){
  if (manzanasLayer){ manzanasLayer.remove(); manzanasLayer = null; }
  pinnedManzanaLayer = null;
  currentManzanaFeature = null;
  clearLotesLayer();
  updateTogglelotesButton();

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

  setPanel("Selección", `
    <p>1) Elige <b>SECCIÓN</b></p>
    <p>2) Elige <b>MANZANA</b></p>
    <p>3) Escribe <b>LOTE</b> (opcional) y presiona Buscar</p>
  `);
}

async function selectManzana(feature, layer){
  currentManzanaFeature = feature;

  try {
    const isCircle = isCircleFeature(feature);
    const pad = isCircle ? 0.40 : 0.20;      // más padding en círculo
    const mz  = isCircle ? 3 : null;         // limitar zoom máximo en círculo

    const b = layer.getBounds
      ? layer.getBounds().pad(pad)
      : L.latLngBounds(layer.getLatLng(), layer.getLatLng()).pad(pad);

    flyToBoundsSmooth(b, 0.65, mz);
  } catch {}

  await loadLotesForCurrentManzana();
}

async function loadLotesForCurrentManzana(){
  clearLotesLayer();
  pinnedLotLayer = null;
  showAlllotes = false;
  updateTogglelotesButton();

  const lotesFile = currentManzanaFeature?.properties?.lotesFile;
  if (!lotesFile){
    setPanel("MANZANA sin lotesFile", `<p>Esta manzana no tiene <b>lotesFile</b>.</p>`);
    return;
  }

  // cargar RAW (600)
  let raw;
  try {
    raw = await loadJson(lotesFile);
  } catch {
    raw = { type:"FeatureCollection", features: [] };
  }

  // escalar a base actual
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

        flyToBoundsSmooth(layer.getBounds().pad(0.30), 0.45, null);
        showLoteInfo(feature);
      });
    }
  }).addTo(map);

  updateTogglelotesButton();

  const sec = getPropSeccion(currentManzanaFeature);
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
    <p><b>SECCIÓN:</b> ${safe(getPropSeccion(currentManzanaFeature))}</p>
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
  rebuildManzanasUIForSeccion(sec);
  $manzanaSelect.value = man;

  currentManzanaFeature = f;
  await loadLotesForCurrentManzana();

  try {
    const temp = L.geoJSON({ type:"FeatureCollection", features:[f] });
    const pad = isCircleFeature(f) ? 0.40 : 0.20;
    const mz  = isCircleFeature(f) ? 3 : null;
    flyToBoundsSmooth(temp.getBounds().pad(pad), 0.65, mz);
  } catch {}
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

    flyToBoundsSmooth(layer.getBounds().pad(0.35), 0.45, null);

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
   DROPDOWNS
   ========================================================= */
function rebuildManzanasUIForSeccion(seccion){
  currentSeccion = seccion;
  const features = buildManzanasListBySeccion(manzanasScaled.features, seccion);
  fillManzanaSelect(features);
  renderManzanasLayer(features);

  $loteInput.value = "";
}

function setupDropdowns(){
  $seccionSelect.onchange = () => {
    const sec = ($seccionSelect.value || "").trim();
    $loteInput.value = "";
    $manzanaSelect.value = "";
    currentManzanaFeature = null;
    clearLotesLayer();
    updateTogglelotesButton();

    if (!sec){
      renderManzanasLayer(manzanasScaled.features);
      return;
    }
    rebuildManzanasUIForSeccion(sec);
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
   BOTONES
   ========================================================= */
function setupButtons(){
  $backBtn.onclick = () => {
    currentSeccion = null;
    currentManzanaFeature = null;
    $seccionSelect.value = "";
    $manzanaSelect.value = "";
    $loteInput.value = "";
    showAlllotes = false;
    clearLotesLayer();
    updateTogglelotesButton();
    renderManzanasLayer(manzanasScaled.features);
  };

  if ($togglelotesBtn){
    $togglelotesBtn.onclick = () => {
      showAlllotes = !showAlllotes;
      updateTogglelotesButton();
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
   Polígono o Círculo
   ========================================================= */
const editor = {
  mode: "edit",
  drawShape: "polygon",

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

  // editing existing
  selectedLayer: null,
  selectedFeature: null,
  selectedIsCircle: false,

  originalGeometry: null,
  originalRadius: null,

  vertexMarkers: [],

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
  })
};

/* =========================================================
   NUEVO: Plantilla + duplicación (solo en ?edit=lotes)
   ========================================================= */
let lotTemplate = null;           // { type:"Polygon"|"Circle", ringLatLngs|centerLatLng, radius, props }
let customDupCenter = null;       // L.LatLng
let pickCenterActive = false;     // para elegir centro con click

function parseMaybeInt(x, fallback){
  const n = parseInt(String(x||"").trim(), 10);
  return Number.isFinite(n) ? n : fallback;
}

function getRingLatLngsFromPolygonCoords(coords){
  // coords = [[x,y],...]
  let pts = coords.map(xyToLatLng);
  // quitar cierre duplicado si existe
  if (pts.length >= 2){
    const a = pts[0], b = pts[pts.length-1];
    if (Math.abs(a.lat-b.lat)<1e-9 && Math.abs(a.lng-b.lng)<1e-9) pts.pop();
  }
  return pts;
}

function getManzanaCenterLatLng(){
  // en edit lotes, currentManzanaFeature es RAW (600 coords)
  if (!currentManzanaFeature) return null;

  // círculo: centro directo
  if (isCircleFeature(currentManzanaFeature)){
    return xyToLatLng(currentManzanaFeature.geometry.coordinates);
  }

  // polígono: centro aproximado = promedio de vertices
  if (currentManzanaFeature.geometry?.type === "Polygon"){
    const ring = currentManzanaFeature.geometry.coordinates?.[0] || [];
    if (!ring.length) return null;
    let sumX = 0, sumY = 0, count = 0;
    for (const xy of ring){
      if (!Array.isArray(xy) || xy.length < 2) continue;
      sumX += xy[0];
      sumY += xy[1];
      count++;
    }
    if (!count) return null;
    return xyToLatLng([sumX/count, sumY/count]);
  }

  return null;
}

function rotatePointAround(p, center, angRad){
  // CRS.Simple: x=lng, y=lat
  const x = p.lng - center.lng;
  const y = p.lat - center.lat;
  const c = Math.cos(angRad);
  const s = Math.sin(angRad);
  const xr = x*c - y*s;
  const yr = x*s + y*c;
  return L.latLng(center.lat + yr, center.lng + xr);
}

function translatePoint(p, dx, dy){
  return L.latLng(p.lat + dy, p.lng + dx);
}

function makePolygonFeatureFromLatLngs(latlngs, props){
  const coords = latlngs.map(latLngToXY);
  coords.push(coords[0]); // cerrar
  return {
    type: "Feature",
    geometry: { type: "Polygon", coordinates: [coords] },
    properties: props
  };
}

function setTemplateFromSelectedFeature(){
  if (!editor.selectedFeature) return;

  const f = editor.selectedFeature;
  const props = {
    estatus: f.properties?.estatus,
    paquete: f.properties?.paquete
  };

  if (isCircleFeature(f)){
    lotTemplate = {
      type: "Circle",
      centerLatLng: xyToLatLng(f.geometry.coordinates),
      radius: f.properties.radius,
      props
    };
  } else if (f.geometry?.type === "Polygon"){
    const ring = f.geometry.coordinates?.[0] || [];
    lotTemplate = {
      type: "Polygon",
      ringLatLngs: getRingLatLngsFromPolygonCoords(ring),
      props
    };
  } else {
    alert("Este lote no es polígono ni círculo. No se puede usar como plantilla.");
    return;
  }

  alert("Plantilla guardada. Ahora puedes crear copias.");
}

function clearTemplate(){
  lotTemplate = null;
  alert("Plantilla borrada.");
}

function duplicateTemplateRadial(total, startLote, angleOffsetDeg, includeOriginal){
  if (!currentLotesRaw) return alert("No hay archivo de lotes cargado.");
  const src = lotTemplate || (editor.selectedFeature ? (() => { setTemplateFromSelectedFeature(); return lotTemplate; })() : null);
  if (!src) return alert("No hay plantilla. Selecciona un lote y guarda como plantilla.");

  // centro: manzana (si existe) o centro custom
  const manzanaCenter = getManzanaCenterLatLng();
  const center = customDupCenter || manzanaCenter;
  if (!center) return alert("No pude calcular el centro. Usa 'Elegir centro (click en mapa)'.");

  const n = Math.max(1, parseMaybeInt(total, 1));
  const step = (2*Math.PI) / n;
  const offset = (parseFloat(angleOffsetDeg)||0) * Math.PI/180;

  // cuántas copias crear
  const startIndex = includeOriginal ? 1 : 0;
  let loteNum = parseMaybeInt(startLote, 1);

  for (let i = startIndex; i < n; i++){
    const ang = offset + step*i;

    let newFeature = null;
    let props = {
      lote: String(loteNum),
      id: String(loteNum),
      estatus: src.props?.estatus ?? "disponible",
      paquete: src.props?.paquete ?? null
    };

    if (src.type === "Polygon"){
      const rotated = src.ringLatLngs.map(p => rotatePointAround(p, center, ang));
      newFeature = makePolygonFeatureFromLatLngs(rotated, props);
    } else {
      // circle lot
      const cRot = rotatePointAround(src.centerLatLng, center, ang);
      newFeature = {
        type: "Feature",
        geometry: { type: "Point", coordinates: latLngToXY(cRot) },
        properties: { ...props, shape: "circle", radius: src.radius }
      };
    }

    currentLotesRaw.features.push(newFeature);
    loteNum += 1;
  }

  alert("Copias creadas. Ahora copia el GeoJSON y pégalo en el archivo de lotes.");
}

function duplicateTemplateOffset(count, startLote, dx, dy, includeOriginal){
  if (!currentLotesRaw) return alert("No hay archivo de lotes cargado.");
  const src = lotTemplate || (editor.selectedFeature ? (() => { setTemplateFromSelectedFeature(); return lotTemplate; })() : null);
  if (!src) return alert("No hay plantilla. Selecciona un lote y guarda como plantilla.");

  const n = Math.max(1, parseMaybeInt(count, 1));
  const stepX = parseFloat(dx)||0;
  const stepY = parseFloat(dy)||0;

  const startIndex = includeOriginal ? 1 : 0;
  let loteNum = parseMaybeInt(startLote, 1);

  for (let i = startIndex; i < n; i++){
    const offX = stepX * i;
    const offY = stepY * i;

    let props = {
      lote: String(loteNum),
      id: String(loteNum),
      estatus: src.props?.estatus ?? "disponible",
      paquete: src.props?.paquete ?? null
    };

    let newFeature = null;
    if (src.type === "Polygon"){
      const moved = src.ringLatLngs.map(p => translatePoint(p, offX, offY));
      newFeature = makePolygonFeatureFromLatLngs(moved, props);
    } else {
      const cMoved = translatePoint(src.centerLatLng, offX, offY);
      newFeature = {
        type: "Feature",
        geometry: { type: "Point", coordinates: latLngToXY(cMoved) },
        properties: { ...props, shape: "circle", radius: src.radius }
      };
    }

    currentLotesRaw.features.push(newFeature);
    loteNum += 1;
  }

  alert("Copias creadas. Ahora copia el GeoJSON y pégalo en el archivo de lotes.");
}

/* =========================================================
   Editor internals
   ========================================================= */
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

function editorStartEditPolygon(layer){
  editorStopEditing();

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
    const mk = L.marker(p, { draggable: true, icon: editor.iconVertex }).addTo(map);
    mk.on("drag", () => {
      const newRing = editor.vertexMarkers.map(m => m.getLatLng());
      layer.setLatLngs([newRing]);
    });
    mk.on("dragend", () => {
      const newRing = editor.vertexMarkers.map(m => m.getLatLng());
      layer.setLatLngs([newRing]);
      editor.selectedFeature.geometry.coordinates = ringToGeoJsonCoords(newRing);
    });
    return mk;
  });

  renderEditSelectedPanel();
}

function editorStartEditCircle(layer){
  editorStopEditing();

  editor.selectedLayer = layer;
  editor.selectedFeature = layer.feature;
  editor.selectedIsCircle = true;

  editor.originalGeometry = deepCopy(layer.feature.geometry);
  editor.originalRadius = layer.feature.properties.radius;

  const center = layer.getLatLng();
  const radius = layer.feature.properties.radius;

  editor.circleCenterMarker = L.marker(center, { draggable:true, icon: editor.iconVertex }).addTo(map);

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

function renderEditSelectedPanel(){
  const ds = getEditDataset();
  const kind = ds?.label || "ITEM";
  const id = (editor.selectedFeature?.properties?.id ||
              editor.selectedFeature?.properties?.manzana ||
              editor.selectedFeature?.properties?.seccion ||
              editor.selectedFeature?.properties?.lote ||
              "(sin id)");

  // NUEVO: bloque de duplicación (solo en edit lotes)
  const dupBlock = isEditLotes ? `
    <hr/>
    <h3>Copiar/Duplicar lote</h3>
    <p style="font-size:12px;color:#666;">
      Ideal para VIP: dibuja 1 rectángulo, guárdalo como plantilla y crea 8 copias alrededor.
    </p>

    <p><b>Plantilla:</b> ${lotTemplate ? "✅ lista" : "— (no hay)"}</p>

    <div style="display:flex;gap:8px;flex-wrap:wrap;margin:8px 0;">
      <button id="btnSetTemplate" style="padding:8px 12px;border-radius:8px;border:1px solid #ccc;cursor:pointer;">Guardar este lote como plantilla</button>
      <button id="btnClearTemplate" style="padding:8px 12px;border-radius:8px;border:1px solid #ccc;cursor:pointer;">Borrar plantilla</button>
      <button id="btnPickCenter" style="padding:8px 12px;border-radius:8px;border:1px solid #ccc;cursor:pointer;">Elegir centro (click en mapa)</button>
    </div>

    <label><b>Modo</b></label><br/>
    <select id="dupMode" style="width:100%;padding:8px;margin:6px 0;border:1px solid #ccc;border-radius:8px;">
      <option value="radial">Alrededor (radial)</option>
      <option value="offset">En línea (desplazar)</option>
    </select>

    <label><b>Cantidad total</b></label><br/>
    <input id="dupCount" value="8" style="width:100%;padding:8px;margin:6px 0;border:1px solid #ccc;border-radius:8px;" />

    <label><b>Inicio LOTE (para nuevas copias)</b></label><br/>
    <input id="dupStart" value="2" style="width:100%;padding:8px;margin:6px 0;border:1px solid #ccc;border-radius:8px;" />

    <div id="radialFields">
      <label><b>Ángulo offset (grados)</b></label><br/>
      <input id="dupAngle" value="0" style="width:100%;padding:8px;margin:6px 0;border:1px solid #ccc;border-radius:8px;" />
    </div>

    <div id="offsetFields" style="display:none;">
      <label><b>Desplazar X (pixeles)</b></label><br/>
      <input id="dupDx" value="200" style="width:100%;padding:8px;margin:6px 0;border:1px solid #ccc;border-radius:8px;" />
      <label><b>Desplazar Y (pixeles)</b></label><br/>
      <input id="dupDy" value="0" style="width:100%;padding:8px;margin:6px 0;border:1px solid #ccc;border-radius:8px;" />
    </div>

    <label style="display:block;margin-top:6px;">
      <input type="checkbox" id="dupInclude" checked />
      Ya tengo el lote #1 (no lo vuelvas a crear)
    </label>

    <button id="btnDoDup" style="margin-top:10px;padding:10px 12px;border-radius:10px;border:1px solid #ccc;cursor:pointer;width:100%;">
      Crear copias
    </button>
  ` : "";

  setPanel(`Editar ${kind}: ${safe(id)}`, `
    <p><b>Tipo:</b> ${editor.selectedIsCircle ? "Círculo" : "Polígono"}</p>
    <p>Mueve puntos (polígono) o centro/radio (círculo).</p>
    <p style="font-size:12px;color:#666;">Destino: <b>${safe(ds?.dest || "")}</b></p>

    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">
      <button id="btnSaveEdit" style="padding:8px 12px;border-radius:8px;border:1px solid #ccc;cursor:pointer;">Guardar cambios</button>
      <button id="btnCancelEdit" style="padding:8px 12px;border-radius:8px;border:1px solid #ccc;cursor:pointer;">Cancelar</button>
      <button id="btnCopyGeo" style="padding:8px 12px;border-radius:8px;border:1px solid #ccc;cursor:pointer;">Copiar GeoJSON</button>
      <button id="btnBack" style="padding:8px 12px;border-radius:8px;border:1px solid #ccc;cursor:pointer;">Volver</button>
    </div>

    ${dupBlock}
  `);

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
      }
    }
    editorStopEditing();
    alert("Cancelado.");
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

  // handlers duplicación
  if (isEditLotes) {
    const modeEl = document.getElementById("dupMode");
    const radialFields = document.getElementById("radialFields");
    const offsetFields = document.getElementById("offsetFields");

    modeEl.onchange = () => {
      const m = modeEl.value;
      radialFields.style.display = (m === "radial") ? "" : "none";
      offsetFields.style.display = (m === "offset") ? "" : "none";
    };

    document.getElementById("btnSetTemplate").onclick = () => {
      setTemplateFromSelectedFeature();
      renderEditSelectedPanel();
    };

    document.getElementById("btnClearTemplate").onclick = () => {
      clearTemplate();
      renderEditSelectedPanel();
    };

    document.getElementById("btnPickCenter").onclick = () => {
      pickCenterActive = true;
      alert("Da 1 click en el mapa para guardar el centro.");
    };

    document.getElementById("btnDoDup").onclick = () => {
      const mode = modeEl.value;
      const total = parseMaybeInt(document.getElementById("dupCount").value, 8);
      const start = parseMaybeInt(document.getElementById("dupStart").value, 1);
      const includeOriginal = document.getElementById("dupInclude").checked;

      if (mode === "radial") {
        const ang = parseFloat(document.getElementById("dupAngle").value) || 0;
        duplicateTemplateRadial(total, start, ang, includeOriginal);
        rerenderLotes_Edit();
      } else {
        const dx = parseFloat(document.getElementById("dupDx").value) || 0;
        const dy = parseFloat(document.getElementById("dupDy").value) || 0;
        duplicateTemplateOffset(total, start, dx, dy, includeOriginal);
        rerenderLotes_Edit();
      }
    };
  }
}

/* =========================================================
   EDIT panels (IGUAL QUE TU VERSION)
   ========================================================= */
function renderEditSeccionesPanel(){
  editor.mode = "edit";
  editor.drawShape = "polygon";
  editorClearPoly();
  editorClearCircle();
  editorStopEditing();

  setPanel("Edición: SECCIONES", `
    <p>Editor de <b>SECCIONES</b> (ORO / VIP / ...). Puedes usar polígono o círculo.</p>

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
    $editBody.innerHTML = `<p><b>Editar:</b> clic en una sección para editar (polígono o círculo).</p>`;
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
      <input id="newSeccion" placeholder="Ej. ORO" style="width:100%;padding:8px;margin:6px 0;border:1px solid #ccc;border-radius:8px;" />

      <label><b>Nombre (opcional)</b></label><br/>
      <input id="newNombre" placeholder="Ej. Zona ORO" style="width:100%;padding:8px;margin:6px 0;border:1px solid #ccc;border-radius:8px;" />

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
      if (!seccion) return alert("Falta SECCIÓN.");

      const props = { seccion, nombre: nombre || seccion, id: seccion };

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
      <input id="newSeccion" placeholder="Ej. ORO" style="width:100%;padding:8px;margin:6px 0;border:1px solid #ccc;border-radius:8px;" />

      <label><b>MANZANA</b></label><br/>
      <input id="newManzana" placeholder="Ej. A" style="width:100%;padding:8px;margin:6px 0;border:1px solid #ccc;border-radius:8px;" />

      <label><b>Nombre (opcional)</b></label><br/>
      <input id="newNombre" placeholder="Ej. ORO - A" style="width:100%;padding:8px;margin:6px 0;border:1px solid #ccc;border-radius:8px;" />

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

      const lotesFile = `./data/lotes-${seccion}-${manzana}.geojson`;
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

    <p style="font-size:12px;color:#666;">
      Plantilla: ${lotTemplate ? "✅ lista" : "— (no hay)"}
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
      <input id="newPkg" placeholder="Ej. PAQ-JARDIN-STD" style="width:100%;padding:8px;margin:6px 0;border:1px solid #ccc;border-radius:8px;" />

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
   EDIT renderers (circle-aware)
   ========================================================= */
function rerenderSecciones_Edit(){
  if (seccionesLayer){ seccionesLayer.remove(); seccionesLayer = null; }
  editorStopEditing();

  seccionesLayer = L.geoJSON(seccionesTopRaw || { type:"FeatureCollection", features:[] }, {
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

/* =========================================================
   Map click handler for CREATE (polygon or circle)
   - Modificado: si pickCenterActive está ON, primero guarda centro
   ========================================================= */
let mapClickAttached = false;
function attachEditorMapClick(){
  if (mapClickAttached) return;
  mapClickAttached = true;

  map.on("click", (e) => {
    // NUEVO: elegir centro para duplicación
    if (pickCenterActive) {
      customDupCenter = e.latlng;
      pickCenterActive = false;
      alert("Centro guardado.");
      return;
    }

    if (!(isEditSecciones || isEditManzanas || isEditLotes)) return;
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
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    const bounds = [[0,0],[h,w]];

    COORD_SCALE_X = w / DATA_COORD_WIDTH;
    COORD_SCALE_Y = h / DATA_COORD_HEIGHT;

    L.imageOverlay(BASE_IMAGE_URL, bounds).addTo(map);
    map.fitBounds(bounds);

    attachEditorMapClick();

    // cargar MANZANAS raw
    manzanasRaw = await loadJson(MANZANAS_URL);

    // cargar SECCIONES raw (si no existe, iniciar vacío)
    try {
      seccionesTopRaw = await loadJson(SECCIONES_TOP_URL);
    } catch {
      seccionesTopRaw = { type:"FeatureCollection", features: [] };
    }

    // ====== EDIT SECCIONES ======
    if (isEditSecciones){
      if ($togglelotesBtn) $togglelotesBtn.disabled = true;
      if ($searchBtn) $searchBtn.disabled = true;

      $seccionSelect.innerHTML = `<option value="">(Edición SECCIONES)</option>`;
      $manzanaSelect.innerHTML = `<option value="">(Edición SECCIONES)</option>`;

      rerenderSecciones_Edit();
      renderEditSeccionesPanel();
      return;
    }

    // ====== EDIT MANZANAS ======
    if (isEditManzanas){
      if ($togglelotesBtn) $togglelotesBtn.disabled = true;
      if ($searchBtn) $searchBtn.disabled = true;

      $seccionSelect.innerHTML = `<option value="">(Edición MANZANAS)</option>`;
      $manzanaSelect.innerHTML = `<option value="">(Edición MANZANAS)</option>`;

      rerenderManzanas_Edit();
      renderEditManzanasPanel();
      return;
    }

    // ====== EDIT LOTES ======
    if (isEditLotes){
      if ($togglelotesBtn) $togglelotesBtn.disabled = true;
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
        flyToBoundsSmooth(temp.getBounds().pad(0.15), 0.65, null);
      };

      renderEditLotesPanel();
      return;
    }

    // ====== NORMAL (PÚBLICO) ======
    manzanasScaled = deepCopy(manzanasRaw);
    applyCoordScaleToGeoJSON(manzanasScaled, COORD_SCALE_X, COORD_SCALE_Y);

    const secciones = buildSeccionesList(manzanasScaled.features);
    fillSeccionSelect(secciones);
    fillManzanaSelect([]);

    renderManzanasLayer(manzanasScaled.features);

    setupDropdowns();
    setupSearch();
    setupButtons();
    updateTogglelotesButton();
  };

  img.onerror = () => {
    setPanel("Error", `<p>No pude cargar el mapa base: <code>${safe(BASE_IMAGE_URL)}</code></p>`);
  };

  img.src = BASE_IMAGE_URL;
}

main();