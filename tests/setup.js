/**
 * 测试环境设置
 */

// 全局测试数据
global.TEST_DATA = {
  systems: new Map([
    [30005008, {
      id: 30005008,
      name: '耶舒尔',
      nameEn: 'Yeeshur',
      regionID: 10000064,
      securityStatus: 0.7,
      securityClass: 'high',
      position2D: { x: 1e16, y: 2e16 },
      isBorder: true,
      borderConnections: []
    }],
    [30005009, {
      id: 30005009,
      name: '测试星系B',
      nameEn: 'Test System B',
      regionID: 10000064,
      securityStatus: 0.3,
      securityClass: 'low',
      position2D: { x: 1.5e16, y: 2.5e16 },
      isBorder: false,
      borderConnections: []
    }]
  ]),
  
  regions: new Map([
    [10000064, {
      id: 10000064,
      name: '金纳泽',
      nameEn: 'Genesis',
      systems: [30005008, 30005009]
    }]
  ]),
  
  connections: new Map([
    [30005008, [30005009]],
    [30005009, [30005008]]
  ])
};

// 清理全局状态
beforeEach(() => {
  // 每个测试前的清理工作
});

afterEach(() => {
  // 每个测试后的清理工作
  vi.clearAllMocks();
});
