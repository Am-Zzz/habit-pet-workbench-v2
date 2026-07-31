# -*- coding: utf-8 -*-
"""生成 books_content.js：公版故事 + 逐字拼音标注 + 年龄/年级 + 角色（用于 AI 多人朗读）"""
import json
from pypinyin import pinyin, Style

def annotate(text):
    """返回 [{t:字, p:拼音或None}]，非汉字 p=None"""
    ps = pinyin(text, style=Style.TONE, heteronym=False)
    out = []
    for ch, py in zip(text, ps):
        p = py[0] if py else ''
        # 仅对汉字标注拼音
        if '\u4e00' <= ch <= '\u9fff':
            out.append({'t': ch, 'p': p})
        else:
            out.append({'t': ch, 'p': None})
    return out

def mk_pages(pages):
    return [{'role': r, 'chars': annotate(t)} for (r, t) in pages]

# 9 本精编故事（公版/民间故事，无版权问题），3 大类 × 跨年龄年级
STORIES = [
    {
        'id': 'guitu', 'cat': 'classic', 'icon': '🐢', 'title': '龟兔赛跑',
        'tag': '幼升小', 'age': '幼升小', 'grade': '幼小衔接', 'ready': True,
        'desc': '坚持到底就是胜利',
        'pages': mk_pages([
            ('旁白', '森林里要举行赛跑。小白兔蹦蹦跳跳，笑眯眯地说：“我跑得最快，冠军一定是我的！”'),
            ('乌龟', '小乌龟慢慢爬过来，轻声说：“我走得慢，但我会一直不停下。”'),
            ('旁白', '比赛开始啦！兔子像箭一样冲出去，回头一看，乌龟还在老远老远的地方。'),
            ('兔子', '兔子想：“反正它那么慢，我先睡一觉也不迟。”于是他靠在树下呼呼大睡。'),
            ('旁白', '乌龟一步一步，一步一步，从不停下。等兔子醒来，乌龟已经稳稳地冲过了终点线。'),
            ('旁白', '这个故事告诉我们：慢慢来，不放弃，也能赢。'),
        ]),
    },
    {
        'id': 'three_pigs', 'cat': 'classic', 'icon': '🐷', 'title': '三只小猪',
        'tag': '幼升小', 'age': '幼升小', 'grade': '幼小衔接', 'ready': True,
        'desc': '勤劳和智慧能战胜困难',
        'pages': mk_pages([
            ('旁白', '猪妈妈有三个宝宝。有一天，她说：“你们长大了，去自己盖房子吧。”'),
            ('猪老大', '老大懒洋洋，用稻草盖了一间房，一下就盖好了。'),
            ('猪老二', '老二图省事，用树枝搭了一间房，也比画比画就完了。'),
            ('猪老三', '老三最认真，搬来砖头一块一块砌，盖了一间结实的砖房。'),
            ('大灰狼', '大灰狼来了！他吹口气，稻草房飞了；一撞，树枝房塌了。两只小猪逃进老三家。'),
            ('旁白', '大灰狼怎么也吹不倒、撞不坏砖房。勤劳和智慧，保护了三只小猪。'),
        ]),
    },
    {
        'id': 'redhood', 'cat': 'classic', 'icon': '👧', 'title': '小红帽',
        'tag': '小学1-3', 'age': '小学1-3', 'grade': '小学1-3年级', 'ready': True,
        'desc': '听妈妈的话，不轻信陌生人',
        'pages': mk_pages([
            ('妈妈', '妈妈对小红帽说：“外婆病了，把这篮点心送去，路上不要和陌生人说话。”'),
            ('小红帽', '小红帽点点头出发了。路边的花儿真好看，她停下来摘花。'),
            ('大灰狼', '大灰狼装成好人问：“小姑娘，去哪儿呀？”小红帽说：“去看外婆。”狼偷偷先跑到外婆家。'),
            ('旁白', '狼把外婆吞进肚子里，穿上她的衣服躺在床上。小红帽来了，觉得“外婆”好奇怪。'),
            ('猎人', '幸好猎人经过，剪开狼的肚子，救出了外婆和小红帽。'),
            ('旁白', '从那以后，小红帽记住了：不要随便和陌生人说话。'),
        ]),
    },
    {
        'id': 'uglyduck', 'cat': 'fable', 'icon': '🦆', 'title': '丑小鸭',
        'tag': '幼升小', 'age': '幼升小', 'grade': '幼小衔接', 'ready': True,
        'desc': '每只天鹅都曾是丑小鸭',
        'pages': mk_pages([
            ('鸭妈妈', '鸭妈妈孵出一窝小鸭。最后破壳的那只，又大又灰，大家都叫他“丑小鸭”。'),
            ('旁白', '丑小鸭走路摇摇摆摆，别的鸭子笑他，连小猫小狗也欺负他。他伤心地离开了家。'),
            ('旁白', '冬天好冷好冷，丑小鸭冻僵在冰面上。好心的农夫把他抱回了家。'),
            ('旁白', '春天来了，丑小鸭来到湖边。水里游来几只白天鹅，雪白的羽毛真漂亮。'),
            ('丑小鸭', '丑小鸭低下头想躲开，忽然看见水里的自己——竟然也是一只洁白的天鹅！'),
            ('旁白', '原来，他从来都不是丑小鸭，而是一只等待长大的天鹅。'),
        ]),
    },
    {
        'id': 'wolf_comes', 'cat': 'fable', 'icon': '🐺', 'title': '狼来了',
        'tag': '幼升小', 'age': '幼升小', 'grade': '幼小衔接', 'ready': True,
        'desc': '诚实比什么都重要',
        'pages': mk_pages([
            ('旁白', '山上有一个放羊的孩子。他觉得放羊太无聊，想了个捣蛋的主意。'),
            ('放羊娃', '他冲着山下大喊：“狼来了！狼来了！”村民们赶紧跑上山来帮忙。'),
            ('旁白', '可是山上根本没有狼。看大家气喘吁吁，放羊娃笑得直不起腰：“哈哈，被骗啦！”'),
            ('旁白', '过了几天，他又喊“狼来了”。善良的村民又信了，跑上来却发现又被骗了。'),
            ('旁白', '真的狼终于来了！放羊娃拼命喊“狼来了”，可再也没人相信他。'),
            ('旁白', '羊被狼叼走了。这个故事说：说谎的人，连真话也没人信。'),
        ]),
    },
    {
        'id': 'wind_sun', 'cat': 'fable', 'icon': '🌾', 'title': '北风与太阳',
        'tag': '小学3-6', 'age': '小学3-6', 'grade': '小学3-6年级', 'ready': True,
        'desc': '温和比暴力更有力量',
        'pages': mk_pages([
            ('旁白', '北风和大阳争论谁更厉害。正好路上走来一个穿外套的旅人。'),
            ('北风', '北风说：“看我的！我把外套吹掉，就算我赢。”他呼地一吹，冷得旅人把外套裹得更紧。'),
            ('旁白', '北风越吹越猛，旅人却把外套越裹越牢，北风累得没了力气。'),
            ('太阳', '太阳笑眯眯地说：“该我了。”他暖暖地照着，旅人觉得热，自己脱下了外套。'),
            ('旁白', '太阳赢了。温和的阳光，比猛烈的北风更有力量。'),
            ('旁白', '做人也是一样：好好说话，比凶巴巴地强迫，更容易让人愿意听。'),
        ]),
    },
    {
        'id': 'sleeping', 'cat': 'fairy', 'icon': '👸', 'title': '睡美人',
        'tag': '幼升小', 'age': '幼升小', 'grade': '幼小衔接', 'ready': True,
        'desc': '真爱之吻唤醒一切',
        'pages': mk_pages([
            ('旁白', '国王给小公主办满月酒，请了十二位仙女。可他忘了第十三位坏仙女。'),
            ('坏仙女', '坏仙女生气地咒道：“公主十五岁会被纺锤刺伤，永远睡着！”'),
            ('好仙女', '好仙女赶紧改咒：“不是死去，是沉睡，等真爱之吻来唤醒。”'),
            ('旁白', '公主十五岁那年，真的被纺锤刺了一下，和王宫所有人一起沉沉地睡着了。'),
            ('旁白', '多年后，一位王子穿过荆棘来到她身边，轻轻一吻——'),
            ('旁白', '公主睁开眼睛，王宫也醒了过来。善良和勇气，守住了美好的结局。'),
        ]),
    },
    {
        'id': 'cinderella', 'cat': 'fairy', 'icon': '👗', 'title': '灰姑娘',
        'tag': '幼升小', 'age': '幼升小', 'grade': '幼小衔接', 'ready': True,
        'desc': '善良的女孩会有好报',
        'pages': mk_pages([
            ('旁白', '灰姑娘的妈妈很早就走了，她和坏脾气的继母、两个姐姐住在一起，天天干活。'),
            ('灰姑娘', '继母说：“你不准去舞会！”灰姑娘伤心地哭了。'),
            ('仙女', '好心的仙女出现，用南瓜变马车、用老鼠变马夫，还给她一身漂亮的礼服。'),
            ('旁白', '仙女说：“魔法只在十二点前有效，要记得回家。”舞会上，王子只请她一个人跳舞。'),
            ('旁白', '钟声一响，灰姑娘跑掉，落下一只水晶鞋。王子拿着鞋挨家挨户找主人。'),
            ('旁白', '鞋刚好合灰姑娘的脚。王子和她举行了婚礼。善良的人，终于被温柔对待。'),
        ]),
    },
    {
        'id': 'mermaid', 'cat': 'fairy', 'icon': '🧜‍♀️', 'title': '海的女儿',
        'tag': '小学1-3', 'age': '小学1-3', 'grade': '小学1-3年级', 'ready': True,
        'desc': '爱与牺牲的美好故事',
        'pages': mk_pages([
            ('旁白', '海底住着小美人鱼，她有动听的歌声，最喜欢听姐姐讲人类世界的故事。'),
            ('小美人鱼', '十五岁生日，她浮出海面，看见一艘大船，船上有位英俊的王子。'),
            ('旁白', '海上起了风暴，王子落水了。小美人鱼把他托上岸，悄悄躲进浪花里。'),
            ('巫婆', '小美人鱼求海巫婆：“给我双腿吧！”巫婆说：“用你的声音换，而且每走一步都像踩在刀尖上。”'),
            ('旁白', '小美人鱼喝下药水，失去了声音，来到王子身边。可王子以为救他的是别的姑娘。'),
            ('旁白', '最后，小美人鱼没有伤害王子，化作海上的泡沫，飞向明亮的星星。爱，让她变得闪闪发光。'),
        ]),
    },
]

