"""Explicit real-model smoke evaluation; fictional texts, project-local model cache."""
import argparse
import json
import os
from pathlib import Path
import sys
from time import perf_counter
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
os.environ["HF_HOME"] = str(ROOT / ".cache" / "huggingface")
os.environ["HF_HUB_DISABLE_PROGRESS_BARS"] = "1"
os.environ["TOKENIZERS_PARALLELISM"] = "false"
os.environ["HF_HUB_ETAG_TIMEOUT"] = "15"
os.environ["HF_HUB_DOWNLOAD_TIMEOUT"] = "60"
os.environ["HF_HUB_DISABLE_XET"] = "1"
os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--download", action="store_true", help="Explicitly allow initial model retrieval")
    parser.add_argument("--revision", default=os.getenv("AI_MODEL_REVISION"))
    args = parser.parse_args()
    from api.config import Settings
    from api.main import create_app
    from ai.embeddings.provider import SentenceTransformerProvider
    from fastapi.testclient import TestClient

    model = Settings.model_name
    revision = args.revision or Settings.model_revision
    if args.download and not revision:
        from huggingface_hub import HfApi
        print("Resolving a pinned public model revision...", flush=True)
        revision = HfApi().model_info(model, timeout=20, token=False).sha
    print("Loading multilingual embeddings into the project-local cache...", flush=True)
    started = perf_counter()
    provider = SentenceTransformerProvider(model, revision, local_files_only=not args.download)
    loaded_ms = round((perf_counter() - started) * 1000)
    print("Running semantic API smoke cases...", flush=True)
    secret = uuid4().hex + uuid4().hex
    cases = [
        ("english", "I enjoy hiking in the mountains on weekends.", "I love trekking and exploring nature.", "I spend my free time competing in online chess tournaments."),
        ("hindi_english", "I enjoy hiking in the mountains on weekends.", "मुझे पहाड़ों में ट्रेकिंग करना बहुत पसंद है।", "मुझे घर पर शतरंज खेलना पसंद है।"),
        ("hinglish", "I enjoy hiking in the mountains on weekends.", "Weekend pe trekking aur pahadon mein ghoomna pasand hai.", "Mujhe online chess tournaments khelna pasand hai."),
    ]
    report = {"model": provider.version, "loadMs": loaded_ms, "cases": []}
    with TestClient(create_app(Settings(service_key=secret), provider)) as client:
        assert client.get("/ready").status_code == 200
        for label, anchor, positive, negative in cases:
            started = perf_counter()
            response = client.post("/v1/matching/semantic", headers={"X-Service-Key": secret}, json={
                "viewerText": anchor,
                "candidates": [{"key": str(uuid4()), "text": positive}, {"key": str(uuid4()), "text": negative}],
            })
            response.raise_for_status()
            scores = [item["similarity"] for item in response.json()["scores"]]
            report["cases"].append({"case": label, "related": round(scores[0], 4), "unrelated": round(scores[1], 4), "latencyMs": round((perf_counter() - started) * 1000), "passed": scores[0] > scores[1]})
        response = client.post("/v1/matching/semantic", headers={"X-Service-Key": secret}, json={
            "viewerText": "I want children.", "candidates": [{"key": str(uuid4()), "text": "I do not want children."}],
        })
        response.raise_for_status()
        report["negationSimilarity"] = round(response.json()["scores"][0]["similarity"], 4)
        report["interpretation"] = "Similarity is topic evidence, not preference agreement or relationship probability; explicit dealbreakers remain authoritative."
    report["passed"] = all(case["passed"] for case in report["cases"])
    output = ROOT / ".cache" / "semantic-smoke.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=True, indent=2))
    if not report["passed"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
