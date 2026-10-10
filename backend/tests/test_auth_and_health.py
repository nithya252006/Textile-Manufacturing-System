import os
import sys

import pytest
from fastapi.testclient import TestClient


os.environ["APP_ENV"] = "development"
os.environ["DATABASE_URL"] = "sqlite:///./test_textile_factory.db"
os.environ["JWT_SECRET_KEY"] = "test-secret-key-with-at-least-32-characters"

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import main  # noqa: E402
from database import Base, engine  # noqa: E402


@pytest.fixture(scope="module")
def client():
    Base.metadata.create_all(bind=engine)
    with TestClient(main.app) as test_client:
        yield test_client


def test_health_endpoint(client):
    response = client.get("/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["app"] == "everest-textile-mills"


def test_owner_login_success(client):
    response = client.post(
        "/api/auth/login",
        json={"email": "owner@everestmills.com", "password": "everest123", "role": "owner"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["user"]["email"] == "owner@everestmills.com"
    assert payload["user"]["role"] == "owner"
    assert "token" in payload


def test_wrong_section_login_is_rejected(client):
    response = client.post(
        "/api/auth/login",
        json={"email": "owner@everestmills.com", "password": "everest123", "role": "buyer"},
    )
    assert response.status_code == 403
    assert "selected section" in response.json()["detail"]


def test_store_keeper_login_success(client):
    response = client.post(
        "/api/auth/login",
        json={"email": "store@everestmills.com", "password": "store123", "role": "store_keeper"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["user"]["role"] == "store_keeper"


def test_legacy_operator_role_is_not_accepted_for_registration(client):
    response = client.post(
        "/api/auth/register",
        json={
            "name": "Legacy Role",
            "email": "legacy@example.com",
            "password": "password123",
            "role": "operator",
        },
    )
    assert response.status_code == 400


def test_inventory_requires_authentication(client):
    response = client.get("/api/inventory/yarn")
    assert response.status_code == 401


def test_buyer_cannot_access_inventory(client):
    login = client.post(
        "/api/auth/login",
        json={"email": "buyer@everestmills.com", "password": "buyer123", "role": "buyer"},
    )
    response = client.get(
        "/api/inventory/yarn",
        headers={"Authorization": f"Bearer {login.json()['token']}"},
    )
    assert response.status_code == 403
