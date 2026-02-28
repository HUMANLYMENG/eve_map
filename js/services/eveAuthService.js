/**
 * EVE Online SSO 认证服务
 * 实现 PKCE 流程，支持桌面应用
 */

class EveAuthService {
    constructor() {
        this.clientId = '76334ad33b43464caedc8f611ab78544';
        this.clientSecret = '[REMOVED_EVE_SECRET]';
        this.redirectUri = 'http://localhost:8080/callback';  // 统一回调 URL（浏览器和 Electron兼用）
        this.scopes = [
            'publicData',
            'esi-location.read_location.v1',
            'esi-characters.read_corporation_roles.v1'
        ];
        
        this.authBaseUrl = 'https://login.eveonline.com/v2/oauth/authorize';
        this.tokenUrl = 'https://login.eveonline.com/v2/oauth/token';
        
        // 存储当前认证状态
        this.codeVerifier = null;
        this.state = null;
        this.tokens = null;
    }

    /**
     * 生成 PKCE code_verifier
     * 32字节随机数，base64url编码
     */
    generateCodeVerifier() {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return this.base64URLEncode(array);
    }

    /**
     * 计算 PKCE code_challenge
     * code_challenge = base64url(SHA256(code_verifier))
     */
    async generateCodeChallenge(codeVerifier) {
        const encoder = new TextEncoder();
        const data = encoder.encode(codeVerifier);
        const hash = await crypto.subtle.digest('SHA-256', data);
        return this.base64URLEncode(new Uint8Array(hash));
    }

    /**
     * base64url 编码（去除 padding）
     */
    base64URLEncode(buffer) {
        const base64 = btoa(String.fromCharCode(...buffer));
        return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    }

    /**
     * 生成随机 state 防 CSRF
     */
    generateState() {
        const array = new Uint8Array(16);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }

    /**
     * 构建授权 URL
     */
    async buildAuthUrl() {
        this.codeVerifier = this.generateCodeVerifier();
        this.state = this.generateState();
        
        const codeChallenge = await this.generateCodeChallenge(this.codeVerifier);
        
        const params = new URLSearchParams({
            response_type: 'code',
            redirect_uri: this.redirectUri,
            client_id: this.clientId,
            scope: this.scopes.join(' '),
            code_challenge: codeChallenge,
            code_challenge_method: 'S256',
            state: this.state
        });
        
        return `${this.authBaseUrl}/?${params.toString()}`;
    }

