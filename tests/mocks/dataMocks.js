/**
 * 测试数据 Mock
 * 提供各种测试场景的数据
 */

// 模拟星系数据
export const mockSystems = [
  {
    id: 30005008,
    name: '耶舒尔',
    nameEn: 'Yeeshur',
    constellationID: 20000647,
    regionID: 10000064,
    securityStatus: 0.7,
    securityClass: 'high',
    position2D: { x: 1.0e16, y: 2.0e16 },
    stargateIDs: [50005008],
    isBorder: true,
    isHub: false,
    isRegional: false,
    isInternational: false,
    borderConnections: [{
      systemId: 30005010,
      systemName: '相邻星系',
      regionId: 10000065,
      regionName: '测试星域'
    }]
  },
  {
    id: 30005009,
    name: '测试星系B',
    nameEn: 'Test System B',
    constellationID: 20000647,
    regionID: 10000064,
    securityStatus: 0.3,
    securityClass: 'low',
    position2D: { x: 1.5e16, y: 2.5e16 },
    stargateIDs: [50005009],
    isBorder: false,
    isHub: false,
    borderConnections: []
  },
  {
    id: 30005010,
    name: '00区测试',
    nameEn: 'Null Test',
    constellationID: 20000648,
    regionID: 10000065,
    securityStatus: -0.2,
    securityClass: 'null',
    position2D: { x: 3.0e16, y: 4.0e16 },
    stargateIDs: [50005010],
    isBorder: true,
    isHub: false,
    borderConnections: []
  }
];

// 模拟星域数据
export const mockRegions = [
  {
    id: 10000064,
    name: '金纳泽',
    nameEn: 'Genesis',
    description: { zh: '测试星域', en: 'Test Region' },
    constellationIDs: [20000647],
    factionID: 500001,
    systems: [30005008, 30005009]
  },
  {
    id: 10000065,
    name: '测试星域2',
    nameEn: 'Test Region 2',
    description: { zh: '测试星域2', en: 'Test Region 2' },
    constellationIDs: [20000648],
    factionID: 500002,
    systems: [30005010]
  }
];

// 模拟星座数据
export const mockConstellations = [
  {
    id: 20000647,
    name: '测试星座',
    nameEn: 'Test Constellation',
    regionID: 10000064,
    systemIDs: [30005008, 30005009]
  }
];

// 模拟星门连接
export const mockConnections = new Map([
  [30005008, [30005009, 30005010]],  // 耶舒尔 连接到 B 和 00区
  [30005009, [30005008]],             // B 连接到 耶舒尔
  [30005010, [30005008]]              // 00区 连接到 耶舒尔
]);

// 模拟虫洞星系
export const mockWormholeSystems = [
  {
    id: 31000001,
    name: 'J100001',
    nameEn: 'J100001',
    constellationID: 21000001,
    regionID: 11000001,
    securityStatus: -0.99,
    securityClass: 'null',
    position2D: { x: 5.0e16, y: 5.0e16 },
    isWormhole: true
  }
];

// 模拟星域边界数据
export const mockRegionData = {
  region: mockRegions[0],
  systems: [mockSystems[0], mockSystems[1]],
  borderSystems: [mockSystems[0]],
  externalSystems: [{
    ...mockSystems[2],
    isExternal: true,
    connectedFrom: 30005008,
    connectedFromName: '耶舒尔',
    position2D: { x: 1.2e16, y: 2.2e16 }  // 虚拟位置
  }],
  bounds: {
    minX: 1.0e16,
    maxX: 1.5e16,
    minY: 2.0e16,
    maxY: 2.5e16,
    width: 0.5e16,
    height: 0.5e16,
    centerX: 1.25e16,
    centerY: 2.25e16
  },
  internalConnections: [{
    from: 30005008,
    to: 30005009,
    fromPos: { x: 1.0e16, y: 2.0e16 },
    toPos: { x: 1.5e16, y: 2.5e16 }
  }],
  externalConnections: [{
    from: 30005008,
    to: 30005010,
    fromPos: { x: 1.0e16, y: 2.0e16 },
    toPos: { x: 1.2e16, y: 2.2e16 },
    targetRegion: 10000065,
    targetRegionName: '测试星域2',
    targetSystem: '00区测试'
  }]
};

// 虫洞类型列表（用于测试）
export const mockWormholeTypes = [
  'K162', 'C247', 'H296', 'X702', 'N110'
];

// 模拟 EVE Scout API 响应
export const mockEveScoutResponse = [
  {
    id: 12345,
    signature_type: 'wormhole',
    in_system_id: 30005008,
    in_system_name: 'Yeeshur',
    out_system_id: 31000001,
    out_system_name: 'J100001',
    in_signature: 'ABC-123',
    out_signature: 'XYZ-789',
    wh_type: 'C247',
    max_ship_size: 'large',
    remaining_hours: 20,
    expires_at: new Date(Date.now() + 20 * 3600 * 1000).toISOString(),
    created_at: new Date().toISOString(),
    created_by_name: 'TestPilot',
    in_system_class: 4,
    in_region_name: 'Genesis',
    wh_exits_outward: true
  }
];
