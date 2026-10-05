#!/usr/bin/env python3
"""Assemble the edition from the written stories and the credited photographs."""
from __future__ import annotations

import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
CONTENT = ROOT / "content"
CREDITS = json.loads((ROOT / "assets" / "img" / "credits.json").read_text())
RESPONSIVE_FILE = ROOT / "assets" / "img" / "responsive.json"
RESPONSIVE = json.loads(RESPONSIVE_FILE.read_text()) if RESPONSIVE_FILE.exists() else {}


def jpeg_size(path: pathlib.Path):
    """Intrinsic width/height of a JPEG, read from its SOF marker.

    Emitting these lets the browser reserve the right box before the photograph
    arrives, which is what keeps the page from shifting under the reader.
    """
    try:
        data = path.read_bytes()
    except OSError:
        return None
    if data[:2] != b"\xff\xd8":
        return None
    i = 2
    sof = {0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF}
    while i < len(data) - 9:
        if data[i] != 0xFF:
            i += 1
            continue
        marker = data[i + 1]
        if marker in sof:
            height = int.from_bytes(data[i + 5:i + 7], "big")
            width = int.from_bytes(data[i + 7:i + 9], "big")
            return width, height
        if marker == 0xD8 or 0xD0 <= marker <= 0xD9:
            i += 2
            continue
        i += 2 + int.from_bytes(data[i + 2:i + 4], "big")
    return None


def load(name: str):
    return json.loads((CONTENT / name).read_text())


BRIEFS_FILE = CONTENT / "briefs.json"
BRIEFS = json.loads(BRIEFS_FILE.read_text()) if BRIEFS_FILE.exists() else []
SETTLE_FILE = CONTENT / "settle.json"
SETTLE = json.loads(SETTLE_FILE.read_text()) if SETTLE_FILE.exists() else []
NUMBERS_FILE = CONTENT / "numbers.json"
NUMBERS = json.loads(NUMBERS_FILE.read_text()) if NUMBERS_FILE.exists() else []


def credit_for(slug: str) -> dict:
    c = CREDITS.get(slug) or {}
    artist = (c.get("artist") or "").strip()
    lic = (c.get("license") or "").strip()
    label = "Photo: " + (artist if artist else "Wikimedia Commons")
    if lic:
        label += " / " + lic
    src = "assets/img/" + c.get("file", slug + ".jpg")
    out = {
        "src": src,
        "credit": label,
        "page": c.get("page") or "",
    }
    size = jpeg_size(ROOT / src)
    if size:
        out["w"], out["h"] = size
    widths = (RESPONSIVE.get(slug) or {}).get("widths") or []
    if widths:
        out["webp"] = ", ".join(
            "assets/img/%s-%d.webp %dw" % (slug, w, w) for w in widths)
    return out


def attach(story: dict) -> dict:
    s = dict(story)
    if s.get("image"):
        s["photo"] = credit_for(s["image"])
    return s


def briefs_for(name: str) -> list:
    """Short items from the reporting round, filed against a section name."""
    return [b for b in BRIEFS if b.get("section") == name]


def numbers_for(name: str) -> list:
    """The 'Numbers on the Record' strip for a section, if it has one."""
    return [n for n in NUMBERS if n.get("section") == name]


front = [attach(s) for s in load("front.json")]
sections = [
    ("The Machine", "Where the models, the proofs and the code are made",
     [attach(s) for s in load("machine.json")]),
    ("The Money", "Capital, revenue and the wires that carry them",
     [attach(s) for s in load("money.json")]),
    ("The Rules", "Who writes the constraints, and who avoids them",
     [attach(s) for s in load("rules.json")]),
    ("The Work", "Jobs, companies and the machines arriving on the floor",
     [attach(s) for s in load("work.json")]),
    ("The World", "Medicine, schools, security and the public mood",
     [attach(s) for s in load("world.json")]),
    ("The Press", "How this edition was reported and printed",
     [attach(s) for s in load("press.json")]),
]
section_objs = [
    {"name": n, "standfirst": s, "stories": st, "briefs": briefs_for(n),
     "numbers": numbers_for(n)}
    for n, s, st in sections
]

sources = []
for st in front:
    for src in st.get("sources", []):
        sources.append({"section": "Front Page", "story": st["headline"], **src})
for sec in section_objs:
    for st in sec["stories"]:
        for src in st.get("sources", []):
            sources.append({"section": sec["name"], "story": st["headline"], **src})
for b in BRIEFS:
    for src in b.get("sources", []):
        sources.append({
            "section": b.get("section") or "Front Page",
            "story": "In Brief: " + b["headline"],
            **src,
        })

edition = {
    "masthead": {
        "name": "The Josty",
        "tagline": "All the Intelligence Fit to Print",
        "volume": "Vol. I",
        "issue": "No. 1",
        "date": "Monday, October 5, 2026",
        "price": "One Query",
        "place": "New York",
    },
    "front": front,
    "frontBriefs": briefs_for("Front Page"),
    "settle": SETTLE,
    "sections": section_objs,
    "sources": sources,
}
(ROOT / "data").mkdir(exist_ok=True)
# The .json stays indented for reading; the .js is what browsers download, so it
# carries no spaces after its separators.
(ROOT / "data" / "edition.json").write_text(json.dumps(edition, ensure_ascii=False, indent=1))
(ROOT / "data" / "edition.js").write_text(
    "window.EDITION = " + json.dumps(edition, ensure_ascii=False, separators=(",", ":")) + ";\n")
print(json.dumps({
    "front": len(front),
    "front_briefs": len(edition["frontBriefs"]),
    "sections": [{"name": s["name"], "stories": len(s["stories"]),
                  "briefs": len(s["briefs"])} for s in section_objs],
    "stories": len(front) + sum(len(s["stories"]) for s in section_objs),
    "briefs": len(BRIEFS),
    "sources": len(sources),
    "kb": round((ROOT / "data" / "edition.js").stat().st_size / 1024),
}, indent=1))
