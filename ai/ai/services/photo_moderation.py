from hashlib import file_digest
from io import BytesIO
import math
from pathlib import Path

MODEL_SHA256 = "e9350e576608afe4b57a089ffeb0ebafa1389cdcea4882dd61df28c45f1c24d2"
MODEL_ID = "marqo-nsfw-image-detection-384-onnx@" + MODEL_SHA256[:12]
PHOTO_MAX_BYTES = 10 * 1024 * 1024


class PhotoModerator:
    def __init__(self, path: str):
        import onnxruntime as ort

        with Path(path).open("rb") as weights:
            if file_digest(weights, "sha256").hexdigest() != MODEL_SHA256:
                raise ValueError("Photo moderation model checksum does not match")
        options = ort.SessionOptions()
        options.intra_op_num_threads = 2
        self.session = ort.InferenceSession(path, options, providers=["CPUExecutionProvider"])

    def assess(self, data: bytes) -> dict:
        import numpy as np
        from PIL import Image, ImageOps, UnidentifiedImageError

        try:
            with Image.open(BytesIO(data), formats=["JPEG", "PNG", "WEBP"]) as source:
                if source.width * source.height > 25_000_000 or source.n_frames != 1:
                    return {"kind": "invalid"}
                image = ImageOps.exif_transpose(source).convert("RGB")
        except (UnidentifiedImageError, Image.DecompressionBombError, OSError, ValueError):
            return {"kind": "invalid"}

        # The full-frame view preserves edges that the model's standard center crop can miss.
        views = [
            ImageOps.fit(image, (384, 384), method=Image.Resampling.BICUBIC),
            image.resize((384, 384), resample=Image.Resampling.BICUBIC),
        ]
        probabilities = []
        for view in views:
            tensor = ((np.asarray(view, dtype=np.float32) / 127.5) - 1).transpose(2, 0, 1)[None]
            raw = self.session.run(None, {self.session.get_inputs()[0].name: tensor})[0]
            if raw.shape != (1, 2) or not np.isfinite(raw).all():
                raise ValueError("Invalid photo classifier output")
            explicit, safe = map(float, raw[0])
            highest = max(explicit, safe)
            numerator = math.exp(explicit - highest)
            probabilities.append(numerator / (numerator + math.exp(safe - highest)))
        return {"kind": "scored", "risk": max(probabilities), "model": MODEL_ID}
