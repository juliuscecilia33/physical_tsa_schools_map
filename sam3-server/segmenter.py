import os
import json
import tempfile
import time
from pathlib import Path

from samgeo.text_sam import LangSAM
from samgeo.common import tms_to_geotiff


# Lazy-loaded model instance
_sam_model: LangSAM | None = None


def get_model() -> LangSAM:
    """Get or initialize the LangSAM model (singleton)."""
    global _sam_model
    if _sam_model is None:
        _sam_model = LangSAM()
    return _sam_model


def run_segmentation(
    bbox: list[float],
    text_prompt: str,
    zoom: int = 18,
    box_threshold: float = 0.24,
    text_threshold: float = 0.24,
    progress_callback=None,
) -> dict:
    """
    Run text-prompted segmentation on satellite imagery.

    Args:
        bbox: [west, south, east, north] in WGS84 degrees
        text_prompt: Text description of features to detect (e.g. "football fields")
        zoom: Tile zoom level (higher = more detail, more tiles)
        box_threshold: GroundingDINO box confidence threshold
        text_threshold: GroundingDINO text confidence threshold
        progress_callback: Optional callable(status_str, progress_float)

    Returns:
        dict with 'geojson' (FeatureCollection) and 'feature_count' (int)
    """
    work_dir = tempfile.mkdtemp(prefix="sam3_")
    image_path = os.path.join(work_dir, "area.tif")
    mask_path = os.path.join(work_dir, "masks.tif")
    vector_path = os.path.join(work_dir, "results.geojson")

    try:
        # Step 1: Download satellite tiles as GeoTIFF
        if progress_callback:
            progress_callback("Downloading satellite imagery...", 0.1)

        tms_to_geotiff(
            output=image_path,
            bbox=bbox,
            zoom=zoom,
            source="Satellite",
        )

        if not os.path.exists(image_path):
            raise RuntimeError("Failed to download satellite imagery")

        # Step 2: Run LangSAM (GroundingDINO + SAM) segmentation
        if progress_callback:
            progress_callback("Running AI segmentation...", 0.4)

        sam = get_model()
        sam.predict(
            image=image_path,
            text_prompt=text_prompt,
            box_threshold=box_threshold,
            text_threshold=text_threshold,
            output=mask_path,
        )

        # Step 3: Convert raster masks to vector GeoJSON
        if progress_callback:
            progress_callback("Converting results to polygons...", 0.8)

        sam.raster_to_vector(
            image=mask_path, output=vector_path, dst_crs="EPSG:4326"
        )

        # Step 4: Read and return the GeoJSON
        if progress_callback:
            progress_callback("Done!", 1.0)

        if os.path.exists(vector_path):
            with open(vector_path, "r") as f:
                geojson = json.load(f)
            # Strip CRS property — Mapbox expects WGS84 and the crs key can cause issues
            geojson.pop("crs", None)
            feature_count = len(geojson.get("features", []))
        else:
            geojson = {"type": "FeatureCollection", "features": []}
            feature_count = 0

        return {
            "geojson": geojson,
            "feature_count": feature_count,
        }

    finally:
        # Clean up temp files
        for p in [image_path, mask_path, vector_path]:
            if os.path.exists(p):
                try:
                    os.remove(p)
                except OSError:
                    pass
        try:
            os.rmdir(work_dir)
        except OSError:
            pass
