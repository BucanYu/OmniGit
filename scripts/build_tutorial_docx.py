import os
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import parse_xml, OxmlElement
from docx.oxml.ns import nsdecls, qn

def set_run_font(run, font_name="Microsoft YaHei", size_pt=10.5, color_rgb=None, bold=False, italic=False):
    run.font.name = font_name
    run.font.size = Pt(size_pt)
    run.bold = bold
    run.italic = italic
    if color_rgb:
        run.font.color.rgb = color_rgb
    rPr = run._r.get_or_add_rPr()
    rFonts = rPr.find(qn('w:rFonts'))
    if rFonts is None:
        rFonts = parse_xml(f'<w:rFonts {nsdecls("w")} w:ascii="{font_name}" w:hAnsi="{font_name}" w:eastAsia="{font_name}"/>')
        rPr.append(rFonts)
    else:
        rFonts.set(qn('w:ascii'), font_name)
        rFonts.set(qn('w:hAnsi'), font_name)
        rFonts.set(qn('w:eastAsia'), font_name)

def set_cell_background(cell, fill_hex):
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>')
    cell._tc.get_or_add_tcPr().append(shd)

def set_cell_margins(cell, top=120, bottom=120, left=180, right=180):
    tcMar = parse_xml(f'''
        <w:tcMar {nsdecls("w")}>
            <w:top w:w="{top}" w:type="dxa"/>
            <w:left w:w="{left}" w:type="dxa"/>
            <w:bottom w:w="{bottom}" w:type="dxa"/>
            <w:right w:w="{right}" w:type="dxa"/>
        </w:tcMar>
    ''')
    cell._tc.get_or_add_tcPr().append(tcMar)

def set_callout_borders(cell, color_hex="3B82F6", sz="36"):
    borders = parse_xml(f'''
        <w:tcBorders {nsdecls("w")}>
            <w:top w:val="none"/>
            <w:left w:val="single" w:sz="{sz}" w:space="0" w:color="{color_hex}"/>
            <w:bottom w:val="none"/>
            <w:right w:val="none"/>
        </w:tcBorders>
    ''')
    cell._tc.get_or_add_tcPr().append(borders)

def set_table_borders(table):
    tblPr = table._tbl.tblPr
    borders = parse_xml(f'''
        <w:tblBorders {nsdecls("w")}>
            <w:top w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
            <w:left w:val="none"/>
            <w:bottom w:val="single" w:sz="10" w:space="0" w:color="94A3B8"/>
            <w:right w:val="none"/>
            <w:insideH w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/>
            <w:insideV w:val="none"/>
        </w:tblBorders>
    ''')
    tblPr.append(borders)

def add_callout_box(doc, title, text_items, callout_type='tip'):
    type_map = {
        'tip': {'bg': 'EFF6FF', 'border': '3B82F6', 'title_color': RGBColor(30, 64, 175), 'icon': '💡 核心技巧 (Pro Tip)'},
        'warning': {'bg': 'FEF2F2', 'border': 'EF4444', 'title_color': RGBColor(185, 28, 28), 'icon': '⚠️ 避坑提醒 (Important)'},
        'success': {'bg': 'F0FDF4', 'border': '22C55E', 'title_color': RGBColor(21, 128, 61), 'icon': '✅ 最佳实践 (Best Practice)'},
        'info': {'bg': 'FAF5FF', 'border': '8B5CF6', 'title_color': RGBColor(107, 33, 168), 'icon': '🔍 深度解析 (Deep Dive)'}
    }
    cfg = type_map.get(callout_type, type_map['tip'])

    table = doc.add_table(rows=1, cols=1)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False

    cell = table.cell(0, 0)
    cell.width = Inches(6.5)
    set_cell_background(cell, cfg['bg'])
    set_callout_borders(cell, cfg['border'], sz="36")
    set_cell_margins(cell, top=140, bottom=140, left=200, right=200)

    # Title paragraph
    p_title = cell.paragraphs[0]
    p_title.paragraph_format.space_before = Pt(2)
    p_title.paragraph_format.space_after = Pt(4)
    r_title = p_title.add_run(f"{cfg['icon']}：{title}")
    set_run_font(r_title, font_name="Microsoft YaHei", size_pt=10.5, color_rgb=cfg['title_color'], bold=True)

    # Content paragraphs
    if isinstance(text_items, str):
        text_items = [text_items]

    for item in text_items:
        p = cell.add_paragraph()
        p.paragraph_format.space_before = Pt(2)
        p.paragraph_format.space_after = Pt(4)
        p.paragraph_format.line_spacing = 1.3
        r = p.add_run(item)
        set_run_font(r, font_name="Microsoft YaHei", size_pt=9.5, color_rgb=RGBColor(51, 65, 85))

    p_spacer = doc.add_paragraph()
    p_spacer.paragraph_format.space_before = Pt(0)
    p_spacer.paragraph_format.space_after = Pt(4)