# 占位书目（原有，内容整理中）——保证每本都有视觉与入口，可后续填充
PLACEHOLDERS = [
    {'id': 'snowwhite', 'cat': 'classic', 'icon': '👸', 'title': '白雪公主', 'tag': '小学1-3', 'age': '小学1-3', 'grade': '小学1-3年级', 'ready': False, 'desc': '善良是最美的魔法'},
    {'id': 'radish', 'cat': 'classic', 'icon': '🥕', 'title': '拔萝卜', 'tag': '幼升小', 'age': '幼升小', 'grade': '幼小衔接', 'ready': False, 'desc': '团结力量大'},
    {'id': 'fox_grape', 'cat': 'fable', 'icon': '🦊', 'title': '狐狸和葡萄', 'tag': '幼升小', 'age': '幼升小', 'grade': '幼小衔接', 'ready': False, 'desc': '吃不到的葡萄是酸的？'},
    {'id': 'ant_grass', 'cat': 'fable', 'icon': '🐜', 'title': '蚂蚁和蝈蝈', 'tag': '小学1-3', 'age': '小学1-3', 'grade': '小学1-3年级', 'ready': False, 'desc': '未雨绸缪，有备无患'},
    {'id': 'frog', 'cat': 'fairy', 'icon': '🐸', 'title': '青蛙王子', 'tag': '幼升小', 'age': '幼升小', 'grade': '幼小衔接', 'ready': False, 'desc': '承诺一定要遵守哦'},
    {'id': 'beauty', 'cat': 'fairy', 'icon': '🌹', 'title': '美女与野兽', 'tag': '小学1-3', 'age': '小学1-3', 'grade': '小学1-3年级', 'ready': False, 'desc': '真正的美在于内心'},
    {'id': 'matchgirl', 'cat': 'fairy', 'icon': '💡', 'title': '卖火柴的小女孩', 'tag': '小学3-6', 'age': '小学3-6', 'grade': '小学3-6年级', 'ready': False, 'desc': '珍惜现在的幸福生活'},
]

