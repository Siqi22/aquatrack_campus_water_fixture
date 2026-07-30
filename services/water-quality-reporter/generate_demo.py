"""End-to-end demo: parse the IEH PDF, generate a DOCX memo.

Run:  python generate_demo.py
"""
from datetime import date
from pathlib import Path

from wqr import (
    FixtureRegistry, ReportContext, parse_ieh_pdf, parse_ieh_wide_csv,
    load_profile, render_pdf, render_docx,
)


HERE = Path(__file__).parent
DATA = HERE / "data"
OUTPUT = HERE / "output"
UPLOADS = Path("/mnt/user-data/uploads")


def main():
    registry = FixtureRegistry(DATA / "fixtures.json")

    # Prefer the actual lab PDF as the primary input source
    pdf_path = UPLOADS / "1766731-IAL-Katya_Cherukumili-04082661857.pdf"
    csv_path = DATA / "ieh_april2026.csv"

    if pdf_path.exists():
        print(f"Parsing lab PDF: {pdf_path.name}")
        samples = parse_ieh_pdf(pdf_path)
    else:
        print(f"Falling back to CSV: {csv_path}")
        samples = parse_ieh_wide_csv(csv_path)

    # Filter to Art Building fixtures
    art_fixture_ids = {f.fixture_id for f in registry.by_building("Art Building")}
    samples = [s for s in samples if s.fixture_id in art_fixture_ids]
    print(f"Matched {len(samples)} samples to Art Building fixtures")

    levels = load_profile("wa_k12_5ppb")

    ctx = ReportContext(
        building="Art Building",
        report_date=date(2026, 4, 22),
        sampling_date_range="April 7, 2026",
        introduction_md=(
            "This message is to inform you that the Environmental Health & Safety "
            "Department (EH&S) and UW Facilities (UWF) conducted follow-up water "
            "sampling on porcelain water fountains that remain in service in the "
            "Art Building, following the December 2025 fixture replacement effort.\n\n"
            "The porcelain fountains in the Art Building are believed to be original "
            "to the building, which opened in 1949. These fountains were retested "
            "to verify post-remediation water quality. The water was tested for "
            "iron, lead, copper, manganese, and zinc using a state-accredited "
            "laboratory (IEH Laboratories, Seattle, WA)."
        ),
        actions_taken_md=(
            "**1. Continued Replacement:** As part of the campus-wide effort to "
            "upgrade water infrastructure, UW Facilities continues replacing the "
            "remaining porcelain water fountains with bottle refill stations "
            "containing NSF/ANSI-certified lead-free parts and activated carbon "
            "filters.\n\n"
            "**2. Out-of-Service Posting:** Fixtures exceeding the action level "
            "in this round will be posted out of service pending replacement."
        ),
        contacts=[
            {"name": "Abebe Aberra",
             "title": "Environmental Public Health Manager",
             "phone": "206-616-1623", "email": "aberra@uw.edu"},
            {"name": "Dennis Garberg",
             "title": "UW Facilities Associate Director",
             "phone": "206-221-6501", "email": "dgarberg@uw.edu"},
        ],
        samples=samples,
        action_levels=levels,
        analytes_shown=["Lead", "Iron", "Copper"],
        notes_md=(
            "This report was generated automatically from IEH Laboratories "
            "Certificate of Analysis IAL-87110."
        ),
    )

    OUTPUT.mkdir(exist_ok=True)
    docx_path = OUTPUT / "art_building_2026-04.docx"
    pdf_out  = OUTPUT / "art_building_2026-04.pdf"
    render_docx(ctx, registry, docx_path)
    render_pdf(ctx, registry, pdf_out)
    print(f"Wrote {docx_path}")
    print(f"Wrote {pdf_out}")


if __name__ == "__main__":
    main()