def add_styled_heading(doc, text, level=1):
    # Use doc.add_heading so that Heading 1 / Heading 2 style is bound
    p = doc.add_heading(level=level)
    pPr = p._p.get_or_add_pPr()

    # Crucial for WPS Office & Word Left Navigation Pane:
    # outlineLvl = 0 for Heading 1, 1 for Heading 2, 2 for Heading 3
    outline_elem = pPr.find(qn('w:outlineLvl'))
    if outline_elem is None:
        pPr.append(parse_xml(f'<w:outlineLvl {nsdecls("w")} w:val="{level - 1}"/>'))
    else:
        outline_elem.set(qn('w:val'), str(level - 1))

    # Ensure pStyle is set to Heading1 / Heading2 / Heading3
    pStyle = pPr.find(qn('w:pStyle'))
    if pStyle is None:
        pPr.append(parse_xml(f'<w:pStyle {nsdecls("w")} w:val="Heading{level}"/>'))
    else:
        pStyle.set(qn('w:val'), f'Heading{level}')

    if level == 1:
        p.paragraph_format.space_before = Pt(20)
        p.paragraph_format.space_after = Pt(8)
        p.paragraph_format.keep_with_next = True
        run = p.add_run(text)
        set_run_font(run, font_name="Microsoft YaHei", size_pt=15.5, color_rgb=RGBColor(30, 58, 138), bold=True)
    elif level == 2:
        p.paragraph_format.space_before = Pt(13)
        p.paragraph_format.space_after = Pt(5)
        p.paragraph_format.keep_with_next = True
        run = p.add_run(text)
        set_run_font(run, font_name="Microsoft YaHei", size_pt=12.5, color_rgb=RGBColor(37, 99, 235), bold=True)
    elif level == 3:
        p.paragraph_format.space_before = Pt(9)
        p.paragraph_format.space_after = Pt(3)
        p.paragraph_format.keep_with_next = True
        run = p.add_run(text)
        set_run_font(run, font_name="Microsoft YaHei", size_pt=11, color_rgb=RGBColor(30, 41, 59), bold=True)
    return p

def add_body_paragraph(doc, text="", bold_prefix=None, space_after=5, line_spacing=1.35):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(space_after)
    p.paragraph_format.line_spacing = line_spacing
    if bold_prefix:
        r_prefix = p.add_run(bold_prefix)
        set_run_font(r_prefix, font_name="Microsoft YaHei", size_pt=10, color_rgb=RGBColor(15, 23, 42), bold=True)
    if text:
        r_text = p.add_run(text)
        set_run_font(r_text, font_name="Microsoft YaHei", size_pt=10, color_rgb=RGBColor(51, 65, 85))
    return p

def add_bullet_item(doc, text, bold_prefix=None):
    p = doc.add_paragraph(style='List Bullet')
    p.paragraph_format.space_before = Pt(1)
    p.paragraph_format.space_after = Pt(3)
    p.paragraph_format.line_spacing = 1.3
    if bold_prefix:
        r_prefix = p.add_run(bold_prefix)
        set_run_font(r_prefix, font_name="Microsoft YaHei", size_pt=10, color_rgb=RGBColor(15, 23, 42), bold=True)
    r_text = p.add_run(text)
    set_run_font(r_text, font_name="Microsoft YaHei", size_pt=10, color_rgb=RGBColor(51, 65, 85))
    return p

def add_figure(doc, img_path, caption, width_in_inches=6.0):
    if not os.path.exists(img_path):
        print(f"Warning: Image not found: {img_path}")
        return
    p_img = doc.add_paragraph()
    p_img.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_img.paragraph_format.space_before = Pt(6)
    p_img.paragraph_format.space_after = Pt(4)
    run = p_img.add_run()
    run.add_picture(img_path, width=Inches(width_in_inches))

    p_cap = doc.add_paragraph()
    p_cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_cap.paragraph_format.space_before = Pt(2)
    p_cap.paragraph_format.space_after = Pt(10)
    p_cap.paragraph_format.keep_with_next = False
    r_cap = p_cap.add_run(caption)
    set_run_font(r_cap, font_name="Microsoft YaHei", size_pt=9, color_rgb=RGBColor(100, 116, 139), italic=True, bold=True)

def build_comparison_table(doc, headers, data, col_widths=None):
    table = doc.add_table(rows=len(data) + 1, cols=len(headers))
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    set_table_borders(table)

    # Format Header Row
    hdr_cells = table.rows[0].cells
    for i, title in enumerate(headers):
        hdr_cells[i].text = ""
        set_cell_background(hdr_cells[i], "1E40AF") # Deep tech blue
        set_cell_margins(hdr_cells[i], top=140, bottom=140, left=160, right=160)
        p = hdr_cells[i].paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.LEFT
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(0)
        r = p.add_run(title)
        set_run_font(r, font_name="Microsoft YaHei", size_pt=9.5, color_rgb=RGBColor(255, 255, 255), bold=True)
        if col_widths and i < len(col_widths):
            hdr_cells[i].width = Inches(col_widths[i])

    # Format Data Rows
    for row_idx, row_data in enumerate(data):
        row_cells = table.rows[row_idx + 1].cells
        bg_color = "F8FAFC" if row_idx % 2 == 1 else "FFFFFF"
        for col_idx, text in enumerate(row_data):
            row_cells[col_idx].text = ""
            set_cell_background(row_cells[col_idx], bg_color)
            set_cell_margins(row_cells[col_idx], top=120, bottom=120, left=160, right=160)
            p = row_cells[col_idx].paragraphs[0]
            p.alignment = WD_ALIGN_PARAGRAPH.LEFT
            p.paragraph_format.space_before = Pt(0)
            p.paragraph_format.space_after = Pt(0)
            p.paragraph_format.line_spacing = 1.25
            r = p.add_run(text)
            bold_flag = True if col_idx == 0 or col_idx == 1 else False
            color = RGBColor(30, 41, 59) if bold_flag else RGBColor(71, 85, 105)
            set_run_font(r, font_name="Microsoft YaHei", size_pt=9, color_rgb=color, bold=bold_flag)
            if col_widths and col_idx < len(col_widths):
                row_cells[col_idx].width = Inches(col_widths[col_idx])

    p_spacer = doc.add_paragraph()
    p_spacer.paragraph_format.space_before = Pt(2)
    p_spacer.paragraph_format.space_after = Pt(6)

