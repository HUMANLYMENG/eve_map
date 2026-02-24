#!/usr/bin/env python3
"""
EVE Regional Map - Python 桥接服务
为浏览器版本提供文件系统访问能力
"""

import http.server
import socketserver
import json
import os
import glob
import re
import urllib.parse
from pathlib import Path

PORT = 8080

# 默认 EVE 日志路径
def get_default_log_path():
    home = Path.home()
    if os.name == 'nt':  # Windows
        return str(home / 'Documents' / 'EVE' / 'logs' / 'Chatlogs')
    elif os.name == 'darwin':  # macOS
        return str(home / 'Library' / 'Application Support' / 'EVE Online' / 'logs' / 'Chatlogs')
    else:  # Linux
        return str(home / '.eve' / 'logs' / 'Chatlogs')

# 读取 EVE 日志文件（支持 UTF-16 LE BOM）
def read_eve_log_file(file_path):
    with open(file_path, 'rb') as f:
        buffer = f.read()
    
    # 检测 BOM
    if len(buffer) >= 2 and buffer[0] == 0xFF and buffer[1] == 0xFE:
        # UTF-16 LE with BOM
        return buffer[2:].decode('utf-16-le')
    elif len(buffer) >= 3 and buffer[0] == 0xEF and buffer[1] == 0xBB and buffer[2] == 0xBF:
        # UTF-8 with BOM
        return buffer[3:].decode('utf-8')
    else:
        # 尝试 UTF-16 LE 或 UTF-8
        try:
            return buffer.decode('utf-16-le')
        except:
            return buffer.decode('utf-8')

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory='.', **kwargs)
    
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()
    
    def do_GET(self):
        # API 路由
        if self.path == '/api/default-log-path':
            self.send_json({'path': get_default_log_path()})
            return
        
        elif self.path.startswith('/api/scan-directory'):
            query = self.path.split('?')[1] if '?' in self.path else ''
            params = {}
            for param in query.split('&'):
                if '=' in param:
                    k, v = param.split('=', 1)
                    params[k] = urllib.parse.unquote(v)  # URL 解码
            
            dir_path = params.get('path', '')
            print(f'[API] 扫描目录: {dir_path}')
            
            if not dir_path:
                self.send_json({'success': False, 'error': '路径为空'})
                return
            
            if not os.path.exists(dir_path):
                self.send_json({'success': False, 'error': f'路径不存在: {dir_path}'})
                return
            
            try:
                files = []
                from datetime import datetime
                
                today = datetime.now().strftime('%Y%m%d')
                print(f'[API] 今天的日期: {today}')
                
                # 只扫描当天的 Local 文件
                all_entries = os.listdir(dir_path)
                local_files = [e for e in all_entries if re.match(rf'^(Local|本地)_{today}_.+\.txt$', e, re.IGNORECASE)]
                
                print(f'[API] 找到 {len(local_files)} 个当天的 Local 文件')
                
                # 按修改时间排序（最新的在前）
                local_files.sort(key=lambda x: os.path.getmtime(os.path.join(dir_path, x)), reverse=True)
                
                for entry in local_files:
                    file_path = os.path.join(dir_path, entry)
                    try:
                        content = read_eve_log_file(file_path)
                        # 提取角色名
                        role_name = None
                        for line in content.split('\n')[:20]:  # 只检查前20行
                            if 'Listener:' in line:
                                role_name = line.split('Listener:')[1].strip()
                                break
                        
                        if role_name:
                            files.append({
                                'name': entry,
                                'path': file_path,
                                'content': content,
                                'roleName': role_name
                            })
                            print(f'[API] 找到角色: {role_name}')
                    except Exception as e:
                        print(f'读取文件失败: {entry}, {e}')
                
                self.send_json({'success': True, 'files': files})
            except Exception as e:
                self.send_json({'success': False, 'error': str(e)})
            return
        
        elif self.path.startswith('/api/read-file'):
            query = self.path.split('?')[1] if '?' in self.path else ''
            params = {}
            for param in query.split('&'):
                if '=' in param:
                    k, v = param.split('=', 1)
                    params[k] = urllib.parse.unquote(v)  # URL 解码
            
            file_path = params.get('path', '')
            print(f'[API] 读取文件: {file_path}')
            
            if not file_path:
                self.send_json({'success': False, 'error': '路径为空'})
                return
            
            if not os.path.exists(file_path):
                print(f'[API] 文件不存在: {file_path}')
                self.send_json({'success': False, 'error': f'文件不存在: {file_path}'})
                return
            
            try:
                content = read_eve_log_file(file_path)
                print(f'[API] 成功读取文件，内容长度: {len(content)}')
                self.send_json({'success': True, 'content': content})
            except Exception as e:
                error_msg = str(e)
                print(f'[API] 读取文件失败: {error_msg}')
                self.send_json({'success': False, 'error': error_msg})
            return
        
        # 静态文件服务
        super().do_GET()
    
    def send_json(self, data):
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))

def main():
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"=" * 50)
        print(f"EVE Regional Map - Python Bridge")
        print(f"=" * 50)
        print(f"服务器运行在: http://localhost:{PORT}")
        print(f"默认日志路径: {get_default_log_path()}")
        print(f"=" * 50)
        print(f"按 Ctrl+C 停止服务器")
        print(f"=" * 50)
        httpd.serve_forever()

if __name__ == '__main__':
    main()
