/**
 * EVE SSO 测试服务器
 * 运行此脚本启动本地 HTTP 服务器，用于测试 EVE SSO 回调
 * 
 * 使用方法:
 *   node test-server.js
 * 然后访问: http://localhost:8000/test-eve-auth.html
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8000;
const HOST = 'localhost';

// MIME 类型映射
const mimeTypes = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    
    // 解析 URL
    let urlPath = req.url;
    
    // 处理回调 URL（带查询参数）
    if (urlPath.includes('?')) {
        urlPath = urlPath.split('?')[0];
    }
    
    // 默认访问 test-eve-auth.html
    if (urlPath === '/') {
        urlPath = '/test-eve-auth.html';
    }
    
    // EVE SSO 回调路径映射
    if (urlPath === '/callback') {
        urlPath = '/callback.html';
    }
    
    // 构建文件路径
    let filePath = path.join(__dirname, urlPath);
    
    // 检查文件扩展名
    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    
    // 读取文件
    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                // 文件不存在
                console.error(`404 - File not found: ${filePath}`);
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end(`
                    <!DOCTYPE html>
                    <html>
                    <head><title>404 Not Found</title></head>
                    <body style="font-family: sans-serif; text-align: center; padding: 50px;">
                        <h1>404 - File Not Found</h1>
                        <p>The requested file <code>${req.url}</code> was not found.</p>
                        <p><a href="/">Go to test page</a></p>
                    </body>
                    </html>
                `);
            } else {
                // 服务器错误
                console.error(`500 - Server error: ${err.message}`);
                res.writeHead(500, { 'Content-Type': 'text/html' });
                res.end(`
                    <!DOCTYPE html>
                    <html>
                    <head><title>500 Server Error</title></head>
                    <body style="font-family: sans-serif; text-align: center; padding: 50px;">
                        <h1>500 - Server Error</h1>
                        <p>${err.message}</p>
                    </body>
                    </html>
                `);
            }
        } else {
            // 成功返回文件
            res.writeHead(200, { 
                'Content-Type': contentType,
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            });
            res.end(content);
        }
    });
});

server.listen(PORT, HOST, () => {
    console.log(`
╔════════════════════════════════════════════════╗
║  EVE SSO 测试服务器已启动                      ║
╠════════════════════════════════════════════════╣
║  访问地址: http://${HOST}:${PORT}/test-eve-auth.html  ║
║  回调 URL: http://${HOST}:${PORT}/eve-callback.html    ║
╠════════════════════════════════════════════════╣
║  按 Ctrl+C 停止服务器                          ║
╚════════════════════════════════════════════════╝
    `);
});

// 处理异常关闭
process.on('SIGINT', () => {
    console.log('\n\n正在关闭服务器...');
    server.close(() => {
        console.log('服务器已关闭');
        process.exit(0);
    });
});
