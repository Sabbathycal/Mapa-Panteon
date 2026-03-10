import os, json, math, shutil

# ========= 1) PUNTOS ANCLA (OLD -> NEW) =========
OLD = [
  [
    6513,
    3636
  ],
  [
    6802,
    3586
  ],
  [
    6763,
    3360
  ],
  [
    6473,
    3413
  ],
  [
    34,
    3407
  ],
  [
    51,
    8357
  ],
  [
    7801,
    8335
  ],
  [
    7848,
    4153
  ],
  [
    10340,
    2863
  ],
  [
    8345,
    380
  ],
  [
    7857,
    1815
  ]
]

NEW = [
  [
    6528,
    3931
  ],
  [
    6820,
    3876
  ],
  [
    6780,
    3633
  ],
  [
    6489,
    3688
  ],
  [
    4,
    3681
  ],
  [
    21,
    9075
  ],
  [
    7826,
    9051
  ],
  [
    7873,
    4495
  ],
  [
    10382,
    3087
  ],
  [
    8373,
    383
  ],
  [
    7883,
    1947
  ]
]

# ========= 2) CALCULAR TRANSFORMACIÓN SIMILAR (escala+rotación+traslación) =========
def compute_similarity(old_pts, new_pts):
    n = len(old_pts)
    if n < 2:
        raise ValueError("Necesitas al menos 2 puntos.")

    ox = sum(p[0] for p in old_pts) / n
    oy = sum(p[1] for p in old_pts) / n
    nx = sum(p[0] for p in new_pts) / n
    ny = sum(p[1] for p in new_pts) / n

    # Centrar puntos
    o = [(p[0]-ox, p[1]-oy) for p in old_pts]
    r = [(p[0]-nx, p[1]-ny) for p in new_pts]

    # a = sum(dot(o_i, r_i)), b = sum(cross(o_i, r_i))
    a = 0.0
    b = 0.0
    denom = 0.0
    for (x,y), (u,v) in zip(o, r):
        a += x*u + y*v
        b += x*v - y*u
        denom += x*x + y*y

    if denom == 0:
        raise ValueError("Puntos OLD inválidos (todos iguales).")

    theta = math.atan2(b, a)
    c = math.cos(theta)
    s = math.sin(theta)

    # escala
    num = 0.0
    for (x,y), (u,v) in zip(o, r):
        xr = c*x - s*y
        yr = s*x + c*y
        num += u*xr + v*yr
    scale = num / denom

    # traslación: new_mean - scale*R*old_mean
    tx = nx - scale*(c*ox - s*oy)
    ty = ny - scale*(s*ox + c*oy)

    return scale, theta, tx, ty

scale, theta, tx, ty = compute_similarity(OLD, NEW)
deg = theta * 180.0 / math.pi

def tf_xy(x, y):
    c = math.cos(theta)
    s = math.sin(theta)
    x2 = scale*(c*x - s*y) + tx
    y2 = scale*(s*x + c*y) + ty
    return x2, y2

# error de calibración
errs = []
for (x,y), (u,v) in zip(OLD, NEW):
    px, py = tf_xy(x,y)
    errs.append(math.hypot(px-u, py-v))
print("=== TRANSFORM ===")
print(f"scale: {scale:.8f}")
print(f"rotation(deg): {deg:.6f}")
print(f"translate: tx={tx:.3f}, ty={ty:.3f}")
print(f"calibration error (px): min={min(errs):.3f}, max={max(errs):.3f}, avg={sum(errs)/len(errs):.3f}")

# ========= 3) TRANSFORMAR GEOJSON =========
def transform_coords(obj):
    # Recursivo: transforma arrays [x,y]
    if isinstance(obj, list):
        # ¿es punto [x,y]?
        if len(obj) == 2 and all(isinstance(v, (int,float)) for v in obj):
            x2, y2 = tf_xy(obj[0], obj[1])
            return [round(x2, 2), round(y2, 2)]
        return [transform_coords(v) for v in obj]
    return obj

def transform_feature(feat):
    if not isinstance(feat, dict):
        return feat

    geom = feat.get("geometry") or {}
    gtype = geom.get("type")
    coords = geom.get("coordinates")

    if coords is not None:
        geom["coordinates"] = transform_coords(coords)

    # Si es círculo (Point + properties.shape=circle + radius), escala radio
    props = feat.get("properties") or {}
    if gtype == "Point" and props.get("shape") == "circle" and isinstance(props.get("radius"), (int,float)):
        props["radius"] = round(props["radius"] * scale, 2)
        feat["properties"] = props

    feat["geometry"] = geom
    return feat

def transform_geojson(data):
    if not isinstance(data, dict):
        return data
    t = data.get("type")
    if t == "FeatureCollection":
        feats = data.get("features") or []
        data["features"] = [transform_feature(f) for f in feats]
        return data
    if t == "Feature":
        return transform_feature(data)
    # Si alguien guardó solo geometría
    if "coordinates" in data:
        data["coordinates"] = transform_coords(data["coordinates"])
    return data

# ========= 4) PROCESAR TODOS LOS .geojson EN data/ -> data_new/ =========
src_root = "data"
dst_root = "data_new"

if os.path.exists(dst_root):
    shutil.rmtree(dst_root)
os.makedirs(dst_root, exist_ok=True)

count = 0
for root, dirs, files in os.walk(src_root):
    # no tocar backups si existieran dentro
    rel = os.path.relpath(root, src_root)
    out_dir = os.path.join(dst_root, rel) if rel != "." else dst_root
    os.makedirs(out_dir, exist_ok=True)

    for fn in files:
        if not fn.lower().endswith(".geojson"):
            continue
        src_path = os.path.join(root, fn)
        dst_path = os.path.join(out_dir, fn)

        with open(src_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        data2 = transform_geojson(data)

        with open(dst_path, "w", encoding="utf-8") as f:
            json.dump(data2, f, ensure_ascii=False, indent=2)

        count += 1

print(f"OK: transformados {count} archivos .geojson -> {dst_root}/")
print("Siguiente: revisa rápido y luego reemplaza data/ por data_new/")
