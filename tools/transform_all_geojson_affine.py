import os, json, math, shutil

# ========= 1) PUNTOS ANCLA (OLD -> NEW) =========
OLD = [
  [12811,4813],
  [13064,4659],
  [12944,4463],
  [12692,4618],
  [6673,7043],
  [8495,11627],
  [15754,8742],
  [14254,4803],
  [16118,2672],
  [13325,1083],
  [13398,2609],
]

NEW = [
  [3272,1833],
  [3417,1809],
  [3397,1696],
  [3252,1722],
  [33,1719],
  [41,4194],
  [3916,4183],
  [3940,2091],
  [5188,1448],
  [4189,206],
  [3944,922],
]

# ========= 2) Resolver transformación affine por mínimos cuadrados =========
# x' = a*x + b*y + tx
# y' = c*x + d*y + ty

def solve_affine(old_pts, new_pts):
    n = len(old_pts)
    if n < 3:
        raise ValueError("Affine requiere mínimo 3 puntos (mejor 6+).")

    # Armamos (2n x 6) * p = (2n)
    # p = [a,b,tx,c,d,ty]
    A = []
    B = []
    for (x,y), (u,v) in zip(old_pts, new_pts):
        A.append([x, y, 1, 0, 0, 0]); B.append(u)
        A.append([0, 0, 0, x, y, 1]); B.append(v)

    # Resolver con ecuaciones normales: (A^T A) p = A^T B
    # Implementación simple (sin numpy)
    def matT(M):
        return list(map(list, zip(*M)))

    def matmul(M, N):
        # M: r x k, N: k x c
        r, k = len(M), len(M[0])
        k2, c = len(N), len(N[0])
        assert k == k2
        out = [[0.0]*c for _ in range(r)]
        for i in range(r):
            for j in range(c):
                s = 0.0
                for t in range(k):
                    s += M[i][t] * N[t][j]
                out[i][j] = s
        return out

    def matvec(M, v):
        out = [0.0]*len(M)
        for i in range(len(M)):
            s = 0.0
            for j in range(len(v)):
                s += M[i][j] * v[j]
            out[i] = s
        return out

    def solve_linear_6x6(M, b):
        # Gauss-Jordan
        n = 6
        aug = [M[i][:] + [b[i]] for i in range(n)]
        for col in range(n):
            # pivot
            piv = col
            for r in range(col, n):
                if abs(aug[r][col]) > abs(aug[piv][col]):
                    piv = r
            if abs(aug[piv][col]) < 1e-12:
                raise ValueError("Matriz singular (puntos malos o repetidos).")
            aug[col], aug[piv] = aug[piv], aug[col]

            # normalize row
            div = aug[col][col]
            for j in range(col, n+1):
                aug[col][j] /= div

            # eliminate others
            for r in range(n):
                if r == col: continue
                factor = aug[r][col]
                for j in range(col, n+1):
                    aug[r][j] -= factor * aug[col][j]

        return [aug[i][n] for i in range(n)]

    AT = matT(A)
    ATA = matmul(AT, A)                 # 6x6
    ATB = matvec(AT, B)                 # 6
    p = solve_linear_6x6(ATA, ATB)
    a,b,tx,c,d,ty = p
    return a,b,c,d,tx,ty

a,b,c,d,tx,ty = solve_affine(OLD, NEW)

def tf_xy(x, y):
    return (a*x + b*y + tx, c*x + d*y + ty)

# Error RMS
errs = []
for (x,y), (u,v) in zip(OLD, NEW):
    px, py = tf_xy(x,y)
    errs.append(math.hypot(px-u, py-v))
avg = sum(errs)/len(errs)
rms = math.sqrt(sum(e*e for e in errs)/len(errs))

# Escala aproximada para radios: promedio de normas de columnas del 2x2
sx = math.sqrt(a*a + c*c)
sy = math.sqrt(b*b + d*d)
radius_scale = (sx + sy) / 2.0

print("=== AFFINE TRANSFORM ===")
print(f"a={a:.10f}  b={b:.10f}  tx={tx:.3f}")
print(f"c={c:.10f}  d={d:.10f}  ty={ty:.3f}")
print(f"radius_scale≈{radius_scale:.6f}  (sx≈{sx:.6f}, sy≈{sy:.6f})")
print(f"calibration error px: min={min(errs):.3f}, max={max(errs):.3f}, avg={avg:.3f}, rms={rms:.3f}")

# ========= 3) Transformar GeoJSON =========
def is_circle_feature(f):
    try:
        return (
            f.get("geometry", {}).get("type") == "Point"
            and f.get("properties", {}).get("shape") == "circle"
            and isinstance(f.get("properties", {}).get("radius"), (int,float))
        )
    except Exception:
        return False

def transform_coords(obj):
    if isinstance(obj, list):
        if len(obj) == 2 and all(isinstance(v, (int,float)) for v in obj):
            x2, y2 = tf_xy(obj[0], obj[1])
            return [round(x2, 2), round(y2, 2)]
        return [transform_coords(v) for v in obj]
    return obj

def transform_feature(feat):
    if not isinstance(feat, dict):
        return feat

    geom = feat.get("geometry") or {}
    if "coordinates" in geom:
        geom["coordinates"] = transform_coords(geom["coordinates"])
    feat["geometry"] = geom

    if is_circle_feature(feat):
        feat["properties"]["radius"] = round(feat["properties"]["radius"] * radius_scale, 2)

    return feat

def transform_geojson(data):
    if not isinstance(data, dict):
        return data
    t = data.get("type")
    if t == "FeatureCollection":
        data["features"] = [transform_feature(f) for f in (data.get("features") or [])]
        return data
    if t == "Feature":
        return transform_feature(data)
    if "coordinates" in data:
        data["coordinates"] = transform_coords(data["coordinates"])
    return data

# ========= 4) Procesar data/ -> data_new/ =========
src_root = "data"
dst_root = "data_new"

if os.path.exists(dst_root):
    shutil.rmtree(dst_root)
os.makedirs(dst_root, exist_ok=True)

count = 0
for root, dirs, files in os.walk(src_root):
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
print("Siguiente: revisar y luego reemplazar data/ por data_new/")
