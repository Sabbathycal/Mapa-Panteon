/* =========================================================
   CONFIG
   ========================================================= */
const BASE_IMAGE_PUBLIC_URL = "./assets/map/base-public.webp"; // ligero (público)
const BASE_IMAGE_EDIT_URL   = "./assets/map/base.png";         // 600dpi (edición)

// Tus GeoJSON están guardados en coordenadas del mapa 600dpi (base.png)
const DATA_COORD_WIDTH  = 21600;
const DATA_COORD_HEIGHT = 14400;

// Archivos de datos
const SECCIONES_TOP_URL = "./data/secciones-top.geojson"; // editor ?edit=secciones + PUBLICO secciones
const MANZANAS_URL      = "./data/secciones.geojson";     // tu archivo actual (MANZANAS)

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

// RAW (600 coords)
let seccionesTopRaw = null;   // SECCIONES (nuevo)
let manzanasRaw = null;       // MANZANAS

// Scaled a base actual (público)
let seccionesTopScaled = null; // SECCIONES escaladas
let manzanasScaled = null;     // MANZANAS escaladas
let lotesScaled = null;        // LOTES escalados

let seccionesLayer = null;    // editor secciones
let seccionesLayerPublic = null; // PUBLICO secciones
let manzanasLayer = null;     // público + editor manzanas
let lotesLayer = null;        // público + editor lotes

let currentSeccion = null;          // "SAN ANDRES", "SAN PABLO", etc
let currentSeccionFeature = null;   // feature seleccionada (scaled, público)
let currentManzanaFeature = null;   // feature seleccionada (scaled en público, raw en edit)
let currentLotesRaw = null;         // lotes raw del archivo de esa manzana (en edit lotes)

let showAllLots = false;

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
   - MEJORA: acepta maxZoom opcional para evitar zoom extremo
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
   FIX ZOOM: bounds correctos para círculo (centro+radio)
   ========================================================= */
function getBoundsForCircleFeature(feature, layer){
  // usamos layer si es Circle; si no, usamos feature.properties.radius
  const center = layer?.getLatLng ? layer.getLatLng() : xyToLatLng(feature.geometry.coordinates);
  const r = layer?.getRadius ? layer.getRadius() : feature.properties.radius;

  // CRS.Simple: lat=y, lng=x; radius en "pixeles"
  const sw = L.latLng(center.lat - r, center.lng - r);
  const ne = L.latLng(center.lat + r, center.lng + r);
  return L.latLngBounds(sw, ne);
}

