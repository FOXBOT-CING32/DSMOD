// ============================================================
//  pc/pc-control.js - PC 端控制（修正设备检测版）
// ============================================================

(function() {
    'use strict';

    // ============================================================
    //  设备检测 - 修复
    // ============================================================
    function isMobile() {
        // 检测触摸设备
        if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
            return true;
        }
        // 检测移动端 UA
        if (/Android|iPhone|iPad|iPod|webOS|BlackBerry|Windows Phone|Mobi|tablet/i.test(navigator.userAgent)) {
            return true;
        }
        // 检测屏幕尺寸（小屏幕视为移动端）
        if (window.innerWidth <= 768) {
            return true;
        }
        return false;
    }

    var IS_MOBILE = isMobile();
    var isPCReady = false;
    var isMenuOpen = false;
    var isSoundEnabled = true;

    var keys = { w: false, a: false, s: false, d: false };
    var isMouseDown = false;
    var hasWeapon = false;
    var currentAngle = 0;
    var mouseX = 0, mouseY = 0;

    // ============================================================
    //  全屏功能
    // ============================================================
    function toggleFullscreen() {
        var elem = document.documentElement;
        if (!document.fullscreenElement && !document.webkitFullscreenElement) {
            if (elem.requestFullscreen) {
                elem.requestFullscreen().catch(function(e) {});
            } else if (elem.webkitRequestFullscreen) {
                elem.webkitRequestFullscreen();
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen().catch(function(e) {});
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            }
        }
    }

    // ============================================================
    //  获取摇杆方向
    // ============================================================
    function getJoystickDirection() {
        var x = 0, y = 0;
        if (keys.w) y = -1;
        if (keys.s) y = 1;
        if (keys.a) x = -1;
        if (keys.d) x = 1;
        if (x !== 0 && y !== 0) {
            x *= 0.707;
            y *= 0.707;
        }
        return { x: x, y: y };
    }

    // ============================================================
    //  检查武器
    // ============================================================
    function checkWeapon() {
        if (window.ENGINE) {
            var player = window.ENGINE.getPlayer();
            if (player) {
                hasWeapon = player.hasUnlockedWeapon && player.currentWeapon !== null;
                return hasWeapon;
            }
        }
        return false;
    }

    // ============================================================
    //  更新玩家角度
    // ============================================================
    function updatePlayerAngle() {
        if (!isMouseDown) return;
        if (!checkWeapon()) return;
        
        var canvas = document.getElementById('gameCanvas');
        if (!canvas) return;
        
        var rect = canvas.getBoundingClientRect();
        var cx = rect.left + rect.width / 2;
        var cy = rect.top + rect.height / 2;
        var dx = mouseX - cx;
        var dy = mouseY - cy;
        
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
            currentAngle = Math.atan2(dy, dx);
            var player = window.ENGINE.getPlayer();
            if (player) {
                player.angle = currentAngle;
            }
        }
    }

    // ============================================================
    //  键盘事件
    // ============================================================
    function onKeyDown(e) {
        var key = e.key.toLowerCase();

        if (key === 'w' || key === 'a' || key === 's' || key === 'd') {
            e.preventDefault();
            keys[key] = true;
        }

        if (key === 'q') {
            e.preventDefault();
            if (window.UI) {
                if (isMenuOpen) {
                    window.UI.closeModal();
                    isMenuOpen = false;
                } else {
                    window.UI.openModal();
                    isMenuOpen = true;
                }
            }
        }

        if (key === 'x') {
            e.preventDefault();
            if (window.ENGINE && window.ENGINE.switchWeapon) {
                window.ENGINE.switchWeapon();
                if (window.ENGINE.playMenuSound) window.ENGINE.playMenuSound();
            }
        }

        if (key === 'r') {
            e.preventDefault();
            if (window.ENGINE && window.ENGINE.reloadWeapon) {
                window.ENGINE.reloadWeapon();
            } else if (window.UI && window.UI.showToast) {
                window.UI.showToast('⚠️ 当前武器不支持换弹');
            }
        }

        if (key === ' ') {
            e.preventDefault();
            toggleFullscreen();
        }

        if (key === 'escape') {
            e.preventDefault();
            if (window.UI && isMenuOpen) {
                window.UI.closeModal();
                isMenuOpen = false;
            } else {
                if (window.UI && window.UI.showToast) {
                    window.UI.showToast('↩️ 返回主菜单...');
                }
                setTimeout(function() {
                    window.location.href = 'index.html';
                }, 300);
            }
        }
    }

    function onKeyUp(e) {
        var key = e.key.toLowerCase();
        if (key === 'w' || key === 'a' || key === 's' || key === 'd') {
            e.preventDefault();
            keys[key] = false;
        }
    }

    // ============================================================
    //  鼠标事件
    // ============================================================
    function onMouseMove(e) {
        mouseX = e.clientX;
        mouseY = e.clientY;
        updatePlayerAngle();
    }

    function onMouseDown(e) {
        if (e.button === 0) {
            e.preventDefault();
            
            if (!checkWeapon()) {
                if (window.UI && window.UI.showToast) {
                    window.UI.showToast('⚠️ 请先解锁武器！');
                }
                return;
            }
            
            isMouseDown = true;
            updatePlayerAngle();
            
            if (window.ENGINE) {
                var player = window.ENGINE.getPlayer();
                if (player) {
                    window.ENGINE.startAttack(currentAngle || player.angle || 0);
                }
            }
        }
    }

    function onMouseUp(e) {
        if (e.button === 0) {
            e.preventDefault();
            isMouseDown = false;
            if (window.ENGINE) {
                window.ENGINE.stopAttack();
            }
        }
    }

    function onMouseLeave() {
        if (isMouseDown) {
            isMouseDown = false;
            if (window.ENGINE) {
                window.ENGINE.stopAttack();
            }
        }
    }

    function onContextMenu(e) {
        e.preventDefault();
    }

    // ============================================================
    //  每帧循环
    // ============================================================
    function pcUpdateLoop() {
        if (isMouseDown && checkWeapon()) {
            updatePlayerAngle();
            if (window.ENGINE) {
                var player = window.ENGINE.getPlayer();
                if (player) {
                    window.ENGINE.updateAttack(currentAngle || player.angle || 0);
                }
            }
        }

        requestAnimationFrame(pcUpdateLoop);
    }

    // ============================================================
    //  ===== 关键修复：只在 PC 端隐藏移动端 UI =====
    // ============================================================
    function removeMobileUI() {
        // 只在 PC 端执行
        if (IS_MOBILE) return;
        
        var elements = [
            '.move-joystick',
            '.attack-joystick',
            '.switch-weapon-btn',
            '.reload-btn',
            '.health-container',
            '.weapon-panel'
        ];
        
        elements.forEach(function(sel) {
            var els = document.querySelectorAll(sel);
            els.forEach(function(el) {
                if (el && el.parentNode) {
                    el.parentNode.removeChild(el);
                }
            });
        });

        var menuBtn = document.getElementById('menuBtn');
        if (menuBtn) {
            menuBtn.style.display = 'none';
        }
    }

    // ============================================================
    //  覆盖 UI 摇杆
    // ============================================================
    function overrideUIJoystick() {
        if (window.UI && window.UI.getJoystickDirection) {
            window.UI.getJoystickDirection = function() {
                return getJoystickDirection();
            };
        }
    }

    // ============================================================
    //  监听模态框状态
    // ============================================================
    function watchModalState() {
        setInterval(function() {
            if (window.UI) {
                var overlay = document.querySelector('.modal-overlay');
                if (overlay) {
                    isMenuOpen = overlay.classList.contains('active');
                }
            }
        }, 100);
    }

    // ============================================================
    //  更新 PC 血条
    // ============================================================
    function updatePCHealth() {
        if (window.ENGINE) {
            var health = window.ENGINE._health;
            var maxH = window.ENGINE._maxHealth;
            
            if (health === undefined || maxH === undefined) {
                var player = window.ENGINE.getPlayer();
                if (player) {
                    if (window.UI && window.UI._health !== undefined) {
                        health = window.UI._health;
                        maxH = window.UI._maxHealth;
                    }
                }
            }
            
            if (health === undefined) health = 100;
            if (maxH === undefined) maxH = 100;
            
            var percent = Math.max(0, (health / maxH) * 100);
            
            var fill = document.getElementById('pcHealthFill');
            var value = document.getElementById('pcHealthValue');
            if (fill) {
                fill.style.width = percent + '%';
                if (percent > 60) {
                    fill.style.background = '#ffffff';
                } else if (percent > 30) {
                    fill.style.background = '#ffaa44';
                } else {
                    fill.style.background = '#ff4444';
                }
            }
            if (value) {
                value.textContent = Math.floor(health);
            }
        }
    }

    // ============================================================
    //  Tools 声音开关
    // ============================================================
    function toggleSound() {
        isSoundEnabled = !isSoundEnabled;
        if (window.ENGINE) {
            if (isSoundEnabled) {
                window.ENGINE.playMenuSound();
                if (window.UI && window.UI.showToast) window.UI.showToast('声音已开启');
            } else {
                window.ENGINE.stopAllSounds();
                if (window.UI && window.UI.showToast) window.UI.showToast('声音已关闭');
            }
        }
        return isSoundEnabled;
    }

    // ============================================================
    //  ===== 初始化 PC 控制（修复手机端检测） =====
    // ============================================================
    function initPC() {
        if (isPCReady) return;
        
        // ===== 关键修复：手机端不启用 PC 控制 =====
        if (IS_MOBILE) {
            console.log('[PC] 检测到移动端，PC 控制已禁用，保留完整移动端UI');
            return;
        }

        console.log('[PC] 检测到 PC 端，启用 PC 控制');

        // 只在 PC 端隐藏移动端 UI
        removeMobileUI();
        overrideUIJoystick();

        document.addEventListener('keydown', onKeyDown);
        document.addEventListener('keyup', onKeyUp);

        var canvas = document.getElementById('gameCanvas');
        if (canvas) {
            canvas.addEventListener('mousemove', onMouseMove);
            canvas.addEventListener('mousedown', onMouseDown);
            canvas.addEventListener('mouseup', onMouseUp);
            canvas.addEventListener('mouseleave', onMouseLeave);
            canvas.addEventListener('contextmenu', onContextMenu);
        }

        pcUpdateLoop();
        watchModalState();

        setTimeout(function() {
            updatePCHealth();
        }, 200);

        setInterval(function() {
            updatePCHealth();
        }, 50);

        if (window.ENGINE && window.ENGINE.executeTool) {
            var origExecute = window.ENGINE.executeTool;
            window.ENGINE.executeTool = function(toolId) {
                if (toolId === 'toggleSound') {
                    toggleSound();
                    return;
                }
                origExecute.call(window.ENGINE, toolId);
            };
        }

        isPCReady = true;
        console.log('[PC] PC 控制已启用');
    }

    // ============================================================
    //  导出
    // ============================================================
    window.PC = {
        isMobile: IS_MOBILE,
        isActive: false,
        init: initPC,
        getJoystickDirection: getJoystickDirection,
        updatePCHealth: updatePCHealth,
        toggleSound: toggleSound,
        toggleFullscreen: toggleFullscreen
    };

    // ============================================================
    //  自动初始化
    // ============================================================
    function autoInit() {
        var checkInterval = setInterval(function() {
            if (window.UI && window.ENGINE && window.ENGINE.getPlayer) {
                clearInterval(checkInterval);
                setTimeout(function() {
                    window.PC.init();
                }, 300);
            }
        }, 200);

        setTimeout(function() {
            clearInterval(checkInterval);
            if (!window.PC.isActive) {
                console.warn('[PC] 初始化超时，强制初始化');
                window.PC.init();
            }
        }, 5000);
    }

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        autoInit();
    } else {
        document.addEventListener('DOMContentLoaded', autoInit);
    }

    console.log('[PC] pc/pc-control.js 已加载');

})();