def generate_full_tutorial():
    doc = docx.Document()

    # Configure styles to ensure WPS & Word recognize Heading 1/2/3 with Chinese aliases & outline levels
    for lvl in range(1, 4):
        style_name = f'Heading {lvl}'
        if style_name in doc.styles:
            st = doc.styles[style_name]
            st.font.name = "Microsoft YaHei"
            # Alias for Chinese Office/WPS
            aliases = st.element.find(qn('w:aliases'))
            if aliases is None:
                aliases = parse_xml(f'<w:aliases {nsdecls("w")} w:val="标题 {lvl}"/>')
                st.element.insert(1, aliases)
            # Outline level in style
            pPr = st.element.get_or_add_pPr()
            outline_elem = pPr.find(qn('w:outlineLvl'))
            if outline_elem is None:
                pPr.append(parse_xml(f'<w:outlineLvl {nsdecls("w")} w:val="{lvl - 1}"/>'))
            else:
                outline_elem.set(qn('w:val'), str(lvl - 1))

    # Set page margins to 0.8 inches
    sections = doc.sections
    for s in sections:
        s.top_margin = Inches(0.8)
        s.bottom_margin = Inches(0.8)
        s.left_margin = Inches(0.85)
        s.right_margin = Inches(0.85)

    base_dir = "d:/projects/OmniGit"
    tut_img_dir = os.path.join(base_dir, "docs/tutorial_images")
    main_preview = os.path.join(base_dir, "docs/images/omnigit_workbench_preview.png")

    # ==========================================
    # 封面与文档头 (Cover & Header)
    # ==========================================
    p_cover_tag = doc.add_paragraph()
    p_cover_tag.paragraph_format.space_before = Pt(10)
    p_cover_tag.paragraph_format.space_after = Pt(4)
    r_tag = p_cover_tag.add_run("OFFICIAL USER GUIDE & BEST PRACTICES | 官方用户手册与最佳实践")
    set_run_font(r_tag, font_name="Consolas", size_pt=9, color_rgb=RGBColor(37, 99, 235), bold=True)

    p_title = doc.add_paragraph()
    p_title.paragraph_format.space_before = Pt(2)
    p_title.paragraph_format.space_after = Pt(6)
    r_title = p_title.add_run("OmniGit 零基础到精通实战指南")
    set_run_font(r_title, font_name="Microsoft YaHei", size_pt=24, color_rgb=RGBColor(30, 58, 138), bold=True)

    p_sub = doc.add_paragraph()
    p_sub.paragraph_format.space_before = Pt(0)
    p_sub.paragraph_format.space_after = Pt(14)
    r_sub = p_sub.add_run("专为非 IDEA 用户打造：3 分钟吃透 JetBrains 级 Git 交互体系与 3-Way Merge 冲突解决神器")
    set_run_font(r_sub, font_name="Microsoft YaHei", size_pt=12.5, color_rgb=RGBColor(71, 85, 105))

    # Meta banner box
    meta_table = doc.add_table(rows=1, cols=1)
    meta_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    meta_cell = meta_table.cell(0, 0)
    meta_cell.width = Inches(6.5)
    set_cell_background(meta_cell, "F1F5F9")
    set_callout_borders(meta_cell, "64748B", sz="24")
    set_cell_margins(meta_cell, top=130, bottom=130, left=180, right=180)

    p_meta = meta_cell.paragraphs[0]
    p_meta.paragraph_format.space_before = Pt(0)
    p_meta.paragraph_format.space_after = Pt(0)
    p_meta.paragraph_format.line_spacing = 1.3
    r_meta1 = p_meta.add_run("【适用对象】")
    set_run_font(r_meta1, font_name="Microsoft YaHei", size_pt=9, color_rgb=RGBColor(15, 23, 42), bold=True)
    r_meta2 = p_meta.add_run("日常使用 VS Code、Sublime Text、Git CLI 命令行或从未使用过 IntelliJ IDEA 的各技术栈开发者。\n")
    set_run_font(r_meta2, font_name="Microsoft YaHei", size_pt=9, color_rgb=RGBColor(71, 85, 105))
    r_meta3 = p_meta.add_run("【软件版本】")
    set_run_font(r_meta3, font_name="Microsoft YaHei", size_pt=9, color_rgb=RGBColor(15, 23, 42), bold=True)
    r_meta4 = p_meta.add_run("OmniGit v0.4.0 正式版（支持 Windows 10/11 与 macOS Apple Silicon / Intel 架构）\n")
    set_run_font(r_meta4, font_name="Microsoft YaHei", size_pt=9, color_rgb=RGBColor(71, 85, 105))
    r_meta5 = p_meta.add_run("【安全特性】")
    set_run_font(r_meta5, font_name="Microsoft YaHei", size_pt=9, color_rgb=RGBColor(15, 23, 42), bold=True)
    r_meta6 = p_meta.add_run("100% 纯本地沙箱执行，零遥测无网络数据上传，MIT 开源合规安全。")
    set_run_font(r_meta6, font_name="Microsoft YaHei", size_pt=9, color_rgb=RGBColor(71, 85, 105))

    p_div = doc.add_paragraph()
    p_div.paragraph_format.space_before = Pt(6)
    p_div.paragraph_format.space_after = Pt(8)

    # ==========================================
    # 导言：为什么需要这份指南？
    # ==========================================
    add_styled_heading(doc, "导言：为什么需要这份指南？", level=1)
    add_body_paragraph(doc, "在现代软件研发中，Git 已经是每一位开发者不可或缺的工具。然而，日常在处理代码提交、分支拉取，尤其是遇到复杂的多分支合并冲突时，很多开发者的体验往往是痛苦且焦虑的：")
    add_bullet_item(doc, "，生怕手滑误删了同事编写的业务代码，或者遗漏了冲突标记导致线上编译流水线直接崩溃；", bold_prefix="手动解冲突提心吊胆：")
    add_bullet_item(doc, "，动辄占用 2~4GB 内存，等待启动耗费数十秒，风扇狂转；", bold_prefix="全功能 IDE 过于臃肿：")
    add_bullet_item(doc, "，要么在 Windows 下频繁卡死无响应（如 SourceTree），要么核心多分支功能强制按月收费订阅（如 GitKraken / Fork）。", bold_prefix="传统专用 Git 客户端痛点重重：")

    add_body_paragraph(doc, "IntelliJ IDEA / WebStorm 的 Git 交互被公认为行业天花板，其 Changes 树状视图、Monaco 双栏比对和 3-Way Merge（三方可视化冲突合并）更是无数资深工程师的心头好。")
    add_body_paragraph(doc, "OmniGit 的核心使命，正是将这套天花板级别的体验从庞大的 Java IDE 中彻底解耦剥离，打造成一个独立、秒开、超轻量的跨平台桌面神器。")
    add_body_paragraph(doc, "本指南专为从未接触过 IntelliJ IDEA 的开发者编写。无论你之前是习惯 VS Code、命令行还是其他图形客户端，阅读完本文，你都将无痛打通全部核心认知，把解决冲突的时间从数十分钟缩短到只需几秒！")

    # ==========================================
    # 第 1 章：核心概念映射速查（3分钟打通思维壁垒）
    # ==========================================
    add_styled_heading(doc, "第 1 章：核心概念映射速查（3分钟打通思维壁垒）", level=1)
    add_body_paragraph(doc, "初次打开 OmniGit，你可能会在界面上看到“Changes”、“Rollback”、“Amend”、“Shelf”、“3-Way Merge”等名词。别被这些专有名词吓倒，它们本质上就是你日常每天都在做的 Git 操作，只是换成了更高效、更不易犯错的人性化呈现方式。")

    add_styled_heading(doc, "1.1 核心概念对照表（速查翻译官）", level=2)
    add_body_paragraph(doc, "下表为你梳理了 Git CLI 命令行、VS Code、IntelliJ IDEA 与 OmniGit 的完整对照映射：")

    headers1 = ["开发者日常习惯 (CLI / VS Code)", "OmniGit (IDEA 交互体系)", "核心作用与为什么更好用"]
    data1 = [
        ["git status\nVS Code 源代码管理面板", "Changes 改动树", "树状层级呈现修改文件，支持按模块折叠展开，改动体量一目了然。"],
        ["git add <file>\nVS Code 暂存更改 (Stage)", "勾选复选框 (Checkbox)", "彻底抛弃“已暂存/未暂存”两级概念！打勾就是要提交，不打勾就留着，极其直观。"],
        ["git restore / git checkout --\nVS Code 放弃更改 (Discard)", "Rollback (回滚撤销)", "一键将选定文件或单行代码无损恢复至最新提交状态，支持精确防误删。"],
        ["git commit --amend\nVS Code 需命令面板输入", "Amend 追加提交", "勾选 Amend 复选框，提交直接融入上一条 Commit，无需打“fix typo”垃圾提交。"],
        ["git stash\nVS Code 储藏 (Stash)", "Shelf (代码货架)", "比 Stash 更直观：可视化上架与下架，可单独恢复货架中的单个文件，绝不丢代码。"],
        ["<<<<<<< HEAD 冲突标记\nVS Code 内联冲突编辑器", "3-Way Merge (三方合并)", "将冲突拆分为“本地 (Yours)”、“最终 (Result)”、“传入 (Theirs)”，点击箭头一键合入。"],
        ["git reset --hard / 翻 reflog\nVS Code 手动回滚", "1-Click Undo Merge", "独创一键无损撤销分支合并，防手滑误合；支持应用重启后根据 Git 历史树智能自愈。"]
    ]
    build_comparison_table(doc, headers1, data1, col_widths=[2.0, 1.8, 2.7])

    add_styled_heading(doc, "1.2 核心设计哲学：所见即所得，拒绝无效“暂存”", level=2)
    add_callout_box(doc, "为什么 OmniGit 不需要“暂存区 (Staging Area)”？", [
        "在传统命令行中，你必须先执行 git add 把文件放进暂存区，然后再执行 git commit。新手经常搞不清暂存区和工作区的区别，容易漏提或误提。",
        "OmniGit 采用了 JetBrains 的“所见即所得”理念：文件列表中每个文件前面都有一个复选框。勾选它即代表“本次要提交”，取消勾选即代表“暂不提交”。你再也不需要在“暂存”与“取消暂存”之间来回折腾！"
    ], callout_type='tip')

    # ==========================================
    # 第 2 章：OmniGit 核心工作台五大布局图解
    # ==========================================
    add_styled_heading(doc, "第 2 章：OmniGit 核心工作台五大布局图解", level=1)
    add_body_paragraph(doc, "OmniGit 的主界面设计极为克制而高效，所有核心能力都被井井有条地分布在五个区域内，没有多余的层级弹窗，保障你在一个屏幕内完成全部操作。")

    add_figure(doc, main_preview, "图 2-1：OmniGit 工作台全景布局实测界面（深色 Darcula 模式）", width_in_inches=6.3)

    add_styled_heading(doc, "2.1 区域 ①：顶部操作栏 (Top Command Bar)", level=2)
    add_figure(doc, os.path.join(tut_img_dir, "tut_topbar.png"), "图 2-2：顶部全局控制栏（仓库切换、分支管理、撤销合并与主题）", width_in_inches=6.2)
    add_bullet_item(doc, "：下拉可秒切当前关注的工程代码仓库，无需开启多个客户端窗口；", bold_prefix="仓库切换器")
    add_bullet_item(doc, "：展示当前所在分支（如 main、feature-v2.0），点击可一键切换或新建分支；", bold_prefix="分支指示与切换")
    add_bullet_item(doc, "：标准 Git 远程协同动作，支持一键拉取与推送到远程团队；", bold_prefix="Fetch / Pull / Push 动作组")
    add_bullet_item(doc, "：独创防后悔神器，只要刚才发生了合并，此按钮即刻高亮生效；", bold_prefix="“Undo Merge (撤销合并)”安全按钮")
    add_bullet_item(doc, "：在 JetBrains 经典的 Darcula 暗色与 IDEA Light 亮色之间一秒平滑切换。", bold_prefix="主题切换图标")

    add_styled_heading(doc, "2.2 区域 ②：左侧多仓库导航栏 (Multi-Repo Sidebar)", level=2)
    add_figure(doc, os.path.join(tut_img_dir, "tut_repolist.png"), "图 2-3：左侧微服务与多仓库聚合管理面板", width_in_inches=3.4)
    add_body_paragraph(doc, "针对现代微服务项目或前后端分离架构，OmniGit 提供了多仓库单视窗聚合管理功能。你可以在左侧同时挂载多个独立的 Git 仓库，软件会实时监测每个工程的状态：")
    add_bullet_item(doc, "：代表本地有 1 个 Commit 尚未推送到远程服务器；", bold_prefix="↗ 1 (未推送提交)")
    add_bullet_item(doc, "：代表远程有 2 个新 Commit 尚未拉取到本地；", bold_prefix="↘ 2 (未拉取提交)")
    add_bullet_item(doc, "：实时反映当前工程有哪些未提交的文件改动。", bold_prefix="改动计数圆点")

    add_styled_heading(doc, "2.3 区域 ③：变更管理与提交面板 (Changes & Commit)", level=2)
    add_figure(doc, os.path.join(tut_img_dir, "tut_changes.png"), "图 2-4：Changes 文件改动树与 Commit 提交面板", width_in_inches=3.8)
    add_body_paragraph(doc, "这里是日常写代码最常交互的核心地带。它分为上下两部分：")
    add_bullet_item(doc, "以树状层级显示所有修改过的文件，支持勾选/反选、右键回滚 (Rollback) 以及点击在右侧查看差异；", bold_prefix="上半部分（文件改动树）：")
    add_bullet_item(doc, "包含多行提交信息输入框、Amend 追加提交复选框以及 Commit 按钮（支持 Ctrl+Enter 快捷提交）。", bold_prefix="下半部分（提交控制台）：")

    add_styled_heading(doc, "2.4 区域 ④：Monaco 差异比对中心 (Diff Viewer)", level=2)
    add_figure(doc, os.path.join(tut_img_dir, "tut_diff_editor.png"), "图 2-5：Monaco 双栏代码差异比对器", width_in_inches=6.2)
    add_body_paragraph(doc, "OmniGit 集成了微软工业级 Monaco 差异比对引擎（与 VS Code 核心同源），但采用了 JetBrains 独有的双栏布局逻辑：")
    add_bullet_item(doc, "代表当前文件的原始基准版本（最近一次 Commit 的内容），作为修改前参照物；", bold_prefix="左侧栏（Base）：")
    add_bullet_item(doc, "代表你当前在磁盘上的实时代码，变动行以醒目色彩高亮，支持行内字符级精细高亮。", bold_prefix="右侧栏（Working Copy）：")

    add_styled_heading(doc, "2.5 区域 ⑤：三方冲突解决操作栏 (3-Way Merge Action Bar)", level=2)
    add_figure(doc, os.path.join(tut_img_dir, "tut_conflict_bar.png"), "图 2-6：冲突解决指示与快速处理工具栏", width_in_inches=6.2)
    add_body_paragraph(doc, "一旦发生分支合并冲突，工作区上方会立即呼出醒目的橙红色冲突警示栏，清晰列出当前有几个冲突文件等待裁决，并提供一键采纳或呼出 3-Way 深度合并器的快捷入口。")

    # ==========================================
    # 第 3 章：日常高频操作实战（提交、撤销与追加）
    # ==========================================
    add_styled_heading(doc, "第 3 章：日常高频操作实战（提交、撤销与追加）", level=1)

    add_styled_heading(doc, "3.1 浏览代码改动并精确挑选提交", level=2)
    add_body_paragraph(doc, "在日常开发中，一个良好的习惯是“原子化提交”——每次只提交相关功能的代码，不要把杂乱的调试代码混杂在一起。")
    add_bullet_item(doc, "：在左侧 Changes 树中点击任何一个文件，右侧 Diff 比对器即刻加载出该文件的所有修改细节。", bold_prefix="第 1 步：查验改动")
    add_bullet_item(doc, "：仔细阅读右侧高亮块，确认修改符合预期。", bold_prefix="第 2 步：核对差异")
    add_bullet_item(doc, "：在 Changes 树中，勾选那些属于本次功能的修改文件；对于临时调试的文件，不要勾选，它会安稳保留在本地工作区，不会被提交到远程。", bold_prefix="第 3 步：勾选文件")

    add_styled_heading(doc, "3.2 规范提交代码 (Commit)", level=2)
    add_body_paragraph(doc, "在提交输入框中键入清晰的说明信息。支持标准的前缀规范（如 feat: 新增用户登录接口 / fix: 修复订单金额精度丢失问题）。")
    add_body_paragraph(doc, "输入完成后，直接点击底部的“Commit”大按钮，或者直接在键盘上按下【Ctrl + Enter】快捷键，即可完成提交。")

    add_styled_heading(doc, "3.3 杀手锏技巧：追加提交 (Amend Commit)", level=2)
    add_body_paragraph(doc, "很多开发者都遇到过这种尴尬情况：刚点击了 Commit，转头发现漏删了一行 console.log，或者函数参数拼写错了一个字母。")
    add_body_paragraph(doc, "如果重新打一个 Commit，就会在 Git 历史中留下一堆像“fix typo”、“修改小错误”这样无意义的垃圾记录；如果敲命令行 git commit --amend，对命令不熟悉的同学又常常担心把之前的提交搞丢。")
    add_body_paragraph(doc, "在 OmniGit 中，处理 Amend 只需要极为优雅的两步：")
    add_bullet_item(doc, "把刚才漏掉的小修改保存好，在 Changes 树中勾选该文件；", bold_prefix="步骤 1：")
    add_bullet_item(doc, "在提交面板中勾选“Amend”复选框，此时提交框会自动填入上一条提交的历史说明；点击 Commit，刚才的小修改就会无缝合入上一条提交，仿佛失误从未发生过！", bold_prefix="步骤 2：")

    add_callout_box(doc, "Amend 使用安全红线：", [
        "Amend 本质上会重写最后一条 Commit 的 Hash 值。因此，如果该 Commit 仅仅停留在你的本地机器上，你可以随时随意 Amend；",
        "但如果该 Commit 已经通过 Push 推送到了团队公共远程分支（如 main/dev），请不要使用 Amend，否则其他拉取了该分支的同事将会遇到历史分叉。"
    ], callout_type='warning')

    add_styled_heading(doc, "3.4 一键回滚撤销 (Rollback)", level=2)
    add_body_paragraph(doc, "有时候改了一大堆代码，经过调试发现思路完全行不通，想彻底放弃本地未提交的代码，恢复原状。")
    add_body_paragraph(doc, "在 OmniGit 中：右键点击该文件，在弹出菜单中点击“Rollback (回滚)”，系统会弹出二次确认框，点击确认后，该文件瞬间无损复原至修改前的初始干净状态。再也不需要去记什么 git checkout -- 或者 git restore 了！")

    # ==========================================
    # 第 4 章：杀手级功能：3-Way Merge 可视化冲突解决
    # ==========================================
    add_styled_heading(doc, "第 4 章：杀手级功能：3-Way Merge 可视化冲突解决", level=1)
    add_body_paragraph(doc, "代码冲突是几乎所有团队协作中最容易令人沮丧的时刻。本章将详细为你解密 OmniGit 最受赞誉的 3-Way Merge 冲突解决机制。")

    add_styled_heading(doc, "4.1 传统冲突解决方式为什么是噩梦？", level=2)
    add_body_paragraph(doc, "在传统的文本编辑器或命令行中，Git 解决冲突的方式是把两个分支的代码粗暴地写在同一个文件里，并塞入一堆特殊标记：")
    add_bullet_item(doc, "：这是你本地分支现有的代码；", bold_prefix="<<<<<<< HEAD")
    add_bullet_item(doc, "：分割线，上面是你的，下面是对方的；", bold_prefix="=======")
    add_bullet_item(doc, "：这是对方分支传入进来的新代码。", bold_prefix=">>>>>>> branch-name")
    add_body_paragraph(doc, "面对上百行的复杂冲突，开发者需要在这些混乱的符号堆里小心翼翼地删除符号。一旦手滑多删了一个大括号，或者漏删了一行“=======”，就会导致代码语法错误，甚至引发线上严重事故！")

    add_styled_heading(doc, "4.2 3-Way Merge 的运行原理图解", level=2)
    add_figure(doc, os.path.join(tut_img_dir, "tut_3way_concept.png"), "图 4-1：3-Way Merge（三方合并）核心原理与三栏数据流向示意图", width_in_inches=6.2)
    add_body_paragraph(doc, "如上图所示，3-Way Merge 之所以被称为“三方”，是因为它将冲突解构成了一个清晰的数据流：")
    add_bullet_item(doc, "位于最左侧，展示当前分支的原有修改，标明“你在此处做过什么”。", bold_prefix="左栏（Yours / 本地当前分支）：")
    add_bullet_item(doc, "位于中央最醒目位置，这是【唯一】将被保存并提交到 Git 仓库的最终文件结果！它实时汇集左右两侧的决策。", bold_prefix="中栏（Result / 最终合并结果）：")
    add_bullet_item(doc, "位于最右侧，展示外部传入分支（如同事推送到远程的更新）带来的代码改动。", bold_prefix="右栏（Theirs / 外部传入分支）：")

    add_styled_heading(doc, "4.3 实战：双向箭头一键采纳代码", level=2)
    add_body_paragraph(doc, "在 OmniGit 呼出的 3-Way Merge 界面中，解决冲突变得如同拼图一样简单直观：")
    add_bullet_item(doc, "：点击左栏与中栏之间的向右双箭头【»】，中栏会自动填入本地代码，代表采纳当前分支的实现；", bold_prefix="采纳本地改动 (Accept Yours)")
    add_bullet_item(doc, "：点击右栏与中栏之间的向左双箭头【«】，中栏会自动填入远程分支代码，代表采纳对方的实现；", bold_prefix="采纳对方改动 (Accept Theirs)")
    add_bullet_item(doc, "：如果两边的代码都需要保留，只需先后点击两侧的箭头，两段代码就会按顺序完整合并至中栏；", bold_prefix="双向同时采纳 (Take Both)")
    add_bullet_item(doc, "：中栏是一个具备完整高亮和智能提示的代码编辑器，你可以随时在中栏直接打字敲代码，对合并结果进行微调润色。", bold_prefix="自由手工润色")

    add_styled_heading(doc, "4.4 独特的“语法防漏提拦截屏障”", level=2)
    add_body_paragraph(doc, "初学者使用其他工具解决冲突时，最容易犯的一个低级失误就是：以为冲突解完了，结果某个角落还残留着“<<<<<<<”标记，直接点了提交。")
    add_callout_box(doc, "OmniGit 独创：语法防漏提拦截机制", [
        "OmniGit 内置了强大的语法级冲突特征扫描引擎。",
        "只要当前工作区任何一个文件中还存在未清理干净的“<<<<<<<”、“=======”或“>>>>>>>”标记，OmniGit 的提交按钮将处于强制置灰锁定状态，并在界面顶部弹出高亮警告，精准指出第几行仍有残留！",
        "这项设计从源头彻底杜绝了因手滑将“半成品冲突标记”提交到远程代码库的低级事故发生。"
    ], callout_type='success')

    # ==========================================
    # 第 5 章：独创功能：1-Click 撤销合并 (Undo Merge) 与智能自愈
    # ==========================================
    add_styled_heading(doc, "第 5 章：独创功能：1-Click 撤销合并 (Undo Merge) 与智能自愈", level=1)

    add_styled_heading(doc, "5.1 场景还原：分支合并后的“后悔药”", level=2)
    add_body_paragraph(doc, "在实际团队协作中，经常会遇到以下场景：")
    add_bullet_item(doc, "手滑把正在重构中的实验性分支（如 experimental-v2）合并到了稳定的 main 分支；", bold_prefix="场景 1：")
    add_bullet_item(doc, "合并了同事的分支后，本地运行单元测试报错成片，发现对方的代码根本还没调通；", bold_prefix="场景 2：")
    add_bullet_item(doc, "合并过程中冲突多达几十个，解到一半心烦意乱，想回到合并前的干净状态重新梳理思路。", bold_prefix="场景 3：")

    add_body_paragraph(doc, "在传统 Git CLI 下，想要安全回滚合并，你需要去翻查 git reflog，寻找合并前的 commit hash，然后小心翼翼地敲 git reset --hard ORIG_HEAD。稍有不慎，命令敲错了就可能把本地未提交的工作成果全部冲掉！")

    add_styled_heading(doc, "5.2 顶部常驻撤销合并按钮", level=2)
    add_body_paragraph(doc, "针对这一痛点，OmniGit 在顶部状态栏创新设计了【Undo Merge (撤销合并)】一键回退系统：")
    add_bullet_item(doc, "只要刚才执行了分支合并操作，顶部操作栏就会常驻显示醒目的 Undo Merge 按钮；", bold_prefix="操作极简：")
    add_bullet_item(doc, "点击后，系统会弹出明确的提示框，点击确认，OmniGit 会在 0.1 秒内无损将分支指针平稳回退至合并触发前的那一刻；", bold_prefix="无损回滚：")
    add_bullet_item(doc, "回滚完成后，工作区彻底恢复如初，没有任何残留的脏数据，让每一次分支合并都有“后悔药”可吃！", bold_prefix="干净彻底：")

    add_styled_heading(doc, "5.3 智能自愈机制：重启后依然生效", level=2)
    add_body_paragraph(doc, "市面上极少数具备类似撤销功能的工具，往往是将状态保存在内存变量中。一旦遇到软件被关闭、或者电脑下班关机，第二天重新打开软件后，撤销按钮就灰掉了，无法再撤销。")
    add_body_paragraph(doc, "OmniGit 研发了独家【基于 Git 历史有向无环图 (DAG) 的自愈定位算法】：")
    add_bullet_item(doc, "即使你在合并分支后直接退出了软件，甚至重启了电脑；", bold_prefix="支持断电关机：")
    add_bullet_item(doc, "第二天重新启动 OmniGit 时，系统启动嗅探器会自动遍历当前仓库的提交树，智能识别出当前的 HEAD 节点是一次未推送到远程的合并节点，并自动自愈重现【Undo Merge】按钮，依然允许你一键安全回退！", bold_prefix="智能图谱自愈：")

    # ==========================================
    # 第 6 章：多工程与微服务协同：单视窗掌控全局
    # ==========================================
    add_styled_heading(doc, "第 6 章：多工程与微服务协同：单视窗掌控全局", level=1)
    add_body_paragraph(doc, "微服务架构已经是现代大型工程的主流标准。一个中大型项目往往会被拆分为前端、网关、认证中心、订单服务、公共组件等十几个独立的 Git 代码仓库。")

    add_styled_heading(doc, "6.1 传统多仓库管理的痛苦", level=2)
    add_body_paragraph(doc, "在使用 VS Code 时，为了协同调试这 5 个微服务，开发者往往被迫打开 5 个独立的 VS Code 窗口。在 Windows 任务栏或 Alt+Tab 切换时眼花缭乱，极容易在错误的窗口里提交了代码；而在 SourceTree 中开启 5 个工程标签页，内存往往直线飙升到 1GB 以上，频繁出现“正在加载仓库...”的假死无响应。")

    add_styled_heading(doc, "6.2 OmniGit 单视窗聚合体验", level=2)
    add_body_paragraph(doc, "在 OmniGit 中，你只需要将这几个工程目录全部添加到左侧仓库列表中，即可享受真正流畅的聚合管理：")
    add_bullet_item(doc, "左侧列表整齐展示所有微服务工程卡片，每个卡片清晰标注当前分支名；", bold_prefix="全景状态透视：")
    add_bullet_item(doc, "每个卡片右侧实时显示 ↗（未推提交）与 ↘（落后远程提交）角标，一眼看清哪些模块需要 Pull，哪些模块需要 Push；", bold_prefix="进出提交监控：")
    add_bullet_item(doc, "点击左侧任何一个工程，主界面在 10 毫秒内瞬间切换上下文，Changes 列表与比对器无缝切换，无需等待任何漫长重载；", bold_prefix="毫秒级秒切：")
    add_bullet_item(doc, "哪怕常驻管理十几个微服务仓库，OmniGit 的内存占用依然稳定保持在 60MB~80MB 左右，轻巧如燕！", bold_prefix="极低资源占用：")

    # ==========================================
    # 第 7 章：进阶技能：代码货架 (Shelf) 与个性化定制
    # ==========================================
    add_styled_heading(doc, "第 7 章：进阶技能：代码货架 (Shelf) 与个性化定制", level=1)

    add_styled_heading(doc, "7.1 Shelf（代码货架）vs Git Stash 深度对比", level=2)
    add_body_paragraph(doc, "正在专心开发功能 A 时，线上突然报了一个紧急 Bug 需要立刻切分支修复。此时你手头写了一半的代码该怎么办？很多新手会选择 git stash，但随后往往会遭遇一系列困扰。")

    headers2 = ["对比维度", "传统 Git Stash (储藏)", "OmniGit Shelf (代码货架)"]
    data2 = [
        ["命名与可读性", "默认按堆栈自动命名 stash@{0}，放两个以上就根本分不清谁是谁。", "可视化货架，上架时可自定义清晰业务名称（如“用户中心重构草稿”）。"],
        ["查看修改内容", "需要敲 git stash show -p 等晦涩命令才能看懂存了什么。", "货架列表里直接展开查看包含哪些文件，点击即在 Monaco 差异器中查看代码。"],
        ["部分恢复能力", "只能一股脑全部 pop 或 apply 出来，无法只恢复其中某一个文件。", "支持精确粒度：可以在货架中挑选只恢复其中 1 个文件，其余继续保留在货架。"],
        ["安全性保障", "执行 git stash pop 时一旦发生冲突，Stash 记录可能意外丢失。", "货架内容永久独立保存，恢复无论是否冲突，货架原稿绝不丢失，极其安全。"]
    ]
    build_comparison_table(doc, headers2, data2, col_widths=[1.5, 2.5, 2.5])

    add_styled_heading(doc, "7.2 双经典主题无缝切换", level=2)
    add_bullet_item(doc, "深度还原 JetBrains 广受好评的暗色调，长时间注视不易疲劳，沉浸感极强；", bold_prefix="Darcula 暗色主题：")
    add_bullet_item(doc, "高对比度清爽背景，适合日间光照充足的办公室，或者连接会议室大屏幕进行代码评审 (Code Review)。", bold_prefix="IDEA Light 亮色主题：")

    add_styled_heading(doc, "7.3 常用高频快捷键速查清单", level=2)
    headers3 = ["操作功能", "Windows / Linux 快捷键", "macOS 快捷键", "作用说明"]
    data3 = [
        ["快速提交 Commit", "Ctrl + Enter", "Command + Enter", "在提交面板中快速完成代码提交"],
        ["呼出提交面板", "Ctrl + K", "Command + K", "IDEA 原生习惯，一键聚焦至 Commit 提交输入框"],
        ["刷新工作区状态", "Ctrl + R", "Command + R", "重新扫描磁盘，更新文件改动与分支状态"],
        ["呼出 3-Way 冲突合并", "Double Click 冲突文件", "Double Click 冲突文件", "双击任何标红的冲突文件，即刻弹出三方比对器"],
        ["撤销本地修改 Rollback", "Alt + Delete / 右键", "Option + Backspace / 右键", "将选中的文件无损回滚至基准版本"]
    ]
    build_comparison_table(doc, headers3, data3, col_widths=[1.8, 1.6, 1.6, 1.5])

    # ==========================================
    # 第 8 章：常见问题解答 (FAQ) 与避坑指南
    # ==========================================
    add_styled_heading(doc, "第 8 章：常见问题解答 (FAQ) 与避坑指南", level=1)

    add_styled_heading(doc, "8.1 Q1：我的电脑上没有安装 IntelliJ IDEA，OmniGit 能正常使用吗？", level=2)
    add_body_paragraph(doc, "答：完全可以！OmniGit 是一个 100% 独立的跨平台桌面应用程序，底层直接调用你本机已安装的标准 git 命令行（只要你在终端里能运行 git 即可）。它完全不依赖 Java 环境，不需要安装 IntelliJ IDEA 或任何庞大臃肿的集成开发环境。")

    add_styled_heading(doc, "8.2 Q2：OmniGit 会把我的公司代码或 Git 凭据上传到外部云端吗？", level=2)
    add_body_paragraph(doc, "答：绝对不会！OmniGit 严格遵循“本地优先 (Local-First) 与隐私沙箱”安全架构。所有的 Git 分支计算、差异比对、合并动作均在你的本地计算机回环执行。软件没有任何遥测上报代码，不收集任何用户隐私或仓库数据，符合企业安全合规审计要求。")

    add_styled_heading(doc, "8.3 Q3：在 3-Way Merge 解决冲突时，如果不小心关闭了软件，我的代码会丢失吗？", level=2)
    add_body_paragraph(doc, "答：绝不会丢失。Git 在遇到合并冲突时，会把合并现场稳固保存在 .git 目录下的 MERGE_HEAD 和暂存索引中。只要你没有执行 git merge --abort，无论是重启 OmniGit 还是重启电脑，再次打开软件时依然会准确停留在冲突待裁决状态，点击冲突文件即可继续裁决。")

    add_styled_heading(doc, "8.4 Q4：绿色免安装便携版 (zip) 与标准安装版 (exe / dmg) 有什么区别？", level=2)
    add_body_paragraph(doc, "答：两者在核心功能、性能与代码处理上 100% 完全一致。")
    add_bullet_item(doc, "解压即用，不修改注册表，非常适合放在 U 盘里随身携带，或者在没有管理员提权权限的公司受限办公机上使用；", bold_prefix="便携版 (zip)：")
    add_bullet_item(doc, "会自动在桌面和开始菜单创建快捷方式，且采用了免 UAC 提权机制，普通用户双击即可平滑安装升级。", bold_prefix="标准安装包：")

    add_styled_heading(doc, "8.5 Q5：如何向开发者反馈建议或参与开源共建？", level=2)
    add_body_paragraph(doc, "答：OmniGit 是一款以 MIT 协议开源的自由软件。你可以直接访问 GitHub 官方仓库：")
    add_bullet_item(doc, "https://github.com/BucanYu/OmniGit", bold_prefix="开源仓库：")
    add_bullet_item(doc, "https://github.com/BucanYu/OmniGit/issues", bold_prefix="提交 Bug 或功能建议 (Issues)：")
    add_body_paragraph(doc, "如果你觉得这款工具切切实实解决了你在 Git 提交与冲突解决上的痛点，欢迎顺手在 GitHub 上为项目点亮一颗 ⭐️ Star，这也是对独立开源开发者最大的支持与鼓励！")

    # Save document
    output_docx = os.path.join(base_dir, "docs/OmniGit_Tutorial_Guide.docx")
    doc.save(output_docx)
    print(f"Tutorial docx successfully generated at: {output_docx}")
    file_size = os.path.getsize(output_docx)
    print(f"Generated file size: {file_size / 1024:.1f} KB")

if __name__ == "__main__":
    generate_full_tutorial()
