import os
import json
import logging
import math
import statistics
import tempfile
import time
from pathlib import Path

from samgeo.text_sam import LangSAM
from samgeo.common import tms_to_geotiff
from shapely.geometry import shape, LineString
from shapely import minimum_rotated_rectangle
from pyproj import Geod

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Prompt expansions — map short preset names to descriptive GroundingDINO prompts
# ---------------------------------------------------------------------------
PROMPT_EXPANSIONS: dict[str, str] = {
    "football fields": "football field . football stadium . green athletic field . running track with field . rectangular grass field . artificial turf field",
    "soccer fields": "green soccer field or soccer pitch on grass",
    "baseball diamonds": "baseball diamond with brown dirt infield and green grass outfield",
    "tennis courts": "rectangular tennis court with net and marked lines",
}

# ---------------------------------------------------------------------------
# Shape filter presets — per-sport geometry constraints
# ---------------------------------------------------------------------------
SHAPE_PRESETS: dict[str, dict] = {
    "football fields": {"min_rect": 0.20, "aspect_min": 1.0, "aspect_max": 6.0, "min_compact": 0.2},
    "soccer fields":   {"min_rect": 0.35, "aspect_min": 1.1, "aspect_max": 4.0, "min_compact": 0.3},
    "baseball diamonds": {"min_rect": 0.30, "aspect_min": 0.8, "aspect_max": 1.8, "min_compact": 0.3},
    "tennis courts":   {"min_rect": 0.55, "aspect_min": 1.3, "aspect_max": 4.0, "min_compact": 0.35},
}


def compute_shape_metrics(geom, geod: Geod) -> dict:
    """Compute rectangularity, aspect ratio, and compactness for a geometry."""
    try:
        area = abs(geod.geometry_area_perimeter(geom)[0])
        perimeter = abs(geod.geometry_area_perimeter(geom)[1])

        mrr = minimum_rotated_rectangle(geom)
        mrr_area = abs(geod.geometry_area_perimeter(mrr)[0])

        rectangularity = area / mrr_area if mrr_area > 0 else 0.0

        # Aspect ratio from minimum rotated rectangle exterior coords
        mrr_coords = list(mrr.exterior.coords)
        if len(mrr_coords) >= 4:
            side1 = abs(geod.geometry_length(LineString([mrr_coords[0], mrr_coords[1]])))
            side2 = abs(geod.geometry_length(LineString([mrr_coords[1], mrr_coords[2]])))
            if side1 > 0 and side2 > 0:
                aspect_ratio = max(side1, side2) / min(side1, side2)
            else:
                aspect_ratio = 1.0
        else:
            aspect_ratio = 1.0

        # Compactness (Polsby-Popper): 4π × area / perimeter²
        compactness = (4 * math.pi * area) / (perimeter ** 2) if perimeter > 0 else 0.0

        return {
            "rectangularity": round(rectangularity, 3),
            "aspect_ratio": round(aspect_ratio, 2),
            "compactness": round(compactness, 3),
            "area_sqm": round(area, 1),
        }
    except Exception:
        return {"rectangularity": 0.0, "aspect_ratio": 1.0, "compactness": 0.0, "area_sqm": 0.0}


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
    box_threshold: float = 0.30,
    text_threshold: float = 0.30,
    min_area_sqm: float = 0,
    shape_filter: bool = True,
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
        shape_filter: Apply shape-based filtering for recognized presets
        progress_callback: Optional callable(status_str, progress_float)

    Returns:
        dict with 'geojson' (FeatureCollection) and 'feature_count' (int)
    """
    # Expand preset prompts to more descriptive GroundingDINO prompts
    original_prompt = text_prompt.lower().strip()
    effective_prompt = PROMPT_EXPANSIONS.get(original_prompt, text_prompt)

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
            text_prompt=effective_prompt,
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
            total_before_filter = len(geojson.get("features", []))

            # Compute shape metrics + area for all features
            geod = Geod(ellps="WGS84")
            if geojson.get("features"):
                for feat in geojson["features"]:
                    try:
                        geom = shape(feat["geometry"])
                        metrics = compute_shape_metrics(geom, geod)
                        feat["properties"] = feat.get("properties") or {}
                        feat["properties"].update(metrics)
                    except Exception:
                        feat["properties"] = feat.get("properties") or {}

            # Compute area stats before any filtering
            all_areas = [
                f.get("properties", {}).get("area_sqm", 0)
                for f in geojson.get("features", [])
            ]
            if all_areas:
                area_stats = {
                    "min": round(min(all_areas), 1),
                    "max": round(max(all_areas), 1),
                    "median": round(statistics.median(all_areas), 1),
                    "mean": round(statistics.mean(all_areas), 1),
                    "count_over_500": sum(1 for a in all_areas if a >= 500),
                    "count_over_1000": sum(1 for a in all_areas if a >= 1000),
                }
            else:
                area_stats = {"min": 0, "max": 0, "median": 0, "mean": 0, "count_over_500": 0, "count_over_1000": 0}

            logger.info("Raw features: %d | Area stats: min=%.0f max=%.0f median=%.0f mean=%.0f",
                        total_before_filter, area_stats["min"], area_stats["max"],
                        area_stats["median"], area_stats["mean"])

            # Area filtering
            area_filtered_count = 0
            if min_area_sqm > 0 and geojson.get("features"):
                before_area = len(geojson["features"])
                geojson["features"] = [
                    f for f in geojson["features"]
                    if (f.get("properties", {}).get("area_sqm", 0) >= min_area_sqm)
                ]
                area_filtered_count = before_area - len(geojson["features"])
                logger.info("Area filter (min=%.0f m²): %d removed, %d remaining",
                            min_area_sqm, area_filtered_count, len(geojson["features"]))

            # Shape-based filtering for recognized presets
            shape_preset = SHAPE_PRESETS.get(original_prompt) if shape_filter else None
            shape_filtered_count = 0
            if shape_preset and geojson.get("features"):
                before = len(geojson["features"])
                filtered = []
                for feat in geojson["features"]:
                    props = feat.get("properties", {})
                    rect = props.get("rectangularity", 0)
                    aspect = props.get("aspect_ratio", 1)
                    compact = props.get("compactness", 0)
                    area = props.get("area_sqm", 0)
                    if (rect >= shape_preset["min_rect"]
                            and shape_preset["aspect_min"] <= aspect <= shape_preset["aspect_max"]
                            and compact >= shape_preset["min_compact"]):
                        filtered.append(feat)
                    else:
                        logger.info("Shape REJECT: area=%.0f rect=%.3f aspect=%.2f compact=%.3f",
                                    area, rect, aspect, compact)
                geojson["features"] = filtered
                shape_filtered_count = before - len(filtered)
                logger.info("Shape filter (%s): %d removed, %d remaining",
                            original_prompt, shape_filtered_count, len(geojson["features"]))

            feature_count = len(geojson.get("features", []))
        else:
            geojson = {"type": "FeatureCollection", "features": []}
            feature_count = 0
            total_before_filter = 0
            area_filtered_count = 0
            shape_filtered_count = 0
            area_stats = {"min": 0, "max": 0, "median": 0, "mean": 0, "count_over_500": 0, "count_over_1000": 0}

        return {
            "geojson": geojson,
            "feature_count": feature_count,
            "total_before_filter": total_before_filter,
            "area_filtered_count": area_filtered_count,
            "shape_filtered_count": shape_filtered_count,
            "filtered_count": total_before_filter - feature_count,
            "effective_prompt": effective_prompt,
            "area_stats": area_stats,
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
