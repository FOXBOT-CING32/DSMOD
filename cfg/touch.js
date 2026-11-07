// ============================================================
//  cfg/touch.js - UI布局 + 触摸控制
//  职责：动态生成所有UI元素，定义布局位置
//  仿半条命2移动端 UI 架构
// ============================================================

(function() {
    'use strict';

    // ============================================================
    //  UI 布局配置（仿半条命2移动端）
    // ============================================================
    var UI_CONFIG = {
        // 左下角：生命值 + 移动摇杆
        health: {
            position: 'bottom-left',
            offset: { x: 20, y: 20 }
        },
        moveJoystick: {
            position: 'bottom-left',
            offset: { x: 60, y: 90 },
            size: 90
        },
        // 右下角：攻击摇杆 + 武器切换
        attackJoystick: {
            position: 'bottom-right',
            offset: { x: 30, y: 110 },
            size: 90
        },
        switchWeapon: {
            position: 'bottom-right',
            offset: { x: 30, y: 30 },
            size: 48
        },
        reloadBtn: {
            position: 'bottom-left',
            offset: { x: 160, y: 195 },
            size: 48
        },
        // 右上角：菜单按钮
        menuBtn: {
            position: 'top-right',
            offset: { x: 20, y: 20 },
            size: 55
        },
        // 左上角：击杀提示
        killFeed: {
            position: 'top-left',
            offset: { x: 20, y: 20 }
        }
    };

    // ============================================================
    //  创建 UI 元素
    // ============================================================
    function createUI() {
        var container = document.querySelector('.game-container');
        if (!container) {
            console.error('[TOUCH] 找不到 .game-container');
            return;
        }

        // ===== 1. 菜单按钮（右上角） =====
        var menuBtn = document.createElement('div');
        menuBtn.className = 'circle-menu-btn';
        menuBtn.id = 'menuBtn';
        menuBtn.innerHTML = '<span>☰</span>';
        container.appendChild(menuBtn);

        // ===== 2. 击杀提示（左上角） =====
        var killFeed = document.createElement('div');
        killFeed.className = 'kill-feed';
        killFeed.id = 'killFeed';
        container.appendChild(killFeed);

        // ===== 3. 模态框（菜单） =====
        var modalOverlay = document.createElement('div');
        modalOverlay.className = 'modal-overlay';
        modalOverlay.id = 'modalOverlay';
        modalOverlay.innerHTML = `
            <div class="upgraded-menu">
                <div class="menu-header">
                    <div class="menu-title">DS-MOD★ SPAWNMENU <span class="version-badge">v1.0</span></div>
                    <button class="close-modal-btn" id="closeModalBtn">✕</button>
                </div>
                <div class="main-tabs" id="mainTabs">
                    <button data-main="all" class="main-tab-btn active">📦 ALL</button>
                    <button data-main="mods" class="main-tab-btn">⚙️ MODS</button>
                    <button data-main="tools" class="main-tab-btn">🛠️ TOOLS</button>
                </div>
                <div id="categoryScroll" class="category-scroll"></div>
            </div>
        `;
        container.appendChild(modalOverlay);

        // ===== 4. 移动摇杆（左下角） =====
        var moveJoy = document.createElement('div');
        moveJoy.className = 'move-joystick';
        moveJoy.id = 'moveJoy';
        moveJoy.innerHTML = '<div class="move-thumb" id="moveThumb"></div>';
        container.appendChild(moveJoy);

        // ===== 5. 换弹按钮（左下角，移动摇杆右侧） =====
        var reloadBtn = document.createElement('div');
        reloadBtn.className = 'reload-btn';
        reloadBtn.id = 'reloadBtn';
        reloadBtn.textContent = 'R';
        container.appendChild(reloadBtn);

        // ===== 6. 右侧武器面板 =====
        var weaponPanel = document.createElement('div');
        weaponPanel.className = 'weapon-panel';
        weaponPanel.id = 'weaponPanel';
        weaponPanel.innerHTML = `
            <button class="switch-weapon-btn" id="switchBtn">X</button>
            <div class="attack-joystick" id="attackJoy">
                <span class="crosshair-icon">⌖</span>
                <div class="thumb-dot" id="thumbDot"></div>
            </div>
        `;
        container.appendChild(weaponPanel);

        // ===== 7. 生命值 HUD（左下角） =====
        var healthContainer = document.createElement('div');
        healthContainer.className = 'health-container';
        healthContainer.id = 'healthContainer';
        healthContainer.innerHTML = `
            <div class="health-panel">
                <div class="health-stats">
                    <span class="health-label">LIFE</span>
                    <span class="health-number" id="healthValue">100</span>
                </div>
                <div class="health-bar-container">
                    <div class="health-fill" id="healthFill"></div>
                </div>
            </div>
        `;
        container.appendChild(healthContainer);

        console.log('[TOUCH] UI 布局已创建');
    }

    // ============================================================
    //  初始化 UI
    // ============================================================
    function initTouchUI() {
        // 等待 DOM 加载完成
        if (document.readyState === 'complete' || document.readyState === 'interactive') {
            createUI();
        } else {
            document.addEventListener('DOMContentLoaded', createUI);
        }
        console.log('[TOUCH] UI 布局初始化完成');
    }

    // ============================================================
    //  导出到全局
    // ============================================================
    window.TOUCH = {
        UI_CONFIG: UI_CONFIG,
        initTouchUI: initTouchUI,
        createUI: createUI
    };

    // ============================================================
    //  自动初始化
    // ============================================================
    initTouchUI();

    console.log('[TOUCH] cfg/touch.js 已加载');

})();