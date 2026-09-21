import os
from PIL import Image, ImageDraw, ImageFont

def generate_assets():
    tut_dir = 'd:/projects/OmniGit/docs/tutorial_images'
    os.makedirs(tut_dir, exist_ok=True)

    src_img = 'd:/projects/OmniGit/docs/images/omnigit_workbench_preview.png'
    im = Image.open(src_img)

    # 1. Top bar: (0, 0, 1024, 40)
    im.crop((0, 0, 1024, 40)).save(os.path.join(tut_dir, 'tut_topbar.png'))

    # 2. Left repo list: (0, 35, 170, 220)
    im.crop((0, 35, 170, 220)).save(os.path.join(tut_dir, 'tut_repolist.png'))

    # 3. Changes panel & commit: (170, 35, 395, 566)
    im.crop((170, 35, 395, 566)).save(os.path.join(tut_dir, 'tut_changes.png'))

    # 4. Conflict banner & tools: (390, 75, 1024, 155)
    im.crop((390, 75, 1024, 155)).save(os.path.join(tut_dir, 'tut_conflict_bar.png'))

    # 5. Monaco Diff editor: (390, 135, 1024, 566)
    im.crop((390, 135, 1024, 566)).save(os.path.join(tut_dir, 'tut_diff_editor.png'))

    # 6. Generate 3-Way Merge infographic diagram
    diag_w, diag_h = 750, 240
    diag = Image.new('RGB', (diag_w, diag_h), (248, 250, 252))
    draw = ImageDraw.Draw(diag)
    font_title = ImageFont.truetype('C:/Windows/Fonts/msyhbd.ttc', 13)
    font_text = ImageFont.truetype('C:/Windows/Fonts/msyh.ttc', 11)
    font_bold = ImageFont.truetype('C:/Windows/Fonts/msyhbd.ttc', 11)
    font_code = ImageFont.truetype('C:/Windows/Fonts/consola.ttf', 11)

    # Left box: Yours (本地改动)
    draw.rounded_rectangle((25, 30, 230, 215), radius=8, fill=(239, 246, 255), outline=(59, 130, 246), width=2)
    draw.text((40, 45), '左栏：本地代码 (Yours)', font=font_title, fill=(30, 64, 175))
    draw.text((40, 75), '• 当前分支现存代码', font=font_text, fill=(71, 85, 105))
    draw.text((40, 98), '• 标明自己在此处的修改', font=font_text, fill=(71, 85, 105))
    draw.text((40, 125), '示例值：', font=font_bold, fill=(30, 64, 175))
    draw.rectangle((40, 148, 215, 185), fill=(255, 255, 255), outline=(203, 213, 225))
    draw.text((48, 158), 'version: 1.2.0', font=font_code, fill=(30, 41, 59))

    # Middle box: Result (最终合并结果)
    draw.rounded_rectangle((270, 20, 480, 225), radius=8, fill=(240, 253, 244), outline=(34, 197, 94), width=3)
    draw.text((285, 35), '中栏：最终结果 (Result)', font=font_title, fill=(22, 101, 52))
    draw.text((285, 65), '• 点击双向箭头一键采纳', font=font_text, fill=(71, 85, 105))
    draw.text((285, 88), '• 最终将要提交的真实代码', font=font_text, fill=(71, 85, 105))
    draw.text((285, 111), '• 支持手动微调与语法防护', font=font_text, fill=(71, 85, 105))
    draw.rectangle((285, 140, 465, 195), fill=(255, 255, 255), outline=(134, 239, 172))
    draw.text((295, 150), 'version: 2.0.0', font=font_code, fill=(22, 101, 52))
    draw.text((295, 172), '[已智能合并采纳]', font=font_bold, fill=(22, 101, 52))

    # Right box: Theirs (传入分支改动)
    draw.rounded_rectangle((520, 30, 725, 215), radius=8, fill=(254, 242, 242), outline=(239, 68, 68), width=2)
    draw.text((535, 45), '右栏：传入代码 (Theirs)', font=font_title, fill=(153, 27, 27))
    draw.text((535, 75), '• 远程或待合入分支代码', font=font_text, fill=(71, 85, 105))
    draw.text((535, 98), '• 引起冲突的外部同事提交', font=font_text, fill=(71, 85, 105))
    draw.text((535, 125), '示例值：', font=font_bold, fill=(153, 27, 27))
    draw.rectangle((535, 148, 710, 185), fill=(255, 255, 255), outline=(203, 213, 225))
    draw.text((543, 158), 'version: 2.0.0', font=font_code, fill=(30, 41, 59))

    # Connecting arrows
    draw.line([(232, 115), (265, 115)], fill=(59, 130, 246), width=3)
    draw.polygon([(265, 110), (270, 115), (265, 120)], fill=(59, 130, 246))

    draw.line([(518, 115), (485, 115)], fill=(239, 68, 68), width=3)
    draw.polygon([(485, 110), (480, 115), (485, 120)], fill=(239, 68, 68))

    diag.save(os.path.join(tut_dir, 'tut_3way_concept.png'))
    print('Generated all tutorial illustration assets successfully!')

if __name__ == '__main__':
    generate_assets()
