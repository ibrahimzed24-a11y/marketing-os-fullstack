# scripts/generate_emblems.py
import os
import xml.sax.saxutils as saxutils
from emblems_data import EMBLEMS

def esc(text):
    if not text:
        return ""
    # saxutils.escape replaces &, <, >
    return saxutils.escape(str(text))

def generate_emblem_svg(slug):
    cfg = EMBLEMS.get(slug)
    if not cfg:
        raise ValueError(f"Unknown emblem slug: {slug}")
    
    pal = cfg["palette"]
    mono = esc(cfg["monogram"])
    shape = cfg["badge_shape"]
    
    # Base gradient IDs unique to slug
    gid = f"grad_{slug.replace('-', '_')}"
    
    # Common tooth vector path centered at (65, 60)
    # Scaled to ~44px wide by 50px tall
    # Dental crest path
    badge_svg = ""
    
    if shape == "bridge_shield":
        # Billings Bridge: Arch Bridge + Shield + Molar
        badge_svg = f"""
        <!-- Shield Background -->
        <path d="M25 24 C25 24 65 14 65 14 C65 14 105 24 105 24 C105 58 92 88 65 106 C38 88 25 58 25 24 Z" fill="url(#{gid}_main)" filter="url(#{gid}_shadow)"/>
        <!-- Bridge Cables & Arch -->
        <path d="M30 65 Q65 30 100 65" fill="none" stroke="{pal['light']}" stroke-width="2.5" opacity="0.8"/>
        <line x1="45" y1="52" x2="45" y2="78" stroke="{pal['light']}" stroke-width="1.5" opacity="0.6"/>
        <line x1="65" y1="40" x2="65" y2="78" stroke="{pal['light']}" stroke-width="1.5" opacity="0.8"/>
        <line x1="85" y1="52" x2="85" y2="78" stroke="{pal['light']}" stroke-width="1.5" opacity="0.6"/>
        <!-- Polished Tooth Emblem -->
        <path d="M52 46 C52 38 60 34 65 40 C70 34 78 38 78 46 C78 58 75 66 69 76 C67 80 64 80 63 74 C62 80 59 80 57 76 C51 66 52 58 52 46 Z" fill="#FFFFFF"/>
        <!-- Star highlight -->
        <circle cx="73" cy="43" r="2" fill="{pal['c2']}"/>
        <!-- Monogram Pill -->
        <rect x="47" y="86" width="36" height="14" rx="7" fill="{pal['c2']}"/>
        <text x="65" y="97" font-family="system-ui, -apple-system, sans-serif" font-size="8.5" font-weight="900" fill="#FFFFFF" text-anchor="middle" letter-spacing="1">{mono}</text>
        """

    elif shape == "royal_arch":
        # Galeries d'Anjou: Architectural Arch + Faceted Diamond Tooth
        badge_svg = f"""
        <!-- Octagonal / Heraldic Badge -->
        <rect x="25" y="16" width="80" height="88" rx="20" fill="url(#{gid}_main)" filter="url(#{gid}_shadow)"/>
        <rect x="29" y="20" width="72" height="80" rx="16" fill="none" stroke="{pal['c2']}" stroke-width="1.5" opacity="0.8"/>
        <!-- Archway -->
        <path d="M40 78 V48 C40 34 90 34 90 48 V78 Z" fill="none" stroke="{pal['c2']}" stroke-width="2"/>
        <!-- Central Enamel Tooth -->
        <path d="M52 44 C52 37 60 34 65 39 C70 34 78 37 78 44 C78 54 75 62 70 70 C68 74 66 74 65 69 C64 74 62 74 60 70 C55 62 52 54 52 44 Z" fill="#FFFFFF"/>
        <!-- Crown Jewels / Gold sparkle -->
        <polygon points="65,30 67,35 72,35 68,38 70,43 65,40 60,43 62,38 58,35 63,35" fill="{pal['c2']}"/>
        <!-- Monogram -->
        <rect x="49" y="80" width="32" height="14" rx="7" fill="{pal['c2']}"/>
        <text x="65" y="91" font-family="system-ui, -apple-system, sans-serif" font-size="8" font-weight="900" fill="#1E3A8A" text-anchor="middle" letter-spacing="1">{mono}</text>
        """

    elif shape == "dual_ribbon":
        # Poirier Tremblay: Dual Interlocking Ribbons forming tooth profile
        badge_svg = f"""
        <circle cx="65" cy="60" r="44" fill="url(#{gid}_main)" filter="url(#{gid}_shadow)"/>
        <!-- Ribbon 1 (Left Dr. Poirier) -->
        <path d="M45 42 C40 50 40 65 52 75 C58 80 62 80 64 72 C60 62 58 52 58 42 C58 36 50 36 45 42 Z" fill="{pal['accent']}" opacity="0.9"/>
        <!-- Ribbon 2 (Right Dr. Tremblay) -->
        <path d="M85 42 C90 50 90 65 78 75 C72 80 68 80 66 72 C70 62 72 52 72 42 C72 36 80 36 85 42 Z" fill="{pal['light']}" opacity="0.95"/>
        <!-- United Dental Core -->
        <path d="M54 44 C54 38 60 36 65 40 C70 36 76 38 76 44 C76 54 73 62 69 70 C67 74 65 74 65 69 C65 74 63 74 61 70 C57 62 54 54 54 44 Z" fill="#FFFFFF"/>
        <!-- Monogram Badge -->
        <rect x="47" y="84" width="36" height="14" rx="7" fill="{pal['c2']}"/>
        <text x="65" y="95" font-family="system-ui, -apple-system, sans-serif" font-size="8.5" font-weight="900" fill="#FFFFFF" text-anchor="middle" letter-spacing="1">{mono}</text>
        """

    elif shape == "laurel_crest":
        # Clinique Laurier: Laurel Wreath of Distinction + Star Tooth
        badge_svg = f"""
        <circle cx="65" cy="60" r="44" fill="url(#{gid}_main)" filter="url(#{gid}_shadow)"/>
        <!-- Golden Laurel Leaves Left -->
        <path d="M38 64 C35 56 36 46 42 38 C44 42 43 48 40 54 C45 48 47 40 53 36 C52 42 49 48 46 56 C51 52 56 46 60 42" fill="none" stroke="{pal['c2']}" stroke-width="2.5" stroke-linecap="round"/>
        <!-- Golden Laurel Leaves Right -->
        <path d="M92 64 C95 56 94 46 88 38 C86 42 87 48 90 54 C85 48 83 40 77 36 C78 42 81 48 84 56 C79 52 74 46 70 42" fill="none" stroke="{pal['c2']}" stroke-width="2.5" stroke-linecap="round"/>
        <!-- Central Tooth -->
        <path d="M53 45 C53 38 60 36 65 41 C70 36 77 38 77 45 C77 56 74 64 69 72 C67 76 65 76 65 71 C65 76 63 76 61 72 C56 64 53 56 53 45 Z" fill="#FFFFFF"/>
        <!-- Gold Star of Excellence -->
        <polygon points="65,26 67,31 72,31 68,34 70,39 65,36 60,39 62,34 58,31 63,31" fill="{pal['c2']}"/>
        <!-- Monogram Badge -->
        <rect x="52" y="83" width="26" height="15" rx="7.5" fill="{pal['c2']}"/>
        <text x="65" y="94" font-family="system-ui, -apple-system, sans-serif" font-size="9" font-weight="900" fill="#1E3A8A" text-anchor="middle">{mono}</text>
        """

    elif shape == "boutique_dual":
        # Dr Eskenazi & Dr Suissa: Dual Curving Cusps & Elegant Ampersand Monogram
        badge_svg = f"""
        <rect x="25" y="16" width="80" height="88" rx="22" fill="url(#{gid}_main)" filter="url(#{gid}_shadow)"/>
        <rect x="29" y="20" width="72" height="80" rx="18" fill="none" stroke="{pal['c2']}" stroke-width="1.5" opacity="0.5"/>
        <!-- Dual Curving Tooth Outline -->
        <path d="M48 42 C48 34 57 32 65 38 C73 32 82 34 82 42 C82 56 78 66 72 75 C69 79 66 79 65 74 C64 79 61 79 58 75 C52 66 48 56 48 42 Z" fill="none" stroke="#FFFFFF" stroke-width="2.5"/>
        <!-- Ampersand & Monogram Center -->
        <circle cx="65" cy="56" r="16" fill="{pal['c2']}"/>
        <text x="65" y="62" font-family="Georgia, serif" font-size="14" font-weight="bold" fill="#FFFFFF" text-anchor="middle">&amp;</text>
        <!-- Monogram Base -->
        <rect x="44" y="82" width="42" height="15" rx="7.5" fill="{pal['light']}"/>
        <text x="65" y="93" font-family="system-ui, -apple-system, sans-serif" font-size="8.5" font-weight="900" fill="{pal['text_sub']}" text-anchor="middle" letter-spacing="1.5">{mono}</text>
        """

    elif shape == "urban_cross":
        # Dundas Ossington: Modern Urban Crossroad + Enamel Smile
        badge_svg = f"""
        <rect x="24" y="16" width="82" height="88" rx="18" fill="url(#{gid}_main)" filter="url(#{gid}_shadow)"/>
        <!-- Minimal Crosshair Grid -->
        <line x1="24" y1="60" x2="106" y2="60" stroke="{pal['c2']}" stroke-width="1.5" stroke-dasharray="3 3" opacity="0.6"/>
        <line x1="65" y1="16" x2="65" y2="104" stroke="{pal['c2']}" stroke-width="1.5" stroke-dasharray="3 3" opacity="0.6"/>
        <!-- Central Modern Tooth Silhouette -->
        <path d="M52 42 C52 34 60 32 65 37 C70 32 78 34 78 42 C78 54 75 63 70 72 C68 76 66 76 65 71 C64 76 62 76 60 72 C55 63 52 54 52 42 Z" fill="#FFFFFF"/>
        <circle cx="65" cy="52" r="5" fill="{pal['c2']}"/>
        <!-- Monogram Badge -->
        <rect x="48" y="82" width="34" height="14" rx="7" fill="{pal['c2']}"/>
        <text x="65" y="93" font-family="system-ui, -apple-system, sans-serif" font-size="8.5" font-weight="900" fill="#FFFFFF" text-anchor="middle" letter-spacing="1">{mono}</text>
        """

    elif shape == "pine_crest":
        # Espanola: Northern Pine & Forest Shield
        badge_svg = f"""
        <path d="M26 24 C26 24 65 14 65 14 C65 14 104 24 104 24 C104 60 90 88 65 106 C40 88 26 60 26 24 Z" fill="url(#{gid}_main)" filter="url(#{gid}_shadow)"/>
        <!-- Pine Tree Silhouette in White/Mint -->
        <polygon points="65,28 72,40 68,40 75,52 70,52 78,66 52,66 60,52 55,52 62,40 58,40" fill="{pal['accent']}" opacity="0.9"/>
        <!-- Tooth Profile emerging from Pine -->
        <path d="M54 50 C54 44 60 42 65 46 C70 42 76 44 76 50 C76 60 73 68 69 76 C67 80 65 80 65 75 C65 80 63 80 61 76 C57 68 54 60 54 50 Z" fill="#FFFFFF"/>
        <!-- Monogram Badge -->
        <rect x="47" y="84" width="36" height="14" rx="7" fill="{pal['c2']}"/>
        <text x="65" y="95" font-family="system-ui, -apple-system, sans-serif" font-size="8.5" font-weight="900" fill="#FFFFFF" text-anchor="middle" letter-spacing="1">{mono}</text>
        """

    elif shape == "pacific_wave":
        # Fraserview: Pacific Coastal Wave & Mountain Crest
        badge_svg = f"""
        <circle cx="65" cy="60" r="44" fill="url(#{gid}_main)" filter="url(#{gid}_shadow)"/>
        <!-- Ocean Wave & Mountain Path -->
        <path d="M30 65 C45 50 55 75 75 58 C85 50 95 62 100 68 C96 85 82 98 65 98 C48 98 34 85 30 65 Z" fill="{pal['accent']}" opacity="0.6"/>
        <path d="M36 72 Q52 55 68 66 T100 70" fill="none" stroke="{pal['light']}" stroke-width="2"/>
        <!-- Central Tooth Profile -->
        <path d="M53 40 C53 32 60 30 65 35 C70 30 77 32 77 40 C77 52 74 61 69 70 C67 74 65 74 65 69 C65 74 63 74 61 70 C56 61 53 52 53 40 Z" fill="#FFFFFF"/>
        <!-- Sun Spark -->
        <circle cx="75" cy="34" r="3" fill="#FCD34D"/>
        <!-- Monogram -->
        <rect x="49" y="82" width="32" height="14" rx="7" fill="{pal['c2']}"/>
        <text x="65" y="93" font-family="system-ui, -apple-system, sans-serif" font-size="8.5" font-weight="900" fill="#FFFFFF" text-anchor="middle" letter-spacing="1">{mono}</text>
        """

    elif shape == "diamond_shield":
        # Greystone: Faceted Diamond Stone & Sparkle Star
        badge_svg = f"""
        <path d="M65 16 L104 38 L92 90 L65 106 L38 90 L26 38 Z" fill="url(#{gid}_main)" filter="url(#{gid}_shadow)"/>
        <!-- Diamond Facet Lines -->
        <line x1="65" y1="16" x2="65" y2="106" stroke="{pal['c2']}" stroke-width="1.5" opacity="0.7"/>
        <line x1="26" y1="38" x2="104" y2="38" stroke="{pal['c2']}" stroke-width="1.5" opacity="0.7"/>
        <polygon points="65,16 104,38 65,58 26,38" fill="{pal['c2']}" opacity="0.25"/>
        <!-- Central Luminous Tooth -->
        <path d="M53 46 C53 38 60 35 65 40 C70 35 77 38 77 46 C77 56 74 64 69 72 C67 76 65 76 65 71 C65 76 63 76 61 72 C56 64 53 56 53 46 Z" fill="#FFFFFF"/>
        <!-- Gold Dental Star -->
        <polygon points="65,34 67,39 72,39 68,42 70,47 65,44 60,47 62,42 58,39 63,39" fill="{pal['c2']}"/>
        <!-- Monogram -->
        <rect x="46" y="84" width="38" height="14" rx="7" fill="{pal['c2']}"/>
        <text x="65" y="95" font-family="system-ui, -apple-system, sans-serif" font-size="8.5" font-weight="900" fill="#FFFFFF" text-anchor="middle" letter-spacing="1">{mono}</text>
        """

    elif shape == "heart_crest":
        # Le Dentiste Hochelaga: Heart-Smile Contour + Chic Modern Molar
        badge_svg = f"""
        <circle cx="65" cy="60" r="44" fill="url(#{gid}_main)" filter="url(#{gid}_shadow)"/>
        <!-- Heart / Smile Arch Outer Glow -->
        <path d="M65 86 C40 68 32 50 42 36 C50 26 62 30 65 38 C68 30 80 26 88 36 C98 50 90 68 65 86 Z" fill="{pal['c2']}" opacity="0.35"/>
        <!-- Pure White Tooth Silhouette -->
        <path d="M53 44 C53 36 60 33 65 38 C70 33 77 36 77 44 C77 55 74 64 69 73 C67 77 65 77 65 72 C65 77 63 77 61 73 C56 64 53 55 53 44 Z" fill="#FFFFFF"/>
        <!-- Coral Smile Arc -->
        <path d="M56 54 Q65 64 74 54" fill="none" stroke="{pal['c2']}" stroke-width="2.5" stroke-linecap="round"/>
        <!-- Monogram Pill -->
        <rect x="49" y="82" width="32" height="14" rx="7" fill="{pal['c2']}"/>
        <text x="65" y="93" font-family="system-ui, -apple-system, sans-serif" font-size="8.5" font-weight="900" fill="#FFFFFF" text-anchor="middle" letter-spacing="1">{mono}</text>
        """

    elif shape == "current_wave":
        # Little Current: Manitoulin Nautical Wave + Shield
        badge_svg = f"""
        <path d="M26 24 C26 24 65 14 65 14 C65 14 104 24 104 24 C104 60 90 88 65 106 C40 88 26 60 26 24 Z" fill="url(#{gid}_main)" filter="url(#{gid}_shadow)"/>
        <!-- Wave Currents -->
        <path d="M32 50 Q48 38 65 50 T98 50" fill="none" stroke="{pal['accent']}" stroke-width="3" stroke-linecap="round"/>
        <path d="M34 62 Q50 50 65 62 T96 62" fill="none" stroke="{pal['light']}" stroke-width="2" stroke-linecap="round"/>
        <!-- Central Enamel Tooth -->
        <path d="M53 42 C53 34 60 32 65 37 C70 32 77 34 77 42 C77 54 74 63 69 72 C67 76 65 76 65 71 C65 76 63 76 61 72 C56 63 53 54 53 42 Z" fill="#FFFFFF"/>
        <!-- Compass Spark -->
        <polygon points="65,28 67,33 72,33 68,36 70,41 65,38 60,41 62,36 58,33 63,33" fill="{pal['accent']}"/>
        <!-- Monogram Badge -->
        <rect x="49" y="84" width="32" height="14" rx="7" fill="{pal['c2']}"/>
        <text x="65" y="95" font-family="system-ui, -apple-system, sans-serif" font-size="8.5" font-weight="900" fill="#FFFFFF" text-anchor="middle" letter-spacing="1">{mono}</text>
        """

    elif shape == "maritime_crest":
        # MicMac: Lighthouse Beam & Atlantic Anchor Shield
        badge_svg = f"""
        <path d="M26 24 C26 24 65 14 65 14 C65 14 104 24 104 24 C104 60 90 88 65 106 C40 88 26 60 26 24 Z" fill="url(#{gid}_main)" filter="url(#{gid}_shadow)"/>
        <!-- Light Beams from Crown -->
        <polygon points="65,24 35,68 95,68" fill="{pal['c2']}" opacity="0.3"/>
        <!-- Tooth Silhouette -->
        <path d="M53 44 C53 36 60 33 65 38 C70 33 77 36 77 44 C77 55 74 64 69 73 C67 77 65 77 65 72 C65 77 63 77 61 73 C56 64 53 55 53 44 Z" fill="#FFFFFF"/>
        <!-- Maritime Beacon Star -->
        <circle cx="65" cy="28" r="4" fill="{pal['c2']}"/>
        <!-- Monogram -->
        <rect x="47" y="84" width="36" height="14" rx="7" fill="{pal['c2']}"/>
        <text x="65" y="95" font-family="system-ui, -apple-system, sans-serif" font-size="8.5" font-weight="900" fill="#FFFFFF" text-anchor="middle" letter-spacing="1">{mono}</text>
        """

    elif shape == "botanical_leaf":
        # Yorkson Dental: Fraser Valley Botanical Leaves + Tooth Crest
        badge_svg = f"""
        <circle cx="65" cy="60" r="44" fill="url(#{gid}_main)" filter="url(#{gid}_shadow)"/>
        <!-- Botanical Leaves Curving inward -->
        <path d="M38 60 C38 44 50 36 62 34 C60 48 50 62 38 60 Z" fill="{pal['c2']}" opacity="0.85"/>
        <path d="M92 60 C92 44 80 36 68 34 C70 48 80 62 92 60 Z" fill="{pal['accent']}" opacity="0.85"/>
        <!-- Central Enamel Tooth -->
        <path d="M53 44 C53 36 60 33 65 38 C70 33 77 36 77 44 C77 55 74 64 69 73 C67 77 65 77 65 72 C65 77 63 77 61 73 C56 64 53 55 53 44 Z" fill="#FFFFFF"/>
        <circle cx="65" cy="50" r="3" fill="{pal['accent']}"/>
        <!-- Monogram -->
        <rect x="49" y="82" width="32" height="14" rx="7" fill="{pal['c2']}"/>
        <text x="65" y="93" font-family="system-ui, -apple-system, sans-serif" font-size="8.5" font-weight="900" fill="#FFFFFF" text-anchor="middle" letter-spacing="1">{mono}</text>
        """

    elif shape == "lake_shield":
        # Lakeside: Lake Shoreline Ripples + 3 Family Stars + Tooth
        badge_svg = f"""
        <rect x="25" y="16" width="80" height="88" rx="20" fill="url(#{gid}_main)" filter="url(#{gid}_shadow)"/>
        <!-- Lake Water Ripples -->
        <path d="M32 74 Q48 66 65 74 T98 74" fill="none" stroke="{pal['accent']}" stroke-width="2.5" stroke-linecap="round"/>
        <path d="M36 82 Q50 76 65 82 T94 82" fill="none" stroke="{pal['light']}" stroke-width="1.8" stroke-linecap="round"/>
        <!-- Central Tooth -->
        <path d="M53 40 C53 32 60 29 65 34 C70 29 77 32 77 40 C77 52 74 61 69 70 C67 74 65 74 65 69 C65 74 63 74 61 70 C56 61 53 52 53 40 Z" fill="#FFFFFF"/>
        <!-- 3 Family Stars -->
        <polygon points="65,24 66.5,27.5 70,27.5 67,29.5 68.5,33 65,31 61.5,33 63,29.5 60,27.5 63.5,27.5" fill="#FCD34D"/>
        <circle cx="48" cy="30" r="2" fill="#FCD34D"/>
        <circle cx="82" cy="30" r="2" fill="#FCD34D"/>
        <!-- Monogram -->
        <rect x="47" y="86" width="36" height="14" rx="7" fill="{pal['c2']}"/>
        <text x="65" y="97" font-family="system-ui, -apple-system, sans-serif" font-size="8.5" font-weight="900" fill="#FFFFFF" text-anchor="middle" letter-spacing="1">{mono}</text>
        """

    elif shape == "sunburst_crest":
        # Savannah Dental: Radiant Prairie Sunburst + Brilliant Tooth
        badge_svg = f"""
        <circle cx="65" cy="60" r="44" fill="url(#{gid}_main)" filter="url(#{gid}_shadow)"/>
        <!-- Sunburst Rays -->
        <g stroke="{pal['c2']}" stroke-width="2" opacity="0.6">
            <line x1="65" y1="20" x2="65" y2="28"/>
            <line x1="65" y1="92" x2="65" y2="100"/>
            <line x1="25" y1="60" x2="33" y2="60"/>
            <line x1="97" y1="60" x2="105" y2="60"/>
            <line x1="37" y1="32" x2="43" y2="38"/>
            <line x1="87" y1="82" x2="93" y2="88"/>
            <line x1="37" y1="88" x2="43" y2="82"/>
            <line x1="87" y1="38" x2="93" y2="32"/>
        </g>
        <!-- Golden Center Disc -->
        <circle cx="65" cy="60" r="28" fill="{pal['c2']}" opacity="0.8"/>
        <!-- Central Tooth -->
        <path d="M53 45 C53 37 60 34 65 39 C70 34 77 37 77 45 C77 56 74 65 69 74 C67 78 65 78 65 73 C65 78 63 78 61 74 C56 65 53 56 53 45 Z" fill="#FFFFFF"/>
        <!-- Spark -->
        <polygon points="65,32 66.5,35.5 70,35.5 67,37.5 68.5,41 65,39 61.5,41 63,37.5 60,35.5 63.5,35.5" fill="#FEF3C7"/>
        <!-- Monogram -->
        <rect x="49" y="82" width="32" height="14" rx="7" fill="{pal['c1']}"/>
        <text x="65" y="93" font-family="system-ui, -apple-system, sans-serif" font-size="8.5" font-weight="900" fill="#FFFFFF" text-anchor="middle" letter-spacing="1">{mono}</text>
        """

    elif shape == "meadow_crest":
        # Meadow Dental Care: Curved Blades of Grass + Floral Dental Cusp
        badge_svg = f"""
        <circle cx="65" cy="60" r="44" fill="url(#{gid}_main)" filter="url(#{gid}_shadow)"/>
        <!-- Meadow Grass Blades -->
        <path d="M40 76 C42 54 54 44 65 42 C60 56 52 70 40 76 Z" fill="{pal['accent']}" opacity="0.9"/>
        <path d="M90 76 C88 54 76 44 65 42 C70 56 78 70 90 76 Z" fill="{pal['c2']}" opacity="0.9"/>
        <!-- White Enamel Molar Silhouette -->
        <path d="M53 44 C53 36 60 33 65 38 C70 33 77 36 77 44 C77 55 74 64 69 73 C67 77 65 77 65 72 C65 77 63 77 61 73 C56 64 53 55 53 44 Z" fill="#FFFFFF"/>
        <!-- Dewdrop Sparkle -->
        <circle cx="65" cy="36" r="3" fill="{pal['light']}"/>
        <!-- Monogram Badge -->
        <rect x="46" y="82" width="38" height="14" rx="7" fill="{pal['c2']}"/>
        <text x="65" y="93" font-family="system-ui, -apple-system, sans-serif" font-size="8.5" font-weight="900" fill="#FFFFFF" text-anchor="middle" letter-spacing="1">{mono}</text>
        """

    elif shape == "tapestry_shield":
        # Tapestry Dental: Interwoven Geometric Tapestry Knot & Modern Dental Crest
        badge_svg = f"""
        <rect x="25" y="16" width="80" height="88" rx="20" fill="url(#{gid}_main)" filter="url(#{gid}_shadow)"/>
        <!-- Woven Ribbon Knot Outline -->
        <path d="M45 35 L85 35 L85 75 L45 75 Z" fill="none" stroke="{pal['c2']}" stroke-width="2.5" transform="rotate(45 65 55)"/>
        <path d="M45 35 L85 35 L85 75 L45 75 Z" fill="none" stroke="{pal['accent']}" stroke-width="1.8" transform="rotate(0 65 55)"/>
        <!-- Central Enamel Tooth -->
        <path d="M53 44 C53 36 60 33 65 38 C70 33 77 36 77 44 C77 55 74 64 69 73 C67 77 65 77 65 72 C65 77 63 77 61 73 C56 64 53 55 53 44 Z" fill="#FFFFFF"/>
        <!-- Monogram -->
        <rect x="49" y="83" width="32" height="14" rx="7" fill="{pal['c2']}"/>
        <text x="65" y="94" font-family="system-ui, -apple-system, sans-serif" font-size="8.5" font-weight="900" fill="#FFFFFF" text-anchor="middle" letter-spacing="1">{mono}</text>
        """

    # Typography sizing calculation based on name length
    primary_text = cfg["primary"]
    p_len = len(primary_text)
    if p_len > 24:
        p_size = "15"
        p_y = "48"
    elif p_len > 18:
        p_size = "17"
        p_y = "50"
    elif p_len > 14:
        p_size = "19"
        p_y = "52"
    else:
        p_size = "21"
        p_y = "53"

    svg_content = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 120" width="400" height="120">
  <defs>
    <linearGradient id="{gid}_main" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="{pal['c1']}"/>
      <stop offset="100%" stop-color="{pal.get('c2', pal['c1'])}"/>
    </linearGradient>
    <filter id="{gid}_shadow" x="-10%" y="-10%" width="130%" height="130%">
      <feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#0F172A" flood-opacity="0.18"/>
    </filter>
  </defs>

  <!-- Transparent Container Canvas -->
  <rect width="400" height="120" fill="transparent"/>

  <!-- Brand Emblem Vector Crest -->
  <g id="brand-crest">
    {badge_svg}
  </g>

  <!-- Clean Brand Typography -->
  <g id="brand-typography">
    <!-- Primary Clinic Name -->
    <text x="124" y="{p_y}" font-family="system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="{p_size}" font-weight="800" fill="{pal['text_main']}" letter-spacing="0.2">{esc(primary_text)}</text>
    <!-- Secondary Designation -->
    <text x="125" y="{int(p_y) + 21}" font-family="system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="11.5" font-weight="700" fill="{pal['text_sub']}" letter-spacing="2.2">{esc(cfg['secondary'])}</text>
    <!-- Location & Credential Tag -->
    <text x="125" y="{int(p_y) + 39}" font-family="system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="9.5" font-weight="500" fill="#64748B" letter-spacing="1.2">{esc(cfg['tag'])}</text>
  </g>
</svg>"""
    return svg_content

if __name__ == "__main__":
    out_dir = "public/exports/leads_logos_svg"
    os.makedirs(out_dir, exist_ok=True)
    for slug in EMBLEMS:
        svg = generate_emblem_svg(slug)
        filepath = os.path.join(out_dir, f"{slug}.svg")
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(svg)
        print(f"Generated {filepath} ({len(svg)} bytes)")
