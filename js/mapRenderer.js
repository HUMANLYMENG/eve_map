/**
 * 地图渲染模块 - Eveeye 风格
 */

class MapRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        
        this.viewport = {
            x: 0,
            y: 0,
            zoom: 1,
            width: 0,
            height: 0
        };
        
        this.currentData = null;
        this.hoveredSystem = null;
        this.selectedSystem = null;
        this.pathSystems = [];
        this.pathConnections = [];
        
        // 样式配置（固定像素大小，不随缩放变化）
        this.styles = {
            node: {
                size: 14,           // 固定像素大小
                radius: 3,
                borderWidth: 1.5,
                fillAlpha: 0.15,
                colors: {
                    high: '#5a8fc7',
                    low: '#c78f4a',
                    null: '#c75a5a',
                    wormhole: '#9a5ac7'
                }
            },
            externalNode: {
                size: 12,
                radius: 2,
                borderWidth: 1.5,
                fillAlpha: 0.15,
                borderColor: 'rgba(150, 150, 150, 0.6)',
                dash: [3, 3]
            },
            border: {
                normal: 'rgba(255, 255, 255, 0.6)',
                hover: 'rgba(255, 255, 255, 0.9)',
                selected: '#ffff00'
            },
            connection: {
                internal: {
                    color: 'rgba(255, 255, 255, 0.35)',
                    width: 1.2
                },
                external: {
                    color: 'rgba(255, 255, 255, 0.35)',
                    width: 1.2,
                    dash: [3, 3]
                }
            },
            label: {
                font: '11px "Segoe UI", system-ui, sans-serif',  // 固定字体大小
                color: 'rgba(220, 220, 220, 0.9)',
                offsetY: -18        // 固定偏移
            }
        };
        
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }
    
    resize() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';
        
        // 重置变换矩阵后再缩放，避免重复缩放
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.scale(dpr, dpr);
        
        this.viewport.width = rect.width;
        this.viewport.height = rect.height;
        
        if (this.currentData) {
            this.render();
        }
    }
    
    setData(data, skipFit = false) {
        this.currentData = data;
        this.hoveredSystem = null;
        this.selectedSystem = null;
        
        if (data && data.bounds && !skipFit) {
            this.fitToBounds(data.bounds);
        }
        
        this.render();
    }
    
    fitToBounds(bounds) {
        const padding = 40;  // 更小的边距，让地图更填充屏幕
        const availableWidth = this.viewport.width - padding * 2;
        const availableHeight = this.viewport.height - padding * 2;
        
        const scaleX = availableWidth / bounds.width;
        const scaleY = availableHeight / bounds.height;
        
        // 默认缩放更大（更靠近地图）
        this.viewport.zoom = 15;  // 固定默认缩放为15
        
        this.viewport.x = this.viewport.width / 2 - bounds.centerX * this.viewport.zoom;
        this.viewport.y = this.viewport.height / 2 - bounds.centerY * this.viewport.zoom;
    }
    
    worldToScreen(worldPos) {
        return {
            x: worldPos.x * this.viewport.zoom + this.viewport.x,
            y: worldPos.y * this.viewport.zoom + this.viewport.y
        };
    }
    
    screenToWorld(screenPos) {
        return {
            x: (screenPos.x - this.viewport.x) / this.viewport.zoom,
            y: (screenPos.y - this.viewport.y) / this.viewport.zoom
        };
    }
    
    render() {
        if (!this.currentData) return;
        
        const { ctx, viewport } = this;
        
        ctx.clearRect(0, 0, viewport.width, viewport.height);
        
        this.drawBackground();
        this.drawConnections();
        this.drawExternalSystems();
        this.drawSystems();
        this.drawPath(); // 绘制路径
        this.drawLabels();
    }
    
    setPathData(pathSystems, pathConnections) {
        this.pathSystems = pathSystems || [];
        this.pathConnections = pathConnections || [];
        this.render();
    }
    
    drawPath() {
        if (!this.pathConnections || this.pathConnections.length === 0) return;
        
        const { ctx } = this;
        
        // 获取当前显示的所有星系
        const allSystems = new Map();
        if (this.currentData) {
            for (const s of this.currentData.systems) allSystems.set(s.id, s);
            for (const s of this.currentData.externalSystems || []) allSystems.set(s.id, s);
        }
        
        // 计算不在当前星域的路径星系的虚拟位置
        const externalPathPositions = new Map(); // id -> {x, y}
        
        // 找到所有连接到当前星域的路径星系
        // 即：路径中的星系在当前星域，且路径中有不在当前星域的相邻星系
        const connectedToBorder = new Map(); // borderSystemId -> [externalSystemIds]
        
        for (const conn of this.pathConnections) {
            const fromInCurrent = allSystems.has(conn.from.id);
            const toInCurrent = allSystems.has(conn.to.id);
            
            if (fromInCurrent && !toInCurrent) {
                // from 在当前星域，to 在外部
                const list = connectedToBorder.get(conn.from.id) || [];
                if (!list.includes(conn.to.id)) list.push(conn.to.id);
                connectedToBorder.set(conn.from.id, list);
            } else if (!fromInCurrent && toInCurrent) {
                // from 在外部，to 在当前星域
                const list = connectedToBorder.get(conn.to.id) || [];
                if (!list.includes(conn.from.id)) list.push(conn.from.id);
                connectedToBorder.set(conn.to.id, list);
            }
        }
        
        // 为每个连接到边界的外部路径星系链分配位置
        const processedExternal = new Set();
        
        for (const [borderId, externalIds] of connectedToBorder) {
            const borderSystem = allSystems.get(borderId);
            if (!borderSystem) continue;
            
            const baseAngle = this.calculateExternalAngle(borderSystem);
            const count = externalIds.length;
            
            externalIds.forEach((externalId, index) => {
                // 计算角度 - 围绕边界星系均匀分布
                let angle;
                if (count === 1) {
                    angle = baseAngle;
                } else {
                    const spread = (count - 1) * 0.7; // 约40度间隔
                    angle = baseAngle - spread / 2 + index * 0.7;
                }
                
                externalPathPositions.set(externalId, {
                    x: borderSystem.position2D.x + Math.cos(angle) * 12,
                    y: borderSystem.position2D.y + Math.sin(angle) * 12
                });
                processedExternal.add(externalId);
                
                // 继续查找这个外部星系的相邻路径星系（形成链）
                this.processExternalChain(externalId, externalPathPositions, processedExternal, 
                    borderSystem.position2D, angle, allSystems);
            });
        }
        
        // 获取路径上所有星系的位置信息
        const pathSystemPositions = new Map();
        for (const pathSys of this.pathSystems) {
            if (allSystems.has(pathSys.id)) {
                // 在当前星域
                pathSystemPositions.set(pathSys.id, allSystems.get(pathSys.id).position2D);
            } else if (externalPathPositions.has(pathSys.id)) {
                // 使用虚拟位置
                pathSystemPositions.set(pathSys.id, externalPathPositions.get(pathSys.id));
            } else {
                // 从 dataLoader 获取并使用原始位置（备用）
                const fullSystem = dataLoader.systems.get(pathSys.id);
                if (fullSystem) {
                    pathSystemPositions.set(pathSys.id, fullSystem.position2D);
                }
            }
        }
        
        // 绘制不在当前星域的路径星系（小图标）
        for (const [id, pos2D] of pathSystemPositions) {
            if (!allSystems.has(id)) {
                const pos = this.worldToScreen(pos2D);
                const system = dataLoader.systems.get(id);
                
                // 背景清除
                ctx.fillStyle = '#0a0808';
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, 7, 0, Math.PI * 2);
                ctx.fill();
                
                // 外圈 - 黄色虚线表示路径星系
                ctx.strokeStyle = '#ffaa00';
                ctx.lineWidth = 1.5;
                ctx.setLineDash([2, 2]);
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, 6, 0, Math.PI * 2);
                ctx.stroke();
                ctx.setLineDash([]);
                
                // 内部填充
                ctx.fillStyle = 'rgba(255, 170, 0, 0.3)';
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, 5, 0, Math.PI * 2);
                ctx.fill();
                
                // 显示名称
                if (system) {
                    ctx.font = '10px "Segoe UI", system-ui, sans-serif';
                    ctx.fillStyle = '#ffaa00';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'bottom';
                    ctx.fillText(system.name, pos.x, pos.y - 10);
                }
            }
        }
        
        // 绘制路径连线
        for (const conn of this.pathConnections) {
            const fromPos = pathSystemPositions.get(conn.from.id);
            const toPos = pathSystemPositions.get(conn.to.id);
            
            if (!fromPos || !toPos) continue;
            
            const from = this.worldToScreen(fromPos);
            const to = this.worldToScreen(toPos);
            
            // 全局检查是否有星门连接
            const hasStargate = this.checkGlobalStargateConnection(conn.from.id, conn.to.id);
            
            ctx.beginPath();
            ctx.moveTo(from.x, from.y);
            ctx.lineTo(to.x, to.y);
            
            if (hasStargate) {
                // 有星门连接 - 橙色高亮
                ctx.strokeStyle = '#ffaa00';
                ctx.lineWidth = 2.5;
                ctx.setLineDash([]);
            } else {
                // 虚拟连接 - 蓝色虚线
                ctx.strokeStyle = '#5a8fc7';
                ctx.lineWidth = 1.5;
                ctx.setLineDash([6, 4]);
            }
            
            ctx.stroke();
            ctx.setLineDash([]);
            
            // 绘制箭头
            this.drawArrow(ctx, from, to, hasStargate ? '#ffaa00' : '#5a8fc7');
        }
        
        // 高亮当前星域中的路径星系
        for (const pathSys of this.pathSystems) {
            const system = allSystems.get(pathSys.id);
            if (system) {
                const pos = this.worldToScreen(system.position2D);
                ctx.strokeStyle = '#ffaa00';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, 10, 0, Math.PI * 2);
                ctx.stroke();
            }
        }
    }
    
    calculateExternalAngle(system) {
        // 计算从星域中心指向该星系的角度
        if (!this.currentData) return Math.random() * Math.PI * 2;
        
        const centerX = this.currentData.bounds.centerX;
        const centerY = this.currentData.bounds.centerY;
        
        const dirX = system.position2D.x - centerX;
        const dirY = system.position2D.y - centerY;
        
        return Math.atan2(dirY, dirX);
    }
    
    processExternalChain(externalId, externalPathPositions, processedExternal, 
                        borderPos, baseAngle, allSystems) {
        // 查找与这个外部星系相邻的路径星系
        for (const conn of this.pathConnections) {
            let neighborId = null;
            
            if (conn.from.id === externalId && !allSystems.has(conn.to.id)) {
                neighborId = conn.to.id;
            } else if (conn.to.id === externalId && !allSystems.has(conn.from.id)) {
                neighborId = conn.from.id;
            }
            
            if (neighborId && !processedExternal.has(neighborId)) {
                // 继续沿着链的方向，增加距离
                const currentPos = externalPathPositions.get(externalId);
                if (currentPos) {
                    // 在相同方向上再往外 15px
                    externalPathPositions.set(neighborId, {
                        x: borderPos.x + Math.cos(baseAngle) * 28,
                        y: borderPos.y + Math.sin(baseAngle) * 28
                    });
                    processedExternal.add(neighborId);
                    
                    // 递归处理下一个
                    this.processExternalChain(neighborId, externalPathPositions, processedExternal,
                        borderPos, baseAngle, allSystems);
                }
            }
        }
    }
    
    checkStargateConnection(fromId, toId) {
        if (!this.currentData) return false;
        
        // 检查内部连接
        for (const conn of this.currentData.internalConnections) {
            if ((conn.from === fromId && conn.to === toId) ||
                (conn.from === toId && conn.to === fromId)) {
                return true;
            }
        }
        
        // 检查外部连接
        for (const conn of this.currentData.externalConnections) {
            if ((conn.from === fromId && conn.to === toId) ||
                (conn.from === toId && conn.to === fromId)) {
                return true;
            }
        }
        
        return false;
    }
    
    checkGlobalStargateConnection(fromId, toId) {
        // 使用 dataLoader 的全局连接数据检查
        const fromConnections = dataLoader.connections.get(fromId);
        if (fromConnections) {
            return fromConnections.includes(toId);
        }
        return false;
    }
    
    drawArrow(ctx, from, to, color) {
        const headLen = 8;
        const angle = Math.atan2(to.y - from.y, to.x - from.x);
        const arrowDist = 0.5; // 箭头位置在线段中间
        
        const arrowX = from.x + (to.x - from.x) * arrowDist;
        const arrowY = from.y + (to.y - from.y) * arrowDist;
        
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(arrowX, arrowY);
        ctx.lineTo(
            arrowX - headLen * Math.cos(angle - Math.PI / 6),
            arrowY - headLen * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
            arrowX - headLen * Math.cos(angle + Math.PI / 6),
            arrowY - headLen * Math.sin(angle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fill();
    }
    
    drawBackground() {
        const { ctx, viewport } = this;
        
        const gradient = ctx.createRadialGradient(
            viewport.width / 2, viewport.height / 2, 0,
            viewport.width / 2, viewport.height / 2, Math.max(viewport.width, viewport.height)
        );
        gradient.addColorStop(0, '#1a1515');
        gradient.addColorStop(1, '#0a0808');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, viewport.width, viewport.height);
        
        this.drawGrid();
    }
    
    drawGrid() {
        const { ctx, viewport } = this;
        const gridSize = 200 * viewport.zoom;
        
        if (gridSize < 30) return;
        
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
        ctx.lineWidth = 1;
        
        const offsetX = viewport.x % gridSize;
        const offsetY = viewport.y % gridSize;
        
        ctx.beginPath();
        for (let x = offsetX; x < viewport.width; x += gridSize) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, viewport.height);
        }
        for (let y = offsetY; y < viewport.height; y += gridSize) {
            ctx.moveTo(0, y);
            ctx.lineTo(viewport.width, y);
        }
        ctx.stroke();
    }
    
    drawConnections() {
        const { ctx } = this;
        const { internalConnections, externalConnections } = this.currentData;
        
        // 内部连接
        ctx.strokeStyle = this.styles.connection.internal.color;
        ctx.lineWidth = this.styles.connection.internal.width;
        ctx.setLineDash([]);
        
        ctx.beginPath();
        for (const conn of internalConnections) {
            const from = this.worldToScreen(conn.fromPos);
            const to = this.worldToScreen(conn.toPos);
            ctx.moveTo(from.x, from.y);
            ctx.lineTo(to.x, to.y);
        }
        ctx.stroke();
        
        // 外部连接
        ctx.strokeStyle = this.styles.connection.external.color;
        ctx.lineWidth = this.styles.connection.external.width;
        ctx.setLineDash(this.styles.connection.external.dash);
        
        ctx.beginPath();
        for (const conn of externalConnections) {
            const from = this.worldToScreen(conn.fromPos);
            const to = this.worldToScreen(conn.toPos);
            ctx.moveTo(from.x, from.y);
            ctx.lineTo(to.x, to.y);
        }
        ctx.stroke();
        
        ctx.setLineDash([]);
    }
    
    drawExternalSystems() {
        const { ctx } = this;
        const { externalSystems } = this.currentData;
        
        if (!externalSystems) return;
        
        const style = this.styles.externalNode;
        const size = style.size;
        const halfSize = size / 2;
        
        for (const system of externalSystems) {
            const pos = this.worldToScreen(system.position2D);
            
            // 先用背景色清除图标区域（遮挡穿过的线）
            ctx.fillStyle = '#0a0808'; // 背景色
            this.drawRoundedRect(ctx, pos.x - halfSize - 1, pos.y - halfSize - 1, size + 2, size + 2, style.radius);
            ctx.fill();
            
            // 再画图标
            ctx.fillStyle = 'rgba(150, 150, 150, 0.15)';
            ctx.strokeStyle = style.borderColor;
            ctx.lineWidth = style.borderWidth;
            ctx.setLineDash(style.dash);
            
            this.drawRoundedRect(ctx, pos.x - halfSize, pos.y - halfSize, size, size, style.radius);
            ctx.fill();
            ctx.stroke();
            
            ctx.setLineDash([]);
        }
    }
    
    drawSystems() {
        const { ctx } = this;
        const { systems } = this.currentData;
        
        const size = this.styles.node.size;
        const halfSize = size / 2;
        
        for (const system of systems) {
            const pos = this.worldToScreen(system.position2D);
            const isHovered = this.hoveredSystem === system;
            const isSelected = this.selectedSystem === system;
            
            this.drawNode(ctx, pos, system, isHovered, isSelected, size, halfSize);
        }
    }
    
    drawNode(ctx, pos, system, isHovered, isSelected, size, halfSize) {
        const { node, border } = this.styles;
        const radius = node.radius;
        
        const color = node.colors[system.securityClass] || node.colors.null;
        
        // 入口星系发光效果
        if (system.isBorder) {
            const gradient = ctx.createRadialGradient(
                pos.x, pos.y, halfSize,
                pos.x, pos.y, halfSize + 8
            );
            gradient.addColorStop(0, 'rgba(100, 200, 100, 0.4)');
            gradient.addColorStop(1, 'transparent');
            
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, halfSize + 8, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // 悬停/选中发光
        if (isHovered || isSelected) {
            const glowSize = halfSize + (isSelected ? 10 : 6);
            const gradient = ctx.createRadialGradient(
                pos.x, pos.y, halfSize,
                pos.x, pos.y, glowSize
            );
            gradient.addColorStop(0, 'rgba(255, 255, 255, 0.25)');
            gradient.addColorStop(1, 'transparent');
            
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, glowSize, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // 填充
        ctx.fillStyle = color;
        ctx.globalAlpha = node.fillAlpha;
        this.drawRoundedRect(ctx, pos.x - halfSize, pos.y - halfSize, size, size, radius);
        ctx.fill();
        ctx.globalAlpha = 1;
        
        // 边框
        ctx.strokeStyle = isSelected ? border.selected : (isHovered ? border.hover : border.normal);
        ctx.lineWidth = isSelected ? 2.5 : node.borderWidth;
        this.drawRoundedRect(ctx, pos.x - halfSize, pos.y - halfSize, size, size, radius);
        ctx.stroke();
    }
    
    drawRoundedRect(ctx, x, y, width, height, radius) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
    }
    
    drawLabels() {
        const { ctx } = this;
        const { systems, externalSystems = [] } = this.currentData;
        const { label } = this.styles;
        
        const allSystems = [...systems, ...externalSystems];
        
        // 固定字体大小，不随缩放变化
        ctx.font = label.font;
        ctx.textBaseline = 'bottom';
        ctx.textAlign = 'center';
        
        for (const system of allSystems) {
            const pos = this.worldToScreen(system.position2D);
            const isHovered = this.hoveredSystem === system;
            const isSelected = this.selectedSystem === system;
            const isExternal = system.isExternal;
            
            // 外部星系名称默认显示，不再跳过
            
            // 根据缩放级别控制标签密度（固定大小的文字）
            if (!isExternal && !isHovered && !isSelected) {
                const importance = (system.isHub ? 3 : 0) + (system.isBorder ? 2 : 0) + (system.isRegional ? 1 : 0);
                
                if (this.viewport.zoom < 0.6 && importance < 3) continue;
                if (this.viewport.zoom < 0.4 && importance < 2) continue;
                if (this.viewport.zoom < 0.25 && importance < 1) continue;
            }
            
            // 固定偏移
            const offsetY = label.offsetY;
            
            const baseAlpha = isExternal ? 0.7 : 0.9;
            ctx.globalAlpha = (isHovered || isSelected) ? 1 : baseAlpha;
            
            // 固定阴影
            ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
            ctx.shadowBlur = 4;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 1;
            
            ctx.fillStyle = isExternal 
                ? 'rgba(180, 180, 180, 0.8)' 
                : (isHovered || isSelected ? '#ffffff' : label.color);
            
            const displayName = system.name;
            
            ctx.fillText(displayName, pos.x, pos.y + offsetY);
            
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
        }
        
        ctx.globalAlpha = 1;
    }
    
    setHoveredSystem(system) {
        if (this.hoveredSystem !== system) {
            this.hoveredSystem = system;
            this.render();
        }
    }
    
    setSelectedSystem(system) {
        if (this.selectedSystem !== system) {
            this.selectedSystem = system;
            this.render();
        }
    }
    
    getSystemAt(screenPos) {
        if (!this.currentData) return null;
        
        const hitRadius = 25; // 屏幕像素，更大的命中区域
        
        // 使用屏幕坐标进行比较，避免坐标转换误差
        for (const system of this.currentData.systems) {
            const systemScreenPos = this.worldToScreen(system.position2D);
            const dx = systemScreenPos.x - screenPos.x;
            const dy = systemScreenPos.y - screenPos.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < hitRadius) {
                return system;
            }
        }
        
        if (this.currentData.externalSystems) {
            for (const system of this.currentData.externalSystems) {
                const systemScreenPos = this.worldToScreen(system.position2D);
                const dx = systemScreenPos.x - screenPos.x;
                const dy = systemScreenPos.y - screenPos.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                if (dist < hitRadius) {
                    return system;
                }
            }
        }
        
        return null;
    }
    
    pan(deltaX, deltaY) {
        this.viewport.x += deltaX;
        this.viewport.y += deltaY;
        this.render();
    }
    
    zoom(factor, centerX, centerY) {
        const oldZoom = this.viewport.zoom;
        // 限制缩放范围：最小4.0，最大20
        const newZoom = Math.max(4.0, Math.min(20, oldZoom * factor));
        
        const zoomFactor = newZoom / oldZoom;
        this.viewport.x = centerX - (centerX - this.viewport.x) * zoomFactor;
        this.viewport.y = centerY - (centerY - this.viewport.y) * zoomFactor;
        this.viewport.zoom = newZoom;
        
        this.render();
    }
    
    resetView() {
        if (this.currentData && this.currentData.bounds) {
            this.fitToBounds(this.currentData.bounds);
            this.render();
        }
    }
    
    centerOnSystem(system, zoomLevel = 3) {
        if (!system) return;
        
        // 设置目标缩放级别
        this.viewport.zoom = zoomLevel;
        
        // 计算目标位置，使星系居中
        const targetX = system.position2D.x * this.viewport.zoom;
        const targetY = system.position2D.y * this.viewport.zoom;
        
        this.viewport.x = this.viewport.width / 2 - targetX;
        this.viewport.y = this.viewport.height / 2 - targetY;
        
        this.render();
    }
}
