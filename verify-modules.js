/**
 * 模块验证脚本
 * 用于检查所有模块是否正确导出
 */

// 核心模块测试
async function testCoreModules() {
    console.log('=== 测试核心模块 ===');
    
    try {
        const core = await import('./js/core/index.js');
        
        // 检查配置
        console.assert(core.WORMHOLE_TYPES.length === 99, 'WORMHOLE_TYPES 数量不正确');
        console.assert(typeof core.getSecurityClass === 'function', 'getSecurityClass 不存在');
        console.assert(typeof core.debounce === 'function', 'debounce 不存在');
        console.assert(typeof core.EventBus === 'function', 'EventBus 不存在');
        
        // 测试功能
        const bus = new core.EventBus();
        let called = false;
        bus.on('test', () => called = true);
        bus.emit('test');
        console.assert(called, 'EventBus 未正常工作');
        
        console.log('✓ 核心模块测试通过');
        return true;
    } catch (error) {
        console.error('✗ 核心模块测试失败:', error);
        return false;
    }
}

// 功能模块测试
async function testFeatureModules() {
    console.log('=== 测试功能模块 ===');
    
    try {
        const features = await import('./js/features/index.js');
        
        console.assert(typeof features.WormholeRecord === 'function', 'WormholeRecord 不存在');
        console.assert(typeof features.PathRecorder === 'function', 'PathRecorder 不存在');
        console.assert(typeof features.WormholeManager === 'function', 'WormholeManager 不存在');
        console.assert(typeof features.PathManager === 'function', 'PathManager 不存在');
        console.assert(typeof features.SearchManager === 'function', 'SearchManager 不存在');
        
        // 测试虫洞记录
        const record = new features.WormholeRecord({
            fromSystem: 'A',
            toSystem: 'B',
            type: 'K162',
            size: 'L',
            maxLife: '1d'
        });
        console.assert(record.fromSystem === 'A', 'WormholeRecord 属性错误');
        
        // 测试路径记录器
        const recorder = new features.PathRecorder();
        recorder.addSystem({ id: 1, name: 'Test', regionID: 100 });
        recorder.addSystem({ id: 2, name: 'Test2', regionID: 100 });
        console.assert(recorder.getDisplayPath().length === 2, 'PathRecorder 未正常工作');
        
        console.log('✓ 功能模块测试通过');
        return true;
    } catch (error) {
        console.error('✗ 功能模块测试失败:', error);
        return false;
    }
}

// 数据模块测试
async function testDataModules() {
    console.log('=== 测试数据模块 ===');
    
    try {
        const data = await import('./js/data/index.js');
        
        console.assert(typeof data.DataLoader === 'function', 'DataLoader 不存在');
        console.assert(typeof data.SystemsManager === 'function', 'SystemsManager 不存在');
        console.assert(typeof data.RegionsManager === 'function', 'RegionsManager 不存在');
        console.assert(typeof data.ConnectionsManager === 'function', 'ConnectionsManager 不存在');
        
        // 测试 SystemsManager
        const systems = new data.SystemsManager();
        systems.process({
            30000001: {
                name: { zh: '测试' },
                regionID: 10000001,
                securityStatus: 0.5,
                position2D: { x: 1e16, y: 2e16 }
            }
        });
        console.assert(systems.get(30000001)?.name === '测试', 'SystemsManager 未正常工作');
        
        console.log('✓ 数据模块测试通过');
        return true;
    } catch (error) {
        console.error('✗ 数据模块测试失败:', error);
        return false;
    }
}

// 渲染模块测试
async function testRendererModules() {
    console.log('=== 测试渲染模块 ===');
    
    try {
        const renderer = await import('./js/renderer/index.js');
        
        console.assert(typeof renderer.MapRenderer === 'function', 'MapRenderer 不存在');
        console.assert(typeof renderer.Viewport === 'function', 'Viewport 不存在');
        
        // 测试 Viewport
        const viewport = new renderer.Viewport(800, 600);
        console.assert(viewport.width === 800, 'Viewport 宽度错误');
        console.assert(viewport.height === 600, 'Viewport 高度错误');
        
        const screenPos = viewport.worldToScreen({ x: 0, y: 0 });
        console.assert(typeof screenPos.x === 'number', 'worldToScreen 返回类型错误');
        
        console.log('✓ 渲染模块测试通过');
        return true;
    } catch (error) {
        console.error('✗ 渲染模块测试失败:', error);
        return false;
    }
}

// 应用模块测试
async function testAppModule() {
    console.log('=== 测试应用模块 ===');
    
    try {
        const { RegionalMapApp } = await import('./js/app.js');
        console.assert(typeof RegionalMapApp === 'function', 'RegionalMapApp 不存在');
        
        // 检查方法存在性
        const app = new RegionalMapApp();
        console.assert(typeof app.init === 'function', 'init 方法不存在');
        console.assert(typeof app.selectRegion === 'function', 'selectRegion 方法不存在');
        console.assert(typeof app.clearPath === 'function', 'clearPath 方法不存在');
        
        console.log('✓ 应用模块测试通过');
        return true;
    } catch (error) {
        console.error('✗ 应用模块测试失败:', error);
        return false;
    }
}

// 运行所有测试
async function runAllTests() {
    console.log('开始模块验证...\n');
    
    const results = await Promise.all([
        testCoreModules(),
        testFeatureModules(),
        testDataModules(),
        testRendererModules(),
        testAppModule()
    ]);
    
    console.log('\n=== 测试结果 ===');
    const allPassed = results.every(r => r);
    
    if (allPassed) {
        console.log('✓ 所有模块测试通过！');
    } else {
        console.log('✗ 部分模块测试失败');
        process.exit(1);
    }
}

// 在 Node.js 环境中运行
if (typeof window === 'undefined') {
    runAllTests().catch(console.error);
}

export { runAllTests };
