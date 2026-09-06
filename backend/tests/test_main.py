from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_read_main():
    # Example simple test to verify the app can be initialized
    # A real test would mock the LangChain agents so we don't hit the API during tests.
    assert app.title == "Synthesia API"
