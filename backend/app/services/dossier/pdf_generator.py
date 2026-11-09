import os
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, Optional

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

# Register Nirmala Tamil font
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
    Generates official A4 Bilingual (Tamil/English) Evidence Dossier PDF
    compliant with Tamil Nadu Forest Department ex-gratia compensation guidelines.
    """

    @classmethod
    def generate(
        cls,
        incident_data: Dict[str, Any],
        output_filename: Optional[str] = None
    ) -> str:
        """
        Renders the PDF document and returns the absolute file path.
        """
        code = incident_data.get("incident_code", "RPD-2026-VAL-001")
        if not output_filename:
            output_filename = f"dossier_{code}.pdf"

        output_path = Path(settings.DOSSIER_DIR) / output_filename

        # Set up A4 document with 12mm margins
        doc = SimpleDocTemplate(
            str(output_path),
            pagesize=A4,
            leftMargin=34,
            rightMargin=34,
            topMargin=30,
            bottomMargin=30
        )

        styles = getSampleStyleSheet()

        # Custom typography styles
        title_main = ParagraphStyle(
            "TitleMain",
            fontName=DEFAULT_FONT,
            fontSize=13,
            leading=16,
            textColor=colors.HexColor("#0F5132"),
            alignment=1,  # Center
            spaceAfter=3
        )
        title_sub = ParagraphStyle(
            "TitleSub",
            fontName=DEFAULT_FONT,
            fontSize=8.5,
            leading=11,
            textColor=colors.HexColor("#374151"),
            alignment=1,
            spaceAfter=8
        )
        section_heading = ParagraphStyle(
            "SectionHeading",
            fontName=DEFAULT_FONT,
            fontSize=9.5,
            leading=13,
            textColor=colors.white,
            spaceBefore=6,
            spaceAfter=4
        )
        cell_bold = ParagraphStyle(
            "CellBold",
            fontName=DEFAULT_FONT,
            fontSize=8.5,
            leading=11,
            textColor=colors.HexColor("#111827")
        )
        cell_normal = ParagraphStyle(
            "CellNormal",
            fontName=DEFAULT_FONT,
            fontSize=8.5,
            leading=11,
            textColor=colors.HexColor("#374151")
        )

        story = []

        # 1. Header Banner
        header_text = """
        <b>தமிழ்நாடு வனத்துறை - வனவிலங்கு பயிர்ச்சேத இழப்பீட்டு அறிக்கை</b>
        """
        header_sub = "TAMIL NADU FOREST DEPARTMENT - WILDLIFE CROP DAMAGE INTIMATION DOSSIER"
        story.append(Paragraph(header_text, title_main))
        story.append(Paragraph(header_sub, title_sub))

        # Dossier ID and Date Metadata Row
        date_str = datetime.utcnow().strftime("%d-%m-%Y")
        meta_table = Table(
            [
                [
                    Paragraph(f"<b>அறிக்கை எண் (Dossier ID):</b> {code}", cell_bold),
                    Paragraph(f"<b>தேதி (Date):</b> {date_str}", cell_bold)
                ]
            ],
            colWidths=[300, 227]
        )
        meta_table.setStyle(TableStyle([
            ('LINEBELOW', (0, 0), (-1, -1), 1.5, colors.HexColor("#0F5132")),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        story.append(meta_table)
        story.append(Spacer(1, 6))

        # Section Helper
        def make_section_header(title_text):
            t = Table([[Paragraph(f"<b>{title_text}</b>", section_heading)]], colWidths=[527])
            t.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#0F5132")),
                ('TOPPADDING', (0, 0), (-1, -1), 3),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
                ('LEFTPADDING', (0, 0), (-1, -1), 6),
            ]))
            return t

        # 2. Part 1: Farmer & Land Details
        story.append(make_section_header("பகுதி 1: விவசாயி & நில விவரங்கள் (Cultivator & Land Details)"))
        farmer = incident_data.get("farmer", {})
        parcel = incident_data.get("parcel", {})

        p1_data = [
            [
                Paragraph("<b>விவசாயி பெயர்:</b>", cell_bold),
                Paragraph(farmer.get("name", "செல்வம்"), cell_normal),
                Paragraph("<b>தொலைபேசி:</b>", cell_bold),
                Paragraph(farmer.get("phone", "9876543210"), cell_normal),
            ],
            [
                Paragraph("<b>கிராமம் / வட்டம்:</b>", cell_bold),
                Paragraph(f"{farmer.get('village', 'வால்பாறை')} / {farmer.get('taluk', 'வால்பாறை')}", cell_normal),
                Paragraph("<b>ஆதார் (கடைசி 4):</b>", cell_bold),
                Paragraph(f"XXXX-XXXX-{farmer.get('aadhaar_last4', '4589')}", cell_normal),
            ],
            [
                Paragraph("<b>பட்டா எண்:</b>", cell_bold),
                Paragraph(str(parcel.get("patta_number", "1042")), cell_normal),
                Paragraph("<b>சர்வே எண்:</b>", cell_bold),
                Paragraph(str(parcel.get("survey_number", "84/2A")), cell_normal),
            ],
            [
                Paragraph("<b>மொத்த நிலப்பரப்பு:</b>", cell_bold),
                Paragraph(f"{parcel.get('area_acres', 2.5)} ஏக்கர் (Acres)", cell_normal),
                Paragraph("<b>பயிரிடப்பட்ட பயிர்:</b>", cell_bold),
                Paragraph(parcel.get("crop", "வாழை (Banana)"), cell_normal),
            ]
        ]
        t1 = Table(p1_data, colWidths=[110, 153, 110, 154])
        t1.setStyle(TableStyle([
            ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor("#D1D5DB")),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#E5E7EB")),
            ('TOPPADDING', (0, 0), (-1, -1), 3),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ]))
        story.append(t1)
        story.append(Spacer(1, 6))

        # 3. Part 2: Wildlife Damage Details
        story.append(make_section_header("பகுதி 2: வனவிலங்கு பயிர்ச்சேத விவரங்கள் (Incident Details)"))
        inc = incident_data.get("incident", {})
        p2_data = [
            [
                Paragraph("<b>தாக்கிய வனவிலங்கு:</b>", cell_bold),
                Paragraph(f"{inc.get('wildlife_tamil', 'காட்டு யானை')} ({inc.get('wildlife_en', 'ELEPHANT')})", cell_normal),
                Paragraph("<b>சேதமடைந்த பயிர்:</b>", cell_bold),
                Paragraph(f"{inc.get('crop_tamil', 'வாழை')} ({inc.get('crop_en', 'BANANA')})", cell_normal),
            ],
            [
                Paragraph("<b>சேதத்தின் அளவு:</b>", cell_bold),
                Paragraph(f"<b>{inc.get('quantity', 40)} {inc.get('unit_tamil', 'மரங்கள்')}</b>", cell_bold),
                Paragraph("<b>சம்பவ நேரம்:</b>", cell_bold),
                Paragraph(inc.get("time_approx", "நேற்று இரவு 02:00 AM"), cell_normal),
            ],
            [
                Paragraph("<b>குரல் வாக்குமூலம்:</b>", cell_bold),
                Paragraph(f"<i>\"{inc.get('voice_transcript', 'யானை வந்து வாழை மரங்களை முறித்து தின்றது.')}\"</i>", cell_normal),
                Paragraph("<b>தாக்குதல் தன்மை:</b>", cell_bold),
                Paragraph(inc.get("attack_pattern", "மரங்களை முறித்து தின்றது"), cell_normal),
            ]
        ]
        t2 = Table(p2_data, colWidths=[110, 153, 110, 154])
        t2.setStyle(TableStyle([
            ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor("#D1D5DB")),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#E5E7EB")),
            ('TOPPADDING', (0, 0), (-1, -1), 3),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ]))
        story.append(t2)
        story.append(Spacer(1, 6))

        # 4. Part 3: Geotagged Photographic Proof
        story.append(make_section_header("பகுதி 3: புவிக்குறியீட்டு புகைப்பட சான்றுகள் (Geotagged Photographic Proof)"))
        photos = incident_data.get("photos", {})
        wide_photo_path = photos.get("wide_path")
        spoor_photo_path = photos.get("spoor_path")

        def get_photo_element(img_path, default_label):
            if img_path and os.path.exists(img_path):
                try:
                    return RLImage(img_path, width=250, height=135)
                except Exception:
                    pass
            # Placeholder box if no image uploaded yet
            ph_table = Table([[Paragraph(f"<br/><br/>[ {default_label} ]<br/>புகைப்படம் இணைக்கப்படும்", cell_sub)]], colWidths=[250], rowHeights=[135])
            ph_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#F3F4F6")),
                ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#9CA3AF")),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ]))
            return ph_table

        cell_sub = ParagraphStyle("CellSub", fontName=DEFAULT_FONT, fontSize=7.5, leading=10, textColor=colors.HexColor("#4B5563"), alignment=1)

        img1 = get_photo_element(wide_photo_path, "முழுத்தோற்ற சேத படம் (Wide View)")
        img2 = get_photo_element(spoor_photo_path, "விலங்கு தடம் / சேத அடையாளம் (Spoor Close-up)")

        gps_info = incident_data.get("gps", {"lat": 10.324512, "lon": 76.951234})
        meta1 = Paragraph(f"<b>பார்வை:</b> முழுத்தோற்ற சேதம் | <b>GPS:</b> {gps_info['lat']:.4f}N, {gps_info['lon']:.4f}E", cell_sub)
        meta2 = Paragraph(f"<b>பார்வை:</b> விலங்கு தடம் / சேதம் | <b>GPS:</b> {gps_info['lat']:.4f}N, {gps_info['lon']:.4f}E", cell_sub)

        photo_table = Table(
            [
                [img1, img2],
                [meta1, meta2]
            ],
            colWidths=[260, 267]
        )
        photo_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
            ('TOPPADDING', (0, 0), (-1, -1), 2),
        ]))
        story.append(photo_table)
        story.append(Spacer(1, 6))

        # 5. Part 4: Document Verification Matrix
        story.append(make_section_header("பகுதி 4: அரசு ஆவண சரிபார்ப்பு பட்டியல் (Document Readiness Matrix)"))
        chk = incident_data.get("checklist", {})
        status_tag = lambda ready: "இணைக்கப்பட்டுள்ளது (Attached)" if ready else "நிலுவை (Pending)"

        p4_data = [
            [
                Paragraph("பட்டா / சிட்டா நகல்:", cell_bold),
                Paragraph(status_tag(chk.get("patta", True)), cell_normal),
                Paragraph("VAO அடங்கல் சான்று:", cell_bold),
                Paragraph(status_tag(chk.get("adangal", False)), cell_normal),
            ],
            [
                Paragraph("வங்கி கணக்கு புத்தகம்:", cell_bold),
                Paragraph(status_tag(chk.get("bank", True)), cell_normal),
                Paragraph("ஆதார் அடையாள அட்டை:", cell_bold),
                Paragraph(status_tag(chk.get("aadhaar", True)), cell_normal),
            ]
        ]
        t4 = Table(p4_data, colWidths=[130, 133, 130, 134])
        t4.setStyle(TableStyle([
            ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor("#D1D5DB")),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#E5E7EB")),
            ('TOPPADDING', (0, 0), (-1, -1), 3),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ]))
        story.append(t4)
        story.append(Spacer(1, 14))

        # 6. Part 5: Signatures Block
        sig_data = [
            [
                Paragraph("<br/><br/>______________________<br/><b>விவசாயியின் கையொப்பம்</b><br/>(Applicant Signature)", cell_bold),
                Paragraph("<br/><br/>______________________<br/><b>அண்டை நில சாட்சி 1</b><br/>(Adjacent Witness 1)", cell_bold),
                Paragraph("<br/><br/>______________________<br/><b>வனச்சரக அலுவலர் ஒப்புதல்</b><br/>(Forest Officer Signature)", cell_bold)
            ]
        ]
        sig_table = Table(sig_data, colWidths=[175, 176, 176])
        sig_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ]))
        story.append(KeepTogether(sig_table))

        # Build PDF
        doc.build(story)
        return str(output_path)
