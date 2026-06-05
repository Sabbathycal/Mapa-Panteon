import json
import re
import unicodedata
from datetime import datetime
from pathlib import Path


INPUT_INVENTARIO = Path("data/inventario-base.json")
OUTPUT_CATALOGO = Path("data/catalogo-propiedades.json")
OUTPUT_REPORTE = Path("data/catalogo-propiedades-reporte.txt")


def clean(value):
    return str(value or "").strip()


def upper(value):
    return clean(value).upper()


def normalize_status(value):
    status = clean(value).lower()

    aliases = {
        "libre": "disponible",
        "disponible": "disponible",

        "separado": "separado",
        "separada": "separado",
        "apartado": "separado",
        "apartada": "separado",

        "vendido": "vendido",
        "vendida": "vendido",

        "ocupado": "utilizado",
        "ocupada": "utilizado",
        "utilizado": "utilizado",
        "utilizada": "utilizado",
        "usado": "utilizado",
        "usada": "utilizado",

        "suspendido": "suspendido",
        "suspendida": "suspendido",

        "por construir": "por_construir",
        "por_construir": "por_construir",
        "no construida": "por_construir",
        "no construidas": "por_construir"
    }

    return aliases.get(status, status or "desconocido")


def normalize_code(value):
    text = clean(value).upper()

    if not text:
        return ""

    # Si viene como número simple, respeta 3 dígitos para lotes: 1 → 001.
    if re.fullmatch(r"\d+", text):
        return text.zfill(3)

    return text


def slug(value):
    text = clean(value).upper()

    if not text:
        return ""

    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = re.sub(r"[^A-Z0-9]+", "-", text)
    text = re.sub(r"-+", "-", text)
    text = text.strip("-")

    return text


def make_lote_id(item):
    seccion = slug(item.get("seccion"))
    manzana = slug(item.get("manzana")) or "SIN-MANZANA"
    codigo = slug(normalize_code(item.get("codigo")))

    return f"LOTE-{seccion}-{manzana}-{codigo}"


def make_nicho_id(item):
    zona = slug(item.get("zonaId") or item.get("columbario")) or "SIN-ZONA"
    cara = slug(item.get("cara")) or "SIN-CARA"
    codigo = slug(normalize_code(item.get("codigo")))

    return f"NICHO-{zona}-{cara}-{codigo}"


def make_property_id(item):
    tipo = clean(item.get("tipo")).lower()

    if tipo == "lote":
        return make_lote_id(item)

    if tipo == "nicho":
        return make_nicho_id(item)

    return ""


def make_display_name(item):
    tipo = clean(item.get("tipo")).lower()
    codigo = normalize_code(item.get("codigo"))

    if tipo == "lote":
        seccion = upper(item.get("seccion"))
        manzana = upper(item.get("manzana"))

        if manzana:
            return f"{seccion} / Manzana {manzana} / Lote {codigo}"

        return f"{seccion} / Lote {codigo}"

    if tipo == "nicho":
        zona = upper(item.get("zonaId") or item.get("columbario"))
        cara = clean(item.get("cara")).lower()

        if cara:
            return f"{zona} / {cara} / Nicho {codigo}"

        return f"{zona} / Nicho {codigo}"

    return codigo


def make_search_text(item, property_id, display_name):
    values = [
        property_id,
        display_name,
        item.get("tipo"),
        item.get("seccion"),
        item.get("manzana"),
        item.get("zonaId"),
        item.get("columbario"),
        item.get("cara"),
        item.get("codigo"),
        item.get("estatus"),
        item.get("referencia_procap"),
        item.get("observaciones")
    ]

    return " ".join(clean(v) for v in values if clean(v)).upper()


