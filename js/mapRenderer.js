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
                size: 10,
                radius: 2,
                borderWidth: 1.5,
                fillAlpha: 0.1,
                borderColor: 'rgba(150, 150, 150, 0.5)',
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
                    color: 'rgba(255, 255, 255, 0.2)',
                    width: 1,
                    dash: [5, 5]
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
        this.viewport.zoom = Math.min(scaleX, scaleY, 10) * 2.5;  // 乘以2.5让默认更近很多
        
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
        this.drawLabels();
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
            
            if (isExternal && !isHovered && !isSelected) continue;
            
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
            
            const displayName = isExternal 
                ? `${system.name} (${system.regionName || dataLoader.getRegionName(system.regionID)})`
                : system.name;
            
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
        // 限制最小缩放为 0.5（不能缩得太远），最大为 10
        const newZoom = Math.max(0.5, Math.min(10, oldZoom * factor));
        
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