function flyToManzanaFeature(feature, layer){
  // padding + maxZoom para evitar zoom extremo en círculos
  const isC = isCircleFeature(feature);
  const pad = isC ? 0.55 : 0.20;     // MÁS PAD PARA VIP circular
  const mz  = isC ? 3 : null;        // limita zoom máximo en círculo

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
  // reset state
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
    style: () => hiddenStyle(),
    pointToLayer: (feature, latlng) => {
      const layer = featureToLayerCircleAware(feature, latlng);
      try { layer.setStyle(hiddenStyle()); } catch {}
      return layer;
    },
    onEachFeature: (feature, layer) => {
      layer.on("mouseover", () => {
        if (pinnedSeccionLayer !== layer) layer.setStyle(hoverStyle());
      });
      layer.on("mouseout", () => {
        if (pinnedSeccionLayer !== layer) layer.setStyle(hiddenStyle());
      });

      layer.on("click", () => {
        if (pinnedSeccionLayer && pinnedSeccionLayer !== layer){
          pinnedSeccionLayer.setStyle(hiddenStyle());
        }
        pinnedSeccionLayer = layer;

        const base = pinnedStyle();
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

  // FIX: zoom correcto en manzana circular
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
  try {
    raw = await loadJson(lotesFile);
  } catch {
    raw = { type:"FeatureCollection", features: [] };
  }

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

  // FIX: no usar temp bounds (en puntos se vuelve 0); usar feature directo
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
   DUPLICAR LOTES (plantilla) - SOLO en ?edit=lotes
   ========================================================= */
let loteTemplate = null;      // { kind:"Polygon"|"Circle", ringLatLngs|centerLatLng, radius, props }
let dupCustomCenter = null;   // L.LatLng
let dupPickCenter = false;    // si true, el siguiente click en mapa guarda centro

function parseIntSafe(v, fallback){
  const n = parseInt(String(v ?? "").trim(), 10);
  return Number.isFinite(n) ? n : fallback;
}
function parseFloatSafe(v, fallback){
  const n = parseFloat(String(v ?? "").trim());
  return Number.isFinite(n) ? n : fallback;
}

function latLngEqual(a,b){
  return Math.abs(a.lat-b.lat)<1e-9 && Math.abs(a.lng-b.lng)<1e-9;
}

function getPolygonRingLatLngs(feature){
  const coords = feature.geometry.coordinates?.[0] || [];
  let ring = coords.map(xyToLatLng);
  if (ring.length >= 2 && latLngEqual(ring[0], ring[ring.length-1])) ring.pop();
  return ring;
}

function makePolygonFeatureFromLatLngs(latlngs, props){
  const coords = latlngs.map(latLngToXY);
  coords.push(coords[0]); // cerrar
  return { type:"Feature", geometry:{ type:"Polygon", coordinates:[coords] }, properties: props };
}

function rotatePointAround(p, center, angRad){
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

function getManzanaCenterLatLng_Edit(){
  // En edit, currentManzanaFeature viene de manzanasRaw (base.png coords)
  if (!currentManzanaFeature) return null;

  if (isCircleFeature(currentManzanaFeature)){
    return xyToLatLng(currentManzanaFeature.geometry.coordinates);
  }

  if (currentManzanaFeature.geometry?.type === "Polygon"){
    const ring = currentManzanaFeature.geometry.coordinates?.[0] || [];
    let sx=0, sy=0, n=0;
    for (const xy of ring){
      if (!Array.isArray(xy) || xy.length<2) continue;
      sx += xy[0]; sy += xy[1]; n++;
    }
    if (!n) return null;
    return xyToLatLng([sx/n, sy/n]);
  }

  return null;
}

function setTemplateFromSelectedLote(){
  if (!editor.selectedFeature) return alert("Selecciona un lote primero.");

  const f = editor.selectedFeature;
  const commonProps = {
    estatus: f.properties?.estatus ?? "disponible",
    paquete: f.properties?.paquete ?? null
  };

  if (isCircleFeature(f)){
    loteTemplate = {
      kind: "Circle",
      centerLatLng: xyToLatLng(f.geometry.coordinates),
      radius: f.properties.radius,
      props: commonProps
    };
  } else if (f.geometry?.type === "Polygon"){
    loteTemplate = {
      kind: "Polygon",
      ringLatLngs: getPolygonRingLatLngs(f),
      props: commonProps
    };
  } else {
    return alert("Este lote no es polígono ni círculo.");
  }

  alert("Plantilla guardada. Ahora puedes crear copias.");
}

function clearTemplate(){
  loteTemplate = null;
  alert("Plantilla borrada.");
}

function duplicateTemplateRadial(total, startLote, angleOffsetDeg, includeOriginal){
  if (!currentLotesRaw) return alert("No hay archivo de lotes cargado.");
  if (!loteTemplate) return alert("No hay plantilla. Selecciona un lote y guarda como plantilla.");

  const center = dupCustomCenter || getManzanaCenterLatLng_Edit();
  if (!center) return alert("No pude calcular el centro. Usa 'Elegir centro (click en mapa)'.");

  const nTotal = Math.max(1, parseIntSafe(total, 8));
  const step = (2*Math.PI) / nTotal;
  const offset = (parseFloatSafe(angleOffsetDeg, 0) * Math.PI) / 180;

  let loteNum = parseIntSafe(startLote, 1);
  const startIndex = includeOriginal ? 1 : 0;

  for (let i = startIndex; i < nTotal; i++){
    const ang = offset + step*i;

    const props = {
      lote: String(loteNum),
      id: String(loteNum),
      estatus: loteTemplate.props?.estatus ?? "disponible",
      paquete: loteTemplate.props?.paquete ?? null
    };

    let newF = null;
    if (loteTemplate.kind === "Polygon"){
      const rotated = loteTemplate.ringLatLngs.map(p => rotatePointAround(p, center, ang));
      newF = makePolygonFeatureFromLatLngs(rotated, props);
    } else {
      const cRot = rotatePointAround(loteTemplate.centerLatLng, center, ang);
      newF = {
        type:"Feature",
        geometry:{ type:"Point", coordinates: latLngToXY(cRot) },
        properties:{ ...props, shape:"circle", radius: loteTemplate.radius }
      };
    }

    currentLotesRaw.features.push(newF);
    loteNum += 1;
  }

  alert("Copias creadas. Ahora copia el GeoJSON y pégalo en el archivo de lotes.");
}

function duplicateTemplateOffset(count, startLote, dx, dy, includeOriginal){
  if (!currentLotesRaw) return alert("No hay archivo de lotes cargado.");
  if (!loteTemplate) return alert("No hay plantilla. Selecciona un lote y guarda como plantilla.");

  const n = Math.max(1, parseIntSafe(count, 8));
  const stepX = parseFloatSafe(dx, 0);
  const stepY = parseFloatSafe(dy, 0);

  let loteNum = parseIntSafe(startLote, 1);
  const startIndex = includeOriginal ? 1 : 0;

  for (let i = startIndex; i < n; i++){
    const offX = stepX * i;
    const offY = stepY * i;

    const props = {
      lote: String(loteNum),
      id: String(loteNum),
      estatus: loteTemplate.props?.estatus ?? "disponible",
      paquete: loteTemplate.props?.paquete ?? null
    };

    let newF = null;
    if (loteTemplate.kind === "Polygon"){
      const moved = loteTemplate.ringLatLngs.map(p => translatePoint(p, offX, offY));
      newF = makePolygonFeatureFromLatLngs(moved, props);
    } else {
      const cMoved = translatePoint(loteTemplate.centerLatLng, offX, offY);
      newF = {
        type:"Feature",
        geometry:{ type:"Point", coordinates: latLngToXY(cMoved) },
        properties:{ ...props, shape:"circle", radius: loteTemplate.radius }
      };
    }

    currentLotesRaw.features.push(newF);
    loteNum += 1;
  }

  alert("Copias creadas. Ahora copia el GeoJSON y pégalo en el archivo de lotes.");
}

/* =========================================================
   Editor helpers
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

  const dupUI = (isEditLotes) ? `
    <hr/>
    <h3>Duplicar lote (plantilla)</h3>

    <p style="font-size:12px;color:#666;">
      Para VIP: dibuja 1 rectángulo, guárdalo como plantilla y crea 8 copias alrededor.
    </p>

    <p><b>Plantilla:</b> ${loteTemplate ? "✅ lista" : "— (no hay)"}</p>

    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">
      <button id="btnTplSet" style="padding:8px 10px;border-radius:8px;border:1px solid #ccc;cursor:pointer;">Guardar como plantilla</button>
      <button id="btnTplClear" style="padding:8px 10px;border-radius:8px;border:1px solid #ccc;cursor:pointer;">Borrar plantilla</button>
      <button id="btnPickCenter" style="padding:8px 10px;border-radius:8px;border:1px solid #ccc;cursor:pointer;">Elegir centro (click)</button>
    </div>

    <label style="display:block;margin-top:10px;"><b>Modo</b></label>
    <select id="dupMode" style="width:100%;padding:8px;margin:6px 0;border:1px solid #ccc;border-radius:8px;">
      <option value="radial">Alrededor (radial)</option>
      <option value="offset">En línea (desplazar)</option>
    </select>

    <label style="display:block;margin-top:6px;"><b>Cantidad total</b></label>
    <input id="dupTotal" value="8" style="width:100%;padding:8px;margin:6px 0;border:1px solid #ccc;border-radius:8px;" />

    <label style="display:block;margin-top:6px;"><b>Inicio LOTE (para nuevas copias)</b></label>
    <input id="dupStart" value="2" style="width:100%;padding:8px;margin:6px 0;border:1px solid #ccc;border-radius:8px;" />

    <div id="radialFields">
      <label style="display:block;margin-top:6px;"><b>Ángulo offset (grados)</b></label>
      <input id="dupAngle" value="0" style="width:100%;padding:8px;margin:6px 0;border:1px solid #ccc;border-radius:8px;" />
    </div>

    <div id="offsetFields" style="display:none;">
      <label style="display:block;margin-top:6px;"><b>Desplazar X (px)</b></label>
      <input id="dupDx" value="250" style="width:100%;padding:8px;margin:6px 0;border:1px solid #ccc;border-radius:8px;" />
      <label style="display:block;margin-top:6px;"><b>Desplazar Y (px)</b></label>
      <input id="dupDy" value="0" style="width:100%;padding:8px;margin:6px 0;border:1px solid #ccc;border-radius:8px;" />
    </div>

    <label style="display:block;margin-top:10px;">
      <input type="checkbox" id="dupIncludeOriginal" checked />
      Ya tengo el lote #1 (no lo vuelvas a crear)
    </label>

    <button id="btnDupGo" style="margin-top:10px;padding:10px 12px;border-radius:10px;border:1px solid #ccc;cursor:pointer;width:100%;">
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

    ${dupUI}
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

  if (isEditLotes) {
    const modeEl = document.getElementById("dupMode");
    const radialFields = document.getElementById("radialFields");
    const offsetFields = document.getElementById("offsetFields");

    modeEl.onchange = () => {
      const m = modeEl.value;
      radialFields.style.display = (m === "radial") ? "" : "none";
      offsetFields.style.display = (m === "offset") ? "" : "none";
    };

    document.getElementById("btnTplSet").onclick = () => { setTemplateFromSelectedLote(); renderEditSelectedPanel(); };
    document.getElementById("btnTplClear").onclick = () => { clearTemplate(); renderEditSelectedPanel(); };
    document.getElementById("btnPickCenter").onclick = () => {
      dupPickCenter = true;
      alert("Da 1 click en el mapa para definir el centro.");
    };

    document.getElementById("btnDupGo").onclick = () => {
      const mode = modeEl.value;
      const total = document.getElementById("dupTotal").value;
      const start = document.getElementById("dupStart").value;
      const includeOriginal = document.getElementById("dupIncludeOriginal").checked;

      if (mode === "radial") {
        const ang = document.getElementById("dupAngle").value;
        duplicateTemplateRadial(total, start, ang, includeOriginal);
        rerenderLotes_Edit();
      } else {
        const dx = document.getElementById("dupDx").value;
        const dy = document.getElementById("dupDy").value;
        duplicateTemplateOffset(total, start, dx, dy, includeOriginal);
        rerenderLotes_Edit();
      }
    };
  }
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
    <p>Editor de <b>SECCIONES</b> (SAN ANDRES / SAN PABLO / ...). Puedes usar polígono o círculo.</p>

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
      <input id="newSeccion" placeholder="Ej. SAN ANDRES" style="width:100%;padding:8px;margin:6px 0;border:1px solid #ccc;border-radius:8px;" />

      <label><b>Nombre (opcional)</b></label><br/>
      <input id="newNombre" placeholder="Ej. Zona SAN ANDRES" style="width:100%;padding:8px;margin:6px 0;border:1px solid #ccc;border-radius:8px;" />

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
      <input id="newLote" placeholder="Ej. 001" style="width:100%;padding:8px;margin:6px 0;border:1px solid #ccc;border-radius:8px;" />

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
   - MEJORA: si dupPickCenter=true, guarda centro con click
   ========================================================= */
let mapClickAttached = false;
function attachEditorMapClick(){
  if (mapClickAttached) return;
  mapClickAttached = true;

  map.on("click", (e) => {
    // Pick center for duplication
    if (dupPickCenter){
      dupCustomCenter = e.latlng;
      dupPickCenter = false;
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

        // zoom a manzana (en edit): si es círculo, usar bounds centro+radio
        try {
          if (isCircleFeature(f)){
            const tempLayer = L.circle(xyToLatLng(f.geometry.coordinates), { radius: f.properties.radius });
            flyToBoundsSmooth(tempLayer.getBounds().pad(0.25), 0.65, 5);
          } else {
            const temp = L.geoJSON(f);
            flyToBoundsSmooth(temp.getBounds().pad(0.15), 0.65);
          }
        } catch {}
      };

      renderEditLotesPanel();
      return;
    }

    // ====== NORMAL (PÚBLICO) ======
    seccionesTopScaled = deepCopy(seccionesTopRaw);
    applyCoordScaleToGeoJSON(seccionesTopScaled, COORD_SCALE_X, COORD_SCALE_Y);

    manzanasScaled = deepCopy(manzanasRaw);
    applyCoordScaleToGeoJSON(manzanasScaled, COORD_SCALE_X, COORD_SCALE_Y);

    const secciones = buildSeccionesList(seccionesTopScaled.features.length ? seccionesTopScaled.features : manzanasScaled?.features || []);
    fillSeccionSelect(secciones);
    $manzanaSelect.innerHTML = `<option value="">MANZANA...</option>`;

    showPublicLevelSecciones();

    setupDropdowns();
    setupSearch();
    setupButtons();
    updateToggleLotsButton();
  };

  img.onerror = () => {
    setPanel("Error", `<p>No pude cargar el mapa base: <code>${safe(BASE_IMAGE_URL)}</code></p>`);
  };

  img.src = BASE_IMAGE_URL;
}

main();