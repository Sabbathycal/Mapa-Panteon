import os, json, math, shutil

OLD = [
  [
    3272,
    1833
  ],
  [
    3417,
    1808
  ],
  [
    3397,
    1696
  ],
  [
    3252,
    1722
  ],
  [
    32,
    1719
  ],
  [
    41,
    4194
  ],
  [
    3916,
    4183
  ],
  [
    3940,
    2091
  ],
  [
    5186,
    1447
  ],
  [
    4188,
    206
  ],
  [
    3944,
    923
  ]
]

NEW = [
  [
    6715,
    3810
  ],
  [
    6978,
    3764
  ],
  [
    6942,
    3561
  ],
  [
    6680,
    3606
  ],
  [
    840,
    3601
  ],
  [
    856,
    8091
  ],
  [
    7884,
    8070
  ],
  [
    7926,
    4279
  ],
  [
    10186,
    3108
  ],
  [
    8376,
    857
  ],
  [
    7935,
    2158
  ]
]

# x' = a*x + b*y + tx
# y' = c*x + d*y + ty

def solve_affine(old_pts, new_pts):
    n = len(old_pts)
    if n < 3:
        raise ValueError("Affine requiere mínimo 3 puntos.")

    A = []
    B = []
    for (x,y), (u,v) in zip(old_pts, new_pts):
        A.append([x, y, 1, 0, 0, 0]); B.append(u)
        A.append([0, 0, 0, x, y, 1]); B.append(v)

    def matT(M):
        return list(map(list, zip(*M)))

    def matmul(M, N):
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
        n = 6
        aug = [M[i][:] + [b[i]] for i in range(n)]
        for col in range(n):
            piv = col
            for r in range(col, n):
                if abs(aug[r][col]) > abs(aug[piv][col]):
                    piv = r
            if abs(aug[piv][col]) < 1e-12:
                raise ValueError("Matriz singular (puntos repetidos o malos).")
            aug[col], aug[piv] = aug[piv], aug[col]

            div = aug[col][col]
            for j in range(col, n+1):
                aug[col][j] /= div

            for r in range(n):
                if r == col: continue
                factor = aug[r][col]
                for j in range(col, n+1):
                    aug[r][j] -= factor * aug[col][j]

        return [aug[i][n] for i in range(n)]

    AT = matT(A)
    ATA = matmul(AT, A)
    ATB = matvec(AT, B)
    p = solve_linear_6x6(ATA, ATB)
    a,b,tx,c,d,ty = p
    return a,b,c,d,tx,ty

a,b,c,d,tx,ty = solve_affine(OLD, NEW)

def tf_xy(x, y):
    return (a*x + b*y + tx, c*x + d*y + ty)

print("\nCHECK FIRST 3 POINTS:")
for i in range(3):
    x,y = OLD[i]
    u,v = NEW[i]
    px,py = tf_xy(x,y)
    print(i, "OLD", (x,y), "-> pred", (round(px,1),round(py,1)), "target", (u,v))

# error
errs = []
for (x,y), (u,v) in zip(OLD, NEW):
    px, py = tf_xy(x,y)
    errs.append(math.hypot(px-u, py-v))

avg = sum(errs)/len(errs)
rms = math.sqrt(sum(e*e for e in errs)/len(errs))

sx = math.sqrt(a*a + c*c)
sy = math.sqrt(b*b + d*d)
radius_scale = (sx + sy) / 2.0

print("=== AFFINE TRANSFORM (OLD->NEW) ===")
print(f"a={a:.10f}  b={b:.10f}  tx={tx:.3f}")
print(f"c={c:.10f}  d={d:.10f}  ty={ty:.3f}")
print(f"radius_scale≈{radius_scale:.6f}  (sx≈{sx:.6f}, sy≈{sy:.6f})")
print(f"calibration error px: min={min(errs):.3f}, max={max(errs):.3f}, avg={avg:.3f}, rms={rms:.3f}")

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
    geom = feat.get("geometry") or {}
    if "coordinates" in geom:
        geom["coordinates"] = transform_coords(geom["coordinates"])
    feat["geometry"] = geom

    if is_circle_feature(feat):
        feat["properties"]["radius"] = round(feat["properties"]["radius"] * radius_scale, 2)
    return feat

def transform_geojson(data):
    t = data.get("type")
    if t == "FeatureCollection":
        data["features"] = [transform_feature(f) for f in (data.get("features") or [])]
        return data
    if t == "Feature":
        return transform_feature(data)
    if "coordinates" in data:
        data["coordinates"] = transform_coords(data["coordinates"])
    return data

src_root = "data_backup_antes"
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
print("Siguiente: reemplazar data/ por data_new/")
