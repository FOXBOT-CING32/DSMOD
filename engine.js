// ============================================================
//  engine.js - 最终完整修复版
//  修复：正确染色（白色=原始，其他颜色改主色保留细节）
// ============================================================

(function() {
    'use strict';

    // ============================================================
    //  核心变量
    // ============================================================
    var playerHealth = 100;
    var maxHealth = 100;
    var isDead = false;
    var deathTimer = 0;
    var bloodParticles = [];
    var attackParticles = [];
    var worldEntities = [];
    var bullets = [];
    var nextId = 1;
    var animTime = 0;
    var lastCollideSoundTime = 0;
    var weaponIndex = 0;
    var gameReady = false;
    var lastRenderTime = 0;
    var RENDER_THROTTLE = 16;
    var DEATH_RESPAWN_DELAY = 2.0;
    var engineInitialized = false;

    var aiEnabled = true;
    var invincible = false;
    var aiIgnore = false;

    var canvas = document.getElementById('gameCanvas');
    var ctx = canvas.getContext('2d');
    var W, H;

    var camera = { x: 0, y: 0 };
    var CAMERA_ZOOM = 1.75;
    var WORLD_LIMIT = 3200;

    // ============================================================
    //  音效系统
    // ============================================================
    var hitAudio = null;
    var deathAudio = null;
    var menuAudio = null;
    var weaponAudio = null;
    var currentPlayingAudio = null;
    var currentAudioBlobUrl = null;
    var audioPool = new Map();
    var activeBlobUrls = [];
    var entityAudioPool = new Map();
    var _hitAudioLastPlay = 0;
    var _hitAudioMinInterval = 50;

    var SOUND_CONFIG = {
        maxDistance: 600,
        minVolume: 0.02,
        maxVolume: 0.6,
        updateInterval: 150,
        fadeSpeed: 0.05
    };

    // ============================================================
    //  弹药系统
    // ============================================================
    var ammoSystem = {
        maxAmmo: 30,
        currentAmmo: 30,
        isReloading: false,
        reloadTimer: 0,
        reloadDuration: 1.5,
        isInfinite: true
    };

    // ============================================================
    //  攻击状态
    // ============================================================
    var attackState = {
        isActive: false,
        cooldown: 0,
        fireRate: 0.15,
        isRanged: false,
        lastAngle: 0,
        hasAngle: false
    };

    // ============================================================
    //  玩家对象
    // ============================================================
    var player = {
        x: 0,
        y: 0,
        radius: 26,
        speed: 380,
        isPlayer: true,
        name: "玩家",
        emoji: "😎",
        color: "#ffffff",
        nameColor: "#ffffff",
        _avatarImage: null,
        _avatarImageObj: null,
        currentWeapon: null,
        unlockedWeapons: [],
        hasUnlockedWeapon: false,
        angle: 0,
        swingProgress: 0,
        isSwinging: false,
        recoilOffset: 0,
        weaponData: {},
        _weaponImageCache: {}
    };

    // ============================================================
    //  武器图片缓存
    // ============================================================
    var weaponImageCache = {};
    var bulletImageCache = {};
    var trailImageCache = {};
    var muzzleImageCache = {};
    var hitImageCache = {};
    var swingImageCache = {};

    // ============================================================
    //  DB相关
    // ============================================================
    var DB_NAME = 'DSMOD_V2_DB';
    var DB_VERSION = 1;
    var STORE_NAME = 'files';
    var db = null;

    // ============================================================
    //  草地纹理
    // ============================================================
    var grassTexture = null;
    var grassTextureLoaded = false;
    var grassImageUrl = "images/grass.webp";

    // ============================================================
    //  尺寸更新
    // ============================================================
    function resize() {
        W = canvas.width = window.innerWidth;
        H = canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resize);
    resize();

    // ============================================================
    //  音效系统核心函数
    // ============================================================
    function playSoundWithDistance(url, sourceX, sourceY, maxDist) {
        if (!url) return null;
        maxDist = maxDist || SOUND_CONFIG.maxDistance;
        var dx = sourceX - player.x;
        var dy = sourceY - player.y;
        var dist = Math.hypot(dx, dy);
        if (dist > maxDist) return null;
        var volume = 1 - (dist / maxDist);
        volume = Math.max(SOUND_CONFIG.minVolume, Math.min(SOUND_CONFIG.maxVolume, volume * SOUND_CONFIG.maxVolume));
        var audio = audioPool.get(url);
        if (!audio) {
            audio = new Audio(url);
            audio.volume = volume;
            audioPool.set(url, audio);
        }
        try {
            audio.currentTime = 0;
            audio.volume = volume;
            audio.play().catch(function(e) {});
            return audio;
        } catch(e) {
            return null;
        }
    }

    function playSoundFixed(url, volume) {
        if (!url) return;
        volume = volume || 0.4;
        var audio = audioPool.get(url);
        if (!audio) {
            audio = new Audio(url);
            audio.volume = volume;
            audioPool.set(url, audio);
        }
        try {
            audio.currentTime = 0;
            audio.volume = volume;
            audio.play().catch(function(e) {});
        } catch(e) {}
    }

    function playUnifiedHitSound() {
        var now = Date.now();
        if (now - _hitAudioLastPlay < _hitAudioMinInterval) return;
        _hitAudioLastPlay = now;
        try {
            if (!hitAudio) {
                hitAudio = new Audio();
                hitAudio.src = "sound/hit.mp3";
                hitAudio.volume = 0.5;
                hitAudio.load();
            }
            hitAudio.currentTime = 0;
            hitAudio.volume = 0.5;
            hitAudio.play().catch(function(e) {});
        } catch(e) {}
    }

    function playDeathSound() {
        try {
            if(!deathAudio) { deathAudio = new Audio(); deathAudio.src = "sound/die.mp3"; deathAudio.volume = 0.6; }
            deathAudio.currentTime = 0;
            deathAudio.play().catch(function(e) {});
        } catch(e) {}
    }

    function playMenuSound() {
        playSoundFixed("sound/spawnmenu.mp3", 0.4);
    }

    function playWeaponSound() {
        playSoundFixed("sound/weapons.mp3", 0.5);
    }

    function playReloadSound() {
        playSoundFixed("sound/reload.mp3", 0.5);
    }

    function playSound(url) {
        if (!url) return;
        playSoundFixed(url, 0.4);
    }

    function updateEntityAudio() {
        for (var i = 0; i < worldEntities.length; i++) {
            var ent = worldEntities[i];
            if (!ent.chaseAudio) continue;
            if (ent.health !== undefined && ent.health <= 0) {
                try {
                    ent.chaseAudio.pause();
                    ent.chaseAudio.currentTime = 0;
                    ent.chaseAudio = null;
                } catch(e) {}
                continue;
            }
            var dx = ent.x - player.x;
            var dy = ent.y - player.y;
            var dist = Math.hypot(dx, dy);
            var maxDist = ent.chaseMaxDist || SOUND_CONFIG.maxDistance;
            var targetVolume = 0;
            if (dist < maxDist) {
                targetVolume = 1 - (dist / maxDist);
                targetVolume = Math.max(SOUND_CONFIG.minVolume, Math.min(SOUND_CONFIG.maxVolume, targetVolume * SOUND_CONFIG.maxVolume));
            }
            if (ent._currentVolume === undefined) ent._currentVolume = 0;
            var diff = targetVolume - ent._currentVolume;
            if (Math.abs(diff) > 0.01) {
                ent._currentVolume += diff * Math.min(1, SOUND_CONFIG.fadeSpeed * 2);
            } else {
                ent._currentVolume = targetVolume;
            }
            try {
                ent.chaseAudio.volume = Math.max(0, ent._currentVolume);
                if (ent._currentVolume > 0.01 && ent.chaseAudio.paused) {
                    ent.chaseAudio.play().catch(function(e) {});
                } else if (ent._currentVolume <= 0.01 && !ent.chaseAudio.paused) {
                    ent.chaseAudio.pause();
                }
            } catch(e) {}
        }
    }

    function loadSoundFromDB(id, callback) {
        if (!id) { if (callback) callback(null); return; }
        if (id.startsWith('http') || id.startsWith('blob:')) { if (callback) callback(id); return; }
        loadFileFromDB(id).then(function(result) {
            if (result && result.url) {
                addBlobUrl(result.url);
                if (callback) callback(result.url);
            } else {
                if (callback) callback(null);
            }
        }).catch(function(e) {
            console.warn('[ENGINE] 音效加载异常:', id, e);
            if (callback) callback(null);
        });
    }

    // ============================================================
    //  停止所有声音
    // ============================================================
    function stopAllSounds() {
        for (var entry of audioPool) {
            try { 
                entry[1].pause(); 
                entry[1].currentTime = 0; 
            } catch(e) {}
        }
        for (var i = 0; i < worldEntities.length; i++) {
            var ent = worldEntities[i];
            if (ent.chaseAudio) {
                try { 
                    ent.chaseAudio.pause(); 
                    ent.chaseAudio.currentTime = 0; 
                    ent.chaseAudio = null;
                } catch(e) {}
            }
        }
        if (currentPlayingAudio) {
            try { 
                currentPlayingAudio.pause(); 
                currentPlayingAudio.currentTime = 0; 
                currentPlayingAudio = null;
            } catch(e) {}
        }
        if (hitAudio) {
            try { hitAudio.pause(); hitAudio.currentTime = 0; } catch(e) {}
        }
        if (deathAudio) {
            try { deathAudio.pause(); deathAudio.currentTime = 0; } catch(e) {}
        }
        if (menuAudio) {
            try { menuAudio.pause(); menuAudio.currentTime = 0; } catch(e) {}
        }
        if (weaponAudio) {
            try { weaponAudio.pause(); weaponAudio.currentTime = 0; } catch(e) {}
        }
        var soundExtensions = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.wma', '.aiff', '.opus'];
        var newActiveBlobUrls = [];
        for (var i = 0; i < activeBlobUrls.length; i++) {
            var url = activeBlobUrls[i];
            var isSound = false;
            for (var s = 0; s < soundExtensions.length; s++) {
                if (url && url.toLowerCase().indexOf(soundExtensions[s]) !== -1) {
                    isSound = true;
                    break;
                }
            }
            if (isSound) {
                try { URL.revokeObjectURL(url); } catch(e) {}
            } else {
                newActiveBlobUrls.push(url);
            }
        }
        activeBlobUrls = newActiveBlobUrls;
        if (window.UI && window.UI.showToast) window.UI.showToast('🔇 所有声音已停止');
    }

    // ============================================================
    //  音乐播放
    // ============================================================
    function playMusic(item, name) {
        if(currentPlayingAudio) {
            try {
                currentPlayingAudio.pause();
                currentPlayingAudio = null;
            } catch(e) {}
        }
        if(currentAudioBlobUrl) {
            URL.revokeObjectURL(currentAudioBlobUrl);
            currentAudioBlobUrl = null;
        }

        var audioUrl = null;
        var isBlob = false;

        if(item.musicUrl && (item.musicUrl.startsWith('http://') || item.musicUrl.startsWith('https://'))) {
            audioUrl = item.musicUrl;
        } else if(item.fileId) {
            loadFileFromDB(item.fileId).then(function(result) {
                if (result) {
                    var url = result.url;
                    addBlobUrl(url);
                    var audio = new Audio(url);
                    audio.loop = false;
                    audio.volume = 0.6;
                    audio.onended = function() {
                        if (url) URL.revokeObjectURL(url);
                        if(currentPlayingAudio === audio) currentPlayingAudio = null;
                    };
                    audio.onerror = function() {
                        if (window.UI && window.UI.showToast) window.UI.showToast('❌ 播放失败: ' + name);
                        if(currentPlayingAudio === audio) currentPlayingAudio = null;
                    };
                    audio.play().then(function() {
                        currentPlayingAudio = audio;
                        currentAudioBlobUrl = url;
                        if (window.UI && window.UI.showToast) window.UI.showToast('🎵 播放: ' + name);
                    }).catch(function(e) {
                        if (window.UI && window.UI.showToast) window.UI.showToast('❌ 播放失败: ' + name);
                    });
                } else {
                    if (window.UI && window.UI.showToast) window.UI.showToast('❌ 无法加载音乐: ' + name);
                }
            });
            return;
        } else if(item.file) {
            audioUrl = URL.createObjectURL(item.file);
            isBlob = true;
            currentAudioBlobUrl = audioUrl;
            addBlobUrl(audioUrl);
        }

        if(!audioUrl) {
            if (window.UI && window.UI.showToast) window.UI.showToast('❌ 无法播放: ' + name);
            return;
        }

        var audio = new Audio(audioUrl);
        audio.loop = false;
        audio.volume = 0.6;
        audio.onended = function() {
            if(isBlob && currentAudioBlobUrl) {
                URL.revokeObjectURL(currentAudioBlobUrl);
                currentAudioBlobUrl = null;
            }
            if(currentPlayingAudio === audio) currentPlayingAudio = null;
        };
        audio.onerror = function() {
            if (window.UI && window.UI.showToast) window.UI.showToast('❌ 播放失败: ' + name);
            if(isBlob && currentAudioBlobUrl) {
                URL.revokeObjectURL(currentAudioBlobUrl);
                currentAudioBlobUrl = null;
            }
            if(currentPlayingAudio === audio) currentPlayingAudio = null;
        };
        audio.play().then(function() {
            currentPlayingAudio = audio;
            if (window.UI && window.UI.showToast) window.UI.showToast('🎵 播放: ' + name);
        }).catch(function(e) {
            if (window.UI && window.UI.showToast) window.UI.showToast('❌ 播放失败: ' + name);
            if(isBlob && currentAudioBlobUrl) {
                URL.revokeObjectURL(currentAudioBlobUrl);
                currentAudioBlobUrl = null;
            }
        });
    }

    // ============================================================
    //  IndexedDB
    // ============================================================
    function initIndexedDB() {
        return new Promise(function(resolve, reject) {
            var request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onerror = function() { reject(request.error); };
            request.onsuccess = function() {
                db = request.result;
                resolve(db);
            };
            request.onupgradeneeded = function(e) {
                var db = e.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                }
            };
        });
    }

    function loadFileFromDB(id) {
        return new Promise(function(resolve, reject) {
            if (!db) {
                initIndexedDB().then(function() {
                    doLoad();
                }).catch(function(err) {
                    reject(err);
                });
            } else {
                doLoad();
            }
            function doLoad() {
                var transaction = db.transaction([STORE_NAME], 'readonly');
                var store = transaction.objectStore(STORE_NAME);
                var request = store.get(id);
                request.onsuccess = function() {
                    if (request.result) {
                        var blob = request.result.data;
                        var url = URL.createObjectURL(blob);
                        resolve({ url: url, blob: blob, type: request.result.type });
                    } else {
                        resolve(null);
                    }
                };
                request.onerror = function() { reject(request.error); };
            }
        });
    }

    function addBlobUrl(url) {
        if (url && url.startsWith('blob:')) {
            var soundExtensions = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.wma', '.aiff', '.opus'];
            var isSound = false;
            for (var i = 0; i < soundExtensions.length; i++) {
                if (url.toLowerCase().indexOf(soundExtensions[i]) !== -1) {
                    isSound = true;
                    break;
                }
            }
            if (isSound) {
                activeBlobUrls.push(url);
            }
        }
    }

    // ============================================================
    //  草地纹理初始化
    // ============================================================
    function initGrassTexture() {
        grassTexture = new Image();
        grassTexture.crossOrigin = "Anonymous";
        grassTexture.onload = function() { 
            grassTextureLoaded = true; 
            if(gameReady) redrawCanvas(); 
        };
        grassTexture.onerror = function() { 
            console.warn('[ENGINE] 草地纹理加载失败，使用备用颜色');
            grassTextureLoaded = false; 
        };
        grassTexture.src = "images/grass.webp";
    }

    // ============================================================
    //  加载角色设置
    // ============================================================
    function loadPlayerSettings() {
        try {
            var saved = localStorage.getItem('DSMOD_settings');
            if (saved) {
                var settings = JSON.parse(saved);
                if (settings.playerName) {
                    player.name = settings.playerName;
                }
                if (settings.playerColor && settings.playerColor !== '#ffffff') {
                    player.color = settings.playerColor;
                } else {
                    player.color = '#ffffff';
                }
                if (settings.nameColor && settings.nameColor !== '#ffffff') {
                    player.nameColor = settings.nameColor;
                } else {
                    player.nameColor = '#ffffff';
                }
                if (settings.avatarData) {
                    if (settings.avatarType === 'image') {
                        player.emoji = null;
                        player._avatarImage = settings.avatarData;
                        var img = new Image();
                        img.crossOrigin = "Anonymous";
                        img.onload = function() {
                            player._avatarImageObj = img;
                            if (gameReady) redrawCanvas();
                        };
                        img.onerror = function() {
                            player._avatarImageObj = null;
                            player.emoji = '😎';
                            if (gameReady) redrawCanvas();
                        };
                        img.src = settings.avatarData;
                    } else {
                        player.emoji = settings.avatarData || '😎';
                        player._avatarImage = null;
                        player._avatarImageObj = null;
                    }
                }
                return true;
            }
        } catch(e) {
            console.warn('[ENGINE] 加载设置失败:', e);
        }
        return false;
    }

    function refreshPlayerSettings() {
        loadPlayerSettings();
        if (gameReady) redrawCanvas();
    }

    // ============================================================
    //  特效系统
    // ============================================================
    function applyEffect(ctx, id, speed, time) {
        var t = time * speed;
        switch(id) {
            case 1: ctx.rotate(Math.sin(t) * 0.2); break;
            case 2: var s = 0.8 + Math.sin(t * 3) * 0.2; ctx.scale(s, s); break;
            case 3: ctx.globalAlpha = 0.5 + Math.sin(t * 2) * 0.5; break;
            case 4: var hue = (t * 180) % 360; ctx.fillStyle = 'hsl(' + hue + ', 70%, 60%)'; ctx.beginPath(); ctx.arc(0, 0, 25, 0, Math.PI * 2); ctx.fill(); break;
            case 5: ctx.shadowBlur = 10 + Math.sin(t * 5) * 5; break;
            case 6: ctx.filter = 'blur(' + (Math.sin(t * 2) * 2) + 'px)'; break;
            case 7: ctx.globalCompositeOperation = 'lighter'; break;
            case 8: ctx.transform(1, 0, Math.sin(t) * 0.1, 1, 0, 0); break;
            case 9: var bounce = 1 + Math.sin(t * 8) * 0.1; ctx.scale(bounce, bounce); break;
            case 10: ctx.rotate(t * 2); break;
            case 11: var rainbowHue = (t * 360) % 360; ctx.fillStyle = 'hsl(' + rainbowHue + ', 100%, 60%)'; ctx.shadowBlur = 15; ctx.shadowColor = 'hsl(' + rainbowHue + ', 100%, 60%)'; ctx.beginPath(); ctx.arc(0, 0, 25, 0, Math.PI * 2); ctx.fill(); break;
            case 12: ctx.filter = 'blur(2px)'; ctx.globalAlpha = 0.7; break;
            case 13: var pulse = 1 + Math.sin(t * 10) * 0.15; ctx.scale(pulse, pulse); ctx.shadowBlur = 20; ctx.shadowColor = 'rgba(255, 200, 0, ' + (0.5 + Math.sin(t * 10) * 0.3) + ')'; break;
            case 14: var lightning = Math.sin(t * 30) > 0.8 ? 2 : 1; ctx.scale(lightning, lightning); ctx.filter = 'brightness(' + (1 + Math.sin(t * 30) * 0.5) + ')'; break;
            case 15: var fire = 1 + Math.sin(t * 15) * 0.08; ctx.scale(fire, fire * 0.9); ctx.filter = 'hue-rotate(' + (Math.sin(t * 20) * 10) + 'deg)'; break;
            case 16: ctx.filter = 'hue-rotate(180deg) brightness(1.2)'; ctx.globalAlpha = 0.85 + Math.sin(t * 3) * 0.1; break;
            case 17: ctx.filter = 'hue-rotate(90deg) drop-shadow(0 0 5px #0f0)'; var poisonScale = 1 + Math.sin(t * 6) * 0.05; ctx.scale(poisonScale, poisonScale); break;
            case 18: ctx.filter = 'blur(3px)'; ctx.globalAlpha = 0.6 + Math.sin(t * 5) * 0.2; break;
            case 19: var magnet = 1 + Math.sin(t * 12) * 0.05; ctx.scale(magnet, magnet); break;
            case 20: var distort = Math.sin(t * 4) * 0.05; ctx.transform(1, distort, distort, 1, 0, 0); break;
            default: break;
        }
    }

    // ============================================================
    //  实体生成
    // ============================================================
    function spawnEntity(tmpl, wx, wy) {
        var ent = {
            id: nextId++,
            x: wx, y: wy,
            radius: tmpl.radius || 20,
            name: tmpl.name,
            isPlayer: false,
            effectId: tmpl.effectId || 5,
            effectSpeed: tmpl.effectSpeed || 1,
            spawnSound: tmpl.spawnSound || null,
            spawnSoundId: tmpl.spawnSoundId || null,
            chaseSound: tmpl.chaseSound || null,
            chaseSoundId: tmpl.chaseSoundId || null,
            chaseAudio: null,
            lastChaseTime: 0,
            chaseMaxDist: tmpl.chaseMaxDist || 500,
            collideSound: tmpl.collideSound || null,
            collideSoundId: tmpl.collideSoundId || null,
            ai: tmpl.ai || 0,
            aiSpeed: tmpl.aiSpeed || 1,
            attackSpeed: tmpl.attackSpeed || 0.5,
            lastDamageTime: 0,
            animOffset: Math.random() * Math.PI * 2,
            bubbleText: tmpl.bubbleText || null,
            category: tmpl.category,
            damage: tmpl.damage,
            scale: tmpl.scale || 1.0,
            imageUrl: tmpl.imageUrl,
            imageId: tmpl.imageId,
            emoji: tmpl.emoji,
            health: tmpl.health || 100,
            _hitBySwing: false,
            luaData: tmpl.luaData || null,
            isLuaWeapon: tmpl.isLuaWeapon || false,
            _currentVolume: 0
        };
        
        if(ent.emoji === null && ent.imageUrl === null && !ent.imageId) ent.emoji = '📦';
        worldEntities.push(ent);
        
        if (ent.spawnSound) {
            playSoundWithDistance(ent.spawnSound, ent.x, ent.y, 400);
        } else if (ent.spawnSoundId) {
            loadSoundFromDB(ent.spawnSoundId, function(url) {
                if (url) {
                    ent.spawnSound = url;
                    playSoundWithDistance(url, ent.x, ent.y, 400);
                }
            });
        }
        
        if (ent.chaseSoundId) {
            loadSoundFromDB(ent.chaseSoundId, function(url) {
                if (url) {
                    ent.chaseSound = url;
                    var audio = new Audio(url);
                    audio.loop = true;
                    audio.volume = 0;
                    ent.chaseAudio = audio;
                }
            });
        } else if (ent.chaseSound) {
            try {
                var audio = new Audio(ent.chaseSound);
                audio.loop = true;
                audio.volume = 0;
                ent.chaseAudio = audio;
            } catch(e) {}
        }
        
        redrawCanvas();
    }

    function clearAllEntities() {
        for (var i = 0; i < worldEntities.length; i++) {
            var ent = worldEntities[i];
            if (ent.chaseAudio) {
                try {
                    ent.chaseAudio.pause();
                    ent.chaseAudio.currentTime = 0;
                    ent.chaseAudio = null;
                } catch(e) {}
            }
        }
        var count = worldEntities.length;
        worldEntities = [];
        if (window.UI && window.UI.showToast) window.UI.showToast('🗑️ 已清除 ' + count + ' 个实体');
        redrawCanvas();
    }

    function clearAll() {
        for (var i = 0; i < worldEntities.length; i++) {
            var ent = worldEntities[i];
            if (ent.chaseAudio) {
                try {
                    ent.chaseAudio.pause();
                    ent.chaseAudio.currentTime = 0;
                    ent.chaseAudio = null;
                } catch(e) {}
            }
        }
        worldEntities = [];
        bullets = [];
        nextId = 1;
        redrawCanvas();
    }

    // ============================================================
    //  获取玩家/实体
    // ============================================================
    function getPlayer() {
        return player;
    }

    function getEntities() {
        return worldEntities;
    }

    // ============================================================
    //  坐标转换
    // ============================================================
    function worldToScreen(wx, wy) {
        return {
            x: canvas.width/2 + (wx - camera.x) / CAMERA_ZOOM,
            y: canvas.height/2 + (wy - camera.y) / CAMERA_ZOOM
        };
    }

    // ============================================================
    //  AI系统
    // ============================================================
    function updateAI(entity, deltaTime) {
        if (aiIgnore) {
            if (entity.chaseAudio) {
                try {
                    entity.chaseAudio.pause();
                } catch(e) {}
                entity.chaseAudio = null;
            }
            return;
        }
        if (!aiEnabled) {
            if (entity.chaseAudio) {
                try {
                    entity.chaseAudio.pause();
                } catch(e) {}
                entity.chaseAudio = null;
            }
            return;
        }
        var ai = entity.ai, speed = entity.aiSpeed || 1.0;
        var dx = player.x - entity.x, dy = player.y - entity.y, dist = Math.hypot(dx,dy);
        
        if (entity.chaseSound && entity.chaseAudio && (ai === 2 || ai === 3 || ai === 7 || ai === 8 || ai === 10)) {
            var isChasing = false;
            if (ai === 2 && dist < 400) isChasing = true;
            if (ai === 3 && dist < 500) isChasing = true;
            if (ai === 7) isChasing = true;
            if (ai === 8) isChasing = true;
            if (ai === 10) isChasing = true;
            
            if (isChasing && entity.health > 0) {
                var maxDist = entity.chaseMaxDist || 500;
                var targetVolume = 0;
                if (dist < maxDist) {
                    targetVolume = 1 - (dist / maxDist);
                    targetVolume = Math.max(0.02, Math.min(0.6, targetVolume * 0.6));
                }
                if (entity._currentVolume === undefined) entity._currentVolume = 0;
                entity._currentVolume += (targetVolume - entity._currentVolume) * 0.1;
                try {
                    entity.chaseAudio.volume = Math.max(0, entity._currentVolume);
                    if (entity._currentVolume > 0.01 && entity.chaseAudio.paused) {
                        entity.chaseAudio.play().catch(function(e) {});
                    } else if (entity._currentVolume <= 0.01 && !entity.chaseAudio.paused) {
                        entity.chaseAudio.pause();
                    }
                } catch(e) {}
            } else {
                if (entity.chaseAudio && !entity.chaseAudio.paused) {
                    try {
                        entity.chaseAudio.pause();
                    } catch(e) {}
                }
            }
        } else {
            if (entity.chaseAudio && !entity.chaseAudio.paused) {
                try {
                    entity.chaseAudio.pause();
                } catch(e) {}
            }
        }
        
        if(ai===0) return;
        if(ai===1){ if(!entity.wanderTarget||Math.random()<0.02){ var a=Math.random()*Math.PI*2; entity.wanderTarget={x:entity.x+Math.cos(a)*150, y:entity.y+Math.sin(a)*150}; } if(entity.wanderTarget){ var ddx=entity.wanderTarget.x-entity.x, ddy=entity.wanderTarget.y-entity.y, len=Math.hypot(ddx,ddy); if(len>5){ entity.x+=(ddx/len)*speed*deltaTime*50; entity.y+=(ddy/len)*speed*deltaTime*50; }else entity.wanderTarget=null; } }
        else if(ai===2){ if(dist<400){ var a=Math.atan2(dy,dx); var moveSpeed = speed * deltaTime * 40; if (dist < 100) moveSpeed *= 1.2; entity.x+=Math.cos(a)*moveSpeed; entity.y+=Math.sin(a)*moveSpeed; } }
        else if(ai===3){ if(dist<500){ var a=Math.atan2(dy,dx); entity.x+=Math.cos(a)*speed*deltaTime*60; entity.y+=Math.sin(a)*speed*deltaTime*60; } }
        else if(ai===4){ if(dist<350){ var a=Math.atan2(dy,dx); entity.x-=Math.cos(a)*speed*deltaTime*55; entity.y-=Math.sin(a)*speed*deltaTime*55; } }
        else if(ai===5){ if(dist<200){ entity.facingPlayer=true; var a=Math.atan2(dy,dx); entity.x+=Math.cos(a)*speed*deltaTime*20; entity.y+=Math.sin(a)*speed*deltaTime*20; } }
        else if(ai===6){ if(!entity.patrolPoints || entity.patrolPoints.length===0 || (entity.patrolPoints[0] && Math.hypot(entity.patrolPoints[0].x-entity.x, entity.patrolPoints[0].y-entity.y)>300)){ entity.patrolPoints=[{x:entity.x+180,y:entity.y},{x:entity.x-180,y:entity.y},{x:entity.x,y:entity.y+180},{x:entity.x,y:entity.y-180}]; entity.patrolIndex=0; } var target=entity.patrolPoints[entity.patrolIndex]; var ddx=target.x-entity.x, ddy=target.y-entity.y, len=Math.hypot(ddx,ddy); if(len<15) entity.patrolIndex=(entity.patrolIndex+1)%entity.patrolPoints.length; else{ entity.x+=(ddx/len)*speed*deltaTime*45; entity.y+=(ddy/len)*speed*deltaTime*45; } }
        else if(ai===7){ if(!entity.circleAngle) entity.circleAngle=0; entity.circleAngle+=speed*deltaTime*2; var radius=150; entity.x=player.x+Math.cos(entity.circleAngle)*radius; entity.y=player.y+Math.sin(entity.circleAngle)*radius; }
        else if(ai===8){ var targetX=player.x, targetY=player.y; var ddx=targetX-entity.x, ddy=targetY-entity.y, len=Math.hypot(ddx,ddy); if(len>200){ entity.x+=(ddx/len)*speed*deltaTime*70; entity.y+=(ddy/len)*speed*deltaTime*70; }else if(len<100){ var awayX=entity.x-player.x, awayY=entity.y-player.y, awayLen=Math.hypot(awayX,awayY); if(awayLen>0){ entity.x+=(awayX/awayLen)*speed*deltaTime*50; entity.y+=(awayY/awayLen)*speed*deltaTime*50; } } }
        else if(ai===9){ if(!entity.wanderTarget||Math.random()<0.03){ var a=Math.atan2(dy,dx); entity.wanderTarget={x:entity.x-Math.cos(a)*200+Math.random()*100-50, y:entity.y-Math.sin(a)*200+Math.random()*100-50}; } if(entity.wanderTarget){ var ddx=entity.wanderTarget.x-entity.x, ddy=entity.wanderTarget.y-entity.y, len=Math.hypot(ddx,ddy); if(len>5){ entity.x+=(ddx/len)*speed*deltaTime*55; entity.y+=(ddy/len)*speed*deltaTime*55; }else entity.wanderTarget=null; } }
        else if(ai===10){ var angle=Math.atan2(dy,dx); var dashSpeed=Math.min(speed*4,15)*deltaTime*80; entity.x+=Math.cos(angle)*dashSpeed; entity.y+=Math.sin(angle)*dashSpeed; }
        entity.x=Math.min(WORLD_LIMIT,Math.max(-WORLD_LIMIT,entity.x));
        entity.y=Math.min(WORLD_LIMIT,Math.max(-WORLD_LIMIT,entity.y));
    }

    // ============================================================
    //  碰撞系统
    // ============================================================
    function resolveCollision(a,b) {
        var dx=a.x-b.x, dy=a.y-b.y, d=Math.hypot(dx,dy), md=a.radius+b.radius;
        if(d>=md) return;
        var ov=md-d, ang=Math.atan2(dy,dx), mx=Math.cos(ang)*ov, my=Math.sin(ang)*ov;
        if(a.isPlayer && !b.isPlayer){
            a.x+=mx; a.y+=my; b.x-=mx*0.3; b.y-=my*0.3;
            if(b.category === 'creature') {
                var damageVal = (b.damage !== undefined && b.damage !== null) ? b.damage : 5;
                if(damageVal > 0) {
                    takeDamage(damageVal, a.x, a.y, b.category, true, b);
                }
            }
            if(b.bubbleText && !b.bubbleShown){ b.bubbleShown=true; showBubble(b, b.bubbleText); setTimeout(function(){ b.bubbleShown=false; },3000); }
            var now=Date.now(); 
            if(b.collideSound && now-lastCollideSoundTime>500){ 
                lastCollideSoundTime=now; 
                playSoundWithDistance(b.collideSound, b.x, b.y, 300);
            } else if(b.collideSoundId) {
                loadSoundFromDB(b.collideSoundId, function(url) {
                    if(url && now-lastCollideSoundTime>500) {
                        lastCollideSoundTime=now;
                        playSoundWithDistance(url, b.x, b.y, 300);
                    }
                });
            }
            if (b.health && b.health <= 0) {
                if (window.UI && window.UI.addKillMessage) window.UI.addKillMessage(player, b);
            }
        } else if(!a.isPlayer && b.isPlayer){
            b.x-=mx; b.y-=my; a.x+=mx*0.3; a.y+=my*0.3;
            if(a.category === 'creature') {
                var damageVal = (a.damage !== undefined && a.damage !== null) ? a.damage : 5;
                if(damageVal > 0) {
                    takeDamage(damageVal, b.x, b.y, a.category, true, a);
                }
            }
            if(a.bubbleText && !a.bubbleShown){ a.bubbleShown=true; showBubble(a, a.bubbleText); setTimeout(function(){ a.bubbleShown=false; },3000); }
            var now=Date.now(); 
            if(a.collideSound && now-lastCollideSoundTime>500){ 
                lastCollideSoundTime=now; 
                playSoundWithDistance(a.collideSound, a.x, a.y, 300);
            } else if(a.collideSoundId) {
                loadSoundFromDB(a.collideSoundId, function(url) {
                    if(url && now-lastCollideSoundTime>500) {
                        lastCollideSoundTime=now;
                        playSoundWithDistance(url, a.x, a.y, 300);
                    }
                });
            }
        } else { a.x+=mx*0.5; a.y+=my*0.5; b.x-=mx*0.5; b.y-=my*0.5; }
        var lim=function(v){ return Math.min(WORLD_LIMIT,Math.max(-WORLD_LIMIT,v)); };
        a.x=lim(a.x); a.y=lim(a.y); b.x=lim(b.x); b.y=lim(b.y);
    }

    function showBubble(entity, text) {
        entity.bubble = { text: text, timer: 120 };
    }

    function handleCollisions() {
        for(var i=0;i<worldEntities.length;i++) resolveCollision(player,worldEntities[i]);
        for(var i=0;i<worldEntities.length;i++) for(var j=i+1;j<worldEntities.length;j++) resolveCollision(worldEntities[i],worldEntities[j]);
    }

    // ============================================================
    //  伤害系统
    // ============================================================
    function showRedEdgePulse() {
        var pulseDiv = document.createElement('div');
        pulseDiv.className = 'screen-red-pulse';
        document.body.appendChild(pulseDiv);
        setTimeout(function() { if(pulseDiv && pulseDiv.parentNode) pulseDiv.parentNode.removeChild(pulseDiv); }, 500);
    }

    function syncHealthUI() {
        if (window.UI && window.UI.updateHealthUI) {
            window.UI.updateHealthUI(playerHealth, maxHealth, isDead);
        }
        if (window.PC && window.PC.updatePCHealth) {
            window.PC.updatePCHealth();
        }
        window.ENGINE._health = playerHealth;
        window.ENGINE._maxHealth = maxHealth;
    }

    function takeDamage(amount, sourceX, sourceY, sourceCategory, targetIsPlayer, entity) {
        if (invincible && targetIsPlayer) return;
        if(playerHealth <= 0) return;
        if(sourceCategory !== 'creature') return;
        var finalDamage = (amount !== undefined && amount !== null) ? amount : 5;
        if(finalDamage <= 0) return;
        var now = Date.now() / 1000;
        var attackSpeed = entity ? (window.DATA ? window.DATA.sanitizeAttackSpeed(entity.attackSpeed) : 0.5) : 0.5;
        if(entity && entity.lastDamageTime && (now - entity.lastDamageTime) < attackSpeed) return;
        if(entity) entity.lastDamageTime = now;
        
        playUnifiedHitSound();
        showRedEdgePulse();
        addBloodParticlesAtPlayer(16);
        
        if(targetIsPlayer) {
            var oldHealth = playerHealth;
            playerHealth = Math.max(0, playerHealth - finalDamage);
            syncHealthUI();
            if (playerHealth <= 0 && oldHealth > 0) {
                isDead = true;
                deathTimer = 0;
                playDeathSound();
                if (window.UI && window.UI.showToast) window.UI.showToast('💀 你已死亡，即将重生...');
                if (entity && window.UI && window.UI.addKillMessage) {
                    window.UI.addKillMessage(entity, player);
                }
            }
        }
        if(gameReady) redrawCanvas();
    }

    // ============================================================
    //  玩家复活
    // ============================================================
    function respawnPlayer() {
        playerHealth = maxHealth;
        isDead = false;
        deathTimer = 0;
        player.x = 0;
        player.y = 0;
        bloodParticles = [];
        ammoSystem.isReloading = false;
        ammoSystem.reloadTimer = 0;
        ammoSystem.currentAmmo = ammoSystem.maxAmmo;
        attackState.isActive = false;
        attackState.cooldown = 0;
        syncHealthUI();
        if (window.UI && window.UI.showToast) {
            window.UI.showToast('✨ 已重生！');
        }
        playWeaponSound();
        redrawCanvas();
    }

    // ============================================================
    //  血粒子
    // ============================================================
    function addBloodParticlesAtPlayer(count) {
        for(var i = 0; i < count; i++) {
            var angle = Math.random() * Math.PI * 2;
            var speed = 60 + Math.random() * 100;
            bloodParticles.push({
                x: player.x + (Math.random() - 0.5) * 45,
                y: player.y + (Math.random() - 0.5) * 30,
                vx: Math.cos(angle) * speed * (0.5 + Math.random()),
                vy: Math.sin(angle) * speed * (0.5 + Math.random()) - 40,
                life: 0.8 + Math.random() * 0.5,
                size: 2 + Math.random() * 6,
                rotation: Math.random() * Math.PI * 2
            });
        }
    }

    function updateBloodParticles(deltaTime) {
        for(var i = 0; i < bloodParticles.length; i++) {
            var p = bloodParticles[i];
            p.x += p.vx * deltaTime;
            p.y += p.vy * deltaTime;
            p.vy += 250 * deltaTime;
            p.life -= deltaTime * 1.5;
            if(p.life <= 0 || p.y > WORLD_LIMIT + 500 || Math.abs(p.x) > WORLD_LIMIT + 500) {
                bloodParticles.splice(i, 1);
                i--;
            }
        }
    }

    // ============================================================
    //  攻击粒子系统
    // ============================================================
    function updateAttackParticles(deltaTime) {
        for (var i = attackParticles.length - 1; i >= 0; i--) {
            var p = attackParticles[i];
            p.x += p.vx * deltaTime;
            p.y += p.vy * deltaTime;
            p.vy += 180 * deltaTime;
            p.life -= deltaTime;
            if (p.life <= 0) attackParticles.splice(i, 1);
        }
    }

    function drawAttackParticles() {
        for (var i = 0; i < attackParticles.length; i++) {
            var p = attackParticles[i];
            var pos = worldToScreen(p.x, p.y);
            if (pos.x + 100 < 0 || pos.x - 100 > canvas.width || pos.y + 100 < 0 || pos.y - 100 > canvas.height) continue;
            
            var alpha = p.life / p.maxLife;
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.translate(pos.x, pos.y);
            ctx.rotate(p.rotation || 0);
            
            if (p.isImage && p.image) {
                var size = p.size * alpha;
                ctx.drawImage(p.image, -size/2, -size/2, size, size);
            } else {
                ctx.shadowBlur = p.glow ? 20 : 5;
                ctx.shadowColor = p.color || '#ffaa44';
                
                if (p.isShockwave) {
                    var size = (1 - alpha) * 30 + 5;
                    ctx.strokeStyle = p.color || '#ffffff';
                    ctx.lineWidth = 2 * alpha;
                    ctx.beginPath();
                    ctx.arc(0, 0, size, 0, Math.PI * 2);
                    ctx.stroke();
                } else {
                    var size = p.size * alpha;
                    ctx.fillStyle = p.color || '#ffaa44';
                    ctx.beginPath();
                    ctx.ellipse(0, 0, size, size * 0.6, 0, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
            
            ctx.restore();
        }
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
    }

    // ============================================================
    //  子弹系统
    // ============================================================
    
    function createBullet(angle, weaponData) {
        var bulletScale = weaponData.bulletScale || 1.0;
        var bulletSpeed = weaponData.bulletSpeed || 600;
        var bulletDamage = weaponData.damage || 25;
        var bulletRadius = weaponData.bulletRadius || 6;
        
        var bulletType = weaponData.BULLET_TYPE || weaponData.bulletType || '-';
        var trailType = weaponData.TRAIL_TYPE || weaponData.trailType || '-';
        
        return {
            x: player.x + Math.cos(angle) * 35,
            y: player.y + Math.sin(angle) * 35,
            vx: Math.cos(angle) * bulletSpeed,
            vy: Math.sin(angle) * bulletSpeed,
            radius: bulletRadius * bulletScale,
            damage: bulletDamage,
            life: 2.0,
            maxLife: 2.0,
            angle: angle,
            weaponKey: player.currentWeapon,
            bulletType: bulletType,
            trailType: trailType,
            scale: bulletScale,
            weaponData: weaponData
        };
    }

    function updateBullets(deltaTime) {
        for (var i = bullets.length - 1; i >= 0; i--) {
            var b = bullets[i];
            b.x += b.vx * deltaTime;
            b.y += b.vy * deltaTime;
            b.life -= deltaTime;
            
            if (b.life <= 0 || Math.abs(b.x) > WORLD_LIMIT || Math.abs(b.y) > WORLD_LIMIT) {
                bullets.splice(i, 1);
                continue;
            }
            
            var hit = false;
            for (var j = worldEntities.length - 1; j >= 0; j--) {
                var ent = worldEntities[j];
                if (ent.isPlayer) continue;
                
                var dx = b.x - ent.x;
                var dy = b.y - ent.y;
                var dist = Math.hypot(dx, dy);
                
                if (dist < ent.radius + b.radius) {
                    playUnifiedHitSound();
                    
                    if (ent.category === 'creature') {
                        ent.health = (ent.health || 100) - b.damage;
                        spawnHitEffect(ent.x, ent.y, b.weaponKey, b.weaponData);
                        if (ent.health <= 0) {
                            if (ent.chaseAudio) {
                                try {
                                    ent.chaseAudio.pause();
                                    ent.chaseAudio.currentTime = 0;
                                    ent.chaseAudio = null;
                                } catch(e) {}
                            }
                            if (window.UI && window.UI.addKillMessage) window.UI.addKillMessage(player, ent);
                            worldEntities.splice(j, 1);
                            if (window.UI && window.UI.showToast) window.UI.showToast('💥 击杀！' + b.damage + '伤害');
                        } else {
                            if (window.UI && window.UI.showToast) window.UI.showToast('💢 -' + b.damage + ' HP');
                        }
                    } else {
                        spawnHitEffect(ent.x, ent.y, b.weaponKey, b.weaponData);
                        worldEntities.splice(j, 1);
                    }
                    hit = true;
                    break;
                }
            }
            
            if (hit) {
                bullets.splice(i, 1);
            }
        }
    }

    // ============================================================
    //  绘制子弹
    // ============================================================
    function drawBullets() {
        for (var i = 0; i < bullets.length; i++) {
            var b = bullets[i];
            var pos = worldToScreen(b.x, b.y);
            
            ctx.save();
            ctx.translate(pos.x, pos.y);
            
            var bulletScale = 1.0;
            if (b.weaponData && b.weaponData.bulletScale !== undefined && b.weaponData.bulletScale !== null) {
                bulletScale = b.weaponData.bulletScale;
            } else if (b.scale !== undefined && b.scale !== null) {
                bulletScale = b.scale;
            }
            
            var alpha = b.life / b.maxLife;
            var bulletType = b.bulletType || '-';
            
            var cachedImg = bulletImageCache[b.weaponKey];
            if (cachedImg && cachedImg.complete && cachedImg.naturalWidth > 0) {
                var baseSize = b.radius * 2;
                var drawSize = baseSize * bulletScale;
                ctx.globalAlpha = alpha;
                ctx.drawImage(cachedImg, -drawSize/2, -drawSize/2, drawSize, drawSize);
                ctx.restore();
                continue;
            }
            
            var radius = b.radius * bulletScale;
            
            if (bulletType === '?' || bulletType === 'none') {
                ctx.restore();
                continue;
            }
            
            if (bulletType === '·' || bulletType === 'dot') {
                var gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
                gradient.addColorStop(0, 'rgba(255, 255, 255, ' + alpha + ')');
                gradient.addColorStop(0.5, 'rgba(200, 200, 255, ' + alpha * 0.8 + ')');
                gradient.addColorStop(1, 'rgba(100, 100, 200, ' + alpha * 0.3 + ')');
                ctx.fillStyle = gradient;
                ctx.shadowBlur = 10;
                ctx.shadowColor = '#4488ff';
                ctx.beginPath();
                ctx.arc(0, 0, radius, 0, Math.PI * 2);
                ctx.fill();
            } else {
                var length = radius * 3;
                var gradient = ctx.createLinearGradient(-length/2, 0, length/2, 0);
                gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
                gradient.addColorStop(0.3, 'rgba(100, 200, 255, ' + alpha * 0.9 + ')');
                gradient.addColorStop(0.7, 'rgba(200, 100, 255, ' + alpha * 0.9 + ')');
                gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
                ctx.fillStyle = gradient;
                ctx.shadowBlur = 15;
                ctx.shadowColor = '#4488ff';
                ctx.beginPath();
                ctx.ellipse(0, 0, length/2, radius * 0.6, 0, 0, Math.PI * 2);
                ctx.fill();
            }
            
            ctx.restore();
        }
    }

    // ============================================================
    //  命中特效
    // ============================================================
    function spawnHitEffect(x, y, weaponKey, weaponData) {
        if (!weaponData) weaponData = {};
        var hitEffect = weaponData.HIT_EFFECT || weaponData.hitEffect || 1;
        
        if (hitEffect === 0 || hitEffect === 'none' || hitEffect === null) {
            return;
        }
        
        var cachedHitImg = hitImageCache[weaponKey];
        if (cachedHitImg && cachedHitImg.complete && cachedHitImg.naturalWidth > 0 && hitEffect === 3) {
            for (var i = 0; i < 8; i++) {
                var angle = Math.random() * Math.PI * 2;
                var speed = 30 + Math.random() * 80;
                attackParticles.push({
                    x: x + (Math.random() - 0.5) * 10,
                    y: y + (Math.random() - 0.5) * 10,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed - 20,
                    life: 0.3 + Math.random() * 0.4,
                    maxLife: 0.7,
                    size: 15 + Math.random() * 25,
                    isImage: true,
                    image: cachedHitImg,
                    rotation: Math.random() * Math.PI * 2,
                    spin: (Math.random() - 0.5) * 6,
                    glow: false
                });
            }
            return;
        }
        
        if (hitEffect === 2) {
            for (var i = 0; i < 20; i++) {
                var angle = Math.random() * Math.PI * 2;
                var speed = 60 + Math.random() * 150;
                attackParticles.push({
                    x: x + (Math.random() - 0.5) * 10,
                    y: y + (Math.random() - 0.5) * 10,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed - 50,
                    life: 0.5 + Math.random() * 0.5,
                    maxLife: 1.0,
                    size: 3 + Math.random() * 8,
                    color: '#cc0000',
                    rotation: Math.random() * Math.PI * 2,
                    spin: (Math.random() - 0.5) * 10,
                    glow: false
                });
            }
            return;
        }
        
        for (var i = 0; i < 25; i++) {
            var angle = Math.random() * Math.PI * 2;
            var speed = 80 + Math.random() * 200;
            var hue = Math.random() * 360;
            attackParticles.push({
                x: x + (Math.random() - 0.5) * 5,
                y: y + (Math.random() - 0.5) * 5,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 40,
                life: 0.4 + Math.random() * 0.6,
                maxLife: 1.0,
                size: 4 + Math.random() * 8,
                color: 'hsl(' + hue + ', 100%, 60%)',
                rotation: Math.random() * Math.PI * 2,
                spin: (Math.random() - 0.5) * 12,
                glow: true
            });
        }
    }

    // ============================================================
    //  枪口火花
    // ============================================================
    function spawnMuzzleFlash(x, y, angle, weaponData) {
        var muzzleScale = weaponData.muzzleScale || 1.0;
        var muzzleEffect = weaponData.MUZZLE_EFFECT || weaponData.muzzleEffect || 1;
        
        if (muzzleEffect === 0 || muzzleEffect === 'none' || muzzleEffect === null) {
            return;
        }
        
        var cachedMuzzleImg = muzzleImageCache[player.currentWeapon];
        if (cachedMuzzleImg && cachedMuzzleImg.complete && cachedMuzzleImg.naturalWidth > 0 && muzzleEffect === 3) {
            attackParticles.push({
                x: x + Math.cos(angle) * 25,
                y: y + Math.sin(angle) * 25,
                vx: 0,
                vy: 0,
                life: 0.15,
                maxLife: 0.15,
                size: 35 * muzzleScale,
                isImage: true,
                image: cachedMuzzleImg,
                rotation: angle + (Math.random() - 0.5) * 0.3,
                spin: 0,
                glow: false
            });
            return;
        }
        
        if (muzzleEffect === 2) {
            for (var i = 0; i < 15; i++) {
                var spread = (Math.random() - 0.5) * 0.6;
                var speed = 80 + Math.random() * 250;
                var hue = Math.random() * 360;
                var size = 3 + Math.random() * 8 * muzzleScale;
                attackParticles.push({
                    x: x + Math.cos(angle) * 15,
                    y: y + Math.sin(angle) * 15,
                    vx: Math.cos(angle + spread) * speed,
                    vy: Math.sin(angle + spread) * speed,
                    life: 0.15 + Math.random() * 0.25,
                    maxLife: 0.4,
                    size: size,
                    color: 'hsl(' + hue + ', 100%, 70%)',
                    glow: true,
                    rotation: Math.random() * Math.PI * 2,
                    spin: (Math.random() - 0.5) * 15
                });
            }
            return;
        }
        
        for (var i = 0; i < 10; i++) {
            var spread = (Math.random() - 0.5) * 0.5;
            var speed = 100 + Math.random() * 200;
            var size = 3 + Math.random() * 6 * muzzleScale;
            attackParticles.push({
                x: x + Math.cos(angle) * 20,
                y: y + Math.sin(angle) * 20,
                vx: Math.cos(angle + spread) * speed,
                vy: Math.sin(angle + spread) * speed,
                life: 0.2 + Math.random() * 0.3,
                maxLife: 0.5,
                size: size,
                color: '#ffaa44',
                glow: true,
                rotation: Math.random() * Math.PI * 2,
                spin: (Math.random() - 0.5) * 10
            });
        }
    }

    // ============================================================
    //  挥砍特效
    // ============================================================
    function spawnSwingEffect(angle, weaponKey, weaponData) {
        if (!weaponData) weaponData = {};
        var swingEffect = weaponData.SWING_EFFECT || weaponData.swingEffect || 1;
        
        if (swingEffect === 0 || swingEffect === 'none' || swingEffect === null) {
            return;
        }
        
        var cachedSwingImg = swingImageCache[weaponKey];
        if (cachedSwingImg && cachedSwingImg.complete && cachedSwingImg.naturalWidth > 0 && swingEffect === 3) {
            var size = 40 + Math.random() * 20;
            var spread = (Math.random() - 0.5) * 0.8;
            attackParticles.push({
                x: player.x + Math.cos(angle + spread) * 30,
                y: player.y + Math.sin(angle + spread) * 30,
                vx: Math.cos(angle + spread) * 20,
                vy: Math.sin(angle + spread) * 20,
                life: 0.2 + Math.random() * 0.2,
                maxLife: 0.4,
                size: size,
                isImage: true,
                image: cachedSwingImg,
                rotation: Math.random() * Math.PI * 2,
                spin: (Math.random() - 0.5) * 4,
                glow: false
            });
            return;
        }
    }

    // ============================================================
    //  获取武器数据
    // ============================================================
    function getWeaponData() {
        var weaponData = player.weaponData ? player.weaponData[player.currentWeapon] : null;
        if (!weaponData) {
            var DATA = window.DATA;
            if (DATA) {
                for (var i = 0; i < DATA.OFFICIAL_RAW.weapon.length; i++) {
                    var w = DATA.OFFICIAL_RAW.weapon[i];
                    if (w.weaponType === player.currentWeapon) {
                        weaponData = w;
                        break;
                    }
                }
            }
        }
        return weaponData;
    }

    // ============================================================
    //  核心攻击系统
    // ============================================================
    
    function doAttack(angle) {
        if (playerHealth <= 0 || isDead) return;
        if (!player.hasUnlockedWeapon) return;
        
        var weaponData = getWeaponData();
        var isRanged = isRangedWeapon(weaponData);
        
        if (isRanged) {
            if (attackState.cooldown > 0) return;
            
            if (!ammoSystem.isInfinite && ammoSystem.currentAmmo <= 0) {
                startReload();
                return;
            }
            
            if (!ammoSystem.isInfinite) {
                ammoSystem.currentAmmo--;
                if (ammoSystem.currentAmmo <= 0) {
                    startReload();
                }
            }
            
            var bullet = createBullet(angle, weaponData);
            bullets.push(bullet);
            spawnMuzzleFlash(player.x, player.y, angle, weaponData);
            player.recoilOffset = Math.min(1, player.recoilOffset + 0.15);
            
            var fireRate = weaponData.fireRate || 0.15;
            attackState.cooldown = fireRate;
            
        } else {
            var swingRange = 90;
            var swingAngleRange = Math.PI;
            if (player.swingProgress < 0.05 || player.swingProgress > 0.85) return;
            
            var damage = 12;
            if (weaponData && weaponData.damage) {
                damage = weaponData.damage;
            }
            
            spawnSwingEffect(angle, player.currentWeapon, weaponData);
            
            var hitAny = false;
            
            for (var i = worldEntities.length - 1; i >= 0; i--) {
                var ent = worldEntities[i];
                if (ent.isPlayer) continue;
                
                var dx = ent.x - player.x;
                var dy = ent.y - player.y;
                var dist = Math.hypot(dx, dy);
                var angleToEnt = Math.atan2(dy, dx);
                
                var angleDiff = angleToEnt - angle;
                while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
                while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
                
                if (dist < swingRange && Math.abs(angleDiff) < swingAngleRange / 2) {
                    if (!ent._hitBySwing) {
                        ent._hitBySwing = true;
                        hitAny = true;
                        
                        playUnifiedHitSound();
                        
                        if (ent.category === 'creature') {
                            ent.health = (ent.health || 100) - damage;
                            spawnHitEffect(ent.x, ent.y, player.currentWeapon, weaponData);
                            if (ent.health <= 0) {
                                if (ent.chaseAudio) {
                                    try {
                                        ent.chaseAudio.pause();
                                        ent.chaseAudio.currentTime = 0;
                                        ent.chaseAudio = null;
                                    } catch(e) {}
                                }
                                if (window.UI && window.UI.addKillMessage) window.UI.addKillMessage(player, ent);
                                worldEntities.splice(i, 1);
                                if (window.UI && window.UI.showToast) window.UI.showToast('💥 击杀！' + damage + '伤害');
                            } else {
                                if (window.UI && window.UI.showToast) window.UI.showToast('💢 -' + damage + ' HP');
                            }
                        } else {
                            spawnHitEffect(ent.x, ent.y, player.currentWeapon, weaponData);
                            worldEntities.splice(i, 1);
                        }
                    }
                }
            }
            
            if (!hitAny) {
                for (var i = 0; i < worldEntities.length; i++) {
                    worldEntities[i]._hitBySwing = false;
                }
            }
        }
    }

    // ============================================================
    //  攻击控制接口
    // ============================================================
    
    function startAttack(angle) {
        if (!player.hasUnlockedWeapon) return;
        if (isDead || playerHealth <= 0) return;
        
        attackState.isActive = true;
        attackState.hasAngle = true;
        
        if (angle !== 0) {
            attackState.lastAngle = angle;
            player.angle = angle;
        } else if (attackState.lastAngle !== 0) {
            player.angle = attackState.lastAngle;
        }
        
        var weaponData = getWeaponData();
        var isRanged = isRangedWeapon(weaponData);
        attackState.isRanged = isRanged;
        
        if (isRanged) {
            doAttack(player.angle);
            player.isSwinging = false;
            player.swingProgress = 0;
        } else {
            player.isSwinging = true;
            player.swingProgress = 0;
        }
    }

    function updateAttack(angle) {
        if (attackState.cooldown > 0) {
            attackState.cooldown -= 0.016;
            if (attackState.cooldown < 0) attackState.cooldown = 0;
        }
        
        if (ammoSystem.isReloading) {
            ammoSystem.reloadTimer -= 0.016;
            if (ammoSystem.reloadTimer <= 0) {
                finishReload();
            }
            return;
        }
        
        if (angle !== 0) {
            attackState.lastAngle = angle;
            attackState.hasAngle = true;
            player.angle = angle;
        } else if (attackState.hasAngle && attackState.lastAngle !== 0) {
            player.angle = attackState.lastAngle;
        }
        
        if (!attackState.isActive) return;
        
        doAttack(player.angle);
    }

    function stopAttack() {
        attackState.isActive = false;
        attackState.hasAngle = false;
        
        player.isSwinging = false;
        player.swingProgress = 0;
        for (var i = 0; i < worldEntities.length; i++) {
            worldEntities[i]._hitBySwing = false;
        }
    }

    function resetAttack() {
        attackState.isActive = false;
        attackState.cooldown = 0;
        attackState.hasAngle = false;
        attackState.lastAngle = 0;
        player.isSwinging = false;
        player.swingProgress = 0;
        for (var i = 0; i < worldEntities.length; i++) {
            worldEntities[i]._hitBySwing = false;
        }
    }

    // ============================================================
    //  换弹系统
    // ============================================================
    function startReload() {
        if (ammoSystem.isReloading) return;
        if (ammoSystem.isInfinite) {
            if (window.UI && window.UI.showToast) window.UI.showToast('♾️ 无限弹药无需换弹');
            return;
        }
        if (ammoSystem.currentAmmo >= ammoSystem.maxAmmo) {
            if (window.UI && window.UI.showToast) window.UI.showToast('📦 弹药已满');
            return;
        }
        
        ammoSystem.isReloading = true;
        ammoSystem.reloadTimer = ammoSystem.reloadDuration;
        playReloadSound();
        if (window.UI && window.UI.showToast) window.UI.showToast('🔄 换弹中...');
    }

    function finishReload() {
        ammoSystem.isReloading = false;
        ammoSystem.reloadTimer = 0;
        ammoSystem.currentAmmo = ammoSystem.maxAmmo;
        if (window.UI && window.UI.showToast) window.UI.showToast('✅ 换弹完成！');
        playWeaponSound();
    }

    function reloadWeapon() {
        var weaponData = getWeaponData();
        var isRanged = isRangedWeapon(weaponData);
        
        if (!player.hasUnlockedWeapon || !player.currentWeapon) {
            if (window.UI && window.UI.showToast) window.UI.showToast('⚠️ 请先解锁武器！');
            return;
        }
        
        if (!isRanged) {
            if (window.UI && window.UI.showToast) window.UI.showToast('⚠️ 近战武器无需换弹');
            return;
        }
        startReload();
    }

    function hasWeapon() {
        return player.hasUnlockedWeapon;
    }

    // ============================================================
    //  武器识别系统
    // ============================================================
    var VALID_WEAPON_TYPES = ['melee', 'ranged'];
    
    function isValidWeaponTemplate(item) {
        if (!item) return false;
        if (item.TYPE) {
            return VALID_WEAPON_TYPES.indexOf(item.TYPE.toLowerCase()) !== -1;
        }
        if (item.weaponType) {
            return VALID_WEAPON_TYPES.indexOf(item.weaponType.toLowerCase()) !== -1;
        }
        if (item.type) {
            return VALID_WEAPON_TYPES.indexOf(item.type.toLowerCase()) !== -1;
        }
        if (item.weaponData && item.weaponData.TYPE) {
            return VALID_WEAPON_TYPES.indexOf(item.weaponData.TYPE.toLowerCase()) !== -1;
        }
        if (item.weaponData && item.weaponData.type) {
            return VALID_WEAPON_TYPES.indexOf(item.weaponData.type.toLowerCase()) !== -1;
        }
        if (item.category === 'weapon') return true;
        if (item.damage !== undefined || item.attackSpeed !== undefined) return true;
        return false;
    }
    
    function isMeleeWeapon(item) {
        if (!item) return false;
        if (item.TYPE) return item.TYPE.toLowerCase() === 'melee';
        if (item.weaponType) return item.weaponType.toLowerCase() === 'melee';
        if (item.type) return item.type.toLowerCase() === 'melee';
        if (item.weaponData && item.weaponData.TYPE) return item.weaponData.TYPE.toLowerCase() === 'melee';
        if (item.weaponData && item.weaponData.type) return item.weaponData.type.toLowerCase() === 'melee';
        return true;
    }
    
    function isRangedWeapon(item) {
        if (!item) return false;
        if (item.TYPE) return item.TYPE.toLowerCase() === 'ranged';
        if (item.weaponType) return item.weaponType.toLowerCase() === 'ranged';
        if (item.type) return item.type.toLowerCase() === 'ranged';
        if (item.weaponData && item.weaponData.TYPE) return item.weaponData.TYPE.toLowerCase() === 'ranged';
        if (item.weaponData && item.weaponData.type) return item.weaponData.type.toLowerCase() === 'ranged';
        return false;
    }

    // ============================================================
    //  音效加载辅助函数
    // ============================================================
    function loadSoundFromDB_old(soundId, callback) {
        if (!soundId) {
            if (callback) callback(null);
            return;
        }
        if (soundId.startsWith('http') || soundId.startsWith('blob:')) {
            if (callback) callback(soundId);
            return;
        }
        loadFileFromDB(soundId).then(function(result) {
            if (result && result.url) {
                addBlobUrl(result.url);
                if (callback) callback(result.url);
            } else {
                if (callback) callback(null);
            }
        }).catch(function(e) {
            console.warn('[ENGINE] 音效加载异常:', soundId, e);
            if (callback) callback(null);
        });
    }

    // ============================================================
    //  解析 Lua 数据
    // ============================================================
    function parseLuaData(luaString) {
        var result = {};
        if (!luaString) return result;
        var lines = luaString.split('\n');
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            if (!line || line.startsWith('--')) continue;
            line = line.replace(/,\s*$/, '');
            var match = line.match(/^([A-Z_]+)\s*=\s*(.+)$/);
            if (match) {
                var key = match[1];
                var value = match[2].trim();
                if (value === 'null' || value === 'nil') {
                    result[key] = null;
                }
                else if (!isNaN(parseFloat(value)) && isFinite(value)) {
                    result[key] = parseFloat(value);
                }
                else if (value === 'true') {
                    result[key] = true;
                }
                else if (value === 'false') {
                    result[key] = false;
                }
                else if (value.startsWith('"') && value.endsWith('"')) {
                    result[key] = value.substring(1, value.length - 1);
                }
                else if (value.startsWith("'") && value.endsWith("'")) {
                    result[key] = value.substring(1, value.length - 1);
                }
                else {
                    result[key] = value;
                }
            }
        }
        return result;
    }

    // ============================================================
    //  加载模组
    // ============================================================
    async function loadModsFromLocal() {
        try {
            var saved = localStorage.getItem('DSMOD_mods');
            if (saved) {
                var parsed = JSON.parse(saved);
                if (parsed) {
                    var DATA = window.DATA;
                    if (DATA) {
                        for (var c = 0; c < DATA.CATEGORY_ORDER.length; c++) {
                            var cat = DATA.CATEGORY_ORDER[c];
                            if (!parsed[cat]) parsed[cat] = [];
                        }
                        DATA.modsInternal = parsed;
                        for (var c = 0; c < DATA.CATEGORY_ORDER.length; c++) {
                            var cat = DATA.CATEGORY_ORDER[c];
                            if (DATA.modsInternal[cat]) {
                                for (var i = 0; i < DATA.modsInternal[cat].length; i++) {
                                    var item = DATA.modsInternal[cat][i];
                                    if (item.filename && item.filename.endsWith('.lua')) {
                                        if (typeof item.luaData === 'string') {
                                            try {
                                                item.luaData = parseLuaData(item.luaData);
                                            } catch(e) {
                                                console.warn('[ENGINE] Lua解析失败:', item.filename, e);
                                            }
                                        }
                                        if (isValidWeaponTemplate(item.luaData || item)) {
                                            item.isLuaWeapon = true;
                                            item.category = 'weapon';
                                            var lua = item.luaData || {};
                                            for (var key in lua) {
                                                if (lua.hasOwnProperty(key)) {
                                                    item[key] = lua[key];
                                                }
                                            }
                                            if (item.TYPE) {
                                                item.weaponType = item.TYPE.toLowerCase();
                                            }
                                        } else {
                                            item.isLuaWeapon = false;
                                            item.invalidTemplate = true;
                                            console.warn('[ENGINE] 无效武器模板:', item.filename);
                                        }
                                    }
                                    if (item.image) {
                                        var result = await loadFileFromDB(item.image);
                                        if (result) {
                                            item.imageUrl = result.url;
                                            addBlobUrl(result.url);
                                        }
                                    }
                                    if (item.imageId) {
                                        var result = await loadFileFromDB(item.imageId);
                                        if (result) {
                                            item.imageUrl = result.url;
                                            addBlobUrl(result.url);
                                        }
                                    }
                                    if (item.WEAPON_IMAGE) {
                                        var result = await loadFileFromDB(item.WEAPON_IMAGE);
                                        if (result) {
                                            item.weaponImageUrl = result.url;
                                            addBlobUrl(result.url);
                                        }
                                    }
                                    if (item.spawnSoundId) {
                                        var result = await loadFileFromDB(item.spawnSoundId);
                                        if (result) {
                                            item.spawnSound = result.url;
                                            addBlobUrl(result.url);
                                        }
                                    }
                                    if (item.chaseSoundId) {
                                        var result = await loadFileFromDB(item.chaseSoundId);
                                        if (result) {
                                            item.chaseSound = result.url;
                                            addBlobUrl(result.url);
                                        }
                                    }
                                    if (item.collideSoundId) {
                                        var result = await loadFileFromDB(item.collideSoundId);
                                        if (result) {
                                            item.collideSound = result.url;
                                            addBlobUrl(result.url);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        } catch(e) {
            console.error('[ENGINE] 加载模组失败:', e);
        }
        if (window.DATA && !window.DATA.modsInternal) {
            window.DATA.modsInternal = {
                prop: [],
                creature: [],
                vehicle: [],
                test: [],
                weapon: [],
                other: []
            };
        }
    }

    // ============================================================
    //  解锁武器
    // ============================================================
    function unlockWeapon(weaponKey, weaponName, item) {
        var isValid = false;
        if (item) {
            if (item.TYPE) isValid = true;
            else if (item.weaponType) isValid = true;
            else if (item.type) isValid = true;
            else if (item.category === 'weapon') isValid = true;
            else if (item.weaponData && item.weaponData.TYPE) isValid = true;
            else if (item.weaponData && item.weaponData.type) isValid = true;
            else if (item.name && item.emoji && item.weaponType !== undefined) isValid = true;
            else if (item.name && item.damage !== undefined && item.weaponType !== undefined) isValid = true;
            else if (item.name && item.radius && item.weaponType !== undefined) isValid = true;
        }
        
        if (!isValid) {
            if (window.UI && window.UI.showToast) {
                window.UI.showToast('⚠️ 无法识别武器: ' + weaponName);
            }
            console.warn('[ENGINE] 无法识别的武器:', item);
            return;
        }
        
        var weaponType = 'melee';
        if (item && item.TYPE) {
            weaponType = item.TYPE.toLowerCase();
        } else if (item && item.weaponType) {
            weaponType = item.weaponType;
        } else if (item && item.type) {
            weaponType = item.type;
        } else if (item && item.weaponData && item.weaponData.TYPE) {
            weaponType = item.weaponData.TYPE.toLowerCase();
        } else if (item && item.category === 'weapon') {
            weaponType = 'melee';
        }
        
        if (typeof weaponType !== 'string') {
            weaponType = 'melee';
        }
        weaponType = weaponType.toLowerCase();
        var typeName = weaponType === 'melee' ? '近战' : '远程';
        
        if (!player.unlockedWeapons.includes(weaponKey)) {
            player.unlockedWeapons.push(weaponKey);
            player.hasUnlockedWeapon = true;
            player.currentWeapon = weaponKey;
            if (window.UI && window.UI.showToast) {
                window.UI.showToast('🔓 已解锁 ' + typeName + '武器: ' + weaponName);
            }
        } else {
            player.currentWeapon = weaponKey;
            if (window.UI && window.UI.showToast) {
                window.UI.showToast('🔁 已装备 ' + typeName + '武器: ' + weaponName);
            }
        }
        
        if (item) {
            item.weaponType = weaponType;
            player.weaponData[weaponKey] = item;
            
            var scaleValue = item.WEAPON_SCALE || item.weaponScale || item.scale || 1.0;
            if (item.scale !== undefined && item.scale > 0) {
                scaleValue = item.scale;
            }
            if (item.weaponData && item.weaponData.WEAPON_SCALE !== undefined) {
                scaleValue = item.weaponData.WEAPON_SCALE;
            }
            if (item.weaponData && item.weaponData.weaponScale !== undefined) {
                scaleValue = item.weaponData.weaponScale;
            }
            if (item.weaponData && item.weaponData.scale !== undefined) {
                scaleValue = item.weaponData.scale;
            }
            
            item.weaponScale = parseFloat(scaleValue);
            if (isNaN(item.weaponScale) || item.weaponScale < 0.01) item.weaponScale = 0.01;
            if (item.weaponScale > 10.0) item.weaponScale = 10.0;
            if (item.weaponData) item.weaponData.weaponScale = item.weaponScale;
            
            if (item.bulletScale !== undefined && item.bulletScale !== null) {
                if (item.weaponData) item.weaponData.bulletScale = item.bulletScale;
            } else if (item.weaponData && item.weaponData.bulletScale !== undefined) {
                item.bulletScale = item.weaponData.bulletScale;
            }
            
            if (item.trailScale !== undefined && item.trailScale !== null) {
                if (item.weaponData) item.weaponData.trailScale = item.trailScale;
            } else if (item.weaponData && item.weaponData.trailScale !== undefined) {
                item.trailScale = item.weaponData.trailScale;
            }
            
            if (item.muzzleScale !== undefined && item.muzzleScale !== null) {
                if (item.weaponData) item.weaponData.muzzleScale = item.muzzleScale;
            } else if (item.weaponData && item.weaponData.muzzleScale !== undefined) {
                item.muzzleScale = item.weaponData.muzzleScale;
            }
            
            if (isRangedWeapon(item)) {
                var maxAmmoVal = item.MAX_AMMO || item.maxAmmo || 30;
                if (item.weaponData && item.weaponData.MAX_AMMO !== undefined) {
                    maxAmmoVal = item.weaponData.MAX_AMMO;
                }
                ammoSystem.maxAmmo = Math.max(1, parseInt(maxAmmoVal) || 30);
                ammoSystem.currentAmmo = ammoSystem.maxAmmo;
                
                var infiniteAmmoVal = item.INFINITE_AMMO !== undefined ? item.INFINITE_AMMO : 
                                      (item.infiniteAmmo !== undefined ? item.infiniteAmmo : true);
                if (item.weaponData && item.weaponData.INFINITE_AMMO !== undefined) {
                    infiniteAmmoVal = item.weaponData.INFINITE_AMMO;
                }
                ammoSystem.isInfinite = !!infiniteAmmoVal;
                
                var reloadTimeVal = item.RELOAD_TIME || item.reloadTime || 1.5;
                if (item.weaponData && item.weaponData.RELOAD_TIME !== undefined) {
                    reloadTimeVal = item.weaponData.RELOAD_TIME;
                }
                ammoSystem.reloadDuration = Math.max(0.3, parseFloat(reloadTimeVal) || 1.5);
                
                var fireRateVal = item.FIRE_RATE || item.fireRate || 0.15;
                if (item.weaponData && item.weaponData.FIRE_RATE !== undefined) {
                    fireRateVal = item.weaponData.FIRE_RATE;
                }
                attackState.fireRate = parseFloat(fireRateVal);
                if (isNaN(attackState.fireRate) || attackState.fireRate < 0.01) attackState.fireRate = 0.15;
                
                var bulletScaleVal = item.BULLET_SCALE || item.bulletScale || 1.0;
                if (item.weaponData && item.weaponData.BULLET_SCALE !== undefined) {
                    bulletScaleVal = item.weaponData.BULLET_SCALE;
                }
                item.bulletScale = parseFloat(bulletScaleVal);
                if (isNaN(item.bulletScale) || item.bulletScale < 0.01) item.bulletScale = 0.01;
                if (item.bulletScale > 10.0) item.bulletScale = 10.0;
                if (item.weaponData) item.weaponData.bulletScale = item.bulletScale;
                
                var bulletSpeedVal = item.BULLET_SPEED || item.bulletSpeed || 600;
                if (item.weaponData && item.weaponData.BULLET_SPEED !== undefined) {
                    bulletSpeedVal = item.weaponData.BULLET_SPEED;
                }
                item.bulletSpeed = parseFloat(bulletSpeedVal);
                if (isNaN(item.bulletSpeed) || item.bulletSpeed < 10) item.bulletSpeed = 600;
                if (item.weaponData) item.weaponData.bulletSpeed = item.bulletSpeed;
                
                var bulletRadiusVal = item.BULLET_RADIUS || item.bulletRadius || 6;
                if (item.weaponData && item.weaponData.BULLET_RADIUS !== undefined) {
                    bulletRadiusVal = item.weaponData.BULLET_RADIUS;
                }
                item.bulletRadius = parseFloat(bulletRadiusVal);
                if (isNaN(item.bulletRadius) || item.bulletRadius < 0.1) item.bulletRadius = 6;
                if (item.weaponData) item.weaponData.bulletRadius = item.bulletRadius;
                
                var muzzleScaleVal = item.MUZZLE_SCALE || item.muzzleScale || 1.0;
                if (item.weaponData && item.weaponData.MUZZLE_SCALE !== undefined) {
                    muzzleScaleVal = item.weaponData.MUZZLE_SCALE;
                }
                item.muzzleScale = parseFloat(muzzleScaleVal);
                if (isNaN(item.muzzleScale) || item.muzzleScale < 0.01) item.muzzleScale = 0.01;
                if (item.muzzleScale > 10.0) item.muzzleScale = 10.0;
                if (item.weaponData) item.weaponData.muzzleScale = item.muzzleScale;
            }
            
            // 加载图片
            function loadImageToCache(id, cacheObj, key, callback) {
                if (!id) { if (callback) callback(); return; }
                loadFileFromDB(id).then(function(result) {
                    if (result && result.url) {
                        var img = new Image();
                        img.onload = function() {
                            cacheObj[key] = img;
                            if (callback) callback();
                        };
                        img.onerror = function() {
                            if (callback) callback();
                        };
                        img.src = result.url;
                    } else {
                        if (callback) callback();
                    }
                }).catch(function() { if (callback) callback(); });
            }
            
            var weaponImgId = item.weaponData && (item.weaponData.weaponImage || item.weaponData.iconImage);
            if (weaponImgId) {
                loadImageToCache(weaponImgId, weaponImageCache, weaponKey);
            }
            
            var bulletImgId = item.weaponData && item.weaponData.bulletImageId;
            if (bulletImgId) {
                loadImageToCache(bulletImgId, bulletImageCache, weaponKey);
            } else {
                var bulletImgUrl = item.BULLET_IMAGE || (item.weaponData && item.weaponData.BULLET_IMAGE);
                if (bulletImgUrl && (bulletImgUrl.startsWith('http') || bulletImgUrl.startsWith('blob:'))) {
                    var img = new Image();
                    img.crossOrigin = "Anonymous";
                    img.onload = function() { bulletImageCache[weaponKey] = img; };
                    img.src = bulletImgUrl;
                } else if (bulletImgUrl) {
                    loadFileFromDB(bulletImgUrl).then(function(result) {
                        if (result && result.url) {
                            var img = new Image();
                            img.onload = function() { bulletImageCache[weaponKey] = img; };
                            img.src = result.url;
                        }
                    });
                }
            }
            
            var trailImgId = item.weaponData && item.weaponData.trailImageId;
            if (trailImgId) {
                loadImageToCache(trailImgId, trailImageCache, weaponKey);
            } else {
                var trailImgUrl = item.TRAIL_IMAGE || (item.weaponData && item.weaponData.TRAIL_IMAGE);
                if (trailImgUrl && (trailImgUrl.startsWith('http') || trailImgUrl.startsWith('blob:'))) {
                    var img = new Image();
                    img.crossOrigin = "Anonymous";
                    img.onload = function() { trailImageCache[weaponKey] = img; };
                    img.src = trailImgUrl;
                } else if (trailImgUrl) {
                    loadFileFromDB(trailImgUrl).then(function(result) {
                        if (result && result.url) {
                            var img = new Image();
                            img.onload = function() { trailImageCache[weaponKey] = img; };
                            img.src = result.url;
                        }
                    });
                }
            }
            
            var muzzleImgId = item.weaponData && item.weaponData.muzzleImageId;
            if (muzzleImgId) {
                loadImageToCache(muzzleImgId, muzzleImageCache, weaponKey);
            } else {
                var muzzleImgUrl = item.MUZZLE_IMAGE || (item.weaponData && item.weaponData.MUZZLE_IMAGE);
                if (muzzleImgUrl && (muzzleImgUrl.startsWith('http') || muzzleImgUrl.startsWith('blob:'))) {
                    var img = new Image();
                    img.crossOrigin = "Anonymous";
                    img.onload = function() { muzzleImageCache[weaponKey] = img; };
                    img.src = muzzleImgUrl;
                } else if (muzzleImgUrl) {
                    loadFileFromDB(muzzleImgUrl).then(function(result) {
                        if (result && result.url) {
                            var img = new Image();
                            img.onload = function() { muzzleImageCache[weaponKey] = img; };
                            img.src = result.url;
                        }
                    });
                }
            }
            
            var hitImgId = item.weaponData && item.weaponData.hitImageId;
            if (hitImgId) {
                loadImageToCache(hitImgId, hitImageCache, weaponKey);
            } else {
                var hitImgUrl = item.HIT_IMAGE || (item.weaponData && item.weaponData.HIT_IMAGE);
                if (hitImgUrl && (hitImgUrl.startsWith('http') || hitImgUrl.startsWith('blob:'))) {
                    var img = new Image();
                    img.crossOrigin = "Anonymous";
                    img.onload = function() { hitImageCache[weaponKey] = img; };
                    img.src = hitImgUrl;
                } else if (hitImgUrl) {
                    loadFileFromDB(hitImgUrl).then(function(result) {
                        if (result && result.url) {
                            var img = new Image();
                            img.onload = function() { hitImageCache[weaponKey] = img; };
                            img.src = result.url;
                        }
                    });
                }
            }
            
            var swingImgId = item.weaponData && item.weaponData.swingImageId;
            if (swingImgId) {
                loadImageToCache(swingImgId, swingImageCache, weaponKey);
            } else {
                var swingImgUrl = item.SWING_IMAGE || (item.weaponData && item.weaponData.SWING_IMAGE);
                if (swingImgUrl && (swingImgUrl.startsWith('http') || swingImgUrl.startsWith('blob:'))) {
                    var img = new Image();
                    img.crossOrigin = "Anonymous";
                    img.onload = function() { swingImageCache[weaponKey] = img; };
                    img.src = swingImgUrl;
                } else if (swingImgUrl) {
                    loadFileFromDB(swingImgUrl).then(function(result) {
                        if (result && result.url) {
                            var img = new Image();
                            img.onload = function() { swingImageCache[weaponKey] = img; };
                            img.src = result.url;
                        }
                    });
                }
            }
        }
        
        playMenuSound();
    }

    // ============================================================
    //  切换武器
    // ============================================================
    function switchWeapon() {
        if (!player.hasUnlockedWeapon || player.unlockedWeapons.length === 0) {
            if (window.UI && window.UI.showToast) window.UI.showToast('⚠️ 请先从菜单武器分区拿一把武器！');
            return;
        }
        weaponIndex = (weaponIndex + 1) % player.unlockedWeapons.length;
        player.currentWeapon = player.unlockedWeapons[weaponIndex];
        
        ammoSystem.isReloading = false;
        ammoSystem.reloadTimer = 0;
        attackState.cooldown = 0;
        attackState.isActive = false;
        
        var weaponData = getWeaponData();
        if (weaponData && isRangedWeapon(weaponData)) {
            var maxAmmoVal = weaponData.MAX_AMMO || weaponData.maxAmmo || 30;
            ammoSystem.maxAmmo = Math.max(1, parseInt(maxAmmoVal) || 30);
            ammoSystem.currentAmmo = ammoSystem.maxAmmo;
            var infiniteAmmoVal = weaponData.INFINITE_AMMO !== undefined ? weaponData.INFINITE_AMMO : 
                                  (weaponData.infiniteAmmo !== undefined ? weaponData.infiniteAmmo : true);
            ammoSystem.isInfinite = !!infiniteAmmoVal;
            var reloadTimeVal = weaponData.RELOAD_TIME || weaponData.reloadTime || 1.5;
            ammoSystem.reloadDuration = Math.max(0.3, parseFloat(reloadTimeVal) || 1.5);
        }
        
        var switchBtn = document.getElementById('switchBtn');
        if (switchBtn) {
            switchBtn.style.borderColor = '#ffaa55';
            switchBtn.style.color = '#ffaa55';
            setTimeout(function() {
                switchBtn.style.borderColor = '#888';
                switchBtn.style.color = '#ccc';
            }, 200);
        }
        playMenuSound();
    }

    // ============================================================
    //  TOOLS 工具
    // ============================================================
    function executeTool(toolId) {
        switch(toolId) {
            case 'clearAllEntities':
                clearAllEntities();
                break;
            case 'toggleInvincible':
                invincible = !invincible;
                if (window.UI && window.UI.showToast) window.UI.showToast(invincible ? '🛡️ 无敌模式 已开启' : '🛡️ 无敌模式 已关闭');
                break;
            case 'toggleAIIgnore':
                aiIgnore = !aiIgnore;
                if (window.UI && window.UI.showToast) window.UI.showToast(aiIgnore ? '👻 AI无视模式 已开启' : '👻 AI无视模式 已关闭');
                break;
            case 'toggleSound':
                if (window.PC && window.PC.toggleSound) {
                    window.PC.toggleSound();
                }
                break;
            case 'toggleInfiniteAmmo':
                ammoSystem.isInfinite = !ammoSystem.isInfinite;
                if (window.UI && window.UI.showToast) window.UI.showToast(ammoSystem.isInfinite ? '♾️ 无限弹药 已开启' : '♾️ 无限弹药 已关闭');
                break;
            default:
                console.warn('[ENGINE] 未知工具:', toolId);
        }
    }

    // ============================================================
    //  渲染系统
    // ============================================================
    function updateCamera() {
        camera.x = player.x;
        camera.y = player.y;
    }

    function drawGrass() {
        var w = canvas.width, h = canvas.height;
        if(grassTextureLoaded && grassTexture && grassTexture.complete && grassTexture.naturalWidth > 0) {
            var patternScale = 1.2;
            var imgW = grassTexture.width, imgH = grassTexture.height;
            var scaledW = imgW * patternScale, scaledH = imgH * patternScale;
            var offX = (camera.x / CAMERA_ZOOM) % scaledW;
            var offY = (camera.y / CAMERA_ZOOM) % scaledH;
            var cols = Math.ceil(w / scaledW) + 2, rows = Math.ceil(h / scaledH) + 2;
            var startX = -offX - scaledW, startY = -offY - scaledH;
            for(var i = 0; i < cols; i++) for(var j = 0; j < rows; j++) ctx.drawImage(grassTexture, startX + i * scaledW, startY + j * scaledH, scaledW, scaledH);
            ctx.globalCompositeOperation = 'overlay';
            ctx.fillStyle = '#fffbe6';
            ctx.globalAlpha = 0.1;
            ctx.fillRect(0, 0, w, h);
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = 'source-over';
        } else {
            ctx.fillStyle = '#4a8a3a'; ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = '#5a9a4a';
            for(var i=0;i<300;i++){ ctx.beginPath(); ctx.arc((camera.x*0.3+i*131)%w,(camera.y*0.2+i*87)%h,2,0,Math.PI*2); ctx.fill(); }
            ctx.fillStyle = '#6aaa5a';
            for(var i=0;i<200;i++){ ctx.beginPath(); ctx.arc((camera.x*0.5+i*251)%w,(camera.y*0.3+i*173)%h,1.5,0,Math.PI*2); ctx.fill(); }
        }
    }

    function drawBloodParticles() {
        if(!ctx) return;
        for(var i = 0; i < bloodParticles.length; i++) {
            var p = bloodParticles[i];
            var screenPos = worldToScreen(p.x, p.y);
            if(screenPos.x + 50 < 0 || screenPos.x - 50 > canvas.width || screenPos.y + 50 < 0 || screenPos.y - 50 > canvas.height) continue;
            ctx.save();
            ctx.translate(screenPos.x, screenPos.y);
            ctx.rotate(p.rotation);
            ctx.beginPath();
            var size = p.size * (0.4 + p.life * 0.6);
            ctx.ellipse(0, 0, size, size * 0.7, 0, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(200, 40, 40, ' + (p.life * 0.9) + ')';
            ctx.fill();
            ctx.restore();
        }
    }

    function drawBubble(ent, pos, sz) {
        if(!ent.bubble) return;
        var fontSize = sz*0.35;
        ctx.font = fontSize + 'px monospace';
        ctx.fillStyle = '#fff';
        ctx.shadowBlur = 4;
        ctx.shadowColor = 'black';
        var text = ent.bubble.text;
        var metrics = ctx.measureText(text);
        var textWidth = metrics.width;
        var bubbleW = textWidth + 20;
        var bubbleH = fontSize + 10;
        ctx.fillStyle = '#000000aa';
        ctx.fillRect(pos.x - bubbleW/2, pos.y - sz/2 - bubbleH - 5, bubbleW, bubbleH);
        ctx.fillStyle = '#fff';
        ctx.fillText(text, pos.x - textWidth/2, pos.y - sz/2 - 8);
        ctx.shadowBlur = 0;
    }

    function drawEntities() {
        for(var i = 0; i < worldEntities.length; i++) {
            var ent = worldEntities[i];
            var pos = worldToScreen(ent.x, ent.y);
            if(pos.x+80<0||pos.x-80>canvas.width||pos.y+90<0||pos.y-90>canvas.height) continue;
            var baseSize = 44 * (1 / CAMERA_ZOOM);
            var sz = baseSize * (ent.scale || 1.0);
            ctx.save(); ctx.translate(pos.x, pos.y);
            ctx.shadowBlur=0; ctx.filter='none'; ctx.globalCompositeOperation='source-over';
            var effectId = ent.effectId || 5;
            var isFillEffect = (effectId === 4 || effectId === 11);
            applyEffect(ctx, effectId, ent.effectSpeed || 1, animTime + (ent.animOffset || 0));
            if(ent.error){
                var alpha=0.5+Math.sin(animTime*3)*0.3;
                ctx.font='bold ' + (sz*0.45) + 'px monospace';
                ctx.fillStyle='rgba(255,70,70,' + alpha + ')';
                ctx.fillText("ERROR", -sz*0.28, sz*0.12);
            } else if(ent.imageUrl){
                var img=new Image(); img.src=ent.imageUrl;
                if(img.complete&&img.naturalWidth>0) {
                    ctx.drawImage(img,-sz/2,-sz/2,sz,sz);
                } else if(isFillEffect) {
                } else {
                    ctx.fillStyle='#aaa';
                    ctx.fillRect(-sz/2,-sz/2,sz,sz);
                }
            } else if(ent.emoji){
                ctx.font=sz + 'px "Segoe UI Emoji"';
                ctx.fillStyle='#1f1b12';
                ctx.fillText(ent.emoji, -sz/2.5, sz/3);
            }
            ctx.restore();
            drawBubble(ent, pos, sz);
        }
    }

    // ============================================================
    //  drawPlayer - 正确染色（白色=原始，保留细节）
    // ============================================================
    function drawPlayer() {
        if(!canvas || canvas.width === 0 || canvas.height === 0) return;
        var sz = 50 * (1 / CAMERA_ZOOM);
        var cx = canvas.width / 2;
        var cy = canvas.height / 2;
        ctx.save();
        ctx.translate(cx, cy);
        
        var weaponData = getWeaponData();
        var isRanged = isRangedWeapon(weaponData);
        
        if (!attackState.isActive && !player.isSwinging && player.angle !== 0) {
            var targetAngle = 0;
            var diff = targetAngle - player.angle;
            while (diff > Math.PI) diff -= 2 * Math.PI;
            while (diff < -Math.PI) diff += 2 * Math.PI;
            
            var returnSpeed = 8;
            if (Math.abs(diff) < 0.005) {
                player.angle = targetAngle;
            } else {
                player.angle += diff * Math.min(1, returnSpeed * 0.016);
            }
        }
        
        var displayAngle = player.angle;
        if (attackState.isActive || player.isSwinging) {
            ctx.rotate(displayAngle);
        } else if (displayAngle !== 0) {
            ctx.rotate(displayAngle);
        }
        
        if (player.recoilOffset > 0.01) {
            ctx.translate(-player.recoilOffset * 5, player.recoilOffset * 3);
        }
        
        // ===== 绘制玩家角色（正确染色） =====
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // 获取颜色
        var color = player.color || '#ffffff';
        var nameColor = player.nameColor || '#ffffff';
        var isColorActive = color !== '#ffffff' && color !== null && color !== '';
        
        if (isDead || playerHealth <= 0) {
            ctx.font = sz + 'px "Segoe UI Emoji"';
            ctx.fillText("💀", 0, 0);
        } else {
            // ===== 自定义角色图片 =====
            if (player._avatarImageObj && player._avatarImageObj.complete && player._avatarImageObj.naturalWidth > 0) {
                var size = sz * 1.3;
                ctx.save();
                ctx.beginPath();
                ctx.arc(0, 0, size/2, 0, Math.PI * 2);
                ctx.closePath();
                ctx.clip();
                
                if (isColorActive) {
                    // 1. 先绘制原图（灰度或颜色映射）
                    ctx.drawImage(player._avatarImageObj, -size/2, -size/2, size, size);
                    // 2. 使用颜色叠加（保留细节，只改主色）
                    ctx.globalCompositeOperation = 'source-atop';
                    ctx.fillStyle = color;
                    ctx.fillRect(-size/2, -size/2, size, size);
                    ctx.globalCompositeOperation = 'source-over';
                } else {
                    // 白色 = 原始颜色
                    ctx.drawImage(player._avatarImageObj, -size/2, -size/2, size, size);
                }
                
                ctx.restore();
                
                // 名字
                ctx.save();
                ctx.shadowBlur = 6;
                ctx.shadowColor = 'rgba(0,0,0,0.8)';
                ctx.fillStyle = nameColor;
                ctx.font = 'bold ' + (sz * 0.45) + 'px monospace';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';
                ctx.fillText(player.name, 0, -size/2 - 18);
                ctx.restore();
                
            } else if (player.emoji) {
                // ===== Emoji 角色（直接染色，保留细节） =====
                ctx.save();
                
                // Emoji 字体大小
                var emojiSize = sz * 1.0;
                ctx.font = emojiSize + 'px "Segoe UI Emoji"';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.shadowBlur = 4;
                ctx.shadowColor = 'rgba(0,0,0,0.5)';
                
                if (isColorActive) {
                    // 用颜色直接绘制 Emoji（颜色会替换主色，保留细节）
                    ctx.fillStyle = color;
                    ctx.fillText(player.emoji, 0, -2);
                } else {
                    // 白色 = 原始颜色
                    ctx.fillStyle = '#000000';
                    ctx.fillText(player.emoji, 0, -2);
                }
                
                ctx.restore();
                
                // 名字
                ctx.save();
                ctx.shadowBlur = 6;
                ctx.shadowColor = 'rgba(0,0,0,0.8)';
                ctx.fillStyle = nameColor;
                ctx.font = 'bold ' + (sz * 0.45) + 'px monospace';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';
                ctx.fillText(player.name, 0, -sz/2 - 18);
                ctx.restore();
                
            } else {
                // 默认
                ctx.font = sz + 'px "Segoe UI Emoji"';
                ctx.fillStyle = isColorActive ? color : '#000000';
                ctx.shadowBlur = 4;
                ctx.shadowColor = 'rgba(0,0,0,0.5)';
                ctx.fillText("😎", 0, -4);
            }
        }
        
        // ===== 武器绘制 =====
        if (player.hasUnlockedWeapon && player.currentWeapon && !isDead) {
            if (weaponData) {
                ctx.save();
                ctx.translate(sz * 0.45, -2);
                
                var swingOffset = 0;
                if (player.isSwinging && !isRanged) {
                    swingOffset = Math.sin(player.swingProgress * Math.PI * 2) * 1.2;
                    ctx.rotate(swingOffset);
                }
                
                var cachedImg = weaponImageCache[player.currentWeapon];
                var hasImage = cachedImg && cachedImg.complete && cachedImg.naturalWidth > 0;
                
                var weaponScale = 1.0;
                if (weaponData) {
                    if (weaponData.weaponScale !== undefined && weaponData.weaponScale > 0) {
                        weaponScale = weaponData.weaponScale;
                    } else if (weaponData.WEAPON_SCALE !== undefined && weaponData.WEAPON_SCALE > 0) {
                        weaponScale = weaponData.WEAPON_SCALE;
                    } else if (weaponData.scale !== undefined && weaponData.scale > 0) {
                        weaponScale = weaponData.scale;
                    }
                }
                weaponScale = Math.min(10.0, Math.max(0.01, weaponScale));
                
                if (hasImage) {
                    var drawW = cachedImg.naturalWidth * weaponScale;
                    var drawH = cachedImg.naturalHeight * weaponScale;
                    var maxSize = 300;
                    if (drawW > maxSize || drawH > maxSize) {
                        var ratio = Math.min(maxSize / drawW, maxSize / drawH);
                        drawW = drawW * ratio;
                        drawH = drawH * ratio;
                    }
                    ctx.drawImage(cachedImg, -drawW/2, -drawH/2, drawW, drawH);
                } else {
                    var weaponEmoji = player.currentWeapon;
                    if (weaponData.emoji) weaponEmoji = weaponData.emoji;
                    ctx.font = (sz * 0.5 * Math.min(weaponScale, 3)) + 'px "Segoe UI Emoji"';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(weaponEmoji, 16, 0);
                }
                
                ctx.restore();
                
                if (player.isSwinging && !isRanged) {
                    var swingEffect = weaponData.SWING_EFFECT || weaponData.swingEffect || 1;
                    
                    if (swingEffect !== 0 && swingEffect !== 'none' && swingEffect !== null) {
                        var cachedSwingImg = swingImageCache[player.currentWeapon];
                        var hasSwingImage = cachedSwingImg && cachedSwingImg.complete && cachedSwingImg.naturalWidth > 0;
                        
                        if (hasSwingImage && swingEffect === 3) {
                            var progress = player.swingProgress;
                            var angleOffset = -0.8 + progress * 1.6;
                            var size = 35 * weaponScale;
                            ctx.save();
                            ctx.rotate(angleOffset);
                            ctx.globalAlpha = 0.4 + progress * 0.3;
                            ctx.drawImage(cachedSwingImg, -size/2, -size/2, size, size);
                            ctx.restore();
                        } else if (swingEffect === 2) {
                            ctx.shadowBlur = 0;
                            var alpha = 0.3 + Math.sin(player.swingProgress * Math.PI * 2) * 0.2;
                            ctx.strokeStyle = 'rgba(255, 180, 80, ' + (alpha * 0.4) + ')';
                            ctx.lineWidth = 6;
                            ctx.beginPath();
                            ctx.arc(sz * 0.4, 0, 30, -0.8, 0.8);
                            ctx.stroke();
                        } else {
                            ctx.shadowBlur = 10;
                            var alpha = 0.3 + Math.sin(player.swingProgress * Math.PI * 2) * 0.2;
                            var hue = (player.swingProgress * 360) % 360;
                            ctx.strokeStyle = 'hsla(' + hue + ', 100%, 60%, ' + (alpha * 0.5) + ')';
                            ctx.shadowColor = 'hsl(' + hue + ', 100%, 60%)';
                            ctx.lineWidth = 8;
                            ctx.beginPath();
                            ctx.arc(sz * 0.4, 0, 30, -0.8, 0.8);
                            ctx.stroke();
                        }
                    }
                }
                
                if (isRanged && !ammoSystem.isInfinite) {
                    ctx.save();
                    ctx.shadowBlur = 4;
                    ctx.shadowColor = 'rgba(0,0,0,0.8)';
                    ctx.fillStyle = '#ffffff';
                    ctx.font = 'bold 14px monospace';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'top';
                    var ammoText = ammoSystem.isReloading ? '🔄' : ammoSystem.currentAmmo + '/' + ammoSystem.maxAmmo;
                    ctx.fillText(ammoText, 0, sz + 10);
                    ctx.restore();
                }
            }
        }
        ctx.restore();
    }

    // ============================================================
    //  redrawCanvas
    // ============================================================
    function redrawCanvas() {
        if (!canvas || !ctx) {
            canvas = document.getElementById('gameCanvas');
            if (canvas) ctx = canvas.getContext('2d');
            if (!ctx) return;
        }
        if (canvas.width === 0 || canvas.height === 0) {
            canvas.width = window.innerWidth || 800;
            canvas.height = window.innerHeight || 600;
        }
        if (!gameReady) {
            gameReady = true;
        }
        if(!canvas || !ctx || canvas.width === 0 || canvas.height === 0) return;
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        updateCamera();
        drawGrass();
        drawEntities();
        drawBloodParticles();
        drawAttackParticles();
        drawBullets();
        drawPlayer();
    }

    // ============================================================
    //  游戏循环
    // ============================================================
    var lastTime = 0;

    function updateMovement(delta) {
        if (!gameReady) {
            gameReady = true;
            resetWorld();
            return;
        }
        
        if (isDead) {
            deathTimer += delta;
            if (deathTimer >= DEATH_RESPAWN_DELAY) {
                respawnPlayer();
            }
            updateBloodParticles(delta);
            updateAttackParticles(delta);
            updateBullets(delta);
            return;
        }

        if(playerHealth <= 0) {
            isDead = true;
            deathTimer = 0;
            playDeathSound();
            if (window.UI && window.UI.showToast) window.UI.showToast('💀 你已死亡，即将重生...');
            syncHealthUI();
            return;
        }

        if(!delta||delta>0.035) delta=0.016;
        
        var joyDir = window.UI ? window.UI.getJoystickDirection() : { x: 0, y: 0 };
        var mx = joyDir.x * player.speed * delta;
        var my = joyDir.y * player.speed * delta;
        if(mx!==0||my!==0){
            var nx = player.x + mx;
            var ny = player.y + my;
            nx = Math.min(WORLD_LIMIT, Math.max(-WORLD_LIMIT, nx));
            ny = Math.min(WORLD_LIMIT, Math.max(-WORLD_LIMIT, ny));
            player.x = nx;
            player.y = ny;
            handleCollisions();
        }
        
        updateEntityAudio();
        
        for(var i=0;i<worldEntities.length;i++){ 
            var ent = worldEntities[i];
            if(aiEnabled && ent.ai && ent.ai !== 0) updateAI(ent, delta); 
            if(ent.bubble){ ent.bubble.timer--; if(ent.bubble.timer<=0) delete ent.bubble; } 
        }
        handleCollisions();
        updateBloodParticles(delta);
        updateAttackParticles(delta);
        updateBullets(delta);
        if (player.recoilOffset > 0) {
            player.recoilOffset *= 0.92;
            if (player.recoilOffset < 0.01) player.recoilOffset = 0;
        }
        if (player.isSwinging) {
            player.swingProgress += delta * 6;
            if (player.swingProgress >= 1) {
                player.swingProgress = 0;
                for (var i = 0; i < worldEntities.length; i++) {
                    worldEntities[i]._hitBySwing = false;
                }
                if (!attackState.isActive) {
                    player.isSwinging = false;
                }
            }
        }
    }

    function animLoop(now) {
        if (!gameReady) {
            gameReady = true;
            resetWorld();
            if (window.UI && window.UI.showToast) {
                window.UI.showToast('🔄 引擎已恢复');
            }
        }
        if(lastTime===0) lastTime=now;
        var delta = Math.min(0.033, (now - lastTime) / 1000);
        if(delta > 0) updateMovement(delta);
        lastTime = now;
        animTime += 0.033;
        var nowTime = Date.now();
        if(nowTime - lastRenderTime >= RENDER_THROTTLE) {
            if(gameReady) redrawCanvas();
            lastRenderTime = nowTime;
        }
        requestAnimationFrame(animLoop);
    }

    // ============================================================
    //  Reset世界
    // ============================================================
    function resetWorld() {
        clearAll();
        player.x = 0;
        player.y = 0;
        playerHealth = 100;
        isDead = false;
        deathTimer = 0;
        ammoSystem.isReloading = false;
        ammoSystem.reloadTimer = 0;
        ammoSystem.currentAmmo = ammoSystem.maxAmmo;
        attackState.isActive = false;
        attackState.cooldown = 0;
        syncHealthUI();
        if (window.UI && window.UI.closeModal) window.UI.closeModal();
        if(gameReady) redrawCanvas();
    }

    // ============================================================
    //  初始化
    // ============================================================
    async function init() {
        console.log('[ENGINE] 初始化地图引擎...');
        if (engineInitialized) {
            console.log('[ENGINE] 引擎已初始化，跳过');
            return;
        }
        try {
            canvas.width = window.innerWidth || 800;
            canvas.height = window.innerHeight || 600;
            ctx = canvas.getContext('2d');
            ctx.fillStyle = '#3a7a4a';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#5a9a4a';
            for (var i = 0; i < 100; i++) {
                ctx.beginPath();
                ctx.arc(Math.random() * canvas.width, Math.random() * canvas.height, 3, 0, Math.PI * 2);
                ctx.fill();
            }
            
            try {
                hitAudio = new Audio();
                hitAudio.src = "sound/hit.mp3";
                hitAudio.volume = 0.5;
                hitAudio.load();
            } catch(e) {}
            
            try {
                await Promise.race([
                    new Promise(function(resolve) {
                        if (document.readyState === 'complete') {
                            resolve();
                        } else {
                            window.addEventListener('load', resolve);
                        }
                    }),
                    new Promise(function(resolve) { setTimeout(resolve, 1000); })
                ]);
            } catch(e) {
                console.warn('[ENGINE] DOM加载等待超时，继续初始化...');
            }
            initGrassTexture();
            try {
                await Promise.race([
                    initIndexedDB(),
                    new Promise(function(_, reject) { setTimeout(function() { reject(new Error('DB timeout')); }, 2000); })
                ]);
            } catch(e) {
                console.warn('[ENGINE] IndexedDB 初始化超时，使用内存模式');
                db = null;
            }
            try {
                await Promise.race([
                    loadModsFromLocal(),
                    new Promise(function(resolve) { setTimeout(resolve, 3000); })
                ]);
            } catch(e) {
                console.warn('[ENGINE] 模组加载超时，继续初始化...');
            }
            if (window.UI && window.UI.initUI) {
                try {
                    window.UI.initUI();
                    await window.UI.renderVerticalMenu();
                } catch(e) {
                    console.warn('[ENGINE] UI初始化失败:', e);
                }
            }
            player.currentWeapon = null;
            player.hasUnlockedWeapon = false;
            player.unlockedWeapons = [];
            player.angle = 0;
            player.swingProgress = 0;
            player.isSwinging = false;
            player.lastAttackTime = 0;
            player.radius = 22;
            player.recoilOffset = 0;
            player.weaponData = {};
            player._weaponImageCache = {};
            
            loadPlayerSettings();
            
            resetAttack();
            gameReady = true;
            engineInitialized = true;
            clearAll();
            player.x = canvas.width / 2;
            player.y = canvas.height / 2;
            playerHealth = 100;
            isDead = false;
            deathTimer = 0;
            ammoSystem.isReloading = false;
            ammoSystem.reloadTimer = 0;
            ammoSystem.currentAmmo = ammoSystem.maxAmmo;
            attackState.isActive = false;
            attackState.cooldown = 0;
            syncHealthUI();
            if (window.UI && window.UI.closeModal) {
                window.UI.closeModal();
            }
            for (var i = 0; i < 3; i++) {
                updateCamera();
                drawGrass();
                drawEntities();
                drawBloodParticles();
                drawAttackParticles();
                drawBullets();
                drawPlayer();
            }
            requestAnimationFrame(animLoop);
            window.addEventListener('resize', function() {
                if(canvas && gameReady) {
                    canvas.width = window.innerWidth || 800;
                    canvas.height = window.innerHeight || 600;
                    redrawCanvas();
                }
            });
            if (window.UI && window.UI.showToast) {
                setTimeout(function() {
                    window.UI.showToast('💡 DS-MOD★ v1.1 - 按右上角按钮打开菜单');
                }, 500);
            }
            console.log('[ENGINE] 地图引擎初始化完成');
        } catch(e) {
            console.error('[ENGINE] 初始化失败:', e);
            gameReady = true;
            engineInitialized = true;
            requestAnimationFrame(animLoop);
        }
    }

    // ============================================================
    //  导出到全局
    // ============================================================
    window.ENGINE = {
        getPlayer: getPlayer,
        getEntities: getEntities,
        spawnEntity: spawnEntity,
        clearAllEntities: clearAllEntities,
        clearAll: clearAll,
        unlockWeapon: unlockWeapon,
        switchWeapon: switchWeapon,
        reloadWeapon: reloadWeapon,
        hasWeapon: hasWeapon,
        startAttack: startAttack,
        updateAttack: updateAttack,
        stopAttack: stopAttack,
        resetAttack: resetAttack,
        executeTool: executeTool,
        playHitSound: playUnifiedHitSound,
        playDeathSound: playDeathSound,
        playMenuSound: playMenuSound,
        playWeaponSound: playWeaponSound,
        playMusic: playMusic,
        stopAllSounds: stopAllSounds,
        redrawCanvas: redrawCanvas,
        resetWorld: resetWorld,
        respawnPlayer: respawnPlayer,
        init: init,
        _loadFileFromDB: loadFileFromDB,
        _weaponImageCache: weaponImageCache,
        parseLuaData: parseLuaData,
        isValidWeaponTemplate: isValidWeaponTemplate,
        isMeleeWeapon: isMeleeWeapon,
        isRangedWeapon: isRangedWeapon,
        loadSoundFromDB: loadSoundFromDB,
        ammoSystem: ammoSystem,
        attackState: attackState,
        startReload: startReload,
        finishReload: finishReload,
        isAttacking: function() { return attackState.isActive; },
        playSoundWithDistance: playSoundWithDistance,
        playSoundFixed: playSoundFixed,
        updateEntityAudio: updateEntityAudio,
        SOUND_CONFIG: SOUND_CONFIG,
        _health: playerHealth,
        _maxHealth: maxHealth,
        syncHealthUI: syncHealthUI,
        refreshPlayerSettings: refreshPlayerSettings
    };

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(function() {
            if (!engineInitialized) {
                window.ENGINE.init();
            }
        }, 100);
    } else {
        window.addEventListener('load', function() {
            setTimeout(function() {
                if (!engineInitialized) {
                    window.ENGINE.init();
                }
            }, 100);
        });
    }

    console.log('[ENGINE] 地图引擎已加载');

})();