import os
from pathlib import Path
from datetime import datetime
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
    PageBreak,
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
        pdfmetrics.registerFont(TTFont("TamilFont-Bold", str(FONT_PATH), subfontIndex=1))
        pdfmetrics.registerFontFamily("TamilFont", normal="TamilFont", bold="TamilFont-Bold")
        DEFAULT_FONT = "TamilFont"
        DEFAULT_BOLD_FONT = "TamilFont-Bold"
    except Exception:
        DEFAULT_FONT = "Helvetica"
        DEFAULT_BOLD_FONT = "Helvetica-Bold"
else:
    DEFAULT_FONT = "Helvetica"
    DEFAULT_BOLD_FONT = "Helvetica-Bold"

class DossierPDFGenerator:
    """
    Generates official 2-Page Form WCD-01 (Citizen Report):
    'Crop Damage by Wild Animals – Complaint and Evidence Form'
    (வனவிலங்குகளால் ஏற்படுத்தப்பட்ட பயிர் சேதம் – புகார் மற்றும் ஆதாரவிவரம்)
    compliant with Tamil Nadu Forest Department reporting standards.
    """

    @classmethod
    def generate(
        cls,
        incident_data: Dict[str, Any],
        output_filename: Optional[str] = None,
        is_sample: bool = False
    ) -> str:
        code = incident_data.get("incident_code", "WCD-TN-2026-01427")
        if not output_filename:
            clean_code = code.replace("/", "_")
            output_filename = f"dossier_{clean_code}.pdf"

        output_path = Path(settings.DOSSIER_DIR) / output_filename
        output_path.parent.mkdir(parents=True, exist_ok=True)

        doc = SimpleDocTemplate(
            str(output_path),
            pagesize=A4,
            leftMargin=24,
            rightMargin=24,
            topMargin=20,
            bottomMargin=20
        )

        # Color definitions matching official document
        C_DARK_GREEN = colors.HexColor('#0F5132')
        C_BORDER = colors.HexColor('#9CA3AF')
        C_INNER_GRID = colors.HexColor('#E5E7EB')
        C_TEXT_MAIN = colors.HexColor('#111827')
        C_MUTED = colors.HexColor('#4B5563')
        C_LIGHT_GREEN_BG = colors.HexColor('#E8F5E9')

        styles = getSampleStyleSheet()

        s_header_ta = ParagraphStyle('H_TA', fontName=DEFAULT_BOLD_FONT, fontSize=11.5, leading=14, textColor=C_DARK_GREEN, alignment=1)
        s_title_ta = ParagraphStyle('T_TA', fontName=DEFAULT_BOLD_FONT, fontSize=10, leading=13, textColor=colors.black, alignment=1)

        s_sec_header = ParagraphStyle('SecH', fontName=DEFAULT_BOLD_FONT, fontSize=9, leading=11, textColor=colors.white)
        s_cell_label = ParagraphStyle('CellL', fontName=DEFAULT_BOLD_FONT, fontSize=8, leading=10, textColor=C_TEXT_MAIN)
        s_cell_val = ParagraphStyle('CellV', fontName=DEFAULT_FONT, fontSize=8, leading=10, textColor=C_TEXT_MAIN)
        s_cell_val_b = ParagraphStyle('CellVB', fontName=DEFAULT_BOLD_FONT, fontSize=8, leading=10, textColor=C_TEXT_MAIN)
        s_cell_num = ParagraphStyle('CellN', fontName=DEFAULT_BOLD_FONT, fontSize=8, leading=10, textColor=C_MUTED, alignment=1)

        # -------------------------------------------------------------
        # 1. EXTRACT DATA VALUES
        # -------------------------------------------------------------
        complaint_no = code if ("WCD-" in code or "RPD-" in code) else f"WCD-TN-2026-{code[-5:]}"
        submission_date = incident_data.get("submission_date") or incident_data.get("created_at") or datetime.now().strftime("%d-%m-%Y")
        if isinstance(submission_date, datetime):
            submission_date = submission_date.strftime("%d-%m-%Y")

        farmer = incident_data.get("farmer", {})
        farmer_name = farmer.get("name") or "Tamilselvan S"
        father_name = farmer.get("father_name") or "Sundaravel M"
        phone_number = farmer.get("phone") or "+91 98765 43210"
        village = farmer.get("village") or "Valparai"
        taluk = farmer.get("taluk") or "Pollachi"
        district = farmer.get("district") or "Coimbatore"
        address = farmer.get("address") or f"No. 45, {village} (Village), {taluk} (Taluk), {district} (District) - 642127"

        parcel = incident_data.get("parcel", {})
        total_area = parcel.get("area_acres") or parcel.get("total_area_acres") or 2.0
        total_area_str = f"<b>{float(total_area):.2f} ஏக்கர் / Acres</b>"
        crop_stage_raw = parcel.get("crop_stage") or "வளர்ச்சி / Growing"
        if "விதைப்பு" in crop_stage_raw or "Sowing" in crop_stage_raw:
            crop_stage_p = Paragraph('<b>☑ விதைப்பு / Sowing</b> &nbsp;&nbsp;&nbsp;&nbsp; ☐ வளர்ச்சி / Growing &nbsp;&nbsp;&nbsp;&nbsp; ☐ அறுவடை / Harvesting', s_cell_val)
        elif "அறுவடை" in crop_stage_raw or "Harvesting" in crop_stage_raw:
            crop_stage_p = Paragraph('☐ விதைப்பு / Sowing &nbsp;&nbsp;&nbsp;&nbsp; ☐ வளர்ச்சி / Growing &nbsp;&nbsp;&nbsp;&nbsp; <b>☑ அறுவடை / Harvesting</b>', s_cell_val)
        else:
            crop_stage_p = Paragraph('☐ விதைப்பு / Sowing &nbsp;&nbsp;&nbsp;&nbsp; <b>☑ வளர்ச்சி / Growing</b> &nbsp;&nbsp;&nbsp;&nbsp; ☐ அறுவடை / Harvesting', s_cell_val)

        incident = incident_data.get("incident", {})
        crop_ta = incident.get("crop_tamil") or incident.get("crop_damaged_tamil") or "மக்காச்சோளம்"
        crop_en = incident.get("crop_en") or incident.get("crop_damaged") or "Maize"
        crop_type_str = f"<b>{crop_ta} / {crop_en}</b>"

        qty = incident.get("quantity") or incident.get("damage_quantity") or 15
        unit = incident.get("unit_tamil") or incident.get("damage_unit_tamil") or "மரங்கள்/செடிகள்"
        damage_area_str = f"<b>0.50 ஏக்கர் / Acres ({qty} {unit})</b>"

        # Calculate or extract estimated loss
        estimated_loss_str = incident.get("estimated_loss") or "₹ 18,000 (Approx.)"

        incident_date = incident.get("date") or "09-11-2026"
        incident_time = incident.get("time_approx") or "இரவு / Night (10:00 PM – 11:00 PM)"

        wildlife_en = (incident.get("wildlife_en") or incident.get("wildlife_species") or "ELEPHANT").upper()
        wildlife_ta = incident.get("wildlife_tamil") or incident.get("wildlife_species_tamil") or "காட்டு யானை"

        if "ELEPHANT" in wildlife_en or "யானை" in wildlife_ta:
            animal_p = Paragraph(
                '<b>☑ யானை / Elephant</b> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ☐ காட்டுப்பன்றி / Wild Boar<br/>'
                '☐ காட்டு எருமை (கௌர்) / Gaur &nbsp;&nbsp;&nbsp;&nbsp; ☐ மான் / Deer<br/>'
                '☐ மற்றவை / Others : ____________________',
                s_cell_val
            )
        elif "BOAR" in wildlife_en or "பன்றி" in wildlife_ta:
            animal_p = Paragraph(
                '☐ யானை / Elephant &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; <b>☑ காட்டுப்பன்றி / Wild Boar</b><br/>'
                '☐ காட்டு எருமை (கௌர்) / Gaur &nbsp;&nbsp;&nbsp;&nbsp; ☐ மான் / Deer<br/>'
                '☐ மற்றவை / Others : ____________________',
                s_cell_val
            )
        elif "GAUR" in wildlife_en or "BISON" in wildlife_en or "எருமை" in wildlife_ta:
            animal_p = Paragraph(
                '☐ யானை / Elephant &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ☐ காட்டுப்பன்றி / Wild Boar<br/>'
                '<b>☑ காட்டு எருமை (கௌர்) / Gaur</b> &nbsp;&nbsp;&nbsp;&nbsp; ☐ மான் / Deer<br/>'
                '☐ மற்றவை / Others : ____________________',
                s_cell_val
            )
        elif "DEER" in wildlife_en or "மான்" in wildlife_ta:
            animal_p = Paragraph(
                '☐ யானை / Elephant &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ☐ காட்டுப்பன்றி / Wild Boar<br/>'
                '☐ காட்டு எருமை (கௌர்) / Gaur &nbsp;&nbsp;&nbsp;&nbsp; <b>☑ மான் / Deer</b><br/>'
                '☐ மற்றவை / Others : ____________________',
                s_cell_val
            )
        else:
            animal_p = Paragraph(
                f'☐ யானை / Elephant &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ☐ காட்டுப்பன்றி / Wild Boar<br/>'
                f'☐ காட்டு எருமை (கௌர்) / Gaur &nbsp;&nbsp;&nbsp;&nbsp; ☐ மான் / Deer<br/>'
                f'<b>☑ மற்றவை / Others : {wildlife_ta} ({wildlife_en})</b>',
                s_cell_val
            )

        desc_ta = incident.get("brief_description_tamil") or incident.get("voice_transcript") or "இரவில் காட்டு யானை குழு வயலில் நுழைந்து மக்காச்சோள பயிர்களை மிதித்து சேதப்படுத்தியது."
        desc_en = incident.get("brief_description_en") or "A herd of elephants entered the field at night and damaged the maize crop by trampling."
        desc_p = Paragraph(f"{desc_ta}<br/><i>{desc_en}</i>", s_cell_val)

        # GPS values
        gps = incident_data.get("gps", {})
        gps_lat = gps.get("lat") or 11.1276
        gps_lon = gps.get("lon") or 78.1589
        gps_acc = gps.get("accuracy") or 5.0
        gps_loc = gps.get("location") or f"{village}, {district}"

        # Resolve asset paths
        assets_dir = Path(settings.STATIC_DIR) / "assets"
        p_emblem = assets_dir / "tn_emblem.png"
        p_forest = assets_dir / "tn_forest_logo.png"
        p_map = assets_dir / "satellite_map_pin.jpg"
        p_sig = assets_dir / "farmer_signature.png"
        p_crop_sample = assets_dir / "damaged_crop_sample.jpg"
        p_cam_sample = assets_dir / "night_elephant_cam.jpg"

        # Resolve photos from photos_list or fallback to official samples
        photos_list = incident_data.get("photos_list", [])
        photo1_path = str(p_crop_sample.resolve()) if p_crop_sample.exists() else str((assets_dir / "field.jpg").resolve())
        photo2_path = str(p_cam_sample.resolve()) if p_cam_sample.exists() else str((assets_dir / "elephant.jpg").resolve())

        if len(photos_list) > 0 and photos_list[0].get("file_path") and os.path.exists(photos_list[0]["file_path"]):
            photo1_path = photos_list[0]["file_path"]
        if len(photos_list) > 1 and photos_list[1].get("file_path") and os.path.exists(photos_list[1]["file_path"]):
            photo2_path = photos_list[1]["file_path"]

        # -------------------------------------------------------------
        # BUILD STORY
        # -------------------------------------------------------------
        story = []

        def make_sec_header(title: str):
            p = Paragraph(f'<b>{title}</b>', s_sec_header)
            t = Table([[p]], colWidths=[547])
            t.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (0, 0), C_DARK_GREEN),
                ('LEFTPADDING', (0, 0), (0, 0), 4),
                ('RIGHTPADDING', (0, 0), (0, 0), 4),
                ('TOPPADDING', (0, 0), (0, 0), 2.5),
                ('BOTTOMPADDING', (0, 0), (0, 0), 2.5),
                ('VALIGN', (0, 0), (0, 0), 'MIDDLE'),
            ]))
            return t

        # =============================================================
        # PAGE 1: CITIZEN REPORT DETAILS
        # =============================================================
        # 1. Official Header
        im_emblem = RLImage(str(p_emblem), width=36, height=40) if p_emblem.exists() else Paragraph("", s_cell_val)
        im_forest = RLImage(str(p_forest), width=38, height=40) if p_forest.exists() else Paragraph("", s_cell_val)

        h_text = Paragraph(
            '<b>தமிழ்நாடு அரசு</b><br/>'
            '<b>வனத்துறை</b><br/>'
            '<b>Government of Tamil Nadu</b><br/>'
            '<b>Forest Department</b>',
            s_header_ta
        )

        h_table = Table([[im_emblem, h_text, im_forest]], colWidths=[45, 457, 45])
        h_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('LEFTPADDING', (0, 0), (-1, -1), 2),
            ('RIGHTPADDING', (0, 0), (-1, -1), 2),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
            ('TOPPADDING', (0, 0), (-1, -1), 0),
        ]))
        story.append(h_table)
        story.append(Spacer(1, 4))

        # 2. Form Title & Form No.
        t_left = Paragraph(
            '<b>வனவிலங்குகளால் ஏற்படுத்தப்பட்ட பயிர் சேதம் – புகார் மற்றும் ஆதாரவிவரம்</b><br/>'
            '<b>Crop Damage by Wild Animals – Complaint and Evidence Form</b>',
            s_title_ta
        )
        f_box = Paragraph(
            '<b>Form No.: WCD-01</b><br/>(Citizen Report)',
            ParagraphStyle('FBox', fontName=DEFAULT_BOLD_FONT, fontSize=7.5, leading=9.5, textColor=C_DARK_GREEN, alignment=1)
        )

        title_table = Table([[t_left, f_box]], colWidths=[447, 100])
        title_table.setStyle(TableStyle([
            ('BOX', (1, 0), (1, 0), 0.8, C_DARK_GREEN),
            ('BACKGROUND', (1, 0), (1, 0), C_LIGHT_GREEN_BG),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('LEFTPADDING', (0, 0), (-1, -1), 3),
            ('RIGHTPADDING', (0, 0), (-1, -1), 3),
            ('TOPPADDING', (0, 0), (-1, -1), 2),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ]))
        story.append(title_table)
        story.append(Spacer(1, 4))

        # 3. Complaint & Date strip
        comp_box = Paragraph(f'<b>{complaint_no}</b>', ParagraphStyle('CB', fontName=DEFAULT_BOLD_FONT, fontSize=8.5, leading=10.5, textColor=colors.black, alignment=1))
        date_box = Paragraph(f'<b>{submission_date}</b>', ParagraphStyle('DB', fontName=DEFAULT_BOLD_FONT, fontSize=8.5, leading=10.5, textColor=colors.black, alignment=1))

        c_table = Table([
            [
                Paragraph('<b>புகார் எண் / Complaint No.:</b>', s_cell_label),
                comp_box,
                Paragraph('<b>பதிவு தேதி / Date of Submission:</b>', s_cell_label),
                date_box
            ]
        ], colWidths=[135, 138, 144, 130])
        c_table.setStyle(TableStyle([
            ('BOX', (1, 0), (1, 0), 0.8, colors.black),
            ('BOX', (3, 0), (3, 0), 0.8, colors.black),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('LEFTPADDING', (0, 0), (-1, -1), 3),
            ('RIGHTPADDING', (0, 0), (-1, -1), 3),
            ('TOPPADDING', (0, 0), (-1, -1), 2),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ]))
        story.append(c_table)
        story.append(Spacer(1, 5))

        # 4. Section 1: Farmer Details
        story.append(make_sec_header('1. விவசாயி விவரங்கள் / Farmer Details'))
        p1_data = [
            [Paragraph('1.1', s_cell_num), Paragraph('விவசாயி பெயர் / Farmer Name', s_cell_label), Paragraph(':', s_cell_num), Paragraph(farmer_name, s_cell_val_b)],
            [Paragraph('1.2', s_cell_num), Paragraph('தந்தை / கணவர் பெயர் / Father / Husband Name', s_cell_label), Paragraph(':', s_cell_num), Paragraph(father_name, s_cell_val)],
            [Paragraph('1.3', s_cell_num), Paragraph('தொடர்பு எண் / Contact Number', s_cell_label), Paragraph(':', s_cell_num), Paragraph(phone_number, s_cell_val_b)],
            [Paragraph('1.4', s_cell_num), Paragraph('முகவரி / Address', s_cell_label), Paragraph(':', s_cell_num), Paragraph(address, s_cell_val)],
        ]
        t_p1 = Table(p1_data, colWidths=[24, 185, 14, 324])
        t_p1.setStyle(TableStyle([
            ('BOX', (0, 0), (-1, -1), 0.5, C_BORDER),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, C_INNER_GRID),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('LEFTPADDING', (0, 0), (-1, -1), 3),
            ('RIGHTPADDING', (0, 0), (-1, -1), 3),
            ('TOPPADDING', (0, 0), (-1, -1), 1.5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 1.5),
        ]))
        story.append(t_p1)
        story.append(Spacer(1, 4))

        # 5. Section 2: Land and Crop Details
        story.append(make_sec_header('2. நிலம் மற்றும் பயிர் விவரங்கள் / Land and Crop Details'))
        p2_data = [
            [Paragraph('2.1', s_cell_num), Paragraph('நிலம் பரப்பளவு / Total Land Area', s_cell_label), Paragraph(':', s_cell_num), Paragraph(total_area_str, s_cell_val)],
            [Paragraph('2.2', s_cell_num), Paragraph('பயிர் வகை / Crop Type', s_cell_label), Paragraph(':', s_cell_num), Paragraph(crop_type_str, s_cell_val)],
            [Paragraph('2.3', s_cell_num), Paragraph('பயிர் பருவம் / Crop Stage', s_cell_label), Paragraph(':', s_cell_num), crop_stage_p],
            [Paragraph('2.4', s_cell_num), Paragraph('மதிப்பிடப்பட்ட சேதப் பரப்பளவு / Estimated Damaged Area', s_cell_label), Paragraph(':', s_cell_num), Paragraph(damage_area_str, s_cell_val)],
            [Paragraph('2.5', s_cell_num), Paragraph('மதிப்பிடப்பட்ட இழப்பு (ரூ.) / Estimated Loss (₹)', s_cell_label), Paragraph(':', s_cell_num), Paragraph(f'<b>{estimated_loss_str}</b>', s_cell_val_b)],
        ]
        t_p2 = Table(p2_data, colWidths=[24, 185, 14, 324])
        t_p2.setStyle(TableStyle([
            ('BOX', (0, 0), (-1, -1), 0.5, C_BORDER),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, C_INNER_GRID),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('LEFTPADDING', (0, 0), (-1, -1), 3),
            ('RIGHTPADDING', (0, 0), (-1, -1), 3),
            ('TOPPADDING', (0, 0), (-1, -1), 1.5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 1.5),
        ]))
        story.append(t_p2)
        story.append(Spacer(1, 4))

        # 6. Section 3: Incident Details
        story.append(make_sec_header('3. சம்பவ விவரங்கள் / Incident Details'))
        p3_data = [
            [Paragraph('3.1', s_cell_num), Paragraph('சம்பவ தேதி / Date of Incident', s_cell_label), Paragraph(':', s_cell_num), Paragraph(incident_date, s_cell_val)],
            [Paragraph('3.2', s_cell_num), Paragraph('சம்பவ நேரம் (தோராயமாக) / Time of Incident (Approx.)', s_cell_label), Paragraph(':', s_cell_num), Paragraph(incident_time, s_cell_val)],
            [Paragraph('3.3', s_cell_num), Paragraph('சேதம் ஏற்படுத்தியதாகக் கூறப்படும் வனவிலங்கு / Reported Wild Animal', s_cell_label), Paragraph(':', s_cell_num), animal_p],
            [Paragraph('3.4', s_cell_num), Paragraph('சம்பவத்தின் சுருக்கமான விளக்கம் / Brief Description of the Incident', s_cell_label), Paragraph(':', s_cell_num), desc_p],
        ]
        t_p3 = Table(p3_data, colWidths=[24, 185, 14, 324])
        t_p3.setStyle(TableStyle([
            ('BOX', (0, 0), (-1, -1), 0.5, C_BORDER),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, C_INNER_GRID),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('LEFTPADDING', (0, 0), (-1, -1), 3),
            ('RIGHTPADDING', (0, 0), (-1, -1), 3),
            ('TOPPADDING', (0, 0), (-1, -1), 2),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ]))
        story.append(t_p3)
        story.append(Spacer(1, 6))

        # 7. Attached Evidences strip (Bottom of Page 1)
        att_left = Paragraph(
            '<b>இணைக்கப்பட்ட ஆதாரங்கள் / Attached Evidences (✓)</b><br/>'
            '<b>☑ புகைப்படம் / Photographs</b> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; <b>☑ இடம் (GPS) / Location (GPS)</b><br/>'
            '☐ குரல் பதிவு / Voice Record (விரும்பினால் / Optional) &nbsp;&nbsp;&nbsp;&nbsp; ☐ மற்றவை / Others : ____________',
            s_cell_val
        )
        page1_box = Paragraph('<b>பக்கம் 1 / 2</b><br/>Page 1 of 2', ParagraphStyle('P1B', fontName=DEFAULT_BOLD_FONT, fontSize=8, leading=10, textColor=C_DARK_GREEN, alignment=1))
        t_att = Table([[att_left, page1_box]], colWidths=[457, 90])
        t_att.setStyle(TableStyle([
            ('BOX', (0, 0), (0, 0), 0.5, C_BORDER),
            ('BOX', (1, 0), (1, 0), 0.8, C_DARK_GREEN),
            ('BACKGROUND', (1, 0), (1, 0), C_LIGHT_GREEN_BG),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('LEFTPADDING', (0, 0), (-1, -1), 3),
            ('RIGHTPADDING', (0, 0), (-1, -1), 3),
            ('TOPPADDING', (0, 0), (-1, -1), 3),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ]))
        story.append(t_att)

        # =============================================================
        # PAGE 2: EVIDENCE & OFFICIAL ATTESTATION
        # =============================================================
        story.append(PageBreak())

        # 1. Header Page 2
        h2_emblem = RLImage(str(p_emblem), width=28, height=32) if p_emblem.exists() else Paragraph("", s_cell_val)
        h2_text = Paragraph('<b>தமிழ்நாடு அரசு – வனத்துறை</b><br/><b>Government of Tamil Nadu – Forest Department</b>', s_header_ta)
        h2_box = Paragraph('<b>Form No.: WCD-01</b><br/>(Citizen Report)', ParagraphStyle('H2B', fontName=DEFAULT_BOLD_FONT, fontSize=7, leading=9, textColor=C_DARK_GREEN, alignment=1))

        h2_table = Table([[h2_emblem, h2_text, h2_box]], colWidths=[38, 419, 90])
        h2_table.setStyle(TableStyle([
            ('BOX', (2, 0), (2, 0), 0.8, C_DARK_GREEN),
            ('BACKGROUND', (2, 0), (2, 0), C_LIGHT_GREEN_BG),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('ALIGN', (1, 0), (1, 0), 'CENTER'),
            ('LEFTPADDING', (0, 0), (-1, -1), 2),
            ('RIGHTPADDING', (0, 0), (-1, -1), 2),
            ('TOPPADDING', (0, 0), (-1, -1), 2),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ]))
        story.append(h2_table)
        story.append(Spacer(1, 4))

        # 2. Section 4: Photographic Evidence
        story.append(make_sec_header('4. ஆதார புகைப்படங்கள் / Photographic Evidence'))
        im_p1 = RLImage(photo1_path, width=265, height=138)
        im_p2 = RLImage(photo2_path, width=265, height=138)
        lbl_p1 = Paragraph('<b>படம் – 1 / Photo – 1</b><br/>(சேதமடைந்த பயிர் / Damaged Crop)', ParagraphStyle('LP1', fontName=DEFAULT_FONT, fontSize=7.5, leading=9.5, alignment=1))
        lbl_p2 = Paragraph('<b>படம் – 2 / Photo – 2</b><br/>(காணொளிகேமரா காட்சி / Camera Capture)', ParagraphStyle('LP2', fontName=DEFAULT_FONT, fontSize=7.5, leading=9.5, alignment=1))

        photo_table = Table([[im_p1, im_p2], [lbl_p1, lbl_p2]], colWidths=[273, 274])
        photo_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('LEFTPADDING', (0, 0), (-1, -1), 2),
            ('RIGHTPADDING', (0, 0), (-1, -1), 2),
            ('TOPPADDING', (0, 0), (-1, -1), 1),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 1),
        ]))
        story.append(photo_table)
        story.append(Spacer(1, 4))

        # 3. Section 5: Location (GPS) Details
        story.append(make_sec_header('5. இடம் (GPS) விவரம் / Location (GPS) Details'))
        gps_rows = [
            [Paragraph('அட்சரேகை / Latitude', s_cell_label), Paragraph(':', s_cell_num), Paragraph(f'<b>{gps_lat:.4f}° N</b>', s_cell_val)],
            [Paragraph('தீர்க்கரேகை / Longitude', s_cell_label), Paragraph(':', s_cell_num), Paragraph(f'<b>{gps_lon:.4f}° E</b>', s_cell_val)],
            [Paragraph('இடம் / Location', s_cell_label), Paragraph(':', s_cell_num), Paragraph(gps_loc, s_cell_val)],
            [Paragraph('GPS துல்லியம் / Accuracy', s_cell_label), Paragraph(':', s_cell_num), Paragraph(f'± {gps_acc} meters', s_cell_val)],
        ]
        t_gps = Table(gps_rows, colWidths=[130, 14, 136])
        t_gps.setStyle(TableStyle([
            ('BOX', (0, 0), (-1, -1), 0.5, C_BORDER),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, C_INNER_GRID),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('LEFTPADDING', (0, 0), (-1, -1), 3),
            ('RIGHTPADDING', (0, 0), (-1, -1), 3),
            ('TOPPADDING', (0, 0), (-1, -1), 1.5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 1.5),
        ]))

        im_map = RLImage(str(p_map), width=255, height=88) if p_map.exists() else Paragraph("", s_cell_val)

        s5_table = Table([[t_gps, im_map]], colWidths=[285, 262])
        s5_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('ALIGN', (1, 0), (1, 0), 'CENTER'),
            ('LEFTPADDING', (0, 0), (-1, -1), 2),
            ('RIGHTPADDING', (0, 0), (-1, -1), 2),
            ('PADDING', (0, 0), (-1, -1), 0),
        ]))
        story.append(s5_table)
        story.append(Spacer(1, 4))

        # 4. Section 6: Farmer Declaration
        story.append(make_sec_header('6. விவசாயி உறுதிமொழி / Farmer Declaration'))
        dec_text = Paragraph(
            '<b>நான் வழங்கியுள்ள மேற்கண்ட விவரங்கள் அனைத்தும் எனது அறிவிற்கு எட்டிய வரையில் உண்மையானவை என்பதை இத்துடன் உறுதிபடுத்துகிறேன்.</b><br/>'
            '<i>I hereby declare that the above information provided by me is true and correct to the best of my knowledge.</i>',
            s_cell_val
        )
        im_sig = RLImage(str(p_sig), width=70, height=26) if p_sig.exists() else Paragraph("________________", s_cell_val)
        sig_left = Table([[Paragraph('விவசாயி கையொப்பம் /<br/>Signature of Farmer', s_cell_label), im_sig]], colWidths=[150, 90])
        sig_left.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('LEFTPADDING', (0, 0), (-1, -1), 2),
            ('RIGHTPADDING', (0, 0), (-1, -1), 2),
            ('PADDING', (0, 0), (-1, -1), 0)
        ]))
        date_right = Paragraph(f'<b>தேதி / Date :  {submission_date}</b>', s_cell_label)

        sig_row = Table([[sig_left, date_right]], colWidths=[360, 187])
        sig_row.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('ALIGN', (1, 0), (1, 0), 'RIGHT'),
            ('LEFTPADDING', (0, 0), (-1, -1), 2),
            ('RIGHTPADDING', (0, 0), (-1, -1), 2),
        ]))

        dec_table = Table([[dec_text], [sig_row]], colWidths=[547])
        dec_table.setStyle(TableStyle([
            ('BOX', (0, 0), (-1, -1), 0.5, C_BORDER),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, C_INNER_GRID),
            ('LEFTPADDING', (0, 0), (-1, -1), 3),
            ('RIGHTPADDING', (0, 0), (-1, -1), 3),
            ('TOPPADDING', (0, 0), (-1, -1), 2),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ]))
        story.append(dec_table)
        story.append(Spacer(1, 4))

        # 5. Section 7: For Office Use Only
        story.append(make_sec_header('7. அலுவலர் பயன்பாட்டிற்கு மட்டும் / For Office Use Only'))
        off_rows = [
            [Paragraph('7.1', s_cell_num), Paragraph('புகார் பெறப்பட்ட தேதி / Date of Receipt', s_cell_label), Paragraph(':', s_cell_num), Paragraph('____________________', s_cell_val)],
            [Paragraph('7.2', s_cell_num), Paragraph('புலனாய்வு (கள ஆய்வு) தேதி / Field Inspection Date', s_cell_label), Paragraph(':', s_cell_num), Paragraph('____________________', s_cell_val)],
            [Paragraph('7.3', s_cell_num), Paragraph('உறுதி செய்யப்பட்ட வனவிலங்கு / Confirmed Wild Animal', s_cell_label), Paragraph(':', s_cell_num), Paragraph('____________________', s_cell_val)],
            [Paragraph('7.4', s_cell_num), Paragraph('அலுவலரின் கருத்து / Remarks', s_cell_label), Paragraph(':', s_cell_num), Paragraph('____________________<br/>____________________', s_cell_val)],
        ]
        t_off = Table(off_rows, colWidths=[20, 200, 14, 126])
        t_off.setStyle(TableStyle([
            ('BOX', (0, 0), (-1, -1), 0.5, C_BORDER),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, C_INNER_GRID),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('LEFTPADDING', (0, 0), (-1, -1), 3),
            ('RIGHTPADDING', (0, 0), (-1, -1), 3),
            ('TOPPADDING', (0, 0), (-1, -1), 1.5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 1.5),
        ]))

        seal_box = Paragraph('அதிகாரி கையொப்பம், முத்திரை /<br/><b>Signature & Seal of Authorized Officer</b>', ParagraphStyle('SB', fontName=DEFAULT_FONT, fontSize=7.5, leading=9.5, alignment=1))
        t_seal = Table([[seal_box]], colWidths=[175], rowHeights=[65])
        t_seal.setStyle(TableStyle([
            ('BOX', (0, 0), (0, 0), 0.8, C_BORDER),
            ('VALIGN', (0, 0), (0, 0), 'TOP'),
            ('ALIGN', (0, 0), (0, 0), 'CENTER'),
            ('LEFTPADDING', (0, 0), (-1, -1), 3),
            ('RIGHTPADDING', (0, 0), (-1, -1), 3),
            ('PADDING', (0, 0), (0, 0), 3),
        ]))

        s7_table = Table([[t_off, t_seal]], colWidths=[365, 182])
        s7_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('LEFTPADDING', (0, 0), (-1, -1), 0),
            ('RIGHTPADDING', (0, 0), (-1, -1), 0),
            ('PADDING', (0, 0), (-1, -1), 0)
        ]))
        story.append(s7_table)
        story.append(Spacer(1, 5))

        # 6. Bottom Notice Page 2
        note_left = Paragraph(
            'ℹ️ <b>குறிப்பு: இது விவசாயியால் வழங்கப்பட்ட புகார் மற்றும் ஆதார விவரம் ஆகும். இது ஒரு ஆரம்ப பதிவு மட்டுமே. '
            'இழப்பீடு / நிவாரணம் தொடர்பான இறுதி முடிவு, துறை விதிமுறைகளின் அடிப்படையில் மேற்கொள்ளப்படும்.</b><br/>'
            '<i>Note: This is a farmer-submitted complaint and evidence record. It is an initial report only. '
            'The final decision regarding compensation/relief will be taken by the Forest Department as per the applicable rules.</i>',
            ParagraphStyle('NL', fontName=DEFAULT_FONT, fontSize=6.5, leading=8.5, textColor=C_TEXT_MAIN)
        )
        page2_box = Paragraph('<b>பக்கம் 2 / 2</b><br/>Page 2 of 2', ParagraphStyle('P2B', fontName=DEFAULT_BOLD_FONT, fontSize=8, leading=10, textColor=C_DARK_GREEN, alignment=1))
        t_note = Table([[note_left, page2_box]], colWidths=[457, 90])
        t_note.setStyle(TableStyle([
            ('BOX', (0, 0), (0, 0), 0.5, C_BORDER),
            ('BOX', (1, 0), (1, 0), 0.8, C_DARK_GREEN),
            ('BACKGROUND', (1, 0), (1, 0), C_LIGHT_GREEN_BG),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('LEFTPADDING', (0, 0), (-1, -1), 3),
            ('RIGHTPADDING', (0, 0), (-1, -1), 3),
            ('TOPPADDING', (0, 0), (-1, -1), 3),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ]))
        story.append(t_note)

        doc.build(story)
        return str(output_path.resolve())