def build_catalog_item(item):
    tipo = clean(item.get("tipo")).lower()
    codigo = normalize_code(item.get("codigo"))
    property_id = make_property_id(item)

    if not property_id:
        return None

    display_name = make_display_name(item)

    catalog_item = {
        "id": property_id,
        "tipo": tipo,
        "displayName": display_name,

        "seccion": upper(item.get("seccion")),
        "manzana": upper(item.get("manzana")),
        "zonaId": upper(item.get("zonaId") or item.get("columbario")),
        "cara": clean(item.get("cara")).lower(),
        "codigo": codigo,

        "estatus": normalize_status(item.get("estatus")),
        "referencia_procap": clean(item.get("referencia_procap")),
        "observaciones": clean(item.get("observaciones")),

        "source": "inventario-base",
        "searchText": ""
    }

    catalog_item["searchText"] = make_search_text(
        catalog_item,
        property_id,
        display_name
    )

    return catalog_item


def sort_catalog_key(item):
    tipo = item.get("tipo", "")
    seccion = item.get("seccion", "")
    manzana = item.get("manzana", "")
    zona = item.get("zonaId", "")
    cara = item.get("cara", "")
    codigo = item.get("codigo", "")

    return (tipo, seccion, manzana, zona, cara, codigo)


def main():
    if not INPUT_INVENTARIO.exists():
        raise FileNotFoundError(f"No existe {INPUT_INVENTARIO}")

    with INPUT_INVENTARIO.open("r", encoding="utf-8") as file:
        inventario = json.load(file)

    raw_items = inventario.get("items", [])

    catalog_items = []
    duplicated_ids = {}
    missing_data = []

    id_counts = {}

    for index, raw_item in enumerate(raw_items, start=1):
        catalog_item = build_catalog_item(raw_item)

        if not catalog_item:
            missing_data.append(f"Fila {index}: no se pudo crear ID. Datos: {raw_item}")
            continue

        original_id = catalog_item["id"]

        if original_id in id_counts:
            id_counts[original_id] += 1
            catalog_item["id"] = f"{original_id}__DUP{id_counts[original_id]}"
            duplicated_ids.setdefault(original_id, 1)
            duplicated_ids[original_id] += 1
        else:
            id_counts[original_id] = 1

        if catalog_item["tipo"] == "lote":
            if not catalog_item["seccion"] or not catalog_item["codigo"]:
                missing_data.append(f"Fila {index}: lote incompleto. Datos: {raw_item}")

        if catalog_item["tipo"] == "nicho":
            if not catalog_item["zonaId"] or not catalog_item["codigo"]:
                missing_data.append(f"Fila {index}: nicho incompleto. Datos: {raw_item}")

        catalog_items.append(catalog_item)

    catalog_items.sort(key=sort_catalog_key)

    payload = {
        "source": "catalogo-propiedades",
        "version": 1,
        "updatedAt": datetime.now().isoformat(timespec="seconds"),
        "total": len(catalog_items),
        "items": catalog_items
    }

    with OUTPUT_CATALOGO.open("w", encoding="utf-8") as file:
        json.dump(payload, file, ensure_ascii=False, indent=2)

    with OUTPUT_REPORTE.open("w", encoding="utf-8") as file:
        file.write("Reporte de generación de catálogo de propiedades\n")
        file.write("================================================\n\n")
        file.write(f"Registros leídos desde inventario-base: {len(raw_items)}\n")
        file.write(f"Registros escritos en catálogo: {len(catalog_items)}\n")
        file.write(f"IDs duplicados detectados: {len(duplicated_ids)}\n")
        file.write(f"Registros con datos faltantes: {len(missing_data)}\n\n")

        if duplicated_ids:
            file.write("IDs duplicados:\n")
            for item_id, count in sorted(duplicated_ids.items()):
                file.write(f"- {item_id}: {count} registros\n")
            file.write("\n")

        if missing_data:
            file.write("Registros con datos faltantes:\n")
            for msg in missing_data:
                file.write(f"- {msg}\n")

    print(f"Catalogo generado: {OUTPUT_CATALOGO}")
    print(f"Reporte generado: {OUTPUT_REPORTE}")
    print(f"Registros escritos: {len(catalog_items)}")
    print(f"IDs duplicados detectados: {len(duplicated_ids)}")
    print(f"Registros con datos faltantes: {len(missing_data)}")


if __name__ == "__main__":
    main()