    /**
     * 启动认证流程
     * 返回 Promise，解析后获得角色信息
     */
    async authenticate() {
        try {
            const authUrl = await this.buildAuthUrl();
            console.log('[EVE Auth] 授权 URL:', authUrl);
            
            // 打开系统浏览器进行认证
            this.openBrowser(authUrl);
            
            // 启动本地服务器接收回调
            const authCode = await this.startCallbackServer();
            
            // 换取 access token
            await this.exchangeCodeForToken(authCode);
            
            // 获取角色信息
            const characterInfo = await this.getCharacterInfo();
            
            return {
                success: true,
                character: characterInfo,
                tokens: this.tokens
            };
            
        } catch (error) {
            console.error('[EVE Auth] 认证失败:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 打开浏览器（桌面应用中使用 shell.openExternal）
     * 浏览器环境中使用 window.open
     */
    openBrowser(url) {
        if (typeof require !== 'undefined') {
            // Electron 环境
            const { shell } = require('electron');
            shell.openExternal(url);
        } else {
            // 浏览器环境
            window.open(url, '_blank', 'width=800,height=600');
        }
    }

    /**
     * 启动本地 HTTP 服务器接收回调
     * 简化版本：使用轮询检测 localStorage 或 popup 通信
     */
    startCallbackServer() {
        return new Promise((resolve, reject) => {
            // 创建回调监听页面
            const popup = window.open('', 'eve-auth-callback', 'width=400,height=300');
            
            // 监听消息
            const messageHandler = (event) => {
                if (event.origin !== window.location.origin) return;
                
                if (event.data.type === 'EVE_AUTH_CALLBACK') {
                    window.removeEventListener('message', messageHandler);
                    
                    const { code, state, error } = event.data;
                    
                    if (error) {
                        reject(new Error(`EVE SSO Error: ${error}`));
                        return;
                    }
                    
                    if (state !== this.state) {
                        reject(new Error('State mismatch - possible CSRF attack'));
                        return;
                    }
                    
                    resolve(code);
                }
            };
            
            window.addEventListener('message', messageHandler);
            
            // 设置超时
            setTimeout(() => {
                window.removeEventListener('message', messageHandler);
                reject(new Error('Authentication timeout'));
            }, 5 * 60 * 1000); // 5分钟超时
        });
    }

    /**
     * 处理回调（从回调页面调用）
     */
    handleCallback(code, state, error = null) {
        // 发送消息给父窗口
        if (window.opener) {
            window.opener.postMessage({
                type: 'EVE_AUTH_CALLBACK',
                code,
                state,
                error
            }, window.location.origin);
        }
    }

    /**
     * 用授权码换取 access token
     */
    async exchangeCodeForToken(code) {
        const params = new URLSearchParams({
            grant_type: 'authorization_code',
            code: code,
            client_id: this.clientId,
            code_verifier: this.codeVerifier
        });
        
        const response = await fetch(this.tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Host': 'login.eveonline.com'
            },
            body: params.toString()
        });
        
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Token exchange failed: ${error}`);
        }
        
        this.tokens = await response.json();
        console.log('[EVE Auth] Token 获取成功');
        
        return this.tokens;
    }

    /**
     * 从 JWT token 解码 character_id
     */
    getCharacterIdFromToken() {
        if (!this.tokens || !this.tokens.access_token) {
            throw new Error('No access token available');
        }
        
        try {
            // JWT 格式: header.payload.signature
            const parts = this.tokens.access_token.split('.');
            if (parts.length !== 3) {
                throw new Error('Invalid JWT format');
            }
            
            // base64url 解码 (EVE 使用 base64url)
            const payload = parts[1];
            const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
            const decoded = JSON.parse(atob(base64));
            
            console.log('[EVE Auth] JWT 解码:', decoded);
            
            // EVE 的 JWT 中 sub 字段格式为: CHARACTER:EVE:12345678
            // 需要提取数字部分
            const sub = decoded.sub;
            const match = sub.match(/(\d+)$/);
            if (!match) {
                throw new Error(`Invalid character ID format: ${sub}`);
            }
            
            return parseInt(match[1], 10);
        } catch (e) {
            console.error('[EVE Auth] JWT 解码失败:', e);
            throw new Error('Failed to decode JWT token');
        }
    }

    /**
     * 获取角色公开信息
     */
    async getCharacterInfo() {
        const characterId = this.getCharacterIdFromToken();
        
        console.log('[EVE Auth] 查询角色 ID:', characterId);
        
        // 1. 获取角色基本信息
        const charUrl = `https://esi.evetech.net/v5/characters/${characterId}/`;
        const charResponse = await fetch(charUrl, {
            headers: { 'Accept': 'application/json' }
        });
        
        if (!charResponse.ok) {
            const errorText = await charResponse.text();
            console.error('[EVE Auth] ESI 错误:', charResponse.status, errorText);
            throw new Error(`Failed to fetch character info: ${charResponse.status} - ${errorText}`);
        }
        
        const info = await charResponse.json();
        info.character_id = characterId;
        
        // 2. 获取军团信息
        if (info.corporation_id) {
            try {
                const corpInfo = await this.getCorporationInfo(info.corporation_id);
                info.corporation = corpInfo;
            } catch (e) {
                console.warn('[EVE Auth] 获取军团信息失败:', e.message);
                info.corporation = { name: 'Unknown', id: info.corporation_id };
            }
        }
        
        // 3. 获取联盟信息
        if (info.corporation?.alliance_id) {
            try {
                const allianceInfo = await this.getAllianceInfo(info.corporation.alliance_id);
                info.alliance = allianceInfo;
                
                // 检测联盟ID是否是 495729389
                info.is_target_alliance = info.corporation.alliance_id === 495729389;
            } catch (e) {
                console.warn('[EVE Auth] 获取联盟信息失败:', e.message);
                info.alliance = { name: 'Unknown', id: info.corporation.alliance_id };
                info.is_target_alliance = false;
            }
        } else {
            info.is_target_alliance = false;
        }
        
        console.log('[EVE Auth] 角色完整信息:', info);
        
        return info;
    }
    
    /**
     * 获取军团信息
     */
    async getCorporationInfo(corporationId) {
        const url = `https://esi.evetech.net/v5/corporations/${corporationId}/`;
        
        const response = await fetch(url, {
            headers: { 'Accept': 'application/json' }
        });
        
        if (!response.ok) {
            throw new Error(`Failed to fetch corporation info: ${response.status}`);
        }
        
        return response.json();
    }
    
    /**
     * 获取联盟信息
     */
    async getAllianceInfo(allianceId) {
        const url = `https://esi.evetech.net/v5/alliances/${allianceId}/`;
        
        const response = await fetch(url, {
            headers: { 'Accept': 'application/json' }
        });
        
        if (!response.ok) {
            throw new Error(`Failed to fetch alliance info: ${response.status}`);
        }
        
        return response.json();
    }

    /**
     * 获取角色当前位置（需要 location scope）
     */
    async getCharacterLocation() {
        const characterId = this.getCharacterIdFromToken();
        
        const response = await fetch(`https://esi.evetech.net/v1/characters/${characterId}/location/`, {
            headers: {
                'Authorization': `Bearer ${this.tokens.access_token}`,
                'Accept': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Failed to fetch location: ${response.status}`);
        }
        
        return response.json();
    }

    /**
     * 刷新 access token
     */
    async refreshToken() {
        if (!this.tokens || !this.tokens.refresh_token) {
            throw new Error('No refresh token available');
        }
        
        const params = new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: this.tokens.refresh_token,
            client_id: this.clientId
        });
        
        const response = await fetch(this.tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Host': 'login.eveonline.com'
            },
            body: params.toString()
        });
        
        if (!response.ok) {
            throw new Error('Token refresh failed');
        }
        
        this.tokens = await response.json();
        return this.tokens;
    }
}

// 导出服务
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EveAuthService;
}
