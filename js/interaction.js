/**
 * 交互模块 - 处理鼠标/触摸事件
 */

class MapInteraction {
    constructor(renderer, onHover, onSelect) {
        this.renderer = renderer;
        this.onHover = onHover;
        this.onSelect = onSelect;
        
        this.canvas = renderer.canvas;
        
        // 状态
        this.isDragging = false;
        this.lastMousePos = { x: 0, y: 0 };
        this.dragStartPos = { x: 0, y: 0 };
        this.hasDragged = false;
        
        // 绑定事件
        this.bindEvents();
    }
    
    bindEvents() {
        const canvas = this.canvas;
        
        // 鼠标事件
        canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
        canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
        canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
        canvas.addEventListener('mouseleave', this.onMouseLeave.bind(this));
        canvas.addEventListener('wheel', this.onWheel.bind(this), { passive: false });
        canvas.addEventListener('dblclick', this.onDoubleClick.bind(this));
        
        // 触摸事件
        canvas.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: false });
        canvas.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false });
        canvas.addEventListener('touchend', this.onTouchEnd.bind(this));
    }
    
    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }
    
    getTouchPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        const touch = e.touches[0] || e.changedTouches[0];
        return {
            x: touch.clientX - rect.left,
            y: touch.clientY - rect.top
        };
    }
    
    onMouseDown(e) {
        this.isDragging = true;
        this.hasDragged = false;
        this.lastMousePos = this.getMousePos(e);
        this.dragStartPos = { ...this.lastMousePos };
        
        this.canvas.style.cursor = 'grabbing';
    }
    
    onMouseMove(e) {
        const pos = this.getMousePos(e);
        
        if (this.isDragging) {
            // 拖动地图
            const dx = pos.x - this.lastMousePos.x;
            const dy = pos.y - this.lastMousePos.y;
            
            if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
                this.hasDragged = true;
            }
            
            this.renderer.pan(dx, dy);
            this.lastMousePos = pos;
        } else {
            // 悬停检测
            const system = this.renderer.getSystemAt(pos);
            this.renderer.setHoveredSystem(system);
            
            if (this.onHover) {
                this.onHover(system);
            }
            
            this.canvas.style.cursor = system ? 'pointer' : 'grab';
        }
    }
    
    onMouseUp(e) {
        if (!this.isDragging) return;
        
        this.isDragging = false;
        this.canvas.style.cursor = 'grab';
        
        // 如果没有拖动，视为点击
        if (!this.hasDragged) {
            const pos = this.getMousePos(e);
            const system = this.renderer.getSystemAt(pos);
            
            if (system) {
                this.renderer.setSelectedSystem(system);
                if (this.onSelect) {
                    this.onSelect(system);
                }
            } else {
                // 点击空白处取消选择
                this.renderer.setSelectedSystem(null);
                if (this.onSelect) {
                    this.onSelect(null);
                }
            }
        }
    }
    
    onMouseLeave(e) {
        this.isDragging = false;
        this.renderer.setHoveredSystem(null);
        if (this.onHover) {
            this.onHover(null);
        }
    }
    
    onWheel(e) {
        e.preventDefault();
        
        const pos = this.getMousePos(e);
        const delta = e.deltaY;
        const factor = delta > 0 ? 0.9 : 1.1;
        
        this.renderer.zoom(factor, pos.x, pos.y);
    }
    
    onDoubleClick(e) {
        this.renderer.resetView();
    }
    
    // 触摸事件处理
    onTouchStart(e) {
        if (e.touches.length === 1) {
            e.preventDefault();
            this.isDragging = true;
            this.hasDragged = false;
            this.lastMousePos = this.getTouchPos(e);
            this.dragStartPos = { ...this.lastMousePos };
        }
    }
    
    onTouchMove(e) {
        if (e.touches.length === 1 && this.isDragging) {
            e.preventDefault();
            
            const pos = this.getTouchPos(e);
            const dx = pos.x - this.lastMousePos.x;
            const dy = pos.y - this.lastMousePos.y;
            
            if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
                this.hasDragged = true;
            }
            
            this.renderer.pan(dx, dy);
            this.lastMousePos = pos;
        }
    }
    
    onTouchEnd(e) {
        if (!this.isDragging) return;
        
        this.isDragging = false;
        
        // 轻触检测
        if (!this.hasDragged) {
            const pos = this.lastMousePos;
            const system = this.renderer.getSystemAt(pos);
            
            if (system) {
                this.renderer.setSelectedSystem(system);
                if (this.onSelect) {
                    this.onSelect(system);
                }
            }
        }
    }
}
