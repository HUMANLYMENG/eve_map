/**
 * Canvas 2D 上下文 Mock
 * 用于测试渲染相关功能
 */

export class CanvasRenderingContext2DMock {
  constructor() {
    this.canvas = { width: 800, height: 600 };
    this.fillStyle = '#000000';
    this.strokeStyle = '#000000';
    this.lineWidth = 1;
    this.globalAlpha = 1;
    this.shadowColor = 'transparent';
    this.shadowBlur = 0;
    this.shadowOffsetX = 0;
    this.shadowOffsetY = 0;
    this.textAlign = 'start';
    this.textBaseline = 'alphabetic';
    this.font = '10px sans-serif';
    this.lineDash = [];
    
    // 记录所有绘制操作
    this.operations = [];
    this.path = [];
  }
  
  // 路径方法
  beginPath() {
    this.path = [];
    this._record('beginPath');
  }
  
  moveTo(x, y) {
    this.path.push({ type: 'moveTo', x, y });
    this._record('moveTo', { x, y });
  }
  
  lineTo(x, y) {
    this.path.push({ type: 'lineTo', x, y });
    this._record('lineTo', { x, y });
  }
  
  arc(x, y, radius, startAngle, endAngle) {
    this._record('arc', { x, y, radius, startAngle, endAngle });
  }
  
  closePath() {
    this._record('closePath');
  }
  
  quadraticCurveTo(cpx, cpy, x, y) {
    this._record('quadraticCurveTo', { cpx, cpy, x, y });
  }
  
  // 绘制方法
  fill() {
    this._record('fill');
  }
  
  stroke() {
    this._record('stroke');
  }
  
  fillRect(x, y, width, height) {
    this._record('fillRect', { x, y, width, height });
  }
  
  clearRect(x, y, width, height) {
    this._record('clearRect', { x, y, width, height });
  }
  
  fillText(text, x, y) {
    this._record('fillText', { text, x, y });
  }
  
  // 状态方法
  save() {
    this._record('save');
  }
  
  restore() {
    this._record('restore');
  }
  
  setTransform(a, b, c, d, e, f) {
    this._record('setTransform', { a, b, c, d, e, f });
  }
  
  scale(x, y) {
    this._record('scale', { x, y });
  }
  
  setLineDash(segments) {
    this.lineDash = segments;
    this._record('setLineDash', { segments });
  }
  
  createRadialGradient(x0, y0, r0, x1, y1, r1) {
    return {
      addColorStop: (offset, color) => {
        this._record('addColorStop', { offset, color });
      }
    };
  }
  
  // 工具方法
  _record(method, args = {}) {
    this.operations.push({ method, args, timestamp: Date.now() });
  }
  
  getOperations(method) {
    return this.operations.filter(op => op.method === method);
  }
  
  clearOperations() {
    this.operations = [];
  }
  
  hasDrawn(method) {
    return this.operations.some(op => op.method === method);
  }
}

export class HTMLCanvasElementMock {
  constructor(width = 800, height = 600) {
    this.width = width;
    this.height = height;
    this.style = { width: width + 'px', height: height + 'px' };
    this._context = null;
  }
  
  getContext(type) {
    if (type === '2d') {
      if (!this._context) {
        this._context = new CanvasRenderingContext2DMock();
        this._context.canvas = this;
      }
      return this._context;
    }
    return null;
  }
  
  getBoundingClientRect() {
    return {
      left: 0,
      top: 0,
      right: this.width,
      bottom: this.height,
      width: this.width,
      height: this.height
    };
  }
}

// 设置全局 Canvas
global.HTMLCanvasElement = HTMLCanvasElementMock;
