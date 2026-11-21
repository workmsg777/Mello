"""Download and check public model weights without sending any photos."""

import argparse
from hashlib import file_digest
from pathlib import Path
import shutil
import sys
import tempfile
from urllib.request import urlopen

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from ai.services.photo_moderation import MODEL_SHA256
from test_selfie import MODELS

URLS = {
    "marqo.onnx": "https://huggingface.co/KanariKanaru/nsfw-image-detection-384-onnx/resolve/main/model.onnx",
    "yunet.onnx": "https://media.githubusercontent.com/media/opencv/opencv_zoo/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx",
    "sface.onnx": "https://media.githubusercontent.com/media/opencv/opencv_zoo/main/models/face_recognition_sface/face_recognition_sface_2021dec.onnx",
    "minifasnet.onnx": "https://github.com/yakhyo/face-anti-spoofing/releases/download/weights/MiniFASNetV2.onnx",
}


def checksum(path):
    with path.open("rb") as model:
        return file_digest(model, "sha256").hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--with-selfie-test", action="store_true")
    args = parser.parse_args()
    directory = Path(__file__).resolve().parents[1] / ".cache" / "vision"
    directory.mkdir(parents=True, exist_ok=True)
    models = {"marqo.onnx": MODEL_SHA256}
    if args.with_selfie_test:
        models.update(MODELS)
    with tempfile.TemporaryDirectory(dir=directory) as temporary:
        for name, expected in models.items():
            target = directory / name
            if target.exists() and checksum(target) == expected:
                print(f"Verified cached {name}")
                continue
            download = Path(temporary) / name
            with urlopen(URLS[name], timeout=45) as response, download.open("wb") as output:
                shutil.copyfileobj(response, output)
            if checksum(download) != expected:
                raise ValueError(f"Unexpected checksum for {name}")
            download.replace(target)
            print(f"Verified and saved {name}")


if __name__ == "__main__":
    main()
