import argparse
import json
import shutil
from collections import defaultdict
from datetime import datetime
from pathlib import Path


INVENTARIO_FILE = Path("data/inventario-base.json")
LOTES_ROOT = Path("data/lotes")
REPORT_FILE = Path("data/reporte-manzanas-sin-inventario.txt")


def norm(value):
    return str(value or "").strip().upper()


def norm_code(value):
    s = str(value or "").strip().upper()
    if s.isdigit():
        return str(int(s))
    return s


def get_lote_code(props):
    for key in ["lote", "id", "codigo"]:
        value = props.get(key)
        if value is not None and str(value).strip():
            return str(value).strip()
    return ""


def format_new_code(old_code, new_number):
    old = str(old_code).strip()

    if old.isdigit() and old.startswith("0"):
        return str(new_number).zfill(len(old))

    return str(new_number)


def summarize(values):
    nums = sorted(int(v) for v in values if str(v).isdigit())

    if not nums:
        return "(sin rango numérico)"

    return f"{nums[0]}-{nums[-1]} ({len(nums)} lotes)"


def calculate_offset(geo_codes, inv_codes):
    geo_nums = sorted(int(v) for v in geo_codes if str(v).isdigit())
    inv_nums = sorted(int(v) for v in inv_codes if str(v).isdigit())

    if not geo_nums or not inv_nums:
        return None

    if len(geo_nums) != len(inv_nums):
        return None

    offsets = [inv - geo for geo, inv in zip(geo_nums, inv_nums)]

    unique_offsets = sorted(set(offsets))

    if len(unique_offsets) != 1:
        return None

    return unique_offsets[0]


def load_json(path, required=False):
    try:
        with path.open("r", encoding="utf-8") as f:
            content = f.read().strip()

        if not content:
            if required:
                raise ValueError(f"Archivo vacío: {path}")
            return None

        return json.loads(content)

    except Exception as e:
        if required:
            raise

        print(f"Saltando archivo JSON inválido o vacío: {path}")
        print(f"  Motivo: {e}")
        return None


