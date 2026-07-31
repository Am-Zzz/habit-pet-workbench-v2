# -*- coding: utf-8 -*-
"""
生成器：把 bedbook (MIT) 的精选儿童故事搬进本项目绘本库。
- 用 curl 拉取 raw.githubusercontent.com 上的故事 Markdown（MIT，注明出处）
- 解析 YAML 头（title/age/keywords/category）
- 按句拆分页，pypinyin 逐字注音，映射进 books_content.js 的 {pages:[{role,chars:[{t,p}]}]} 模式
- 保留原有 9 本（带 AI 封面），丢弃 7 个 ready:false 占位
运行：python gen_books_bedbook.py
"""
import os, re, json, subprocess, urllib.parse

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, "books_content.js")
TMP = os.path.join(ROOT, ".bedbook_raw")
os.makedirs(TMP, exist_ok=True)

RAW_BASE = "https://raw.githubusercontent.com/shenjingnan/bedbook/main/stories/"

# 精选 24 篇： (bedbook分类目录, 文件名, 映射到本项目cat, 图标)
# cat 映射：童话→fairy，成语→fable，历史/神话/成长/科学/原创→classic（沿用现有导航三分类）
CURATED = [
    # 童话故事 (fairy)
    ("fairy-tale", "丑小鸭.md", "fairy", "🦢"),
    ("fairy-tale", "拇指姑娘.md", "fairy", "🌱"),
    ("fairy-tale", "杰克与魔豆.md", "fairy", "🌿"),
    ("fairy-tale", "糖果屋历险记.md", "fairy", "🍬"),
    # 寓言/成语 (fable)
    ("idiom", "守株待兔.md", "fable", "🐰"),
    ("idiom", "愚公移山.md", "fable", "⛰️"),
    ("idiom", "掩耳盗铃.md", "fable", "🔔"),
    ("idiom", "狐假虎威.md", "fable", "🦊"),
    ("idiom", "亡羊补牢.md", "fable", "🐑"),
    ("idiom", "画蛇添足.md", "fable", "🐍"),
    # 历史故事 (classic)
    ("history", "司马光砸缸.md", "classic", "🏺"),
    ("history", "孟母三迁.md", "classic", "📜"),
    ("history", "岳飞精忠报国.md", "classic", "🛡️"),
    # 成语故事 (fable) — 曹冲称象属 idiom 分类
    ("idiom", "曹冲称象.md", "fable", "🐘"),
    # 神话故事 (classic)
    ("myth", "哪吒闹海.md", "classic", "🔥"),
    ("myth", "女娲补天.md", "classic", "🌌"),
    ("myth", "精卫填海.md", "classic", "🐦"),
    ("myth", "后羿射日.md", "classic", "🏹"),
    # 成长故事 (classic) — 文件名是「我会自己睡觉」
    ("growth", "我会自己睡觉.md", "classic", "🌙"),
    ("growth", "第一次上学.md", "classic", "🎒"),
    ("growth", "不挑食的好孩子.md", "classic", "🥦"),
    # 科学故事 (classic)
    ("science", "小蝌蚪找妈妈.md", "classic", "🐸"),
    ("science", "为什么会有白天和黑夜.md", "classic", "🌞"),
    ("science", "彩虹是怎么形成的.md", "classic", "🌈"),
]

CAT_LABEL = {"fairy": "童话故事", "fable": "寓言故事", "classic": "经典故事"}
ICON_FALLBACK = {"fairy": "📖", "fable": "💡", "classic": "📚"}


def fetch_raw(cat, fname):
    url = RAW_BASE + cat + "/" + urllib.parse.quote(fname)
    out = os.path.join(TMP, cat + "__" + fname)
    # raw.githubusercontent 在沙箱里偶发连接抖动（exit 7 / http 000），加重试
    last_err = None
    for attempt in range(3):
        try:
            r = subprocess.run(
                ["curl", "-s", "-m", "25", "-f", "-o", out, url],
                check=True,
            )
            if os.path.getsize(out) > 0:
                break
            last_err = f"空文件 (attempt {attempt+1})"
        except subprocess.CalledProcessError as e:
            last_err = f"curl exit {e.returncode} (attempt {attempt+1})"
        # 短暂退避后重试
        import time
        time.sleep(1.5)
    else:
        raise RuntimeError(f"拉取失败（已重试3次）：{cat}/{fname} — {last_err}")
    with open(out, "r", encoding="utf-8") as f:
        return f.read()


def parse_front(text):
    m = re.match(r"^---\s*\n(.*?)\n---\s*\n", text, re.S)
    fm = m.group(1) if m else ""
    meta = {}
    # title
    mt = re.search(r"^title:\s*(.+)$", fm, re.M)
    if mt: meta["title"] = mt.group(1).strip()
    # age
    ma = re.search(r"^age:\s*(.+)$", fm, re.M)
    if ma: meta["age"] = ma.group(1).strip()
    # keywords (YAML list)
    mk = re.search(r"^keywords:\s*\n((?:\s*-\s*.+\n)+)", fm, re.M)
    if mk:
        meta["keywords"] = [re.sub(r"^\s*-\s*", "", l).strip() for l in mk.group(1).splitlines() if l.strip()]
    return meta


