/**
 * 全局配置常量
 */

// 虫洞类型列表
export const WORMHOLE_TYPES = [
  'A009', 'A239', 'A641', 'A982', 'B041', 'B274', 'B449', 'B520', 'B735',
  'C008', 'C125', 'C140', 'C247', 'C248', 'C391', 'C414', 'C729', 'D364',
  'D382', 'D792', 'D845', 'E004', 'E175', 'E545', 'E587', 'F135', 'F216',
  'F355', 'G008', 'G024', 'H121', 'H296', 'H900', 'I182', 'J244', 'J377',
  'J492', 'K162', 'K329', 'K346', 'L005', 'L031', 'L477', 'L614', 'M001',
  'M164', 'M267', 'M555', 'M609', 'N062', 'N110', 'N290', 'N432', 'N766',
  'N770', 'N944', 'N968', 'O128', 'O477', 'O883', 'P060', 'Q003', 'Q063',
  'Q317', 'R051', 'R081', 'R259', 'R474', 'R943', 'S047', 'S199', 'S804',
  'S877', 'T405', 'T458', 'U210', 'U319', 'U372', 'U574', 'V283', 'V301',
  'V753', 'V898', 'V911', 'V928', 'W237', 'X450', 'X702', 'X877', 'Y683',
  'Y790', 'Z006', 'Z060', 'Z142', 'Z457', 'Z647', 'Z971'
];

// 安全等级分类阈值
export const SECURITY_THRESHOLDS = {
  HIGH: 0.5,
  LOW: 0.1
};

// 路径显示最大数量
export const PATH_MAX_DISPLAY = 6;

// 虫洞寿命（毫秒）
export const WORMHOLE_LIFETIME = {
  '1h': 1 * 60 * 60 * 1000,
  '4h': 4 * 60 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000,
  '2d': 48 * 60 * 60 * 1000
};

// EVE Scout API 配置
export const EVESCOUT_CONFIG = {
  API_URL: 'https://api.eve-scout.com/v2/public/signatures',
  CACHE_DURATION: 5 * 60 * 1000, // 5分钟
  TIMEOUT: 30000 // 30秒
};

// 渲染配置
export const RENDER_CONFIG = {
  DEFAULT_ZOOM: 1e-14,
  MIN_ZOOM_RATIO: 0.9,  // 90%
  MAX_ZOOM_RATIO: 9.0,  // 900%
  HIT_RADIUS: 25,       // 点击命中半径（像素）
  GRID_SIZE: 200,       // 网格大小
  EXTERNAL_DISTANCE_MIN: 0.06,  // 外部星系最小距离（相对于星域大小）
  EXTERNAL_DISTANCE_MAX: 0.10   // 外部星系最大距离
};

// 默认星域ID（金纳泽）
export const DEFAULT_REGION_ID = 10000064;

// 默认星系ID（耶舒尔）
export const DEFAULT_SYSTEM_ID = 30005008;