def save_json(path, data):
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def main():
    parser = argparse.ArgumentParser(
        description="Detecta y corrige manzanas donde todos los lotes están sin cruce contra Inventario_Mapa."
    )

    parser.add_argument(
        "--only-count",
        type=int,
        default=50,
        help="Solo considerar manzanas con esta cantidad de lotes dibujados. Default: 50."
    )

    parser.add_argument(
        "--apply",
        action="store_true",
        help="Aplicar cambios. Si no se usa, solo genera vista previa."
    )

    args = parser.parse_args()

    if not INVENTARIO_FILE.exists():
        raise FileNotFoundError(f"No existe {INVENTARIO_FILE}")

    inventario = load_json(INVENTARIO_FILE, required=True)

    inv_by_group = defaultdict(set)

    for item in inventario.get("items", []):
        if norm(item.get("tipo")).lower() != "lote":
            continue

        seccion = norm(item.get("seccion"))
        manzana = norm(item.get("manzana"))
        codigo = norm_code(item.get("codigo"))

        if not seccion or not manzana or not codigo:
            continue

        inv_by_group[(seccion, manzana)].add(codigo)

    geo_by_file_group = defaultdict(list)

    for path in sorted(LOTES_ROOT.glob("*/lotes.geojson")):
        data = load_json(path)

        if not data:
            continue

        for feature in data.get("features", []):
            props = feature.get("properties") or {}

            seccion = norm(props.get("seccion"))
            manzana = norm(props.get("manzana") or props.get("manzanaId"))
            codigo = norm_code(get_lote_code(props))

            if not seccion or not manzana or not codigo:
                continue

            geo_by_file_group[(path, seccion, manzana)].append(feature)

    automatic = []
    manual = []

    for (path, seccion, manzana), features in sorted(
        geo_by_file_group.items(),
        key=lambda x: (str(x[0][0]), x[0][1], x[0][2])
    ):
        geo_codes = {norm_code(get_lote_code(f.get("properties") or {})) for f in features}
        inv_codes = inv_by_group.get((seccion, manzana), set())

        matches = geo_codes & inv_codes

        geo_count = len(geo_codes)
        inv_count = len(inv_codes)
        match_count = len(matches)

        if args.only_count and geo_count != args.only_count:
            continue

        # Buscamos manzanas donde todos los lotes dibujados están sin cruce.
        if geo_count == 0:
            continue

        if match_count != 0:
            continue

        offset = calculate_offset(geo_codes, inv_codes)

        record = {
            "path": path,
            "seccion": seccion,
            "manzana": manzana,
            "geo_count": geo_count,
            "inv_count": inv_count,
            "match_count": match_count,
            "offset": offset,
            "geo_range": summarize(geo_codes),
            "inv_range": summarize(inv_codes),
            "features": features,
        }

        if offset is not None and geo_count == inv_count:
            automatic.append(record)
        else:
            manual.append(record)

    lines = []
    lines.append("REPORTE DE MANZANAS SIN INVENTARIO")
    lines.append("=" * 70)
    lines.append("")
    lines.append(f"Filtro de cantidad de lotes: {args.only_count}")
    lines.append(f"Candidatas automáticas: {len(automatic)}")
    lines.append(f"Revisión manual: {len(manual)}")
    lines.append("")

    lines.append("CANDIDATAS AUTOMÁTICAS")
    lines.append("-" * 70)

    for r in automatic:
        sign = "+" if r["offset"] >= 0 else ""
        lines.append(f"{r['seccion']} / Manzana {r['manzana']}")
        lines.append(f"Archivo:    {r['path']}")
        lines.append(f"GeoJSON:    {r['geo_range']}")
        lines.append(f"Inventario: {r['inv_range']}")
        lines.append(f"Offset:     {sign}{r['offset']}")
        lines.append("")

    lines.append("")
    lines.append("REVISIÓN MANUAL")
    lines.append("-" * 70)

    for r in manual:
        lines.append(f"{r['seccion']} / Manzana {r['manzana']}")
        lines.append(f"Archivo:    {r['path']}")
        lines.append(f"GeoJSON:    {r['geo_range']}")
        lines.append(f"Inventario: {r['inv_range']}")
        lines.append("Offset:     NO automático")
        lines.append("")

    REPORT_FILE.parent.mkdir(parents=True, exist_ok=True)

    with REPORT_FILE.open("w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    print(f"Reporte generado: {REPORT_FILE}")
    print(f"Candidatas automáticas: {len(automatic)}")
    print(f"Revisión manual: {len(manual)}")

    if not args.apply:
        print("")
        print("Vista previa solamente. Para aplicar cambios, ejecuta otra vez con --apply")
        return

    changed_files = {}

    for r in automatic:
        path = r["path"]
        offset = r["offset"]
        seccion = r["seccion"]
        manzana = r["manzana"]

        if path not in changed_files:
            file_data = load_json(path)

            if not file_data:
                print(f"No se puede modificar archivo inválido o vacío: {path}")
                continue

            changed_files[path] = file_data

            backup = path.with_suffix(path.suffix + f".bak-{datetime.now().strftime('%Y%m%d-%H%M%S')}")
            shutil.copy2(path, backup)
            print(f"Backup creado: {backup}")

        for feature in changed_files[path].get("features", []):
            props = feature.get("properties") or {}

            f_sec = norm(props.get("seccion"))
            f_man = norm(props.get("manzana") or props.get("manzanaId"))

            if f_sec != seccion or f_man != manzana:
                continue

            old_code_raw = get_lote_code(props)
            old_code = norm_code(old_code_raw)

            if not old_code.isdigit():
                continue

            new_number = int(old_code) + offset
            new_code = format_new_code(old_code_raw, new_number)

            props["id"] = new_code
            props["lote"] = new_code

            if "codigo" in props:
                props["codigo"] = new_code

            props["seccion"] = seccion
            props["manzana"] = manzana
            props["manzanaId"] = manzana

            feature["properties"] = props

    for path, data in changed_files.items():
        save_json(path, data)
        print(f"Archivo corregido: {path}")

    print("")
    print("Cambios aplicados.")


if __name__ == "__main__":
    main()