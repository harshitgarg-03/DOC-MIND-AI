from slowapi import Limiter
from slowapi.util import get_remote_address
from fastapi import Request

from app.core.auth import try_get_user_id


def rate_limit_key(request: Request) -> str:
    """
    Logged-in user ho to uska user_id use karo (fair, per-account limiting).
    Token missing/invalid ho to IP-address pe fallback karo — taaki
    anonymous/malformed requests bhi bina limit ke spam na kar sakें.
    """
    user_id = try_get_user_id(request)
    return user_id if user_id else f"ip:{get_remote_address(request)}"


limiter = Limiter(key_func=rate_limit_key)