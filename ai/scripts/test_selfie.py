"""Compare local, consented test images. The app and database are outside this experiment."""

import argparse
from hashlib import file_digest
import json
import os
from pathlib import Path
from statistics import median

MODELS = {
    "yunet.onnx": "8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4",
    "sface.onnx": "0ba9fbfa01b5270c96627c4ef784da859931e02f04419c829e83484087c34e79",
    "minifasnet.onnx": "b32929adc2d9c34b9486f8c4c7bc97c1b69bc0ea9befefc380e4faae4e463907",
}


def sample_video(video, cv2, np):
    if not video.is_file() or video.stat().st_size > 50 * 1024 * 1024:
        raise ValueError("Use a local video no larger than 50 MB")
    capture = cv2.VideoCapture(str(video.resolve()))
    try:
        fps = capture.get(cv2.CAP_PROP_FPS)
        frames = capture.get(cv2.CAP_PROP_FRAME_COUNT)
        if not fps or not 1 <= frames / fps <= 15:
            raise ValueError("Use a supported video between one and 15 seconds long")
        for index in np.linspace(0, frames - 1, 8, dtype=int):
            capture.set(cv2.CAP_PROP_POS_FRAMES, int(index))
            success, frame = capture.read()
            if success:
                yield frame
    finally:
        capture.release()


def score_video(model_dir, reference, video):
    import cv2
    import numpy as np
    import onnxruntime as ort

    for filename, expected in MODELS.items():
        with (model_dir / filename).open("rb") as model:
            if file_digest(model, "sha256").hexdigest() != expected:
                raise ValueError(f"Unexpected checksum for {filename}")

    detector = cv2.FaceDetectorYN.create(str(model_dir / "yunet.onnx"), "", (320, 320), 0.85)
    recognizer = cv2.FaceRecognizerSF.create(str(model_dir / "sface.onnx"), "")
    options = ort.SessionOptions()
    options.intra_op_num_threads = 2
    liveness = ort.InferenceSession(str(model_dir / "minifasnet.onnx"), options, providers=["CPUExecutionProvider"])

    def locate_face(image):
        height, width = image.shape[:2]
        scale = min(1, 1024 / max(height, width))
        if scale < 1:
            image = cv2.resize(image, (max(1, int(width * scale)), max(1, int(height * scale))))
        detector.setInputSize((image.shape[1], image.shape[0]))
        _, faces = detector.detect(image)
        if faces is None or len(faces) != 1:
            return image, None
        return image, faces[0]

    if not reference.is_file() or reference.stat().st_size > 10 * 1024 * 1024:
        raise ValueError("Use a local reference photo no larger than 10 MB")
    image = cv2.imread(str(reference.resolve()))
    if image is None:
        raise ValueError("Could not read reference photo")
    image, face = locate_face(image)
    if face is None:
        raise ValueError("Reference photo must show one clear face")
    reference_feature = recognizer.feature(recognizer.alignCrop(image, face)).copy()
    faces, live, sampled = [], [], 0
    for frame in sample_video(video, cv2, np):
        sampled += 1
        image, face = locate_face(frame)
        if face is None:
            continue
        x, y, width, height = face[:4]
        image_height, image_width = image.shape[:2]
        scale = min(2.7, (image_height - 1) / height, (image_width - 1) / width)
        center_x, center_y = x + width / 2, y + height / 2
        left, right = max(0, int(center_x - scale * width / 2)), min(image_width, int(center_x + scale * width / 2) + 1)
        top, bottom = max(0, int(center_y - scale * height / 2)), min(image_height, int(center_y + scale * height / 2) + 1)
        if left >= right or top >= bottom:
            continue
        feature = recognizer.feature(recognizer.alignCrop(image, face))
        faces.append(float(recognizer.match(reference_feature, feature, cv2.FaceRecognizerSF_FR_COSINE)))
        crop = cv2.resize(image[top:bottom, left:right], (80, 80))
        tensor = crop.transpose(2, 0, 1)[None].astype(np.float32)
        logits = liveness.run(None, {liveness.get_inputs()[0].name: tensor})[0]
        if logits.shape != (1, 3) or not np.isfinite(logits).all():
            raise ValueError("Invalid liveness model output")
        probabilities = np.exp(logits[0] - logits.max())
        live.append(float(probabilities[1] / probabilities.sum()))

    return {
        "mode": "experiment",
        "sampledFrames": sampled,
        "scoredFrames": len(faces),
        "faceCosineMedian": round(median(faces), 5) if faces else None,
        "passiveLivenessMedian": round(median(live), 5) if live else None,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--profile", type=Path, required=True)
    parser.add_argument("--video", type=Path, required=True)
    parser.add_argument("--models", type=Path, default=Path(__file__).resolve().parents[1] / ".cache" / "vision")
    args = parser.parse_args()
    if os.getenv("SELFIE_VERIFICATION_TEST_ENABLED") != "true":
        parser.exit(2, "Selfie experiment disabled. Set SELFIE_VERIFICATION_TEST_ENABLED=true to test locally.\n")
    try:
        print(json.dumps(score_video(args.models, args.profile, args.video), allow_nan=False))
    except (ImportError, OSError, ValueError) as error:
        parser.exit(1, f"{error}\n")


if __name__ == "__main__":
    main()
