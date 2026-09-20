import os
from PIL import Image, ImageDraw, ImageFont

def patch_screenshot():
    src_path = 'd:/projects/OmniGit/docs/images/omnigit_workbench_preview.png'
    im = Image.open(src_path).convert('RGBA')

    # Reusable icons from original image
    # User icon from top user pill: original at x=722 to 735, y=8 to 19
    user_icon = im.crop((722, 8, 735, 19))
    # '+4' badge from user pill: original at x=771 to 789, y=7 to 20
    badge_plus4 = im.crop((771, 7, 789, 20))

    draw = ImageDraw.Draw(im)

    # Windows Fonts
    font_segoe_11 = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 11)
    font_segoe_10 = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 10)
    font_segoe_bold_11 = ImageFont.truetype('C:/Windows/Fonts/seguisb.ttf', 11)
    font_segoe_bold_10 = ImageFont.truetype('C:/Windows/Fonts/seguisb.ttf', 10)
    font_segoe_bold_9 = ImageFont.truetype('C:/Windows/Fonts/seguisb.ttf', 9)
    font_consola_10 = ImageFont.truetype('C:/Windows/Fonts/consola.ttf', 10)
    font_yahei_11 = ImageFont.truetype('C:/Windows/Fonts/msyh.ttc', 11)

    TOP_BAR_BG = (237, 238, 242, 255)
    SIDEBAR_BG = (233, 237, 243, 255)
    ACTIVE_CARD_BG = (219, 234, 254, 255)

    # =========================================================================
    # 1. Top Bar: Version Badge (v0.1.0 -> v0.3.0)
    # =========================================================================
    draw.rounded_rectangle((86, 7, 122, 20), radius=3, fill=(224, 242, 254, 255), outline=(186, 230, 253, 255))
    draw.text((89, 7), 'v0.3.0', font=font_segoe_bold_9, fill=(2, 132, 199, 255))

    # =========================================================================
    # 2. Top Bar: Active Repo Pill (SJSM sjsmaelm -> OMNI omnigit)
    # =========================================================================
    draw.rectangle((127, 5, 199, 22), fill=(255, 255, 255, 255))
    draw.rounded_rectangle((128, 7, 155, 20), radius=3, fill=(59, 130, 246, 255))
    draw.text((130, 8), 'OMNI', font=font_segoe_bold_9, fill=(255, 255, 255, 255))
    draw.text((159, 7), 'omnigit', font=font_segoe_bold_10, fill=(30, 41, 59, 255))
    draw.line([(199, 12), (202, 15), (205, 12)], fill=(148, 163, 184, 255), width=1)

    # =========================================================================
    # 3. Top Bar: User Pill (wangyu -> Developer)
    # =========================================================================
    draw.rectangle((714, 3, 825, 24), fill=TOP_BAR_BG)
    draw.rounded_rectangle((715, 4, 820, 23), radius=9, fill=(255, 255, 255, 255), outline=(209, 213, 219, 255))
    im.paste(user_icon, (721, 8), user_icon)
    draw.text((736, 7), 'Developer', font=font_segoe_bold_10, fill=(30, 41, 59, 255))
    im.paste(badge_plus4, (790, 7), badge_plus4)
    draw.line([(811, 12), (813, 14), (815, 12)], fill=(148, 163, 184, 255), width=1)

    # =========================================================================
    # 4. Left Sidebar: Repo 1 (gov-back-ebm-sjs -> omnigit-server)
    # =========================================================================
    draw.rectangle((8, 60, 140, 75), fill=SIDEBAR_BG)
    draw.text((10, 61), 'omnigit-server', font=font_segoe_bold_10, fill=(15, 23, 42, 255))

    # =========================================================================
    # 5. Left Sidebar: Repo 2 Active Card (sjsmaelm -> omnigit-core)
    # =========================================================================
    draw.rectangle((8, 96, 115, 111), fill=ACTIVE_CARD_BG)
    draw.text((10, 97), 'omnigit-core', font=font_segoe_bold_11, fill=(37, 99, 235, 255))

    # =========================================================================
    # 6. Left Sidebar: Bottom User Profile (wangyu -> Developer)
    # =========================================================================
    draw.rectangle((1, 538, 75, 558), fill=SIDEBAR_BG)
    draw.ellipse((4, 542, 14, 552), fill=(37, 99, 235, 255))
    draw.text((6, 541), 'D', font=font_segoe_bold_9, fill=(255, 255, 255, 255))
    draw.text((17, 542), 'Developer', font=font_segoe_11, fill=(51, 65, 85, 255))

    # =========================================================================
    # 7. Commit Message Textarea
    # =========================================================================
    draw.rectangle((175, 462, 382, 522), fill=(255, 255, 255, 255))
    draw.text((182, 468), 'feat(merge): 支持多分支冲突可视化比对', font=font_yahei_11, fill=(30, 41, 59, 255))
    draw.text((182, 484), '并智能采纳冲突代码', font=font_yahei_11, fill=(30, 41, 59, 255))

    # =========================================================================
    # 8. Diff Editor: Line 58/59 Conflict code
    # =========================================================================
    # Left pane line 58: clear white strip from x=444 all the way to x=684
    draw.rectangle((444, 318, 684, 331), fill=(255, 255, 255, 255))
    draw.text((454, 319), '"@omnigit/diff-engine": "^1.2.0",', font=font_consola_10, fill=(50, 50, 50, 255))

    # Right pane line 59: full white strip from x=591 to 1020, y=318 to 331
    draw.rectangle((591, 318, 1020, 331), fill=(255, 255, 255, 255))
    draw.text((612, 319), '"@omnigit/diff-engine": "^2.0.0",', font=font_consola_10, fill=(50, 50, 50, 255))

    # Overwrite destination file
    dst_path = 'd:/projects/OmniGit/docs/images/omnigit_workbench_preview.png'
    im.save(dst_path)
    print(f'Successfully updated {dst_path}')

if __name__ == '__main__':
    patch_screenshot()
