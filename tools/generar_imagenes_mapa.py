from pathlib import Path

import fitz
from PIL import Image


Image.MAX_IMAGE_PIXELS = None

PDF_PATH = Path("assets/source/plan-new.pdf")
BASE_OUT = Path("assets/map/base.png")
PUBLIC_OUT = Path("assets/map/base-public.webp")

# Dimensiones históricas del mapa
TARGET_W = 11100
TARGET_H = 9250


def main():
    if not PDF_PATH.exists():
        raise FileNotFoundError(f"No existe el PDF fuente: {PDF_PATH}")

    BASE_OUT.parent.mkdir(parents=True, exist_ok=True)

    doc = fitz.open(PDF_PATH)

    if doc.page_count < 1:
        raise RuntimeError("El PDF no tiene páginas.")

    page = doc[0]

    # Render cercano al tamaño final. No usar multiplicador alto.
    zoom_x = TARGET_W / page.rect.width
    zoom_y = TARGET_H / page.rect.height
    zoom = max(zoom_x, zoom_y)

    matrix = fitz.Matrix(zoom, zoom)
    pix = page.get_pixmap(matrix=matrix, alpha=False)

    img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)

    scale = min(TARGET_W / img.width, TARGET_H / img.height)
    new_w = round(img.width * scale)
    new_h = round(img.height * scale)

    try:
        resample = Image.Resampling.LANCZOS
    except AttributeError:
        resample = Image.LANCZOS

    resized = img.resize((new_w, new_h), resample)

    canvas = Image.new("RGB", (TARGET_W, TARGET_H), "white")

    offset_x = (TARGET_W - new_w) // 2
    offset_y = (TARGET_H - new_h) // 2

    canvas.paste(resized, (offset_x, offset_y))

    canvas.save(BASE_OUT, "PNG", optimize=True)

    # Misma dimensión, pero comprimido para público
    canvas.save(PUBLIC_OUT, "WEBP", quality=82, method=6)

    print("Imagenes generadas correctamente:")
    print(f"- {BASE_OUT} ({TARGET_W}x{TARGET_H})")
    print(f"- {PUBLIC_OUT} ({TARGET_W}x{TARGET_H})")
    print("")
    print(f"PDF usado: {PDF_PATH}")
    print(f"PDF render original: {pix.width}x{pix.height}")
    print(f"Imagen ajustada: {new_w}x{new_h}")
    print(f"Offset aplicado: x={offset_x}, y={offset_y}")


if __name__ == "__main__":
    main()