"""Serve the repository and refresh a catalog older than 24 hours in the background.

Run: python music/tools/serve.py --port 8000
Open http://localhost:8000/music/ . Only one refresh runs in this process.
"""
import argparse
from datetime import datetime, timedelta, timezone
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import threading

from build_catalog import ROOT, build


def refresh_if_due(sources, output, workers=4):
    output = Path(output)
    try:
        data = json.loads(output.read_text(encoding="utf-8"))
        generated = datetime.fromisoformat(data["generatedAt"].replace("Z", "+00:00"))
        if datetime.now(timezone.utc) - generated < timedelta(hours=24):
            return False
    except (OSError, ValueError, KeyError, TypeError):
        pass
    print("Catalog refresh started in the background.", flush=True)
    try:
        return build(sources, output, workers=workers)
    except (OSError, ValueError, TypeError) as exc:
        print("Catalog refresh failed; previous catalog retained:", exc, flush=True)
        return False


def refresh_loop(sources, output, stop, workers=4):
    while not stop.is_set():
        refresh_if_due(sources, output, workers)
        if stop.wait(3600):
            break


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--bind", default="127.0.0.1")
    parser.add_argument("--workers", type=int, default=4)
    args = parser.parse_args()
    if not 1 <= args.port <= 65535 or args.workers < 1:
        parser.error("port must be 1..65535; workers must be positive")
    handler = partial(SimpleHTTPRequestHandler, directory=str(ROOT))
    server = ThreadingHTTPServer((args.bind, args.port), handler)
    stop = threading.Event()
    refresher = threading.Thread(target=refresh_loop, args=(ROOT / "music/data/sources.json", ROOT / "music/data/catalog.json", stop, args.workers), daemon=True)
    refresher.start()
    print("Serving http://" + args.bind + ":" + str(args.port) + "/music/", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        stop.set()
        server.server_close()


if __name__ == "__main__":
    main()
