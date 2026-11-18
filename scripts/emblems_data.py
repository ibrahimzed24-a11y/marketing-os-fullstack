# scripts/emblems_data.py
"""
Definitions and vector SVG generators for the 17 clinics without existing public logos.
Each emblem features:
- Bespoke vector dental crest (shield, arches, ribbons, leaves, cross, sunburst, waves)
- Clinic initials monogram
- Distinctive high-contrast typography and location styling
- Standard viewBox="0 0 400 120"
"""

EMBLEMS = {
    "billings-bridge-dental-centre": {
        "name": "Billings Bridge Dental Centre",
        "primary": "BILLINGS BRIDGE",
        "secondary": "DENTAL CENTRE",
        "tag": "OTTAWA • ESTABLISHED CARE",
        "palette": {
            "c1": "#0F2942",
            "c2": "#00A896",
            "accent": "#0284C7",
            "light": "#E0F2FE",
            "text_main": "#0F2942",
            "text_sub": "#00A896"
        },
        "badge_shape": "bridge_shield",
        "monogram": "BB"
    },
    "centre-dentaire-boulevard-galeries-d-anjou": {
        "name": "Centre Dentaire Boulevard Galeries d’Anjou",
        "primary": "GALERIES D'ANJOU",
        "secondary": "CENTRE DENTAIRE",
        "tag": "MONTRÉAL • SOINS COMPLETS",
        "palette": {
            "c1": "#1E3A8A",
            "c2": "#D4AF37",
            "accent": "#2563EB",
            "light": "#FEF9C3",
            "text_main": "#1E3A8A",
            "text_sub": "#B45309"
        },
        "badge_shape": "royal_arch",
        "monogram": "GA"
    },
    "centre-dentaire-poirier-tremblay": {
        "name": "Centre Dentaire Poirier Tremblay",
        "primary": "POIRIER TREMBLAY",
        "secondary": "CENTRE DENTAIRE",
        "tag": "VARENNES • DR POIRIER & DR TREMBLAY",
        "palette": {
            "c1": "#064E3B",
            "c2": "#059669",
            "accent": "#10B981",
            "light": "#D1FAE5",
            "text_main": "#064E3B",
            "text_sub": "#059669"
        },
        "badge_shape": "dual_ribbon",
        "monogram": "PT"
    },
    "clinique-dentaire-laurier": {
        "name": "Clinique Dentaire Laurier",
        "primary": "DENTAIRE LAURIER",
        "secondary": "CLINIQUE DENTAIRE",
        "tag": "VICTORIAVILLE • EXCELLENCE",
        "palette": {
            "c1": "#1E3A8A",
            "c2": "#D97706",
            "accent": "#38BDF8",
            "light": "#EFF6FF",
            "text_main": "#1E3A8A",
            "text_sub": "#D97706"
        },
        "badge_shape": "laurel_crest",
        "monogram": "L"
    },
    "dr-eskenazi-dr-suissa": {
        "name": "Dr Eskenazi & Dr Suissa",
        "primary": "DR ESKENAZI & DR SUISSA",
        "secondary": "CHIRURGIENS DENTISTES",
        "tag": "PIERREFONDS • PRATIQUE PRIVÉE",
        "palette": {
            "c1": "#0F172A",
            "c2": "#6366F1",
            "accent": "#818CF8",
            "light": "#EEF2FF",
            "text_main": "#0F172A",
            "text_sub": "#4F46E5"
        },
        "badge_shape": "boutique_dual",
        "monogram": "E&S"
    },
    "dundas-ossington-dentistry": {
        "name": "Dundas Ossington Dentistry",
        "primary": "DUNDAS OSSINGTON",
        "secondary": "DENTISTRY",
        "tag": "TORONTO • COMPREHENSIVE CLINIC",
        "palette": {
            "c1": "#18181B",
            "c2": "#0891B2",
            "accent": "#06B6D4",
            "light": "#ECFEFF",
            "text_main": "#18181B",
            "text_sub": "#0891B2"
        },
        "badge_shape": "urban_cross",
        "monogram": "DO"
    },
    "espanola-dental-centre": {
        "name": "Espanola Dental Centre",
        "primary": "ESPANOLA",
        "secondary": "DENTAL CENTRE",
        "tag": "NORTHERN ONTARIO • FAMILY CARE",
        "palette": {
            "c1": "#14532D",
            "c2": "#16A34A",
            "accent": "#22C55E",
            "light": "#DCFCE7",
            "text_main": "#14532D",
            "text_sub": "#15803D"
        },
        "badge_shape": "pine_crest",
        "monogram": "EDC"
    },
    "fraserview-dentist": {
        "name": "Fraserview Dentist",
        "primary": "FRASERVIEW DENTIST",
        "secondary": "FAMILY & COSMETIC DENTAL",
        "tag": "VANCOUVER BC • 4.9★ CARE",
        "palette": {
            "c1": "#0C4A6E",
            "c2": "#0D9488",
            "accent": "#0284C7",
            "light": "#E0F2FE",
            "text_main": "#0C4A6E",
            "text_sub": "#0D9488"
        },
        "badge_shape": "pacific_wave",
        "monogram": "FD"
    },
    "greystone-family-dental": {
        "name": "Greystone Family Dental",
        "primary": "GREYSTONE",
        "secondary": "FAMILY DENTAL",
        "tag": "CALGARY AB • 5.0★ VERIFIED",
        "palette": {
            "c1": "#1E293B",
            "c2": "#D97706",
            "accent": "#F59E0B",
            "light": "#FEF3C7",
            "text_main": "#1E293B",
            "text_sub": "#B45309"
        },
        "badge_shape": "diamond_shield",
        "monogram": "GFD"
    },
    "le-dentiste-hochelaga": {
        "name": "Le Dentiste Hochelaga",
        "primary": "LE DENTISTE",
        "secondary": "HOCHELAGA",
        "tag": "MONTRÉAL • SOINS DENTAIRES",
        "palette": {
            "c1": "#1E1B4B",
            "c2": "#E11D48",
            "accent": "#F43F5E",
            "light": "#FFE4E6",
            "text_main": "#1E1B4B",
            "text_sub": "#BE123C"
        },
        "badge_shape": "heart_crest",
        "monogram": "DH"
    },
    "little-current-dental-centre": {
        "name": "Little Current Dental Centre",
        "primary": "LITTLE CURRENT",
        "secondary": "DENTAL CENTRE",
        "tag": "MANITOULIN ISLAND • ESTABLISHED",
        "palette": {
            "c1": "#1E3A8A",
            "c2": "#0284C7",
            "accent": "#06B6D4",
            "light": "#E0F2FE",
            "text_main": "#1E3A8A",
            "text_sub": "#0284C7"
        },
        "badge_shape": "current_wave",
        "monogram": "LC"
    },
    "micmac-dental-centre-dr-dessureault": {
        "name": "MicMac Dental Centre – Dr. Dessureault",
        "primary": "MICMAC DENTAL CENTRE",
        "secondary": "DR. DESSUREAULT & ASSOCIATES",
        "tag": "DARTMOUTH NS • ATLANTIC EXCELLENCE",
        "palette": {
            "c1": "#0C4A6E",
            "c2": "#D97706",
            "accent": "#0284C7",
            "light": "#FEF3C7",
            "text_main": "#0C4A6E",
            "text_sub": "#D97706"
        },
        "badge_shape": "maritime_crest",
        "monogram": "MM"
    },
    "yorkson-dental": {
        "name": "Yorkson Dental",
        "primary": "YORKSON DENTAL",
        "secondary": "FAMILY PRACTICE",
        "tag": "LANGLEY BC • 4.9★ (411 REVIEWS)",
        "palette": {
            "c1": "#14532D",
            "c2": "#16A34A",
            "accent": "#4ADE80",
            "light": "#DCFCE7",
            "text_main": "#14532D",
            "text_sub": "#15803D"
        },
        "badge_shape": "botanical_leaf",
        "monogram": "YD"
    },
    "lakeside-family-dental": {
        "name": "Lakeside Family Dental",
        "primary": "LAKESIDE",
        "secondary": "FAMILY DENTAL",
        "tag": "BURLINGTON ON • 4.8★ (422 REVIEWS)",
        "palette": {
            "c1": "#0F172A",
            "c2": "#0284C7",
            "accent": "#38BDF8",
            "light": "#E0F2FE",
            "text_main": "#0F172A",
            "text_sub": "#0284C7"
        },
        "badge_shape": "lake_shield",
        "monogram": "LFD"
    },
    "savannah-dental": {
        "name": "Savannah Dental",
        "primary": "SAVANNAH DENTAL",
        "secondary": "CLINICAL EXCELLENCE",
        "tag": "EDMONTON AB • 4.9★ (106 REVIEWS)",
        "palette": {
            "c1": "#78350F",
            "c2": "#D97706",
            "accent": "#F59E0B",
            "light": "#FEF3C7",
            "text_main": "#78350F",
            "text_sub": "#B45309"
        },
        "badge_shape": "sunburst_crest",
        "monogram": "SD"
    },
    "meadow-dental-care": {
        "name": "Meadow Dental Care",
        "primary": "MEADOW DENTAL",
        "secondary": "CARE & SMILE STUDIO",
        "tag": "BRAMPTON ON • 4.7★ (192 REVIEWS)",
        "palette": {
            "c1": "#14532D",
            "c2": "#16A34A",
            "accent": "#22C55E",
            "light": "#DCFCE7",
            "text_main": "#14532D",
            "text_sub": "#16A34A"
        },
        "badge_shape": "meadow_crest",
        "monogram": "MDC"
    },
    "tapestry-dental": {
        "name": "Tapestry Dental",
        "primary": "TAPESTRY DENTAL",
        "secondary": "MODERN SMILE DESIGN",
        "tag": "SURREY BC • 4.9★ (439 REVIEWS)",
        "palette": {
            "c1": "#4C1D95",
            "c2": "#7C3AED",
            "accent": "#0D9488",
            "light": "#EDE9FE",
            "text_main": "#4C1D95",
            "text_sub": "#7C3AED"
        },
        "badge_shape": "tapestry_shield",
        "monogram": "TD"
    }
}
