from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_token():
    r = client.post("/token")
    assert r.status_code == 200
    data = r.json()
    assert "token" in data
