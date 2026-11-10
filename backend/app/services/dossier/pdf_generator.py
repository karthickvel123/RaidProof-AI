import os
from pathlib import Path
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    Image as RLImage,
    KeepTogether
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

from app.core.config import settings

# Register Nirmala Tamil font if present
FONT_PATH = Path(settings.FONTS_DIR) / "Nirmala.ttc"
if FONT_PATH.exists():
    try:
        pdfmetrics.registerFont(TTFont("TamilFont", str(FONT_PATH), subfontIndex=0))
        DEFAULT_FONT = "TamilFont"
    except Exception:
        DEFAULT_FONT = "Helvetica"
else:
    DEFAULT_FONT = "Helvetica"

class DossierPDFGenerator:
    """
    Generates bilingual (Tamil/English) Self-Declared Evidence Dossier PDF.
    Strictly an evidence compilation assistant for farmers — NOT an official government form.
    """

    @classmethod
    def generate(
        cls,
        incident_data: Dict[str, Any],
        output_filename: Optional[str] = None,
        is_sample: bool = False
    ) -> str:
        """
        Renders the PDF document and returns the absolute file path.
        """
        is_demo_sample = is_sample or incident_data.get("is_sample", False)
        code = incident_data.get("incident_code", "RPD-2026-VAL-001")
        if not output_filename:
            output_filename = f"dossier_{code}.pdf"

        output_path = Path(settings.DOSSIER_DIR) / output_filename
        output_path.parent.mkdir(parents=True, exist_ok=True)

        # Set up A4 document with 34pt margins
        doc = SimpleDocTemplate(
            str(output_path),
            pagesize=A4,
            leftMargin=34,
            rightMargin=34,
            topMargin=24,
            bottomMargin=24
        )

        styles = getSampleStyleSheet()

        # Custom typography styles
        sample_banner_style = ParagraphStyle(
            "SampleBannerStyle",
            fontName=DEFAULT_FONT,
            fontSize=8.5,
            leading=11,
            textColor=colors.HexColor("#991B1B"),
            alignment=1
        )
        title_main = ParagraphStyle(
            "TitleMain",
            fontName=DEFAULT_FONT,
            fontSize=11.5,
            leading=15,
            textColor=colors.HexColor("#0F5132"),
            alignment=1,
            spaceAfter=2
        )
        title_sub = ParagraphStyle(
            "TitleSub",
            fontName=DEFAULT_FONT,
            fontSize=8.0,
            leading=10,
            textColor=colors.HexColor("#374151"),
            alignment=1,
            spaceAfter=4
        )
        disclaimer_style = ParagraphStyle(
            "DisclaimerStyle",
            fontName=DEFAULT_FONT,
            fontSize=7.2,
            leading=9.5,
            textColor=colors.HexColor("#78350F"),
            alignment=1
        )
        section_heading = ParagraphStyle(
            "SectionHeading",
            fontName=DEFAULT_FONT,
            fontSize=8.5,
            leading=11.5,
            textColor=colors.white,
            spaceBefore=3,
            spaceAfter=2
        )
        cell_bold = ParagraphStyle(
            "CellBold",
            fontName=DEFAULT_FONT,
            fontSize=7.5,
            leading=10.0,
            textColor=colors.HexColor("#111827")
        )
        cell_normal = ParagraphStyle(
            "CellNormal",
            fontName=DEFAULT_FONT,
            fontSize=7.5,
            leading=10.0,
            textColor=colors.HexColor("#374151")
        )
        cell_sub = ParagraphStyle(
            "CellSub",
            fontName=DEFAULT_FONT,
            fontSize=6.8,
            leading=8.8,
            textColor=colors.HexColor("#4B5563"),
            alignment=1
        )

        story = []

        # 0. Prominent Sample Warning Banner if Sample/Demo PDF
        if is_demo_sample:
            sample_warning_text = (
                "<b>*** மாதிரி ஆவணம் / மாதிரி தரவு மட்டுமே — உண்மை அறிக்கை அல்ல ***<br/>"
                "(SAMPLE / DEMONSTRATION DATA ONLY — NOT AN ACTUAL INCIDENT REPORT — NOT A GOVERNMENT FORM)</b>"
            )
            sample_table = Table([[Paragraph(sample_warning_text, sample_banner_style)]], colWidths=[527])
            sample_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#FEE2E2")),
                ('BOX', (0, 0), (-1, -1), 1.2, colors.HexColor("#DC2626")),
                ('TOPPADDING', (0, 0), (-1, -1), 4),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
                ('LEFTPADDING', (0, 0), (-1, -1), 6),
                ('RIGHTPADDING', (0, 0), (-1, -1), 6),
            ]))
            story.append(sample_table)
            story.append(Spacer(1, 3))

        # 1. Header Banner — Explicitly Not an Official Government Form
        header_text = "<b>விவசாயியின் சுய அறிவிப்பு வனவிலங்கு பயிர்ச்சேத சான்றாவணம் (அரசு ஆவணம் அல்ல)</b>"
        header_sub = "Self-Declared Wildlife Crop Damage Evidence Dossier — Not an Official Government Form"
        story.append(Paragraph(header_text, title_main))
        story.append(Paragraph(header_sub, title_sub))

        # Prominent Legal Disclaimer Box
        disclaimer_text = (
            "<b>சுய சான்று அறிவிப்பு:</b> இந்த ஆவணம் விவசாயியால் இழப்பீட்டு விண்ணப்பத்திற்கு ஆதாரங்களை "
            "ஒழுங்கமைக்க தயார் செய்யப்பட்ட சுய அறிவிப்பு சான்றாவணமாகும். இது அதிகாரப்பூர்வ அரசு ஆவணம் அல்ல; "
            "அரசு சரிபார்ப்பையோ அல்லது இழப்பீட்டு ஒப்புதலையோ உறுதிப்படுத்தாது.<br/>"
            "<i>(Cultivator Self-Declaration: Prepared strictly as a farmer evidence compilation aid. "
            "Not an official government form. Does not constitute official approval, verification, or compensation guarantee.)</i>"
        )
        disclaimer_table = Table([[Paragraph(disclaimer_text, disclaimer_style)]], colWidths=[527])
        disclaimer_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#FEF3C7")),
            ('BOX', (0, 0), (-1, -1), 0.75, colors.HexColor("#F59E0B")),
            ('TOPPADDING', (0, 0), (-1, -1), 3),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
            ('LEFTPADDING', (0, 0), (-1, -1), 6),
            ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ]))
        story.append(disclaimer_table)
        story.append(Spacer(1, 4))

        # Dossier ID and Date Metadata Row
        date_str = datetime.now(timezone.utc).strftime("%d-%m-%Y")
        meta_table = Table(
            [
                [
                    Paragraph(f"<b>சான்றாவண எண் (Dossier ID):</b> {code}", cell_bold),
                    Paragraph(f"<b>தயாரிக்கப்பட்ட தேதி (Date):</b> {date_str}", cell_bold)
                ]
            ],
            colWidths=[300, 227]
        )
        meta_table.setStyle(TableStyle([
            ('LINEBELOW', (0, 0), (-1, -1), 1.2, colors.HexColor("#0F5132")),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ]))
        story.append(meta_table)
        story.append(Spacer(1, 3))

        # Section Header Helper
        def make_section_header(title_text):
            t = Table([[Paragraph(f"<b>{title_text}</b>", section_heading)]], colWidths=[527])
            t.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#0F5132")),
                ('TOPPADDING', (0, 0), (-1, -1), 2.0),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 2.0),
                ('LEFTPADDING', (0, 0), (-1, -1), 6),
            ]))
            return t

        # 2. Part 1: Cultivator & Land Details
        story.append(make_section_header("பகுதி 1: விவசாயி & நில விவரங்கள் (Cultivator & Land Holding Details)"))
        farmer = incident_data.get("farmer", {})
        parcel = incident_data.get("parcel", {})

        farmer_name = farmer.get("name") or "குறிப்பிடப்படவில்லை (Not Provided)"
        farmer_phone = farmer.get("phone") or "குறிப்பிடப்படவில்லை (Not Provided)"
        farmer_village = farmer.get("village") or "குறிப்பிடப்படவில்லை"
        farmer_taluk = farmer.get("taluk") or "குறிப்பிடப்படவில்லை"
        farmer_aadhaar = farmer.get("aadhaar_last4") or "----"

        patta_str = str(parcel.get("patta_number") or "குறிப்பிடப்படவில்லை (Not Provided)")
        survey_str = str(parcel.get("survey_number") or "குறிப்பிடப்படவில்லை (Not Provided)")
        area_val = parcel.get("area_acres")
        area_str = f"{area_val} ஏக்கர் (Acres)" if area_val is not None else "குறிப்பிடப்படவில்லை (Not Provided)"
        crop_str = str(parcel.get("crop") or "குறிப்பிடப்படவில்லை (Not Provided)")

        p1_data = [
            [
                Paragraph("<b>விவசாயி பெயர்:</b>", cell_bold),
                Paragraph(farmer_name, cell_normal),
                Paragraph("<b>தொலைபேசி:</b>", cell_bold),
                Paragraph(farmer_phone, cell_normal),
            ],
            [
                Paragraph("<b>கிராமம் / வட்டம்:</b>", cell_bold),
                Paragraph(f"{farmer_village} / {farmer_taluk}", cell_normal),
                Paragraph("<b>ஆதார் (கடைசி 4):</b>", cell_bold),
                Paragraph(f"XXXX-XXXX-{farmer_aadhaar}", cell_normal),
            ],
            [
                Paragraph("<b>பட்டா எண் (சுய பதிவு):</b>", cell_bold),
                Paragraph(patta_str, cell_normal),
                Paragraph("<b>சர்வே எண்:</b>", cell_bold),
                Paragraph(survey_str, cell_normal),
            ],
            [
                Paragraph("<b>சுய அறிவிப்பு நிலப்பரப்பு:</b>", cell_bold),
                Paragraph(area_str, cell_normal),
                Paragraph("<b>பயிரிடப்பட்ட பயிர்:</b>", cell_bold),
                Paragraph(crop_str, cell_normal),
            ]
        ]
        t1 = Table(p1_data, colWidths=[115, 148, 115, 149])
        t1.setStyle(TableStyle([
            ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor("#D1D5DB")),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#E5E7EB")),
            ('TOPPADDING', (0, 0), (-1, -1), 2.0),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 2.0),
        ]))
        story.append(t1)
        story.append(Spacer(1, 4))

        # 3. Part 2: Wildlife Damage Details (Farmer Declared)
        story.append(make_section_header("பகுதி 2: விவசாயி அறிவித்த சேத விவரங்கள் (Farmer-Declared Incident Details)"))
        inc = incident_data.get("incident", {})
        qty_val = inc.get("quantity", 0)
        qty_display = int(qty_val) if isinstance(qty_val, float) and qty_val.is_integer() else qty_val

        p2_data = [
            [
                Paragraph("<b>தாக்கியதாக கூறப்படும் வனவிலங்கு:</b>", cell_bold),
                Paragraph(f"{inc.get('wildlife_tamil', 'காட்டு விலங்கு')} ({inc.get('wildlife_en', 'WILDLIFE')})", cell_normal),
                Paragraph("<b>சேதமடைந்த பயிர்:</b>", cell_bold),
                Paragraph(f"{inc.get('crop_tamil', 'பயிர்')} ({inc.get('crop_en', 'CROP')})", cell_normal),
            ],
            [
                Paragraph("<b>அறிவிக்கப்பட்ட சேத அளவு:</b>", cell_bold),
                Paragraph(f"<b>{qty_display} {inc.get('unit_tamil', 'அளவீடு')}</b>", cell_bold),
                Paragraph("<b>கூறப்படும் சம்பவ நேரம்:</b>", cell_bold),
                Paragraph(str(inc.get("time_approx", "குறிப்பிடப்படவில்லை")), cell_normal),
            ],
            [
                Paragraph("<b>குரல் வாக்குமூலம்:</b>", cell_bold),
                Paragraph(f"<i>\"{inc.get('voice_transcript', 'விவரம் பதிவு செய்யப்படவில்லை')}\"</i>", cell_normal),
                Paragraph("<b>சேதத்தின் தன்மை:</b>", cell_bold),
                Paragraph(str(inc.get("attack_pattern", "பயிர்ச்சேதம்")), cell_normal),
            ]
        ]
        t2 = Table(p2_data, colWidths=[115, 148, 115, 149])
        t2.setStyle(TableStyle([
            ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor("#D1D5DB")),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#E5E7EB")),
            ('TOPPADDING', (0, 0), (-1, -1), 2.0),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 2.0),
        ]))
        story.append(t2)
        story.append(Spacer(1, 4))

        # 4. Part 3: Farmer-Submitted Photographs & Location Metadata (Preserve all photos)
        story.append(make_section_header("பகுதி 3: விவசாயி சமர்ப்பித்த புகைப்படங்கள் & இருப்பிட தகவல் (Farmer-Submitted Evidence Photos)"))
        photos_list: List[Dict[str, Any]] = incident_data.get("photos_list", [])

        # Legacy fallback if photos_list not passed
        if not photos_list and "photos" in incident_data:
            legacy_p = incident_data["photos"]
            if legacy_p.get("wide_path"):
                photos_list.append({"photo_type": "WIDE_ANGLE", "file_path": legacy_p["wide_path"]})
            if legacy_p.get("spoor_path"):
                photos_list.append({"photo_type": "CLOSE_UP_SPOOR", "file_path": legacy_p["spoor_path"]})

        def render_photo_cell(p_data: Optional[Dict[str, Any]], default_label: str):
            if p_data and p_data.get("file_path") and os.path.exists(p_data["file_path"]):
                try:
                    img_elem = RLImage(p_data["file_path"], width=250, height=120)
                except Exception:
                    img_elem = None
            else:
                img_elem = None

            if not img_elem:
                img_elem = Table([[Paragraph(f"<br/><br/>[ {default_label} ]<br/>விவசாயி புகைப்படம் இணைக்கப்படவில்லை", cell_sub)]], colWidths=[250], rowHeights=[120])
                img_elem.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#F3F4F6")),
                    ('BOX', (0, 0), (-1, -1), 0.75, colors.HexColor("#9CA3AF")),
                    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ]))

            # Determine caption & GPS provenance for this photo
            if p_data and p_data.get("latitude") is not None and p_data.get("longitude") is not None:
                acc_txt = f" ±{p_data['accuracy']:.0f}மீ" if p_data.get("accuracy") else ""
                prov_txt = p_data.get("provenance", "சாதன இருப்பிடம்")
                caption_text = (
                    f"<b>{default_label}</b><br/>"
                    f"இருப்பிடம்: {p_data['latitude']:.5f}°N, {p_data['longitude']:.5f}°E{acc_txt} ({prov_txt}) — சரிபார்க்கப்படாத பதிவு"
                )
            else:
                gps_gen = incident_data.get("gps")
                if gps_gen and gps_gen.get("lat") is not None and gps_gen.get("lon") is not None:
                    acc_txt = f" ±{gps_gen['accuracy']:.0f}மீ" if gps_gen.get("accuracy") else ""
                    prov_txt = gps_gen.get("provenance", "சாதன இருப்பிடம்")
                    caption_text = (
                        f"<b>{default_label}</b><br/>"
                        f"இருப்பிடம்: {gps_gen['lat']:.5f}°N, {gps_gen['lon']:.5f}°E{acc_txt} ({prov_txt}) — சரிபார்க்கப்படாத பதிவு"
                    )
                else:
                    caption_text = (
                        f"<b>{default_label}</b><br/>"
                        f"இருப்பிடம்: பதிவு செய்யப்படவில்லை (No GPS Recorded)"
                    )

            caption_elem = Paragraph(caption_text, cell_sub)
            return img_elem, caption_elem

        type_names = {
            "WIDE_ANGLE": "முழுத்தோற்ற சேத படம் (Wide View)",
            "CLOSE_UP_SPOOR": "விலங்கு தடம் / சேத அடையாளம் (Close-up)",
            "SCALE_REF": "அளவீட்டு குறிப்பு (Scale Reference)",
            "OTHER": "கூடுதல் சான்று (Additional Photo)"
        }

        # Build 2-column grid of photos
        photo_grid_rows = []
        if not photos_list:
            # Default placeholder pair
            i1, c1 = render_photo_cell(None, type_names["WIDE_ANGLE"])
            i2, c2 = render_photo_cell(None, type_names["CLOSE_UP_SPOOR"])
            photo_grid_rows.append([i1, i2])
            photo_grid_rows.append([c1, c2])
        else:
            # Pair photos in twos
            for i in range(0, len(photos_list), 2):
                p1 = photos_list[i]
                lbl1 = type_names.get(p1.get("photo_type", "WIDE_ANGLE"), "சான்று புகைப்படம்")
                i1, c1 = render_photo_cell(p1, lbl1)

                if i + 1 < len(photos_list):
                    p2 = photos_list[i + 1]
                    lbl2 = type_names.get(p2.get("photo_type", "CLOSE_UP_SPOOR"), "சான்று புகைப்படம்")
                    i2, c2 = render_photo_cell(p2, lbl2)
                else:
                    i2, c2 = Paragraph("", cell_sub), Paragraph("", cell_sub)

                photo_grid_rows.append([i1, i2])
                photo_grid_rows.append([c1, c2])

        photo_table = Table(photo_grid_rows, colWidths=[260, 267])
        photo_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 1.5),
            ('TOPPADDING', (0, 0), (-1, -1), 1.5),
        ]))
        story.append(photo_table)
        story.append(Spacer(1, 4))

        # 5. Part 4: Document Enclosure Checklist (Self-Reported)
        story.append(make_section_header("பகுதி 4: விவசாயி இணைத்துள்ள ஆவண பட்டியல் (Self-Reported Document Checklist)"))
        chk = incident_data.get("checklist", {})
        status_tag = lambda ready: "இணைக்கப்பட்டுள்ளது (Attached)" if ready else "நிலுவை (Pending)"

        p4_data = [
            [
                Paragraph("பட்டா / சிட்டா நகல்:", cell_bold),
                Paragraph(status_tag(chk.get("patta", False)), cell_normal),
                Paragraph("VAO அடங்கல் சான்று:", cell_bold),
                Paragraph(status_tag(chk.get("adangal", False)), cell_normal),
            ],
            [
                Paragraph("வங்கி கணக்கு புத்தகம்:", cell_bold),
                Paragraph(status_tag(chk.get("bank", False)), cell_normal),
                Paragraph("ஆதார் அடையாள அட்டை:", cell_bold),
                Paragraph(status_tag(chk.get("aadhaar", False)), cell_normal),
            ],
            [
                Paragraph("அண்டை நில சாட்சி விவரம்:", cell_bold),
                Paragraph(status_tag(chk.get("witness", False)), cell_normal),
                Paragraph("சான்றாவண நிலை:", cell_bold),
                Paragraph("சுய அறிவிப்பு தயார் (Self-Declared)", cell_normal),
            ]
        ]
        t4 = Table(p4_data, colWidths=[130, 133, 130, 134])
        t4.setStyle(TableStyle([
            ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor("#D1D5DB")),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#E5E7EB")),
            ('TOPPADDING', (0, 0), (-1, -1), 2.0),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 2.0),
        ]))
        story.append(t4)
        story.append(Spacer(1, 6))

        # 6. Part 5: Farmer Self-Declaration & Witness Signatures (No Officer Approval)
        sig_data = [
            [
                Paragraph("<br/><br/>______________________<br/><b>விவசாயியின் உறுதிமொழி கையொப்பம்</b><br/>(Applicant Cultivator Signature)", cell_bold),
                Paragraph("<br/><br/>______________________<br/><b>அண்டை நில சாட்சி 1</b><br/>(Adjacent Land Witness 1)", cell_bold),
                Paragraph("<br/><br/>______________________<br/><b>அண்டை நில சாட்சி 2</b><br/>(Adjacent Land Witness 2)", cell_bold)
            ]
        ]
        sig_table = Table(sig_data, colWidths=[175, 176, 176])
        sig_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ]))
        story.append(KeepTogether(sig_table))

        # Bottom Administrative Notice
        admin_notice = Paragraph(
            "<br/><b>முக்கிய குறிப்பு:</b> மேலே குறிப்பிடப்பட்ட விவரங்கள் யாவும் விவசாயியால் சுயமாக தெரிவிக்கப்பட்டவை. "
            "இழப்பீட்டுத் தொகையை இறுதி செய்தல் மற்றும் நேரடி கள ஆய்வு ஆகியவை துறை அதிகாரிகளின் அதிகார வரம்பிற்கு உட்பட்டது. "
            "இந்த சான்றாவணம் எந்தவொரு அரசு அலுவலக ஒப்புதலையும் பிரதிபலிக்காது.",
            cell_sub
        )
        story.append(admin_notice)

        # Build PDF
        doc.build(story)
        return str(output_path)
