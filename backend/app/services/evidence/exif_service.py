import io
import math
from datetime import datetime, timezone
from typing import Dict, Any, Tuple, Optional
from PIL import Image, ImageDraw, ImageFont
import piexif

class ExifService:
    """
    Handles EXIF metadata extraction, consent-based GPS coordinate parsing,
    parcel proximity reference checking, and visual metadata watermarking.
    Does NOT claim to guarantee photograph or GPS authenticity.
    """

    @staticmethod
    def _convert_to_degrees(value) -> float:
        """
        Helper function to convert GPS coordinates stored in EXIF (degrees, minutes, seconds)
        to decimal degrees.
        """
        d = float(value[0][0]) / float(value[0][1])
        m = float(value[1][0]) / float(value[1][1])
        s = float(value[2][0]) / float(value[2][1])
        return d + (m / 60.0) + (s / 3600.0)

    @classmethod
    def extract_metadata(cls, image_bytes: bytes) -> Dict[str, Any]:
        """
        Extracts GPS Lat/Long and capture timestamp from raw photo bytes.
        """
        try:
            image = Image.open(io.BytesIO(image_bytes))
            exif_dict = piexif.load(image.info.get("exif", b""))
            gps_info = exif_dict.get("GPS", {})
            exif_info = exif_dict.get("Exif", {})

            lat = None
            lon = None

            if piexif.GPSIFD.GPSLatitude in gps_info and piexif.GPSIFD.GPSLatitudeRef in gps_info:
                lat = cls._convert_to_degrees(gps_info[piexif.GPSIFD.GPSLatitude])
                if gps_info[piexif.GPSIFD.GPSLatitudeRef].decode() == "S":
                    lat = -lat

            if piexif.GPSIFD.GPSLongitude in gps_info and piexif.GPSIFD.GPSLongitudeRef in gps_info:
                lon = cls._convert_to_degrees(gps_info[piexif.GPSIFD.GPSLongitude])
                if gps_info[piexif.GPSIFD.GPSLongitudeRef].decode() == "W":
                    lon = -lon

            timestamp_str = None
            if piexif.ExifIFD.DateTimeOriginal in exif_info:
                timestamp_str = exif_info[piexif.ExifIFD.DateTimeOriginal].decode("utf-8", errors="ignore")

            return {
                "has_exif": True,
                "latitude": lat,
                "longitude": lon,
                "timestamp_device": timestamp_str or datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
            }
        except Exception:
            return {
                "has_exif": False,
                "latitude": None,
                "longitude": None,
                "timestamp_device": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
            }

    @staticmethod
    def haversine_distance_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """
        Calculates the great circle distance between two points in meters.
        """
        R = 6371000.0  # Earth radius in meters
        phi1 = math.radians(lat1)
        phi2 = math.radians(lat2)
        delta_phi = math.radians(lat2 - lat1)
        delta_lambda = math.radians(lon2 - lon1)

        a = math.sin(delta_phi / 2.0) ** 2 + \
            math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
        c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
        return R * c

    @classmethod
    def process_and_watermark(
        cls,
        image_bytes: bytes,
        latitude: float,
        longitude: float,
        timestamp_str: str,
        label: str = "FIELD DAMAGE"
    ) -> bytes:
        """
        Downscales the image to a mobile-friendly size (max 1600x1200) and overlays
        a farmer metadata banner at the bottom for record clarity.
        """
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        image.thumbnail((1600, 1200), Image.Resampling.LANCZOS)

        draw = ImageDraw.Draw(image)
        width, height = image.size

        # Watermark banner at the bottom
        banner_height = 42
        draw.rectangle(
            [(0, height - banner_height), (width, height)],
            fill=(0, 0, 0, 200)
        )

        watermark_text = f"RAIDPROOF AI | SELF-REPORTED EVIDENCE | {label} | GPS: {latitude:.5f}°N, {longitude:.5f}°E | TIME: {timestamp_str}"
        draw.text((12, height - banner_height + 12), watermark_text, fill=(255, 255, 255))

        out_buffer = io.BytesIO()
        image.save(out_buffer, format="JPEG", quality=80, optimize=True)
        return out_buffer.getvalue()

