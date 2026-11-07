// ============================================================
//  data.js - 数据层
// ============================================================

(function() {
    'use strict';

    var CATEGORY_TITLES = {
        prop: "PROP - 物品类",
        creature: "CREATURE - 生物类",
        vehicle: "VEHICLE - 载具类",
        test: "TEST - 测试类",
        weapon: "WEAPONS - 武器类",
        other: "OTHER - 特殊类"
    };

    var CATEGORY_ORDER = ['prop', 'creature', 'vehicle', 'test', 'weapon', 'other'];

    var EXISTING_EMOJIS = [
        '📦', '🌲', '⚽', '💎', '🍎', '🏮', '🍕', '⚔️',
        '🧑‍🌾', '🕵️', '🐉',
        '🚗', '🚚', '🏍️', '🚲', '✈️', '🚁',
        '🤖', '🌀', '💠',
        '🔪', '🗡️', '⛏️', '📐'
    ];

    function isEmojiExists(emoji) {
        return EXISTING_EMOJIS.indexOf(emoji) !== -1;
    }

    var OFFICIAL_RAW = {
        prop: [
            { name: "木箱", emoji: "📦", radius: 22 },
            { name: "松树", emoji: "🌲", radius: 20 },
            { name: "足球", emoji: "⚽", radius: 16 },
            { name: "钻石", emoji: "💎", radius: 15 },
            { name: "苹果", emoji: "🍎", radius: 14 },
            { name: "灯笼", emoji: "🏮", radius: 16 },
            { name: "披萨", emoji: "🍕", radius: 18 },
            { name: "双剑", emoji: "⚔️", radius: 18 },
            { name: "笑脸", emoji: "😁", radius: 18 },
            { name: "大笑", emoji: "😂", radius: 18 },
            { name: "开心", emoji: "😃", radius: 18 },
            { name: "咧嘴笑", emoji: "😄", radius: 18 },
            { name: "小恶魔", emoji: "👿", radius: 18 },
            { name: "眨眼", emoji: "😉", radius: 18 },
            { name: "微笑", emoji: "😊", radius: 18 },
            { name: "天使笑", emoji: "☺", radius: 18 },
            { name: "放松", emoji: "😌", radius: 18 },
            { name: "爱心眼", emoji: "😍", radius: 18 },
            { name: "坏笑", emoji: "😏", radius: 18 },
            { name: "无语", emoji: "😒", radius: 18 },
            { name: "汗", emoji: "😓", radius: 18 },
            { name: "难过", emoji: "😔", radius: 18 },
            { name: "尴尬", emoji: "😖", radius: 18 },
            { name: "飞吻", emoji: "😘", radius: 18 },
            { name: "亲亲", emoji: "😚", radius: 18 },
            { name: "吐舌头", emoji: "😜", radius: 18 },
            { name: "吐舌头2", emoji: "😝", radius: 18 },
            { name: "失望", emoji: "😞", radius: 18 },
            { name: "生气", emoji: "😠", radius: 18 },
            { name: "愤怒", emoji: "😡", radius: 18 },
            { name: "哭泣", emoji: "😢", radius: 18 },
            { name: "焦虑", emoji: "😣", radius: 18 },
            { name: "震惊", emoji: "😳", radius: 18 },
            { name: "惊讶", emoji: "😲", radius: 18 },
            { name: "恐惧", emoji: "😱", radius: 18 },
            { name: "惊恐", emoji: "😰", radius: 18 },
            { name: "痛哭", emoji: "😭", radius: 18 },
            { name: "困倦", emoji: "😪", radius: 18 },
            { name: "害怕", emoji: "😨", radius: 18 },
            { name: "担心", emoji: "😥", radius: 18 },
            { name: "生病", emoji: "😷", radius: 18 },
            { name: "倒脸", emoji: "🙃", radius: 18 },
            { name: "美味", emoji: "😋", radius: 18 },
            { name: "亲吻", emoji: "😗", radius: 18 },
            { name: "嘟嘴", emoji: "😛", radius: 18 },
            { name: "钱眼", emoji: "🤑", radius: 18 },
            { name: "书呆子", emoji: "🤓", radius: 18 },
            { name: "酷", emoji: "😎", radius: 18 },
            { name: "睡觉", emoji: "😴", radius: 18 },
            { name: "发烧", emoji: "🤒", radius: 18 },
            { name: "闭嘴", emoji: "🤐", radius: 18 },
            { name: "抓狂", emoji: "😤", radius: 18 },
            { name: "困惑", emoji: "😩", radius: 18 },
            { name: "思考", emoji: "🤔", radius: 18 },
            { name: "翻白眼", emoji: "🙄", radius: 18 },
            { name: "拥抱", emoji: "🤗", radius: 18 },
            { name: "大笑2", emoji: "😀", radius: 18 },
            { name: "咧嘴笑2", emoji: "😆", radius: 18 },
            { name: "天使微笑", emoji: "😅", radius: 18 },
            { name: "光环", emoji: "😇", radius: 18 },
            { name: "微笑2", emoji: "🙂", radius: 18 },
            { name: "亲亲2", emoji: "😙", radius: 18 },
            { name: "悲伤", emoji: "😟", radius: 18 },
            { name: "无奈", emoji: "😕", radius: 18 },
            { name: "皱眉", emoji: "🙁", radius: 18 },
            { name: "哭脸", emoji: "☹️", radius: 18 },
            { name: "头晕", emoji: "😫", radius: 18 },
            { name: "晕", emoji: "😵", radius: 18 },
            { name: "闭嘴2", emoji: "😬", radius: 18 },
            { name: "受伤", emoji: "🤕", radius: 18 },
            { name: "沉默", emoji: "😮", radius: 18 },
            { name: "焦虑2", emoji: "😧", radius: 18 },
            { name: "面无表情", emoji: "😑", radius: 18 },
            { name: "安静", emoji: "😐", radius: 18 },
            { name: "无语2", emoji: "😶", radius: 18 },
            { name: "幽灵", emoji: "👻", radius: 20 },
            { name: "便便", emoji: "💩", radius: 18 },
            { name: "骷髅", emoji: "💀", radius: 20 },
            { name: "骷髅骨", emoji: "☠️", radius: 20 },
            { name: "日本鬼", emoji: "👺", radius: 20 },
            { name: "食人魔", emoji: "👹", radius: 20 },
            { name: "恶魔", emoji: "😈", radius: 18 },
            { name: "外星人", emoji: "👾", radius: 20 },
            { name: "外星生物", emoji: "👽", radius: 20 }
        ],
        creature: [
            { name: "农夫", emoji: "🧑‍🌾", radius: 22, category: "creature", damage: 5, health: 100 },
            { name: "侦探", emoji: "🕵️", radius: 21, category: "creature", damage: 8, health: 120 },
            { name: "龙", emoji: "🐉", radius: 34, category: "creature", damage: 20, health: 200 },
            { name: "宝宝", emoji: "👶", radius: 20, category: "creature", damage: 1, health: 30 },
            { name: "男孩", emoji: "👦", radius: 22, category: "creature", damage: 2, health: 50 },
            { name: "女孩", emoji: "👧", radius: 22, category: "creature", damage: 2, health: 50 },
            { name: "男人", emoji: "👨", radius: 24, category: "creature", damage: 5, health: 80 },
            { name: "女人", emoji: "👩", radius: 24, category: "creature", damage: 5, health: 80 },
            { name: "金发", emoji: "👱", radius: 22, category: "creature", damage: 3, health: 60 },
            { name: "光头", emoji: "👲", radius: 22, category: "creature", damage: 3, health: 60 },
            { name: "戴头巾", emoji: "👳", radius: 22, category: "creature", damage: 3, health: 60 },
            { name: "老人", emoji: "👴", radius: 22, category: "creature", damage: 2, health: 40 },
            { name: "老太太", emoji: "👵", radius: 22, category: "creature", damage: 2, health: 40 },
            { name: "警察", emoji: "👮", radius: 24, category: "creature", damage: 8, health: 100 },
            { name: "工人", emoji: "👷", radius: 24, category: "creature", damage: 6, health: 90 },
            { name: "公主", emoji: "👸", radius: 22, category: "creature", damage: 4, health: 70 },
            { name: "保镖", emoji: "💂", radius: 24, category: "creature", damage: 7, health: 100 },
            { name: "圣诞老人", emoji: "🎅", radius: 24, category: "creature", damage: 3, health: 80 },
            { name: "侦探2", emoji: "🕵️", radius: 22, category: "creature", damage: 5, health: 80 },
            { name: "新娘", emoji: "👰", radius: 22, category: "creature", damage: 3, health: 60 }
        ],
        vehicle: [
            { name: "轿车", emoji: "🚗", radius: 28 },
            { name: "卡车", emoji: "🚚", radius: 32 },
            { name: "摩托车", emoji: "🏍️", radius: 18 },
            { name: "自行车", emoji: "🚲", radius: 20 },
            { name: "飞机", emoji: "✈️", radius: 30 },
            { name: "直升机", emoji: "🚁", radius: 28 },
            { name: "火箭", emoji: "🚀", radius: 26 },
            { name: "卫星", emoji: "🛰️", radius: 24 },
            { name: "潜水艇", emoji: "🚤", radius: 26 },
            { name: "帆船", emoji: "⛵", radius: 28 },
            { name: "轮船", emoji: "🚢", radius: 34 }
        ],
        test: [
            { name: "机器人", emoji: "🤖", radius: 24 },
            { name: "漩涡", emoji: "🌀", radius: 26 },
            { name: "数据体", emoji: "💠", radius: 18 }
        ],
        weapon: [
            { name: "小刀", emoji: "🔪", radius: 16, damage: 12, weaponType: "🔪", attackSpeed: 0.5 },
            { name: "短剑", emoji: "🗡️", radius: 18, damage: 20, weaponType: "🗡️", attackSpeed: 0.7 },
            { name: "镐子", emoji: "⛏️", radius: 20, damage: 18, weaponType: "⛏️", attackSpeed: 1.0 },
            { name: "三角尺", emoji: "📐", radius: 16, damage: 10, weaponType: "📐", attackSpeed: 0.4 }
        ],
        other: [
            { name: "示例音乐1", type: "music", musicUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" },
            { name: "示例音乐2", type: "music", musicUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3" }
        ]
    };

    var FACTORY_MODS = {
        prop: [],
        creature: [],
        vehicle: [],
        test: [],
        weapon: [],
        other: []
    };

    var modsInternal = JSON.parse(JSON.stringify(FACTORY_MODS));

    // ============================================================
    //  TOOLS 配置 - 移除 AI 控制
    // ============================================================
    var TOOLS_OFFICIAL = [
        { name: "清除实体", id: "clearAllEntities" },
        { name: "无敌", id: "toggleInvincible" },
        { name: "AI无视", id: "toggleAIIgnore" },
        { name: "声音开关", id: "toggleSound" },
        { name: "无限弹药", id: "toggleInfiniteAmmo" }
    ];

    function sanitizeAttackSpeed(value) {
        var spd = parseFloat(value);
        if (isNaN(spd)) return 0.5;
        if (spd < 0.05) return 0.05;
        if (spd > 5.0) return 5.0;
        return spd;
    }

    function sanitizeScale(value) {
        var s = parseFloat(value);
        if (isNaN(s)) return 1.0;
        if (s < 0.3) return 0.3;
        if (s > 3.0) return 3.0;
        return s;
    }

    function sanitizeEffect(id, spd) {
        var eId = parseInt(id);
        if (isNaN(eId) || eId < 1 || eId > 20) eId = 5;
        var eSpd = parseFloat(spd);
        if (isNaN(eSpd)) eSpd = 1.0;
        eSpd = Math.min(3.0, Math.max(0.1, eSpd));
        return { effectId: eId, effectSpeed: eSpd };
    }

    function sanitizeAi(code, spd) {
        var c = parseInt(code);
        if (isNaN(c) || c < 0 || c > 10) c = 0;
        var s = parseFloat(spd);
        if (isNaN(s)) s = 1.0;
        s = Math.min(5.0, Math.max(0.1, s));
        return { ai: c, aiSpeed: s };
    }

    window.DATA = {
        CATEGORY_TITLES: CATEGORY_TITLES,
        CATEGORY_ORDER: CATEGORY_ORDER,
        OFFICIAL_RAW: OFFICIAL_RAW,
        FACTORY_MODS: FACTORY_MODS,
        modsInternal: modsInternal,
        TOOLS_OFFICIAL: TOOLS_OFFICIAL,
        sanitizeAttackSpeed: sanitizeAttackSpeed,
        sanitizeScale: sanitizeScale,
        sanitizeEffect: sanitizeEffect,
        sanitizeAi: sanitizeAi,
        isEmojiExists: isEmojiExists,
        EXISTING_EMOJIS: EXISTING_EMOJIS
    };

    console.log('[DATA] 数据层已加载');

})();