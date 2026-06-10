import argparse
import json
import shutil
from datetime import datetime
from pathlib import Path


def norm(value):
    return str(value or "").strip().upper()


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


def main():
    parser = argparse.ArgumentParser(
        description="Renumerar lotes de una manzana aplicando un offset numerico."
    )

    parser.add_argument("--file", required=True, help="Ruta del GeoJSON de lotes.")
    parser.add_argument("--seccion", required=True, help="Seccion a modificar.")
    parser.add_argument("--manzana", required=True, help="Manzana a modificar.")
    parser.add_argument("--offset", required=True, type=int, help="Numero a sumar al lote actual.")
    parser.add_argument("--apply", action="store_true", help="Aplicar cambios. Si no se usa, solo muestra vista previa.")

    args = parser.parse_args()

    path = Path(args.file)

    if not path.exists():
        raise FileNotFoundError(f"No existe el archivo: {path}")

    with path.open("r", encoding="utf-8") as f:
        data = json.load(f)

    features = data.get("features", [])

    target_seccion = norm(args.seccion)
    target_manzana = norm(args.manzana)

    changes = []

    for feature in features:
        props = feature.get("properties") or {}

        seccion = norm(props.get("seccion"))
        manzana = norm(props.get("manzana") or props.get("manzanaId"))

        if seccion != target_seccion:
            continue

        if manzana != target_manzana:
            continue

        old_code = get_lote_code(props)

        if not old_code.isdigit():
            print(f"Saltando lote no numerico: {old_code}")
            continue

        new_number = int(old_code) + args.offset
        new_code = format_new_code(old_code, new_number)

        changes.append((old_code, new_code, props))

    print(f"Archivo: {path}")
    print(f"Seccion: {target_seccion}")
    print(f"Manzana: {target_manzana}")
    print(f"Offset: {args.offset}")
    print(f"Lotes encontrados: {len(changes)}")

    if not changes:
        print("No se encontraron lotes para modificar.")
        return

    print("")
    print("Vista previa:")
    for old_code, new_code, _ in changes[:20]:
        print(f"  {old_code} -> {new_code}")

    if len(changes) > 20:
        print(f"  ... y {len(changes) - 20} mas")

    if not args.apply:
        print("")
        print("Vista previa solamente. Para aplicar, ejecuta otra vez con --apply")
        return

    backup = path.with_suffix(path.suffix + f".bak-{datetime.now().strftime('%Y%m%d-%H%M%S')}")
    shutil.copy2(path, backup)

    for old_code, new_code, props in changes:
        props["id"] = new_code
        props["lote"] = new_code

        if "codigo" in props:
            props["codigo"] = new_code

        props["seccion"] = target_seccion
        props["manzana"] = target_manzana
        props["manzanaId"] = target_manzana

    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print("")
    print("Cambios aplicados.")
    print(f"Backup creado: {backup}")


if __name__ == "__main__":
    main()