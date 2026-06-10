import json
from collections import defaultdict
from pathlib import Path


INVENTARIO_FILE = Path("data/inventario-base.json")
LOTES_ROOT = Path("data/lotes")
REPORT_FILE = Path("data/reporte-cruce-inventario.txt")


def norm(value):
    return str(value or "").strip().upper()

def norm_seccion(value):
    s = norm(value)

    aliases = {
        "SJV": "SAN JUAN VIP",
        "SMV": "SAN MATEO VIP",
        "SPV": "SAN PEDRO VIP",
    }

    return aliases.get(s, s)


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


def load_json(path):
    try:
        with path.open("r", encoding="utf-8") as f:
            content = f.read().strip()

        if not content:
            return None

        return json.loads(content)

    except Exception as e:
        print(f"Saltando JSON inválido: {path}")
        print(f"  Motivo: {e}")
        return None


def summarize_codes(values):
    nums = sorted(int(v) for v in values if str(v).isdigit())

    if not nums:
        return "(sin rango numérico)"

    return f"{nums[0]}-{nums[-1]} ({len(nums)} lotes)"


def compact_list(values, limit=20):
    ordered = sorted(values, key=lambda x: int(x) if str(x).isdigit() else str(x))

    if len(ordered) <= limit:
        return ", ".join(str(v) for v in ordered)

    first = ", ".join(str(v) for v in ordered[:limit])
    return f"{first}, ... y {len(ordered) - limit} más"


def main():
    inventario = load_json(INVENTARIO_FILE)

    if not inventario:
        raise RuntimeError(f"No se pudo leer {INVENTARIO_FILE}")

    inv_by_group = defaultdict(set)

    for item in inventario.get("items", []):
        if norm(item.get("tipo")).lower() != "lote":
            continue

        seccion = norm_seccion(item.get("seccion"))
        manzana = norm(item.get("manzana"))
        codigo = norm_code(item.get("codigo"))

        if not seccion or not manzana or not codigo:
            continue

        inv_by_group[(seccion, manzana)].add(codigo)

    geo_by_group = defaultdict(set)
    files_by_group = defaultdict(set)

    for path in sorted(LOTES_ROOT.glob("*/lotes.geojson")):
        data = load_json(path)

        if not data:
            continue

        for feature in data.get("features", []):
            props = feature.get("properties") or {}

            seccion = norm_seccion(props.get("seccion"))
            manzana = norm(props.get("manzana") or props.get("manzanaId"))
            codigo = norm_code(get_lote_code(props))

            if not seccion or not manzana or not codigo:
                continue

            geo_by_group[(seccion, manzana)].add(codigo)
            files_by_group[(seccion, manzana)].add(str(path))

    all_groups = sorted(set(inv_by_group.keys()) | set(geo_by_group.keys()))

    problemas = []
    correctas = 0

    for group in all_groups:
        seccion, manzana = group

        inv_codes = inv_by_group.get(group, set())
        geo_codes = geo_by_group.get(group, set())

        matches = inv_codes & geo_codes
        sin_inventario = geo_codes - inv_codes
        sin_dibujo = inv_codes - geo_codes

        geo_count = len(geo_codes)
        inv_count = len(inv_codes)
        match_count = len(matches)

        if geo_count == inv_count and geo_count == match_count:
            correctas += 1
            continue

        problemas.append({
            "seccion": seccion,
            "manzana": manzana,
            "geo_count": geo_count,
            "inv_count": inv_count,
            "match_count": match_count,
            "sin_inventario": sin_inventario,
            "sin_dibujo": sin_dibujo,
            "geo_range": summarize_codes(geo_codes),
            "inv_range": summarize_codes(inv_codes),
            "files": sorted(files_by_group.get(group, [])),
        })

    problemas.sort(key=lambda r: (
        r["seccion"],
        r["manzana"],
        r["geo_count"] - r["match_count"]
    ))

    lines = []
    lines.append("REPORTE GENERAL DE CRUCE CONTRA INVENTARIO_MAPA")
    lines.append("=" * 80)
    lines.append("")
    lines.append(f"Manzanas correctas: {correctas}")
    lines.append(f"Manzanas con diferencias: {len(problemas)}")
    lines.append("")

    for r in problemas:
        lines.append("-" * 80)
        lines.append(f"{r['seccion']} / Manzana {r['manzana']}")
        lines.append(f"GeoJSON:       {r['geo_range']}")
        lines.append(f"Inventario:    {r['inv_range']}")
        lines.append(f"Cruces:        {r['match_count']} de {r['geo_count']} lotes dibujados")
        lines.append(f"Sin inventario en mapa: {len(r['sin_inventario'])}")
        lines.append(f"En inventario sin dibujo: {len(r['sin_dibujo'])}")

        if r["sin_inventario"]:
            lines.append(f"Lotes en mapa que NO existen en inventario: {compact_list(r['sin_inventario'])}")

        if r["sin_dibujo"]:
            lines.append(f"Lotes en inventario que NO tienen dibujo: {compact_list(r['sin_dibujo'])}")

        if r["files"]:
            lines.append("Archivo(s):")
            for file in r["files"]:
                lines.append(f"  {file}")

        lines.append("")

    with REPORT_FILE.open("w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    print(f"Reporte generado: {REPORT_FILE}")
    print(f"Manzanas correctas: {correctas}")
    print(f"Manzanas con diferencias: {len(problemas)}")


if __name__ == "__main__":
    main()