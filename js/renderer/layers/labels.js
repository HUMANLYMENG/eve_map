/**
 * 标签层渲染器
 */

import { RenderLayer } from './base.js';

export class LabelsLayer extends RenderLayer {
  constructor(ctx, viewport) {
    super(ctx, viewport);
    this.styles = {
      baseFontSize: 7,
      fontFamily: '"Segoe UI", system-ui, sans-serif',
      color: 'rgba(220, 220, 220, 0.9)',
      offsetY: -9
    };
    this.hoveredSystem = null;
    this.selectedSystem = null;
  }
  
  setHoveredSystem(system) {
    this.hoveredSystem = system;
  }
  
  setSelectedSystem(system) {
    this.selectedSystem = system;
  }
  
  render(data) {
    if (!data) return;
    
    const { systems, externalSystems = [] } = data;
    const allSystems = [...systems, ...externalSystems];
    
    const fontSize = this.getScaledSize(this.styles.baseFontSize);
    this.ctx.font = `${fontSize}px ${this.styles.fontFamily}`;
    this.ctx.textBaseline = 'bottom';
    this.ctx.textAlign = 'center';
    
    for (const system of allSystems) {
      this._drawLabel(system, fontSize);
    }
    
    this.ctx.globalAlpha = 1;
  }
  
  /**
   * 绘制单个标签
   */
  _drawLabel(system, fontSize) {
    const { ctx } = this;
    const pos = this.worldToScreen(system.position2D);
    const isHovered = this.hoveredSystem === system;
    const isSelected = this.selectedSystem === system;
    const isExternal = system.isExternal;
    
    const offsetY = this.styles.offsetY * (fontSize / this.styles.baseFontSize);
    const baseAlpha = isExternal ? 0.7 : 0.9;
    
    ctx.globalAlpha = (isHovered || isSelected) ? 1 : baseAlpha;
    
    // 阴影
    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 1;
    
    // 颜色
    ctx.fillStyle = isExternal 
      ? 'rgba(180, 180, 180, 0.8)' 
      : (isHovered || isSelected ? '#ffffff' : this.styles.color);
    
    ctx.fillText(system.name, pos.x, pos.y + offsetY);
    
    // 清除阴影
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
  }
}
