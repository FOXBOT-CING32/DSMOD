// ============================================================
//  ui.js - UI层（血条修复版）
// ============================================================

(function() {
    'use strict';

    var uiState = {
        currentMainTab: "all",
        currentMainForRender: "all",
        isModalOpen: false,
        moveTouchId: null,
        isMoveDragging: false,
        attackTouchId: null,
        isAttackDragging: false,
        weaponIndex: 0
    };

    var cache = {
        imageUrls: {},
        weaponImageUrls: {},
        soundUrls: {},
        initialized: false
    };

    function getDOM() {
        return {
            canvas: document.getElementById('gameCanvas'),
            menuBtn: document.getElementById('menuBtn'),
            modalOverlay: document.getElementById('modalOverlay'),
            closeModalBtn: document.getElementById('closeModalBtn'),
            mainTabs: document.getElementById('mainTabs'),
            categoryScroll: document.getElementById('categoryScroll'),
            moveJoy: document.getElementById('moveJoy'),
            moveThumb: document.getElementById('moveThumb'),
            attackJoy: document.getElementById('attackJoy'),
            thumbDot: document.getElementById('thumbDot'),
            switchBtn: document.getElementById('switchBtn'),
            reloadBtn: document.getElementById('reloadBtn'),
            healthFill: document.getElementById('healthFill'),
            healthValue: document.getElementById('healthValue'),
            killFeed: document.getElementById('killFeed')
        };
    }

    var DOM = getDOM();

    // ============================================================
    //  音效函数
    // ============================================================
    function playMenuSound() {
        if (window.ENGINE && window.ENGINE.playMenuSound) {
            window.ENGINE.playMenuSound();
        }
    }

    // ============================================================
    //  摇杆控制
    // ============================================================
    var MOVE_MAX_RADIUS = 30;
    var ATTACK_MAX_RADIUS = 30;
    var joyDir = { x: 0, y: 0 };
    var attackAngle = 0;
    var movePointerId = null;
    var attackPointerId = null;

    function getMoveCenter() {
        if (!DOM.moveJoy) return { x: 0, y: 0 };
        var rect = DOM.moveJoy.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }

    function updateMove(clientX, clientY) {
        var center = getMoveCenter();
        var dx = clientX - center.x;
        var dy = clientY - center.y;
        var dist = Math.hypot(dx, dy);
        var clampedDx = dx;
        var clampedDy = dy;
        if (dist > MOVE_MAX_RADIUS) {
            clampedDx = (dx / dist) * MOVE_MAX_RADIUS;
            clampedDy = (dy / dist) * MOVE_MAX_RADIUS;
        }
        if (DOM.moveThumb) {
            DOM.moveThumb.style.transform = 'translate(calc(-50% + ' + clampedDx + 'px), calc(-50% + ' + clampedDy + 'px))';
        }
        if (dist > 5) {
            joyDir.x = clampedDx / MOVE_MAX_RADIUS;
            joyDir.y = clampedDy / MOVE_MAX_RADIUS;
        } else {
            joyDir.x = 0;
            joyDir.y = 0;
        }
    }

    function resetMove() {
        if (DOM.moveThumb) {
            DOM.moveThumb.style.transform = 'translate(-50%, -50%)';
        }
        joyDir.x = 0;
        joyDir.y = 0;
        movePointerId = null;
        uiState.isMoveDragging = false;
    }

    function getAttackCenter() {
        if (!DOM.attackJoy) return { x: 0, y: 0 };
        var rect = DOM.attackJoy.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }

    function updateAttackPosition(clientX, clientY) {
        var center = getAttackCenter();
        var dx = clientX - center.x;
        var dy = clientY - center.y;
        var dist = Math.hypot(dx, dy);
        var clampedDx = dx;
        var clampedDy = dy;
        if (dist > ATTACK_MAX_RADIUS) {
            clampedDx = (dx / dist) * ATTACK_MAX_RADIUS;
            clampedDy = (dy / dist) * ATTACK_MAX_RADIUS;
        }
        if (DOM.thumbDot) {
            DOM.thumbDot.style.transform = 'translate(calc(-50% + ' + clampedDx + 'px), calc(-50% + ' + clampedDy + 'px))';
        }
        if (dist > 8) {
            attackAngle = Math.atan2(dy, dx);
            if (window.ENGINE && window.ENGINE.getPlayer) {
                var player = window.ENGINE.getPlayer();
                if (player) {
                    player.angle = attackAngle;
                }
            }
        } else {
            attackAngle = 0;
        }
    }

    function resetAttackState() {
        if (DOM.thumbDot) {
            DOM.thumbDot.style.transform = 'translate(-50%, -50%)';
        }
        if (DOM.attackJoy) {
            DOM.attackJoy.classList.remove('dragging');
        }
        uiState.isAttackDragging = false;
        attackPointerId = null;
        attackAngle = 0;
        if (window.ENGINE && window.ENGINE.resetAttack) {
            window.ENGINE.resetAttack();
        }
    }

    // ============================================================
    //  攻击循环
    // ============================================================
    var attackLoopRunning = false;

    function startAttackLoop() {
        if (attackLoopRunning) return;
        attackLoopRunning = true;

        function loop() {
            if (uiState.isAttackDragging) {
                if (window.ENGINE && window.ENGINE.updateAttack) {
                    window.ENGINE.updateAttack(attackAngle);
                }
            }
            requestAnimationFrame(loop);
        }
        loop();
    }

    // ============================================================
    //  Toast通知
    // ============================================================
    function showToast(msg) {
        var toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = msg;
        document.body.appendChild(toast);
        setTimeout(function() {
            if (toast && toast.parentNode) toast.remove();
        }, 1500);
    }

    // ============================================================
    //  击杀提示
    // ============================================================
    function getEntityDisplay(entity) {
        return new Promise(function(resolve) {
            if (!entity) {
                resolve({ type: 'emoji', content: '❓' });
                return;
            }
            if (entity.imageUrl && (entity.imageUrl.startsWith('http') || entity.imageUrl.startsWith('blob:'))) {
                var img = new Image();
                img.onload = function() { resolve({ type: 'image', content: entity.imageUrl }); };
                img.onerror = function() { resolve({ type: 'emoji', content: entity.emoji || '❓' }); };
                img.src = entity.imageUrl;
                return;
            }
            resolve({ type: 'emoji', content: entity.emoji || entity.name || '❓' });
        });
    }

    async function addKillMessage(killer, victim) {
        if (!DOM.killFeed) return;
        var entry = document.createElement('div');
        entry.className = 'kill-entry';
        
        if (killer) {
            var display = await getEntityDisplay(killer);
            if (display.type === 'image') {
                var img = document.createElement('img');
                img.src = display.content;
                img.className = 'kill-avatar';
                img.style.width = '20px';
                img.style.height = '20px';
                img.style.objectFit = 'contain';
                img.style.borderRadius = '50%';
                entry.appendChild(img);
            } else {
                var span = document.createElement('span');
                span.textContent = display.content || '❓';
                span.className = 'kill-avatar';
                span.style.fontSize = '16px';
                span.style.display = 'inline-block';
                span.style.width = '20px';
                span.style.textAlign = 'center';
                entry.appendChild(span);
            }
            var nameSpan = document.createElement('span');
            nameSpan.textContent = killer.name || '未知';
            nameSpan.style.color = '#ffaa55';
            nameSpan.style.fontWeight = 'bold';
            entry.appendChild(nameSpan);
        }
        
        var iconSpan = document.createElement('span');
        iconSpan.textContent = '☠️';
        iconSpan.style.fontSize = '1rem';
        iconSpan.style.minWidth = '20px';
        iconSpan.style.textAlign = 'center';
        entry.appendChild(iconSpan);
        
        if (victim) {
            var vDisplay = await getEntityDisplay(victim);
            if (vDisplay.type === 'image') {
                var vImg = document.createElement('img');
                vImg.src = vDisplay.content;
                vImg.className = 'kill-avatar';
                vImg.style.width = '20px';
                vImg.style.height = '20px';
                vImg.style.objectFit = 'contain';
                vImg.style.borderRadius = '50%';
                entry.appendChild(vImg);
            } else {
                var vSpan = document.createElement('span');
                vSpan.textContent = vDisplay.content || '❓';
                vSpan.className = 'kill-avatar';
                vSpan.style.fontSize = '16px';
                vSpan.style.display = 'inline-block';
                vSpan.style.width = '20px';
                vSpan.style.textAlign = 'center';
                entry.appendChild(vSpan);
            }
            var victimSpan = document.createElement('span');
            victimSpan.textContent = victim.name || '玩家';
            victimSpan.style.color = '#ff8888';
            victimSpan.style.fontWeight = 'bold';
            entry.appendChild(victimSpan);
        }
        
        DOM.killFeed.appendChild(entry);
        setTimeout(function() {
            if (entry && entry.parentNode) entry.remove();
        }, 3500);
    }

    // ============================================================
    //  获取图片URL
    // ============================================================
    async function getImageUrl(item) {
        if (!item) return null;
        var cacheKey = item.id || item.name || JSON.stringify(item);
        if (cache.imageUrls[cacheKey]) {
            return cache.imageUrls[cacheKey];
        }
        if (item.imageUrl && (item.imageUrl.startsWith('http') || item.imageUrl.startsWith('blob:'))) {
            cache.imageUrls[cacheKey] = item.imageUrl;
            return item.imageUrl;
        }
        if (item.image) {
            try {
                if (window.ENGINE && window.ENGINE._loadFileFromDB) {
                    var result = await window.ENGINE._loadFileFromDB(item.image);
                    if (result && result.url) {
                        cache.imageUrls[cacheKey] = result.url;
                        item.imageUrl = result.url;
                        return result.url;
                    }
                }
            } catch(e) {}
        }
        if (item.imageId) {
            try {
                if (window.ENGINE && window.ENGINE._loadFileFromDB) {
                    var result = await window.ENGINE._loadFileFromDB(item.imageId);
                    if (result && result.url) {
                        cache.imageUrls[cacheKey] = result.url;
                        item.imageUrl = result.url;
                        return result.url;
                    }
                }
            } catch(e) {}
        }
        return null;
    }

    async function getWeaponImageUrl(item) {
        if (!item) return null;
        var cacheKey = item.id || item.name || JSON.stringify(item);
        if (cache.weaponImageUrls[cacheKey]) {
            return cache.weaponImageUrls[cacheKey];
        }
        if (item.ICON_IMAGE) {
            try {
                if (window.ENGINE && window.ENGINE._loadFileFromDB) {
                    var result = await window.ENGINE._loadFileFromDB(item.ICON_IMAGE);
                    if (result && result.url) {
                        cache.weaponImageUrls[cacheKey] = result.url;
                        item.weaponImageUrl = result.url;
                        return result.url;
                    }
                }
            } catch(e) {}
        }
        if (item.weaponData && item.weaponData.iconImage) {
            try {
                if (window.ENGINE && window.ENGINE._loadFileFromDB) {
                    var result = await window.ENGINE._loadFileFromDB(item.weaponData.iconImage);
                    if (result && result.url) {
                        cache.weaponImageUrls[cacheKey] = result.url;
                        item.weaponImageUrl = result.url;
                        return result.url;
                    }
                }
            } catch(e) {}
        }
        if (item.imageUrl && (item.imageUrl.startsWith('http') || item.imageUrl.startsWith('blob:'))) {
            cache.weaponImageUrls[cacheKey] = item.imageUrl;
            return item.imageUrl;
        }
        if (item.weaponImageUrl && (item.weaponImageUrl.startsWith('http') || item.weaponImageUrl.startsWith('blob:'))) {
            cache.weaponImageUrls[cacheKey] = item.weaponImageUrl;
            return item.weaponImageUrl;
        }
        if (item.WEAPON_IMAGE) {
            try {
                if (window.ENGINE && window.ENGINE._loadFileFromDB) {
                    var result = await window.ENGINE._loadFileFromDB(item.WEAPON_IMAGE);
                    if (result && result.url) {
                        cache.weaponImageUrls[cacheKey] = result.url;
                        item.weaponImageUrl = result.url;
                        return result.url;
                    }
                }
            } catch(e) {}
        }
        if (item.weaponData && item.weaponData.weaponImage) {
            try {
                if (window.ENGINE && window.ENGINE._loadFileFromDB) {
                    var result = await window.ENGINE._loadFileFromDB(item.weaponData.weaponImage);
                    if (result && result.url) {
                        cache.weaponImageUrls[cacheKey] = result.url;
                        item.weaponImageUrl = result.url;
                        return result.url;
                    }
                }
            } catch(e) {}
        }
        return null;
    }

    function getWeaponEmoji(item) {
        if (!item) return '🔫';
        if (item.ICON_EMOJI) return item.ICON_EMOJI;
        if (item.emoji) return item.emoji;
        if (item.weaponData && item.weaponData.ICON_EMOJI) return item.weaponData.ICON_EMOJI;
        return '🔫';
    }

    function getDisplayName(item) {
        var name = item.name || '未知';
        var emojiRegex = /[\u{1F000}-\u{1FFFF}]|[\u2600-\u27BF]|[\u{1F300}-\u{1F5FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F700}-\u{1F77F}]|[\u{1F780}-\u{1F7FF}]|[\u{1F800}-\u{1F8FF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]/gu;
        var emojis = name.match(emojiRegex) || [];
        if (emojis.length >= 2) {
            return emojis.slice(0, 2).join('');
        }
        if (emojis.length === 1) {
            return name;
        }
        return name;
    }

    function countEmojis(str) {
        if (!str) return 0;
        var emojiRegex = /[\u{1F000}-\u{1FFFF}]|[\u2600-\u27BF]|[\u{1F300}-\u{1F5FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F700}-\u{1F77F}]|[\u{1F780}-\u{1F7FF}]|[\u{1F800}-\u{1F8FF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]/gu;
        var matches = str.match(emojiRegex);
        return matches ? matches.length : 0;
    }

    // ============================================================
    //  菜单渲染
    // ============================================================
    async function renderVerticalMenu() {
        var container = DOM.categoryScroll;
        if (!container) return;

        var DATA = window.DATA;
        if (!DATA) {
            console.error('[UI] DATA 未加载');
            return;
        }

        var currentTab = uiState.currentMainTab;

        if (currentTab === "tools") {
            container.innerHTML = '';
            
            var officialBlock = document.createElement('div');
            officialBlock.className = 'category-block';
            var officialTitle = document.createElement('div');
            officialTitle.className = 'category-title';
            officialTitle.textContent = "⚙️ 官方功能";
            officialBlock.appendChild(officialTitle);
            var officialGrid = document.createElement('div');
            officialGrid.className = 'category-grid';
            
            for (var t = 0; t < DATA.TOOLS_OFFICIAL.length; t++) {
                var tool = DATA.TOOLS_OFFICIAL[t];
                var card = document.createElement('div');
                card.className = 'spawn-card';
                var inner = document.createElement('div');
                inner.className = 'spawn-card-inner';
                var content = document.createElement('div');
                content.className = 'spawn-card-content';
                
                var placeholder = document.createElement('div');
                placeholder.className = 'spawn-card-placeholder';
                placeholder.textContent = '?';
                placeholder.style.background = 'rgba(60,60,80,0.9)';
                placeholder.style.color = '#888';
                placeholder.style.fontSize = '28px';
                content.appendChild(placeholder);
                
                var nameDiv = document.createElement('div');
                nameDiv.className = 'spawn-card-name';
                var displayName = tool.name;
                if (displayName && displayName.length > 6) {
                    displayName = displayName.substring(0, 5) + '…';
                }
                nameDiv.textContent = displayName;
                nameDiv.style.whiteSpace = 'nowrap';
                nameDiv.style.overflow = 'hidden';
                nameDiv.style.textOverflow = 'ellipsis';
                content.appendChild(nameDiv);
                inner.appendChild(content);
                card.appendChild(inner);
                
                card.onclick = (function(toolId) {
                    return function(e) {
                        e.stopPropagation();
                        playMenuSound();
                        if (window.ENGINE && window.ENGINE.executeTool) {
                            window.ENGINE.executeTool(toolId);
                        }
                    };
                })(tool.id);
                officialGrid.appendChild(card);
            }
            officialBlock.appendChild(officialGrid);
            container.appendChild(officialBlock);
            
            var modBlock = document.createElement('div');
            modBlock.className = 'category-block';
            var modTitle = document.createElement('div');
            modTitle.className = 'category-title';
            modTitle.textContent = "🔧 模组功能";
            modBlock.appendChild(modTitle);
            var modMsg = document.createElement('div');
            modMsg.className = 'empty-cat';
            modMsg.textContent = '🔜 未来版本将会开放，敬请期待！';
            modMsg.style.color = '#ffaa55';
            modMsg.style.fontSize = '0.8rem';
            modMsg.style.padding = '20px';
            modMsg.style.textAlign = 'center';
            modBlock.appendChild(modMsg);
            container.appendChild(modBlock);
            
            return;
        }

        var isAllTab = (currentTab === "all");
        var dataSet = isAllTab ? DATA.OFFICIAL_RAW : DATA.modsInternal;
        container.innerHTML = '';
        
        for (var c = 0; c < DATA.CATEGORY_ORDER.length; c++) {
            var cat = DATA.CATEGORY_ORDER[c];
            var items = dataSet[cat] || [];
            var block = document.createElement('div');
            block.className = 'category-block';
            var titleDiv = document.createElement('div');
            titleDiv.className = 'category-title';
            titleDiv.textContent = DATA.CATEGORY_TITLES[cat];
            block.appendChild(titleDiv);
            
            if (items.length === 0) {
                var empty = document.createElement('div');
                empty.className = 'empty-cat';
                empty.textContent = '--- 暂无物品 ---';
                block.appendChild(empty);
            } else {
                var grid = document.createElement('div');
                grid.className = 'category-grid';
                
                for (var i = 0; i < items.length; i++) {
                    var item = items[i];
                    var isMusic = item.type === 'music';
                    var isWeapon = (cat === "weapon" || item.category === "weapon" || item.weaponType || item.isWeapon || item.isLuaWeapon);
                    var isLuaWeapon = item.isLuaWeapon || false;
                    
                    var card = document.createElement('div');
                    card.className = 'spawn-card';
                    var inner2 = document.createElement('div');
                    inner2.className = 'spawn-card-inner';
                    var content2 = document.createElement('div');
                    content2.className = 'spawn-card-content';
                    
                    var imgUrl = null;
                    var displayEmoji = null;
                    
                    if (isWeapon || isLuaWeapon) {
                        imgUrl = await getWeaponImageUrl(item);
                        if (!imgUrl) {
                            imgUrl = await getImageUrl(item);
                        }
                        if (!imgUrl) {
                            displayEmoji = getWeaponEmoji(item);
                        }
                    } else {
                        imgUrl = await getImageUrl(item);
                        if (!imgUrl) {
                            displayEmoji = item.emoji || '?';
                        }
                    }
                    
                    if (isMusic) {
                        var musicDiv = document.createElement('div');
                        musicDiv.className = 'spawn-card-music';
                        musicDiv.textContent = '🎵';
                        content2.appendChild(musicDiv);
                    } else if (imgUrl) {
                        var bgDiv = document.createElement('div');
                        bgDiv.className = 'spawn-card-bg';
                        bgDiv.style.backgroundImage = 'url(' + imgUrl + ')';
                        content2.appendChild(bgDiv);
                    } else {
                        if (isAllTab) {
                            var placeholder2 = document.createElement('div');
                            placeholder2.className = 'spawn-card-placeholder';
                            placeholder2.textContent = displayEmoji || '?';
                            content2.appendChild(placeholder2);
                        } else {
                            var placeholder2 = document.createElement('div');
                            placeholder2.className = 'spawn-card-placeholder';
                            placeholder2.textContent = '?';
                            placeholder2.style.background = 'rgba(60,60,80,0.9)';
                            placeholder2.style.color = '#888';
                            placeholder2.style.fontSize = '28px';
                            content2.appendChild(placeholder2);
                        }
                    }
                    
                    var nameDiv2 = document.createElement('div');
                    nameDiv2.className = 'spawn-card-name';
                    var displayName2 = isAllTab ? (item.name || '未知') : getDisplayName(item);
                    nameDiv2.textContent = displayName2;
                    
                    var emojiCount = countEmojis(displayName2);
                    if (emojiCount >= 3) {
                        nameDiv2.style.fontSize = 'clamp(0.15rem, 0.7vw, 0.3rem)';
                        nameDiv2.style.letterSpacing = '-1px';
                    } else if (emojiCount >= 2) {
                        nameDiv2.style.fontSize = 'clamp(0.18rem, 0.9vw, 0.35rem)';
                        nameDiv2.style.letterSpacing = '-0.5px';
                    } else if (displayName2.length > 8) {
                        nameDiv2.style.fontSize = 'clamp(0.2rem, 1.0vw, 0.4rem)';
                    }
                    
                    nameDiv2.style.whiteSpace = 'nowrap';
                    nameDiv2.style.overflow = 'hidden';
                    nameDiv2.style.textOverflow = 'ellipsis';
                    nameDiv2.style.display = 'flex';
                    nameDiv2.style.alignItems = 'center';
                    nameDiv2.style.justifyContent = 'center';
                    nameDiv2.style.gap = '1px';
                    
                    content2.appendChild(nameDiv2);
                    inner2.appendChild(content2);
                    card.appendChild(inner2);
                    
                    card.onclick = (function(itemData, isMusicItem, isWeaponItem, isLua) {
                        return function(e) {
                            e.stopPropagation();
                            playMenuSound();
                            if (isMusicItem) {
                                if (window.ENGINE && window.ENGINE.playMusic) {
                                    window.ENGINE.playMusic(itemData, itemData.name);
                                }
                                return;
                            }
                            if (isWeaponItem || isLua) {
                                var weaponKey = itemData.weaponType || itemData.name || '武器';
                                var weaponName = itemData.name || '武器';
                                if (window.ENGINE && window.ENGINE.unlockWeapon) {
                                    window.ENGINE.unlockWeapon(weaponKey, weaponName, itemData);
                                }
                                if (window.ENGINE && window.ENGINE.playWeaponSound) {
                                    window.ENGINE.playWeaponSound();
                                }
                            } else {
                                var angle = Math.random() * Math.PI * 2;
                                var r = 100 + Math.random() * 80;
                                if (window.ENGINE && window.ENGINE.spawnEntity) {
                                    var player = window.ENGINE.getPlayer();
                                    if (player) {
                                        window.ENGINE.spawnEntity(itemData, player.x + Math.cos(angle) * r, player.y + Math.sin(angle) * r);
                                    }
                                }
                            }
                        };
                    })(item, isMusic, isWeapon, isLuaWeapon);
                    grid.appendChild(card);
                }
                block.appendChild(grid);
            }
            container.appendChild(block);
        }
    }

    async function switchMainTab(tabId) {
        if (tabId === uiState.currentMainTab) return;
        playMenuSound();
        uiState.currentMainTab = tabId;
        uiState.currentMainForRender = tabId;
        var btns = document.querySelectorAll('.main-tab-btn');
        for (var i = 0; i < btns.length; i++) {
            var btn = btns[i];
            if (btn.getAttribute('data-main') === tabId) btn.classList.add('active');
            else btn.classList.remove('active');
        }
        await renderVerticalMenu();
    }

    // ============================================================
    //  HUD更新 - 修复血条
    // ============================================================
    function updateHealthUI(health, maxHealth, isDead) {
        var percent = Math.max(0, (health / maxHealth) * 100);
        if (DOM.healthFill) {
            DOM.healthFill.style.width = percent + '%';
            if (percent > 60) {
                DOM.healthFill.style.background = '#ffffff';
            } else if (percent > 30) {
                DOM.healthFill.style.background = '#ffaa44';
            } else {
                DOM.healthFill.style.background = '#ff4444';
            }
        }
        if (DOM.healthValue) {
            DOM.healthValue.textContent = Math.floor(health);
        }
        if (window.ENGINE) {
            window.ENGINE._health = health;
            window.ENGINE._maxHealth = maxHealth;
        }
        if (window.PC && window.PC.updatePCHealth) {
            window.PC.updatePCHealth();
        }
    }

    // ============================================================
    //  模态框控制
    // ============================================================
    function openModal() {
        playMenuSound();
        if (DOM.modalOverlay) {
            DOM.modalOverlay.classList.add('active');
        }
        uiState.isModalOpen = true;
        renderVerticalMenu();
    }

    function closeModal() {
        playMenuSound();
        if (DOM.modalOverlay) {
            DOM.modalOverlay.classList.remove('active');
        }
        uiState.isModalOpen = false;
    }

    function bindModal() {
        if (DOM.menuBtn) {
            DOM.menuBtn.onclick = function(e) {
                e.stopPropagation();
                e.preventDefault();
                openModal();
            };
            DOM.menuBtn.ontouchstart = function(e) {
                e.stopPropagation();
                e.preventDefault();
                openModal();
            };
        }
        
        if (DOM.closeModalBtn) {
            DOM.closeModalBtn.onclick = function(e) {
                e.stopPropagation();
                e.preventDefault();
                closeModal();
            };
            DOM.closeModalBtn.ontouchstart = function(e) {
                e.stopPropagation();
                e.preventDefault();
                closeModal();
            };
        }
        
        if (DOM.modalOverlay) {
            DOM.modalOverlay.onclick = function(e) {
                if (e.target === DOM.modalOverlay) {
                    closeModal();
                }
            };
        }
        
        var tabBtns = document.querySelectorAll('.main-tab-btn');
        for (var i = 0; i < tabBtns.length; i++) {
            tabBtns[i].onclick = function(e) {
                e.stopPropagation();
                e.preventDefault();
                switchMainTab(this.getAttribute('data-main'));
            };
            tabBtns[i].ontouchstart = function(e) {
                e.stopPropagation();
                e.preventDefault();
                switchMainTab(this.getAttribute('data-main'));
            };
        }
    }

    // ============================================================
    //  武器切换按钮
    // ============================================================
    function bindWeaponButtons() {
        if (DOM.switchBtn) {
            DOM.switchBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                e.preventDefault();
                playMenuSound();
                if (window.ENGINE && window.ENGINE.switchWeapon) {
                    window.ENGINE.switchWeapon();
                }
            });
            DOM.switchBtn.addEventListener('touchstart', function(e) {
                e.stopPropagation();
                e.preventDefault();
                playMenuSound();
                if (window.ENGINE && window.ENGINE.switchWeapon) {
                    window.ENGINE.switchWeapon();
                }
            }, { passive: false });
        }

        if (DOM.reloadBtn) {
            DOM.reloadBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                e.preventDefault();
                playMenuSound();
                if (window.ENGINE && window.ENGINE.reloadWeapon) {
                    window.ENGINE.reloadWeapon();
                } else {
                    showToast('⚠️ 当前武器不支持换弹');
                }
            });
            DOM.reloadBtn.addEventListener('touchstart', function(e) {
                e.stopPropagation();
                e.preventDefault();
                playMenuSound();
                if (window.ENGINE && window.ENGINE.reloadWeapon) {
                    window.ENGINE.reloadWeapon();
                } else {
                    showToast('⚠️ 当前武器不支持换弹');
                }
            }, { passive: false });
        }
    }

    // ============================================================
    //  绑定摇杆事件
    // ============================================================
    function bindJoysticks() {
        if (DOM.moveJoy) {
            DOM.moveJoy.addEventListener('touchstart', function(e) {
                if (movePointerId !== null) return;
                e.preventDefault();
                e.stopPropagation();
                var touch = e.changedTouches[0];
                if (touch) {
                    movePointerId = touch.identifier;
                    uiState.isMoveDragging = true;
                    updateMove(touch.clientX, touch.clientY);
                }
            }, { passive: false });

            DOM.moveJoy.addEventListener('mousedown', function(e) {
                if (uiState.isMoveDragging) return;
                e.preventDefault();
                e.stopPropagation();
                uiState.isMoveDragging = true;
                updateMove(e.clientX, e.clientY);
            });

            DOM.moveJoy.addEventListener('dragstart', function(e) {
                e.preventDefault();
            });
        }

        if (DOM.attackJoy) {
            DOM.attackJoy.addEventListener('touchstart', function(e) {
                if (attackPointerId !== null) return;
                if (window.ENGINE && !window.ENGINE.hasWeapon()) {
                    showToast('⚠️ 请先从菜单武器分区拿一把武器！');
                    return;
                }
                e.preventDefault();
                e.stopPropagation();
                var touch = e.changedTouches[0];
                if (touch) {
                    attackPointerId = touch.identifier;
                    uiState.isAttackDragging = true;
                    DOM.attackJoy.classList.add('dragging');
                    updateAttackPosition(touch.clientX, touch.clientY);
                    if (window.ENGINE && window.ENGINE.startAttack) {
                        window.ENGINE.startAttack(attackAngle);
                    }
                }
            }, { passive: false });

            DOM.attackJoy.addEventListener('mousedown', function(e) {
                if (uiState.isAttackDragging) return;
                if (window.ENGINE && !window.ENGINE.hasWeapon()) {
                    showToast('⚠️ 请先从菜单武器分区拿一把武器！');
                    return;
                }
                e.preventDefault();
                e.stopPropagation();
                uiState.isAttackDragging = true;
                DOM.attackJoy.classList.add('dragging');
                updateAttackPosition(e.clientX, e.clientY);
                if (window.ENGINE && window.ENGINE.startAttack) {
                    window.ENGINE.startAttack(attackAngle);
                }
            });

            DOM.attackJoy.addEventListener('dragstart', function(e) {
                e.preventDefault();
            });
        }

        document.addEventListener('touchmove', function(e) {
            var touches = e.touches;
            for (var i = 0; i < touches.length; i++) {
                var touch = touches[i];
                if (touch.identifier === movePointerId) {
                    e.preventDefault();
                    updateMove(touch.clientX, touch.clientY);
                }
                if (touch.identifier === attackPointerId) {
                    e.preventDefault();
                    updateAttackPosition(touch.clientX, touch.clientY);
                    if (uiState.isAttackDragging && attackAngle !== 0) {
                        if (window.ENGINE && window.ENGINE.updateAttack) {
                            window.ENGINE.updateAttack(attackAngle);
                        }
                    }
                }
            }
        }, { passive: false });

        document.addEventListener('touchend', function(e) {
            var touches = e.changedTouches;
            for (var i = 0; i < touches.length; i++) {
                var touch = touches[i];
                if (touch.identifier === movePointerId) {
                    resetMove();
                }
                if (touch.identifier === attackPointerId) {
                    resetAttackState();
                }
            }
        }, { passive: false });

        document.addEventListener('touchcancel', function(e) {
            if (movePointerId !== null) resetMove();
            if (attackPointerId !== null) resetAttackState();
        }, { passive: false });

        document.addEventListener('mousemove', function(e) {
            if (uiState.isMoveDragging) {
                e.preventDefault();
                updateMove(e.clientX, e.clientY);
            }
            if (uiState.isAttackDragging) {
                e.preventDefault();
                updateAttackPosition(e.clientX, e.clientY);
                if (attackAngle !== 0) {
                    if (window.ENGINE && window.ENGINE.updateAttack) {
                        window.ENGINE.updateAttack(attackAngle);
                    }
                }
            }
        });

        document.addEventListener('mouseup', function(e) {
            if (uiState.isMoveDragging) {
                resetMove();
            }
            if (uiState.isAttackDragging) {
                resetAttackState();
            }
        });

        window.addEventListener('blur', function() {
            if (movePointerId !== null) resetMove();
            if (attackPointerId !== null) resetAttackState();
        });
    }

    // ============================================================
    //  获取摇杆方向
    // ============================================================
    function getJoystickDirection() {
        return joyDir;
    }

    function getAttackAngle() {
        return attackAngle;
    }

    function isAttackActive() {
        return uiState.isAttackDragging;
    }

    // ============================================================
    //  初始化UI
    // ============================================================
    function initUI() {
        console.log('[UI] 初始化UI层...');
        DOM = getDOM();
        bindModal();
        bindJoysticks();
        bindWeaponButtons();
        startAttackLoop();
        console.log('[UI] UI层初始化完成');
    }

    // ============================================================
    //  导出到全局
    // ============================================================
    window.UI = {
        getJoystickDirection: getJoystickDirection,
        getAttackAngle: getAttackAngle,
        isAttackActive: isAttackActive,
        resetAttackState: resetAttackState,
        updateHealthUI: updateHealthUI,
        showToast: showToast,
        addKillMessage: addKillMessage,
        openModal: openModal,
        closeModal: closeModal,
        renderVerticalMenu: renderVerticalMenu,
        switchMainTab: switchMainTab,
        initUI: initUI,
        _cache: cache,
        _health: 100,
        _maxHealth: 100,
        isModalOpen: false
    };

    console.log('[UI] UI层已加载');

})();