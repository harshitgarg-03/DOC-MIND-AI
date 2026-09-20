import jwt
from jwt import PyJWKClient
from fastapi import Header, HTTPException

# Better-Auth ka JWKS endpoint — yahan se public keys milte hain,
# private key FastAPI ko kabhi pata hi nahi chalti (secure by design)
JWKS_URL = "http://localhost:3000/api/auth/jwks"
jwk_client = PyJWKClient(JWKS_URL)


def get_current_user(authorization: str = Header(...)) -> str:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")

    token = authorization.split(" ")[1]

    try:
        signing_key = jwk_client.get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256", "EdDSA"],
            options={"verify_aud": False},
        )
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    return payload["sub"]   # Better-Auth ka user_id