import math
import unittest
from uuid import uuid4
from fastapi.testclient import TestClient
from api.config import Settings
from api.main import create_app
from ai.services.matching import cosine_similarity

KEY = "test-service-key-that-is-more-than-32-characters"


class FakeEncoder:
    version = "test-only-v1"

    def __init__(self):
        self.batches = []

    def encode(self, texts):
        self.batches.append(texts)
        return [[0, 1] if text == "cooking" else [1, 0] for text in texts]


class MatchingApiTests(unittest.TestCase):
    def setUp(self):
        self.encoder = FakeEncoder()
        self.client = TestClient(create_app(Settings(service_key=KEY), self.encoder))
        self.client.__enter__()
        self.headers = {"X-Service-Key": KEY}

    def tearDown(self):
        self.client.__exit__(None, None, None)

    def payload(self):
        return {"viewerText": "hiking", "candidates": [{"key": str(uuid4()), "text": "hiking"}, {"key": str(uuid4()), "text": "cooking"}]}

    def test_internal_auth_required(self):
        self.assertEqual(self.client.post("/v1/matching/semantic", json=self.payload()).status_code, 401)
        self.assertEqual(self.encoder.batches, [])
        self.assertEqual(self.client.post("/v1/assist/icebreakers", json={}, headers={"X-Service-Key": "wrong"}).status_code, 401)

    def test_semantic_batch_is_grounded_bounded_and_not_persistent(self):
        response = self.client.post("/v1/matching/semantic", json=self.payload(), headers=self.headers)
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual([s["similarity"] for s in response.json()["scores"]], [1, 0])
        self.assertEqual(self.encoder.batches, [["hiking", "cooking"]])
        self.client.post("/v1/matching/semantic", json=self.payload(), headers=self.headers)
        self.assertEqual(len(self.encoder.batches), 2)

    def test_strict_validation_does_not_echo_private_input(self):
        payload = self.payload()
        payload["viewerText"] = "private biography " * 1000
        response = self.client.post("/v1/matching/semantic", json=payload, headers=self.headers)
        self.assertEqual(response.status_code, 422)
        self.assertNotIn("private biography", response.text)
        payload = self.payload()
        payload["candidates"] *= 2
        self.assertEqual(self.client.post("/v1/matching/semantic", json=payload, headers=self.headers).status_code, 422)
        payload = self.payload()
        payload["phone"] = "must-not-be-accepted"
        self.assertEqual(self.client.post("/v1/matching/semantic", json=payload, headers=self.headers).status_code, 422)

    def test_body_limit_and_no_public_openapi(self):
        response = self.client.post("/v1/matching/semantic", content=b"x" * 1_200_001, headers=self.headers)
        self.assertEqual(response.status_code, 413)
        self.assertEqual(self.client.get("/openapi.json").status_code, 404)

    def test_photo_worker_route_requires_auth_and_reports_disabled_provider(self):
        route = "/v1/photo-moderation"
        self.assertEqual(self.client.post(route, content=b"photo").status_code, 401)
        self.assertEqual(self.client.post(route, content=b"photo", headers=self.headers).status_code, 503)

    def test_photo_worker_route_accepts_binary_without_retaining_it(self):
        class TestModerator:
            def assess(inner, supplied):
                self.assertEqual(supplied, b"image bytes")
                return {"kind": "scored", "risk": 0.01, "model": "fixture"}

        with TestClient(create_app(Settings(service_key=KEY), photo_moderator=TestModerator())) as client:
            result = client.post("/v1/photo-moderation", content=b"image bytes", headers=self.headers)
            self.assertEqual(result.status_code, 200)
            self.assertEqual(result.json()["risk"], 0.01)

    def test_icebreakers_are_drafts_from_supplied_facts(self):
        response = self.client.post("/v1/assist/icebreakers", json={"sharedInterests": ["Trekking", "Trekking"]}, headers=self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()["suggestions"]), 1)
        self.assertIn("Trekking", response.json()["suggestions"][0])

    def test_unavailable_model_preserves_health_and_assist(self):
        with TestClient(create_app(Settings(service_key=KEY))) as client:
            self.assertEqual(client.get("/health").status_code, 200)
            self.assertEqual(client.get("/ready").status_code, 503)
            self.assertEqual(client.post("/v1/matching/semantic", json=self.payload(), headers=self.headers).status_code, 503)
            self.assertEqual(client.post("/v1/assist/icebreakers", json={}, headers=self.headers).status_code, 200)

    def test_cosine_rejects_invalid_provider_outputs(self):
        for a, b in [([], []), ([1], [1, 2]), ([0, 0], [1, 1]), ([math.nan], [1])]:
            with self.assertRaises(ValueError):
                cosine_similarity(a, b)

    def test_missing_secret_fails_closed(self):
        with self.assertRaises(ValueError):
            with TestClient(create_app(Settings())):
                pass
