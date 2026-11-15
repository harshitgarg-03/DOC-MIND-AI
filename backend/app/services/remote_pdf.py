import ipaddress
import logging
import re
import socket
from urllib.parse import unquote, urljoin, urlparse

import httpx
from fastapi import HTTPException

logger = logging.getLogger(__name__)

MAX_PDF_BYTES = 25 * 1024 * 1024  # 25 MB
MAX_REDIRECTS = 5
TIMEOUT = httpx.Timeout(connect=10.0, read=30.0, write=10.0, pool=10.0)
HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; DocMindBot/1.0)",
    "Accept": "application/pdf,*/*;q=0.8",
}


def _assert_public_url(url: str) -> None:
    """Only http(s), and the host must resolve to a public IP (SSRF protection)."""
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        raise HTTPException(status_code=400, detail="Please provide a valid http(s) link.")

    try:
        infos = socket.getaddrinfo(parsed.hostname, None)
    except socket.gaierror:
        raise HTTPException(status_code=400, detail="Could not resolve the host of this link.")

    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_multicast
            or ip.is_reserved
            or ip.is_unspecified
        ):
            raise HTTPException(
                status_code=400,
                detail="Links to private or internal addresses are not allowed.",
            )


def _pick_filename(url: str, content_disposition: str | None) -> str:
    name = ""
    if content_disposition:
        m = re.search(r"filename\*?=(?:UTF-8'')?\"?([^\";]+)\"?", content_disposition, re.I)
        if m:
            name = unquote(m.group(1))
    if not name:
        name = unquote(urlparse(url).path.rsplit("/", 1)[-1])

    name = re.sub(r"[^\w.\- ()]", "_", name).strip()[:120] or "document"
    if not name.lower().endswith(".pdf"):
        name += ".pdf"
    return name


def download_pdf(url: str) -> tuple[bytes, str]:
    """Download a remote PDF safely. Returns (file_bytes, filename)."""
    current = url

    with httpx.Client(timeout=TIMEOUT, follow_redirects=False, headers=HEADERS) as client:
        for _ in range(MAX_REDIRECTS + 1):
            _assert_public_url(current)  # re-checked on every redirect hop

            try:
                with client.stream("GET", current) as resp:
                    if resp.is_redirect:
                        location = resp.headers.get("location")
                        if not location:
                            raise HTTPException(status_code=400, detail="Invalid redirect from remote server.")
                        current = urljoin(current, location)
                        continue

                    if resp.status_code != 200:
                        raise HTTPException(
                            status_code=400,
                            detail=f"Remote server returned status {resp.status_code}.",
                        )

                    declared = resp.headers.get("content-length")
                    if declared and declared.isdigit() and int(declared) > MAX_PDF_BYTES:
                        raise HTTPException(status_code=413, detail="PDF is too large (max 25 MB).")

                    buf = bytearray()
                    for chunk in resp.iter_bytes(65536):
                        buf.extend(chunk)
                        if len(buf) > MAX_PDF_BYTES:
                            raise HTTPException(status_code=413, detail="PDF is too large (max 25 MB).")

                    data = bytes(buf)
                    if b"%PDF" not in data[:1024]:
                        raise HTTPException(status_code=400, detail="This link does not point to a valid PDF file.")

                    filename = _pick_filename(current, resp.headers.get("content-disposition"))
                    return data, filename

            except httpx.TimeoutException:
                raise HTTPException(status_code=504, detail="The remote server took too long to respond.")
            except httpx.HTTPError:
                logger.exception("Remote PDF download failed")
                raise HTTPException(status_code=400, detail="Could not download the PDF from this link.")

    raise HTTPException(status_code=400, detail="Too many redirects.")