/**
 * 星系节点层渲染器
 */

import { RenderLayer } from './base.js';

export class SystemsLayer extends RenderLayer {
  constructor(ctx, viewport) {
    super(ctx, viewport);
    this.styles = {
      node: {
        baseSize: 7,
        radius: 1.5,
        borderWidth: 1.0,
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
        borderColor: 'rgba(150, 150, 150, 0.6)',
        dash: [3, 3]
      },
      border: {
        normal: 'rgba(255, 255, 255, 0.6)',
        hover: 'rgba(255, 255, 255, 0.9)',
        selected: '#ffff00'
      }
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
    
    // 先绘制外部星系
    if (data.externalSystems) {
      for (const system of data.externalSystems) {
        this._drawExternalSystem(system);
      }
    }
    
    // 再绘制本星域星系
    for (const system of data.systems) {
      this._drawSystem(system);
    }
  }
  
  /**
   * 绘制单个星系
   */
  _drawSystem(system) {
    const { ctx } = this;
    const style = this.styles.node;
    const size = this.getScaledSize(style.baseSize);
    const halfSize = size / 2;
    const radius = style.radius * (size / style.baseSize);
    
    const pos = this.worldToScreen(system.position2D);
    const isHovered = this.hoveredSystem === system;
    const isSelected = this.selectedSystem === system;
    
    // 颜色
    let color;
    if (system.isWormhole || system.id >= 31000000) {
      color = style.colors.wormhole;
    } else {
      color = style.colors[system.securityClass] || style.colors.null;
    }
    
    // 入口星系发光
    if (system.isBorder) {
      this._drawBorderGlow(pos, halfSize);
    }
    
    // 悬停/选中发光
    if (isHovered || isSelected) {
      this._drawSelectionGlow(pos, halfSize, isSelected);
    }
    
    // 填充
    ctx.fillStyle = color;
    this.drawRoundedRect(pos.x - halfSize, pos.y - halfSize, size, size, radius);
    ctx.fill();
    
    // 边框
    ctx.strokeStyle = isSelected ? this.styles.border.selected : 
                      (isHovered ? this.styles.border.hover : this.styles.border.normal);
    ctx.lineWidth = isSelected ? this.getScaledSize(2.5) : this.getScaledSize(style.borderWidth);
    this.drawRoundedRect(pos.x - halfSize, pos.y - halfSize, size, size, radius);
    ctx.stroke();
  }
  
  /**
   * 绘制外部星系
   */
  _drawExternalSystem(system) {
    const { ctx } = this;
    const style = this.styles.externalNode;
    const size = this.getScaledSize(style.baseSize);
    const halfSize = size / 2;
    const radius = style.radius * (size / style.baseSize);
    
    const pos = this.worldToScreen(system.position2D);
    
    // 清除背景
    ctx.fillStyle = '#0a0808';
    const clearSize = size + this.getScaledSize(2);
    this.drawRoundedRect(pos.x - clearSize/2, pos.y - clearSize/2, clearSize, clearSize, radius);
    ctx.fill();
    
    // 绘制节点
    ctx.fillStyle = 'rgba(150, 150, 150, 0.15)';
    ctx.strokeStyle = style.borderColor;
    ctx.lineWidth = this.getScaledSize(style.borderWidth);
    ctx.setLineDash(style.dash.map(d => d * (size / style.baseSize)));
    
    this.drawRoundedRect(pos.x - halfSize, pos.y - halfSize, size, size, radius);
    ctx.fill();
    ctx.stroke();
    
    ctx.setLineDash([]);
  }
  
  /**
   * 绘制入口星系发光
   */
  _drawBorderGlow(pos, halfSize) {
    const { ctx } = this;
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
  
  /**
   * 绘制选中/悬停发光
   */
  _drawSelectionGlow(pos, halfSize, isSelected) {
    const { ctx } = this;
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
}
