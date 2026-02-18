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
        
        // 样式配置（基础像素大小，会随缩放调整）
        this.styles = {
            node: {
                baseSize: 7,        // 节点大小（更小）
                radius: 1.5,
                borderWidth: 1.0,
                fillAlpha: 1.0,     // 不透明
                colors: {
                    high: '#5a8fc7',
                    low: '#c78f4a',
                    null: '#c75a5a',
                    wormhole: '#9a5ac7'
                }
            },
            externalNode: {
                baseSize: 6,
                radius: 1.5,
                borderWidth: 1.0,
                fillAlpha: 1.0,     // 不透明
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
                    width: 0.8
                },
                external: {
                    color: 'rgba(255, 255, 255, 0.35)',
                    width: 0.8,
                    dash: [3, 3]
                }
            },
            label: {
                baseFontSize: 7,    // 字体大小（更小）
                fontFamily: '"Segoe UI", system-ui, sans-serif',
                color: 'rgba(220, 220, 220, 0.9)',
                offsetY: -9         // 距离节点更近
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
        const padding = 40;
        const availableWidth = this.viewport.width - padding * 2;
        const availableHeight = this.viewport.height - padding * 2;
        
        // 根据坐标范围自动计算缩放（SDE position2D 坐标值很大，需要很小的缩放因子）
        const scaleX = availableWidth / bounds.width;
        const scaleY = availableHeight / bounds.height;
        this.viewport.zoom = Math.min(scaleX, scaleY) * 0.9;
        
        this.viewport.x = this.viewport.width / 2 - bounds.centerX * this.viewport.zoom;
        this.viewport.y = this.viewport.height / 2 + bounds.centerY * this.viewport.zoom;  // +Y 因为 Y 轴已翻转
    }
    
    worldToScreen(worldPos) {
        // SDE position2D: +Y 是北（上）
        // Canvas: +Y 是下，所以需要翻转 Y 轴
        return {
            x: worldPos.x * this.viewport.zoom + this.viewport.x,
            y: -worldPos.y * this.viewport.zoom + this.viewport.y
        };
    }
    
    getScaledSize(baseSize) {
        // 所有元素同步缩放
        // 参考 zoom：fitToBounds 时的 zoom 值（使星域适应屏幕）
        if (!this.currentData || !this.currentData.bounds) return baseSize;
        
        const bounds = this.currentData.bounds;
        const domainSize = Math.max(bounds.width, bounds.height);
        const viewportSize = Math.min(this.viewport.width, this.viewport.height);
        const referenceZoom = (viewportSize / domainSize) * 0.9;
        
        // 当前 zoom 相对于参考 zoom 的比例
        const scale = this.viewport.zoom / referenceZoom;
        return baseSize * scale;
    }
    
    screenToWorld(screenPos) {
        return {
            x: (screenPos.x - this.viewport.x) / this.viewport.zoom,
            y: -(screenPos.y - this.viewport.y) / this.viewport.zoom
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
        this.drawZoomIndicator();
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
        
        // 计算不在当前星域的路径星系的虚拟位置（带防重叠）
        const externalPathPositions = this.calculateExternalPositions(allSystems);
        
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
        const pathNodeSize = this.getScaledSize(12);
        const pathFontSize = this.getScaledSize(10);
        
        for (const [id, pos2D] of pathSystemPositions) {
            if (!allSystems.has(id)) {
                const pos = this.worldToScreen(pos2D);
                const system = dataLoader.systems.get(id);
                
                // 背景清除
                ctx.fillStyle = '#0a0808';
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, pathNodeSize * 0.6, 0, Math.PI * 2);
                ctx.fill();
                
                // 外圈 - 黄色虚线表示路径星系
                ctx.strokeStyle = '#ffaa00';
                ctx.lineWidth = this.getScaledSize(1.5);
                ctx.setLineDash([2, 2]);
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, pathNodeSize * 0.5, 0, Math.PI * 2);
                ctx.stroke();
                ctx.setLineDash([]);
                
                // 内部填充
                ctx.fillStyle = 'rgba(255, 170, 0, 0.3)';
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, pathNodeSize * 0.4, 0, Math.PI * 2);
                ctx.fill();
                
                // 显示名称
                if (system) {
                    ctx.font = `${pathFontSize}px "Segoe UI", system-ui, sans-serif`;
                    ctx.fillStyle = '#ffaa00';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'bottom';
                    ctx.fillText(system.name, pos.x, pos.y - pathFontSize);
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
                ctx.lineWidth = this.getScaledSize(2.5);
                ctx.setLineDash([]);
            } else {
                // 虚拟连接 - 蓝色虚线
                ctx.strokeStyle = '#5a8fc7';
                ctx.lineWidth = this.getScaledSize(1.5);
                const dashScale = this.getScaledSize(1);
                ctx.setLineDash([6 * dashScale, 4 * dashScale]);
            }
            
            ctx.stroke();
            ctx.setLineDash([]);
            
            // 绘制箭头
            this.drawArrow(ctx, from, to, hasStargate ? '#ffaa00' : '#5a8fc7');
        }
        
        // 高亮当前星域中的路径星系
        const highlightRadius = this.getScaledSize(10);
        const highlightWidth = this.getScaledSize(2);
        for (const pathSys of this.pathSystems) {
            const system = allSystems.get(pathSys.id);
            if (system) {
                const pos = this.worldToScreen(system.position2D);
                ctx.strokeStyle = '#ffaa00';
                ctx.lineWidth = highlightWidth;
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, highlightRadius, 0, Math.PI * 2);
                ctx.stroke();
            }
        }
    }
    
    calculateExternalPositions(allSystems) {
        // 外部星系布局：使用星域大小的固定比例作为偏移距离
        const externalPathPositions = new Map();
        const placedPositions = []; // 世界坐标，用于碰撞检测
        
        if (!this.currentData || !this.currentData.bounds) return externalPathPositions;
        
        const bounds = this.currentData.bounds;
        const domainSize = Math.max(bounds.width, bounds.height);
        
        // 收集本星域星系作为障碍物
        for (const system of allSystems.values()) {
            placedPositions.push({
                x: system.position2D.x,
                y: system.position2D.y,
                id: system.id
            });
        }
        
        // 收集所有路径中的外部星系（不在当前星域）
        const externalSystemIds = new Set();
        for (const pathSys of this.pathSystems) {
            if (!allSystems.has(pathSys.id)) {
                externalSystemIds.add(pathSys.id);
            }
        }
        
        // 构建连接图：外部星系 -> 已放置的相邻星系
        const externalConnections = new Map(); // externalId -> [connectedIds]
        
        for (const conn of this.pathConnections) {
            const fromInCurrent = allSystems.has(conn.from.id);
            const toInCurrent = allSystems.has(conn.to.id);
            const fromInExternal = externalSystemIds.has(conn.from.id);
            const toInExternal = externalSystemIds.has(conn.to.id);
            
            if (fromInCurrent && toInExternal) {
                // from 在当前星域，to 在外部
                if (!externalConnections.has(conn.to.id)) {
                    externalConnections.set(conn.to.id, []);
                }
                externalConnections.get(conn.to.id).push(conn.from.id);
            } else if (!fromInCurrent && toInCurrent) {
                // from 在外部，to 在当前星域
                if (!externalConnections.has(conn.from.id)) {
                    externalConnections.set(conn.from.id, []);
                }
                externalConnections.get(conn.from.id).push(conn.to.id);
            } else if (fromInExternal && toInExternal) {
                // 两个都在外部
                if (!externalConnections.has(conn.from.id)) {
                    externalConnections.set(conn.from.id, []);
                }
                if (!externalConnections.has(conn.to.id)) {
                    externalConnections.set(conn.to.id, []);
                }
                externalConnections.get(conn.from.id).push(conn.to.id);
                externalConnections.get(conn.to.id).push(conn.from.id);
            }
        }
        
        // 偏移距离：3% 星域大小
        const baseOffset = domainSize * 0.025;
        const minGap = domainSize * 0.015;
        
        // 迭代放置外部星系（优先放置连接到当前星域的）
        const placedExternalIds = new Set();
        let changed = true;
        
        while (changed && placedExternalIds.size < externalSystemIds.size) {
            changed = false;
            
            for (const externalId of externalSystemIds) {
                if (placedExternalIds.has(externalId)) continue;
                
                const connectedIds = externalConnections.get(externalId) || [];
                let anchorSystem = null;
                
                // 优先使用已放置的相邻星系作为锚点
                for (const connectedId of connectedIds) {
                    if (allSystems.has(connectedId)) {
                        anchorSystem = allSystems.get(connectedId);
                        break;
                    }
                    if (externalPathPositions.has(connectedId)) {
                        const pos = externalPathPositions.get(connectedId);
                        anchorSystem = { position2D: pos, id: connectedId };
                        break;
                    }
                }
                
                if (!anchorSystem) continue; // 没有可用的锚点，跳过本轮
                
                const ax = anchorSystem.position2D.x;
                const ay = anchorSystem.position2D.y;
                
                // 计算从星域中心指向锚点的角度
                const dirX = ax - bounds.centerX;
                const dirY = ay - bounds.centerY;
                const baseAngle = Math.atan2(dirY, dirX);
                
                // 尝试多个角度和距离
                let bestPos = null;
                const angles = [0, 0.5, -0.5, 1.0, -1.0, 1.5, -1.5, 2.0, -2.0, 2.5, -2.5, 3.0, -3.0];
                const distances = [baseOffset, baseOffset * 0.6, baseOffset * 1.4];
                
                for (const angleOffset of angles) {
                    for (const dist of distances) {
                        const angle = baseAngle + angleOffset;
                        const testPos = {
                            x: ax + Math.cos(angle) * dist,
                            y: ay + Math.sin(angle) * dist
                        };
                        
                        // 检查是否与已放置位置重叠
                        let hasCollision = false;
                        for (const placed of placedPositions) {
                            const dx = testPos.x - placed.x;
                            const dy = testPos.y - placed.y;
                            const distBetween = Math.sqrt(dx * dx + dy * dy);
                            if (distBetween < minGap) {
                                hasCollision = true;
                                break;
                            }
                        }
                        
                        if (!hasCollision) {
                            bestPos = testPos;
                            break;
                        }
                    }
                    if (bestPos) break;
                }
                
                if (bestPos) {
                    externalPathPositions.set(externalId, bestPos);
                    placedPositions.push({ x: bestPos.x, y: bestPos.y, id: externalId });
                    placedExternalIds.add(externalId);
                    changed = true;
                }
            }
        }
        
        return externalPathPositions;
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
        const headLen = this.getScaledSize(8);
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
        ctx.lineWidth = this.getScaledSize(this.styles.connection.internal.width);
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
        ctx.lineWidth = this.getScaledSize(this.styles.connection.external.width);
        const dashScale = this.getScaledSize(1);
        ctx.setLineDash(this.styles.connection.external.dash.map(d => d * dashScale));
        
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
        const size = this.getScaledSize(style.baseSize);
        const halfSize = size / 2;
        const radius = style.radius * (size / style.baseSize);
        
        for (const system of externalSystems) {
            const pos = this.worldToScreen(system.position2D);
            
            // 先用背景色清除图标区域（遮挡穿过的线）
            ctx.fillStyle = '#0a0808';
            const clearSize = size + this.getScaledSize(2);
            this.drawRoundedRect(ctx, pos.x - clearSize/2, pos.y - clearSize/2, clearSize, clearSize, radius);
            ctx.fill();
            
            // 再画图标
            ctx.fillStyle = 'rgba(150, 150, 150, 0.15)';
            ctx.strokeStyle = style.borderColor;
            ctx.lineWidth = this.getScaledSize(style.borderWidth);
            ctx.setLineDash(style.dash.map(d => d * (size / style.baseSize)));
            
            this.drawRoundedRect(ctx, pos.x - halfSize, pos.y - halfSize, size, size, radius);
            ctx.fill();
            ctx.stroke();
            
            ctx.setLineDash([]);
        }
    }
    
    drawSystems() {
        const { ctx } = this;
        const { systems } = this.currentData;
        
        const size = this.getScaledSize(this.styles.node.baseSize);
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
        ctx.lineWidth = isSelected ? this.getScaledSize(2.5) : this.getScaledSize(node.borderWidth);
        this.drawRoundedRect(ctx, pos.x - halfSize, pos.y - halfSize, size, size, radius * (size / this.styles.node.baseSize));
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
        
        // 随缩放调整的字体大小
        const fontSize = this.getScaledSize(label.baseFontSize);
        ctx.font = `${fontSize}px ${label.fontFamily}`;
        ctx.textBaseline = 'bottom';
        ctx.textAlign = 'center';
        
        for (const system of allSystems) {
            const pos = this.worldToScreen(system.position2D);
            const isHovered = this.hoveredSystem === system;
            const isSelected = this.selectedSystem === system;
            const isExternal = system.isExternal;
            
            // 随缩放调整的偏移
            const offsetY = label.offsetY * (fontSize / label.baseFontSize);
            
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
    
    drawZoomIndicator() {
        const { ctx, viewport } = this;
        
        // 计算缩放百分比（相对于 fitToBounds 的 zoom）
        if (!this.currentData || !this.currentData.bounds) return;
        
        const bounds = this.currentData.bounds;
        const domainSize = Math.max(bounds.width, bounds.height);
        const viewportSize = Math.min(viewport.width, viewport.height);
        const referenceZoom = (viewportSize / domainSize) * 0.9;
        const scale = this.viewport.zoom / referenceZoom;
        const percentage = Math.round(scale * 100);
        
        // 左下角位置
        const padding = 10;
        const x = padding;
        const y = viewport.height - padding;
        const width = 80;
        const height = 22;
        const radius = 4;
        
        // 背景（使用 drawRoundedRect 绘制圆角矩形）
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        this.drawRoundedRect(ctx, x, y - height, width, height, radius);
        ctx.fill();
        
        // 文字
        ctx.font = '12px "Segoe UI", system-ui, sans-serif';
        ctx.fillStyle = 'rgba(200, 200, 200, 0.9)';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText(`Zoom: ${percentage}%`, x + 8, y - 6);
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
        
        // 计算参考 zoom（fitToBounds 时的 zoom）
        let minZoom = oldZoom * 0.1;
        let maxZoom = oldZoom * 10;
        if (this.currentData && this.currentData.bounds) {
            const bounds = this.currentData.bounds;
            const domainSize = Math.max(bounds.width, bounds.height);
            const viewportSize = Math.min(this.viewport.width, this.viewport.height);
            const referenceZoom = (viewportSize / domainSize) * 0.9;
            // 限制：90% ~ 900%
            minZoom = referenceZoom * 0.9;
            maxZoom = referenceZoom * 9.0;
        }
        
        const newZoom = Math.max(minZoom, Math.min(maxZoom, oldZoom * factor));
        
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
    
    centerOnSystem(system, zoomLevel = null) {
        if (!system) return;
        
        // 如果没有指定缩放级别，使用当前缩放或默认缩放
        if (zoomLevel === null) {
            zoomLevel = this.viewport.zoom || 1e-15;
        }
        this.viewport.zoom = zoomLevel;
        
        // 计算目标位置，使星系居中
        const targetX = system.position2D.x * this.viewport.zoom;
        const targetY = system.position2D.y * this.viewport.zoom;
        
        this.viewport.x = this.viewport.width / 2 - targetX;
        this.viewport.y = this.viewport.height / 2 + targetY;  // +Y 因为 Y 轴已翻转
        
        this.render();
    }
}