def map_age(bedbook_age):
    """bedbook age 如 '3-7岁' → 本项目分龄 + 年级文案"""
    low = 99
    if bedbook_age:
        nums = re.findall(r"\d+", bedbook_age)
        if nums:
            low = int(nums[0])
    if low <= 5:
        return "幼升小", "幼小衔接"
    if low <= 7:
        return "小学1-3", "小学1-3年级"
    return "小学3-6", "小学3-6年级"


def split_pages(body):
    """按段落→按句拆分页，每页约 2-4 句"""
    # 去掉 YAML 头
    body = re.sub(r"^---\s*\n.*?\n---\s*\n", "", body, flags=re.S)
    # 按空行分段
    paras = [p.strip() for p in re.split(r"\n\s*\n", body) if p.strip()]
    pages = []
    buf = []
    cnt = 0
    for p in paras:
        # 段落内按句拆分
        sentences = re.split(r"(?<=[。！？])", p)
        for s in sentences:
            s = s.strip()
            if not s:
                continue
            buf.append(s)
            cnt += len(s)
            if cnt >= 45:
                pages.append("".join(buf))
                buf = []
                cnt = 0
    if buf:
        pages.append("".join(buf))
    return pages


def char_pinyin(ch, pypinyin, Style):
    if "\u4e00" <= ch <= "\u9fff":
        try:
            py = pypinyin.pinyin(ch, style=Style.TONE, heteronym=False, errors="default")[0][0]
            return py
        except Exception:
            return None
    return None


def slugify_title(title, pypinyin):
    """把中文标题转成拼音 slug（用于稳定且唯一的 book id）。"""
    from pypinyin import Style as _S
    parts = pypinyin.pinyin(title, style=_S.NORMAL, heteronym=False, errors="default")
    s = "".join([p[0] for p in parts if p and p[0]])
    s = re.sub(r"[^a-z0-9]", "", s.lower())
    return s or "book"


def build_book(cat_dir, fname, cat, icon, pypinyin, Style):
    raw = fetch_raw(cat_dir, fname)
    meta = parse_front(raw)
    title = meta.get("title") or fname.replace(".md", "")
    age, grade = map_age(meta.get("age"))
    keywords = meta.get("keywords") or []
    desc = "·".join(keywords[:4]) if keywords else title
    body_pages = split_pages(raw)
    pages = []
    for pg in body_pages:
        chars = [{"t": c, "p": char_pinyin(c, pypinyin, Style)} for c in pg]
        pages.append({"role": "讲述", "chars": chars})
    return {
        "id": "bb_" + slugify_title(title, pypinyin),
        "cat": cat,
        "icon": icon,
        "title": title,
        "tag": age,
        "age": age,
        "grade": grade,
        "ready": True,
        "desc": desc,
        "source": "bedbook (MIT) · github.com/shenjingnan/bedbook",
        "pages": pages,
        "cover": None,
    }


def load_existing():
    """从 git HEAD 的原始 books_content.js 读取基准（9 本带 AI 封面），
    避免读取被本脚本生成过的文件导致重复累积。"""
    import subprocess
    raw = subprocess.run(
        ["git", "show", "HEAD:books_content.js"],
        cwd=ROOT, capture_output=True, text=True
    ).stdout
    if not raw:
        # 回退：直接用工作区文件
        with open(SRC, "r", encoding="utf-8") as f:
            raw = f.read()
    m = re.search(r"window\.BOOK_CONTENT\s*=\s*(\[.*\])\s*;", raw, re.S)
    arr = json.loads(m.group(1))
    # 只保留带封面（原 9 本），丢弃占位与被本脚本生成过的（cover:null）
    keep = [b for b in arr if b.get("cover")]
    dropped = len(arr) - len(keep)
    return keep, dropped


def main():
    import pypinyin
    from pypinyin import Style
    existing, dropped = load_existing()
    print(f"保留原有 ready 书: {len(existing)} 本；丢弃占位: {dropped} 本")

    new_books = []
    for cat_dir, fname, cat, icon in CURATED:
        try:
            b = build_book(cat_dir, fname, cat, icon, pypinyin, Style)
            new_books.append(b)
            print(f"  + {b['title']}  [{CAT_LABEL[cat]}] {b['age']}  ({len(b['pages'])}页)")
        except Exception as e:
            print(f"  ! 失败 {fname}: {e}")

    # 保证新书的 id 唯一（同音字/重名兜底）
    seen = {}
    for b in new_books:
        base = b["id"]
        if base in seen:
            seen[base] += 1
            b["id"] = f"{base}_{seen[base]}"
        else:
            seen[base] = 0
    dup = [i for i in seen if seen[i] > 0]
    if dup:
        print(f"  ⚠ 修正了 {len(dup)} 个重复 id")

    all_books = existing + new_books
    out = "// 自动生成：绘本故事内容（公版 + bedbook MIT 精选）+ 逐字拼音标注。由 gen_books.py / gen_books_bedbook.py 生成，勿手改。\n"
    out += "window.BOOK_CONTENT = " + json.dumps(all_books, ensure_ascii=False, indent=2) + ";\n"
    with open(SRC, "w", encoding="utf-8") as f:
        f.write(out)
    print(f"\n完成：共 {len(all_books)} 本（原 {len(existing)} + 新增 {len(new_books)}）")


if __name__ == "__main__":
    main()
