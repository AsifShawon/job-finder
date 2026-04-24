from app.core.security import create_token, decode_token, get_password_hash, verify_password


def test_password_hash_roundtrip() -> None:
    raw = "StrongPass123!"
    hashed = get_password_hash(raw)
    assert verify_password(raw, hashed)


def test_token_roundtrip() -> None:
    token = create_token("1", expires_delta=__import__("datetime").timedelta(minutes=5), token_type="access")
    payload = decode_token(token)
    assert payload["sub"] == "1"
    assert payload["type"] == "access"