ALL = STORIES + PLACEHOLDERS

# 封面：9 本精编故事由 ImageGen 生成（assets/books/<id>.png），占位书目用 '' 表示 CSS 占位封面
COVER = {
    'guitu': 'assets/books/guitu.png',
    'three_pigs': 'assets/books/three_pigs.png',
    'redhood': 'assets/books/redhood.png',
    'uglyduck': 'assets/books/uglyduck.png',
    'wolf_comes': 'assets/books/wolf_comes.png',
    'wind_sun': 'assets/books/wind_sun.png',
    'sleeping': 'assets/books/sleeping.png',
    'cinderella': 'assets/books/cinderella.png',
    'mermaid': 'assets/books/mermaid.png',
}
for s in ALL:
    s['cover'] = COVER.get(s['id'], '')

js = '// 自动生成：绘本故事内容（公版）+ 逐字拼音标注。由 gen_books.py 生成，勿手改。\n'
js += 'window.BOOK_CONTENT = ' + json.dumps(ALL, ensure_ascii=False, indent=1) + ';\n'

with open('books_content.js', 'w', encoding='utf-8') as f:
    f.write(js)

print('OK stories=%d (ready=%d, placeholder=%d)' % (len(ALL), len(STORIES), len(PLACEHOLDERS)))
print('chars annotated total =', sum(len(p['chars']) for s in STORIES for p in s['pages']))
