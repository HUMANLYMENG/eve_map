import os
import sys
import glob
import time
import sqlite3
import threading
import re
import json
import csv
import tkinter as tk
from tkinter import ttk, scrolledtext, messagebox
from datetime import datetime
from collections import defaultdict
import ctypes
from ctypes import wintypes

# ================= 配置常量 =================
def get_resource_path(relative_path):
    """获取资源文件的绝对路径（支持开发和打包环境）"""
    if hasattr(sys, '_MEIPASS'):
        # PyInstaller 打包后的临时目录
        return os.path.join(sys._MEIPASS, relative_path)
    return os.path.join(os.path.abspath("."), relative_path)

DB_PATH = get_resource_path('mapSolarSystems.db')
DEFAULT_LOG_PATH = os.path.join(os.path.expanduser('~'), 'Documents', 'EVE', 'logs', 'Chatlogs')
CONFIG_FILE = 'pixel_monitor_config.json'
RECORDS_FILE = 'pixel_monitor_records.json'
MAX_ROLES = 8  # 最多支持8个角色

# Windows API for pixel color detection
user32 = ctypes.windll.user32
gdi32 = ctypes.windll.gdi32


class EveMultiPixelMonitor:
    def __init__(self, root):
        self.root = root
        self.root.title("淘金队")
        self.root.geometry("1100x800")
        
        # 设置窗口图标
        try:
            icon_path = get_resource_path('gold_digger.ico')
            if os.path.exists(icon_path):
                self.root.iconbitmap(icon_path)
        except Exception:
            pass  # 图标设置失败不影响程序运行
        
        # --- 数据状态 ---
        self.system_cache = {}
        self.log_files_map = {}
        self.monitoring = False
        self.log_base_path = DEFAULT_LOG_PATH
        
        # 角色数据: {role_name: {file_path, current_system, position, color, last_trigger_time}}
        self.role_data = {}
        
        # 配置数据
        self.config = {
            'positions': [],  # [{'x': 100, 'y': 200}, ...]
            'roles': [],      # [{'name': '角色1', 'position_index': 0, 'target_color': '#RRGGBB'}, ...]
            'check_interval': 0.5,
            'cooldown': 5.0,  # 同一位置冷却时间（秒）
        }
        
        # 触发记录列表
        self.trigger_records = []
        
        # 加载数据库和配置
        self.load_database()
        self.load_config()
        self.load_records()
        
        # 构建UI
        self.setup_ui()
        
        # 扫描日志文件
        self.scan_log_files()
    
    def load_database(self):
        """加载星系数据库"""
        print("正在加载数据库...")
        try:
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            cursor.execute("SELECT solarSystemName, solarSystemNameZh, x, y, z FROM mapSolarSystems")
            rows = cursor.fetchall()
            for row in rows:
                en_name, zh_name, x, y, z = row
                coords = (x, y, z)
                if en_name:
                    self.system_cache[en_name] = coords
                if zh_name:
                    self.system_cache[zh_name] = coords
            conn.close()
            print(f"数据库加载完毕，缓存了 {len(rows)} 个星系数据。")
        except Exception as e:
            print(f"错误: 无法连接数据库 {e}")
    
    def load_config(self):
        """加载配置文件"""
        if os.path.exists(CONFIG_FILE):
            try:
                with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
                    loaded_config = json.load(f)
                    self.config.update(loaded_config)
                print(f"配置已加载: {CONFIG_FILE}")
            except Exception as e:
                print(f"加载配置失败: {e}")
    
    def save_config(self):
        """保存配置文件"""
        try:
            with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
                json.dump(self.config, f, indent=2, ensure_ascii=False)
            self.log_ui("配置已保存", "green")
        except Exception as e:
            self.log_ui(f"保存配置失败: {e}", "red")
    
    def load_records(self):
        """加载历史记录"""
        if os.path.exists(RECORDS_FILE):
            try:
                with open(RECORDS_FILE, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    for item in data:
                        item['time'] = datetime.fromisoformat(item['time'])
                    self.trigger_records = data
                print(f"记录已加载: {len(self.trigger_records)} 条")
            except Exception as e:
                print(f"加载记录失败: {e}")
                self.trigger_records = []
    
    def save_records(self):
        """保存记录到文件"""
        try:
            data = []
            for item in self.trigger_records:
                data.append({
                    'time': item['time'].isoformat(),
                    'role': item['role'],
                    'position': item['position'],
                    'system': item['system'],
                    'color': item['color'],
                    'target': item['target']
                })
            with open(RECORDS_FILE, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
        except Exception as e:
            print(f"保存记录失败: {e}")
    
    def scan_log_files(self):
        """扫描当前路径下的本地日志"""
        if not os.path.exists(self.log_base_path):
            self.log_ui(f"路径不存在: {self.log_base_path}", "red")
            return
        
        self.log_files_map.clear()
        
        files_en = glob.glob(os.path.join(self.log_base_path, "Local_*.txt"))
        files_zh = glob.glob(os.path.join(self.log_base_path, "本地_*.txt"))
        all_files = list(set(files_en + files_zh))
        files = sorted(all_files, key=os.path.getmtime, reverse=True)
        
        for file_path in files[:100]:
            try:
                with open(file_path, 'r', encoding='utf-16-le', errors='ignore') as f:
                    for _ in range(20):
                        line = f.readline()
                        if "Listener:" in line:
                            role = line.split("Listener:")[1].strip()
                            if role not in self.log_files_map:
                                self.log_files_map[role] = file_path
                            break
            except Exception:
                continue
        
        # 更新所有角色选择框
        roles = list(self.log_files_map.keys())
        for combo in self.role_combos:
            combo['values'] = roles
        
        self.log_ui(f"扫描完成，找到 {len(roles)} 个角色", "green")
        return roles
    
    def setup_ui(self):
        """构建用户界面"""
        # 创建 Notebook 标签页
        self.notebook = ttk.Notebook(self.root)
        self.notebook.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        
        # ===== 监控页面 =====
        frame_monitor = tk.Frame(self.notebook)
        self.notebook.add(frame_monitor, text="监控设置")
        
        # 顶部控制区
        frame_top = tk.Frame(frame_monitor, padx=10, pady=5)
        frame_top.pack(fill=tk.X)
        
        tk.Label(frame_top, text="日志路径:").pack(side=tk.LEFT)
        self.log_path_var = tk.StringVar(value=DEFAULT_LOG_PATH)
        tk.Entry(frame_top, textvariable=self.log_path_var, width=50).pack(side=tk.LEFT, padx=5)
        tk.Button(frame_top, text="浏览...", command=self.select_log_directory).pack(side=tk.LEFT)
        tk.Button(frame_top, text="刷新", command=self.refresh_logs).pack(side=tk.LEFT, padx=5)
        
        # 监控位置设置区
        frame_positions = tk.LabelFrame(frame_monitor, text="监控位置设置 (屏幕坐标)", padx=10, pady=5)
        frame_positions.pack(fill=tk.X, padx=10, pady=5)
        
        self.position_vars = []
        for i in range(4):  # 默认4个位置
            frame = tk.Frame(frame_positions)
            frame.pack(fill=tk.X, pady=2)
            
            tk.Label(frame, text=f"位置{i+1}:").pack(side=tk.LEFT)
            x_var = tk.StringVar(value=str(self.config['positions'][i]['x']) if i < len(self.config['positions']) else "0")
            y_var = tk.StringVar(value=str(self.config['positions'][i]['y']) if i < len(self.config['positions']) else "0")
            
            tk.Label(frame, text="X:").pack(side=tk.LEFT)
            tk.Entry(frame, textvariable=x_var, width=8).pack(side=tk.LEFT, padx=2)
            tk.Label(frame, text="Y:").pack(side=tk.LEFT)
            tk.Entry(frame, textvariable=y_var, width=8).pack(side=tk.LEFT, padx=2)
            
            btn_test = tk.Button(frame, text="拾取", command=lambda idx=i: self.pick_position(idx))
            btn_test.pack(side=tk.LEFT, padx=5)
            
            self.position_vars.append({'x': x_var, 'y': y_var})
        
        # 角色配置区
        frame_roles = tk.LabelFrame(frame_monitor, text="角色配置 (角色 -> 位置 -> 目标颜色)", padx=10, pady=5)
        frame_roles.pack(fill=tk.X, padx=10, pady=5)
        
        self.role_combos = []
        self.role_position_vars = []
        self.target_color_vars = []
        self.tolerance_vars = []
        
        for i in range(4):  # 默认4个角色
            frame = tk.Frame(frame_roles)
            frame.pack(fill=tk.X, pady=2)
            
            tk.Label(frame, text=f"角色{i+1}:").pack(side=tk.LEFT)
            
            role_var = tk.StringVar()
            combo = ttk.Combobox(frame, textvariable=role_var, width=15)
            combo.pack(side=tk.LEFT, padx=2)
            self.role_combos.append(combo)
            
            tk.Label(frame, text="-> 位置:").pack(side=tk.LEFT, padx=5)
            pos_var = tk.StringVar(value=str(self.config['roles'][i]['position_index'] + 1) if i < len(self.config['roles']) else str(i + 1))
            tk.Spinbox(frame, from_=1, to=4, textvariable=pos_var, width=5).pack(side=tk.LEFT)
            self.role_position_vars.append(pos_var)
            
            tk.Label(frame, text="目标颜色:").pack(side=tk.LEFT, padx=5)
            color_var = tk.StringVar(value=self.config['roles'][i]['target_color'] if i < len(self.config['roles']) else "#FF0000")
            tk.Entry(frame, textvariable=color_var, width=10).pack(side=tk.LEFT)
            self.target_color_vars.append(color_var)
            
            btn_color = tk.Button(frame, text="选色", command=lambda idx=i: self.pick_color(idx))
            btn_color.pack(side=tk.LEFT, padx=2)
            
            tk.Label(frame, text="容差:").pack(side=tk.LEFT)
            tol_var = tk.StringVar(value=self.config['roles'][i].get('tolerance', '30') if i < len(self.config['roles']) else "30")
            tk.Spinbox(frame, from_=0, to=255, textvariable=tol_var, width=5).pack(side=tk.LEFT)
            self.tolerance_vars.append(tol_var)
            
            tk.Label(frame, text="实时:").pack(side=tk.LEFT, padx=5)
            live_canvas = tk.Canvas(frame, width=20, height=20, bg="gray")
            live_canvas.pack(side=tk.LEFT)
            setattr(self, f'live_color_{i}', live_canvas)
        
        # 监控控制区
        frame_control = tk.Frame(frame_monitor, padx=10, pady=5)
        frame_control.pack(fill=tk.X)
        
        tk.Label(frame_control, text="检测间隔(秒):").pack(side=tk.LEFT)
        self.interval_var = tk.StringVar(value=str(self.config.get('check_interval', 0.5)))
        tk.Spinbox(frame_control, from_=0.1, to=5.0, increment=0.1, textvariable=self.interval_var, width=5).pack(side=tk.LEFT, padx=2)
        
        tk.Label(frame_control, text="冷却时间(秒):").pack(side=tk.LEFT, padx=10)
        self.cooldown_var = tk.StringVar(value=str(self.config.get('cooldown', 5.0)))
        tk.Spinbox(frame_control, from_=1.0, to=60.0, increment=1.0, textvariable=self.cooldown_var, width=5).pack(side=tk.LEFT, padx=2)
        
        self.btn_start = tk.Button(frame_control, text="开始监控", command=self.start_monitoring, bg="green", fg="white", font=("Arial", 10, "bold"))
        self.btn_start.pack(side=tk.LEFT, padx=20)
        
        self.btn_stop = tk.Button(frame_control, text="停止监控", command=self.stop_monitoring, state="disabled")
        self.btn_stop.pack(side=tk.LEFT, padx=5)
        
        tk.Button(frame_control, text="保存配置", command=self.save_current_config).pack(side=tk.LEFT, padx=20)
        
        # 日志显示区
        self.result_area = scrolledtext.ScrolledText(frame_monitor, height=12, state='disabled', font=("Consolas", 10))
        self.result_area.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        self.result_area.tag_config('green', foreground='green', font=("Consolas", 10, "bold"))
        self.result_area.tag_config('red', foreground='red', font=("Consolas", 10, "bold"))
        self.result_area.tag_config('blue', foreground='blue', font=("Consolas", 10))
        self.result_area.tag_config('gray', foreground='gray', font=("Consolas", 10))
        self.result_area.tag_config('normal', foreground='black', font=("Consolas", 10))
        self.result_area.tag_config('alert', foreground='red', background='yellow', font=("Consolas", 10, "bold"))
        
        # ===== 数据表格页面 =====
        frame_data = tk.Frame(self.notebook)
        self.notebook.add(frame_data, text="触发记录")
        
        # 工具栏
        frame_toolbar = tk.Frame(frame_data, padx=10, pady=5)
        frame_toolbar.pack(fill=tk.X)
        
        tk.Button(frame_toolbar, text="导出CSV", command=self.export_csv).pack(side=tk.LEFT, padx=5)
        tk.Button(frame_toolbar, text="导出JSON", command=self.export_json).pack(side=tk.LEFT, padx=5)
        tk.Button(frame_toolbar, text="删除选中", command=self.delete_selected, bg="red", fg="white").pack(side=tk.LEFT, padx=20)
        tk.Button(frame_toolbar, text="清空全部", command=self.clear_records).pack(side=tk.LEFT, padx=5)
        
        tk.Label(frame_toolbar, text="统计:").pack(side=tk.LEFT, padx=(30, 5))
        self.stats_var = tk.StringVar(value="共 0 条记录")
        tk.Label(frame_toolbar, textvariable=self.stats_var, font=("Arial", 10, "bold")).pack(side=tk.LEFT)
        
        # 数据表格
        columns = ('time', 'system', 'role', 'position', 'color', 'target')
        self.tree = ttk.Treeview(frame_data, columns=columns, show='headings', selectmode='browse')
        
        self.tree.heading('time', text='时间', command=lambda: self.sort_tree('time'))
        self.tree.heading('system', text='星系', command=lambda: self.sort_tree('system'))
        self.tree.heading('role', text='角色', command=lambda: self.sort_tree('role'))
        self.tree.heading('position', text='位置')
        self.tree.heading('color', text='检测颜色')
        self.tree.heading('target', text='目标颜色')
        
        self.tree.column('time', width=150, anchor='center')
        self.tree.column('system', width=120, anchor='center')
        self.tree.column('role', width=100, anchor='center')
        self.tree.column('position', width=80, anchor='center')
        self.tree.column('color', width=100, anchor='center')
        self.tree.column('target', width=100, anchor='center')
        
        # 滚动条
        scrollbar_y = ttk.Scrollbar(frame_data, orient=tk.VERTICAL, command=self.tree.yview)
        scrollbar_x = ttk.Scrollbar(frame_data, orient=tk.HORIZONTAL, command=self.tree.xview)
        self.tree.configure(yscrollcommand=scrollbar_y.set, xscrollcommand=scrollbar_x.set)
        
        self.tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=(10, 0), pady=5)
        scrollbar_y.pack(side=tk.LEFT, fill=tk.Y, pady=5)
        scrollbar_x.pack(side=tk.BOTTOM, fill=tk.X, padx=10)
        
        # 加载已有数据
        self.refresh_tree()
    
    def refresh_tree(self):
        """刷新表格数据"""
        # 清空现有数据
        for item in self.tree.get_children():
            self.tree.delete(item)
        
        # 插入数据
        for record in self.trigger_records:
            self.tree.insert('', 'end', values=(
                record['time'].strftime('%Y-%m-%d %H:%M:%S'),
                record['system'],
                record['role'],
                record['position'],
                record['color'],
                record['target']
            ))
        
        # 更新统计
        self.stats_var.set(f"共 {len(self.trigger_records)} 条记录")
    
    def sort_tree(self, col):
        """按列排序"""
        if col == 'time':
            self.trigger_records.sort(key=lambda x: x['time'], reverse=getattr(self, '_sort_reverse', False))
        elif col == 'system':
            self.trigger_records.sort(key=lambda x: x['system'].lower(), reverse=getattr(self, '_sort_reverse', False))
        elif col == 'role':
            self.trigger_records.sort(key=lambda x: x['role'].lower(), reverse=getattr(self, '_sort_reverse', False))
        
        self._sort_reverse = not getattr(self, '_sort_reverse', False)
        self.refresh_tree()
    
    def delete_selected(self):
        """删除选中的记录"""
        selected = self.tree.selection()
        if not selected:
            messagebox.showwarning("提示", "请先选择要删除的记录")
            return
        
        if not messagebox.askyesno("确认", "确定要删除选中的记录吗？"):
            return
        
        # 获取选中项的索引（从后往前删，避免索引变化）
        indices = []
        for item in selected:
            idx = self.tree.index(item)
            indices.append(idx)
        
        indices.sort(reverse=True)
        for idx in indices:
            del self.trigger_records[idx]
        
        self.save_records()
        self.refresh_tree()
        self.log_ui(f"已删除 {len(indices)} 条记录", "gray")
    
    def export_csv(self):
        """导出为CSV"""
        from tkinter import filedialog
        
        if not self.trigger_records:
            messagebox.showwarning("提示", "没有可导出的记录")
            return
        
        filename = filedialog.asksaveasfilename(
            defaultextension=".csv",
            filetypes=[("CSV files", "*.csv"), ("All files", "*.*")],
            initialfile=f"eve_pixel_records_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        )
        
        if not filename:
            return
        
        try:
            with open(filename, 'w', newline='', encoding='utf-8-sig') as f:
                writer = csv.writer(f)
                writer.writerow(['时间', '星系', '角色', '位置', '检测颜色', '目标颜色'])
                for record in self.trigger_records:
                    writer.writerow([
                        record['time'].strftime('%Y-%m-%d %H:%M:%S'),
                        record['system'],
                        record['role'],
                        record['position'],
                        record['color'],
                        record['target']
                    ])
            self.log_ui(f"已导出 {len(self.trigger_records)} 条记录到: {filename}", "green")
        except Exception as e:
            messagebox.showerror("错误", f"导出失败: {e}")
    
    def export_json(self):
        """导出为JSON"""
        from tkinter import filedialog
        
        if not self.trigger_records:
            messagebox.showwarning("提示", "没有可导出的记录")
            return
        
        filename = filedialog.asksaveasfilename(
            defaultextension=".json",
            filetypes=[("JSON files", "*.json"), ("All files", "*.*")],
            initialfile=f"eve_pixel_records_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        )
        
        if not filename:
            return
        
        try:
            data = []
            for item in self.trigger_records:
                data.append({
                    'time': item['time'].isoformat(),
                    'role': item['role'],
                    'position': item['position'],
                    'system': item['system'],
                    'color': item['color'],
                    'target': item['target']
                })
            with open(filename, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            self.log_ui(f"已导出 {len(self.trigger_records)} 条记录到: {filename}", "green")
        except Exception as e:
            messagebox.showerror("错误", f"导出失败: {e}")
    
    def pick_position(self, index):
        """拾取屏幕位置和颜色"""
        dialog = tk.Toplevel(self.root)
        dialog.title("点击拾取位置和颜色")
        dialog.geometry("350x200")
        dialog.transient(self.root)
        dialog.grab_set()
        
        tk.Label(dialog, text="请将鼠标移动到目标位置，\n然后按 Ctrl 键拾取坐标和颜色", font=("Arial", 12)).pack(pady=10)
        
        coord_var = tk.StringVar(value="等待...")
        tk.Label(dialog, textvariable=coord_var, font=("Consolas", 12), fg="blue").pack(pady=5)
        
        color_frame = tk.Frame(dialog)
        color_frame.pack(pady=10)
        tk.Label(color_frame, text="当前颜色:").pack(side=tk.LEFT)
        color_canvas = tk.Canvas(color_frame, width=30, height=30, bg="gray")
        color_canvas.pack(side=tk.LEFT, padx=5)
        color_hex_var = tk.StringVar(value="")
        tk.Label(color_frame, textvariable=color_hex_var, font=("Consolas", 10)).pack(side=tk.LEFT)
        
        def update_preview():
            if dialog.winfo_exists():
                x, y = self.get_mouse_pos()
                color = self.get_pixel_color(x, y)
                if color:
                    hex_color = f"#{color[0]:02x}{color[1]:02x}{color[2]:02x}"
                    coord_var.set(f"X: {x}, Y: {y} | 颜色: {hex_color}")
                    color_canvas.config(bg=hex_color)
                    color_hex_var.set(hex_color)
                else:
                    coord_var.set(f"X: {x}, Y: {y}")
                dialog.after(100, update_preview)
        
        def on_key(event):
            if event.keysym == "Control_L" or event.keysym == "Control_R":
                x, y = self.get_mouse_pos()
                color = self.get_pixel_color(x, y)
                
                self.position_vars[index]['x'].set(str(x))
                self.position_vars[index]['y'].set(str(y))
                
                if color and index < len(self.target_color_vars):
                    hex_color = f"#{color[0]:02x}{color[1]:02x}{color[2]:02x}"
                    self.target_color_vars[index].set(hex_color)
                    self.log_ui(f"位置{index+1}已拾取: ({x}, {y}) 颜色: {hex_color}", "green")
                else:
                    self.log_ui(f"位置{index+1}已拾取: ({x}, {y})", "green")
                
                dialog.destroy()
        
        dialog.bind("<KeyPress>", on_key)
        dialog.focus_set()
        update_preview()
    
    def pick_color(self, index):
        """颜色选择器"""
        from tkinter import colorchooser
        color = colorchooser.askcolor(title="选择目标颜色")
        if color[1]:
            self.target_color_vars[index].set(color[1])
    
    def get_mouse_pos(self):
        """获取当前鼠标位置"""
        point = wintypes.POINT()
        user32.GetCursorPos(ctypes.byref(point))
        return point.x, point.y
    
    def get_pixel_color(self, x, y):
        """获取屏幕指定位置的像素颜色"""
        try:
            hdc = user32.GetDC(0)
            pixel = gdi32.GetPixel(hdc, x, y)
            user32.ReleaseDC(0, hdc)
            
            r = pixel & 0xFF
            g = (pixel >> 8) & 0xFF
            b = (pixel >> 16) & 0xFF
            
            return (r, g, b)
        except Exception as e:
            return None
    
    def color_distance(self, c1, c2):
        """计算两个颜色之间的距离"""
        return sum((a - b) ** 2 for a, b in zip(c1, c2)) ** 0.5
    
    def hex_to_rgb(self, hex_color):
        """将十六进制颜色转换为RGB元组"""
        hex_color = hex_color.lstrip('#')
        return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))
    
    def select_log_directory(self):
        """选择日志目录"""
        from tkinter import filedialog
        selected_dir = filedialog.askdirectory(initialdir=self.log_path_var.get())
        if selected_dir:
            self.log_path_var.set(selected_dir)
            self.log_base_path = selected_dir
            self.scan_log_files()
    
    def refresh_logs(self):
        """刷新日志文件列表"""
        self.log_base_path = self.log_path_var.get()
        self.scan_log_files()
    
    def save_current_config(self):
        """保存当前配置"""
        self.config['positions'] = []
        for var in self.position_vars:
            try:
                x = int(var['x'].get())
                y = int(var['y'].get())
                self.config['positions'].append({'x': x, 'y': y})
            except ValueError:
                self.config['positions'].append({'x': 0, 'y': 0})
        
        self.config['roles'] = []
        for i in range(len(self.role_combos)):
            try:
                role_name = self.role_combos[i].get()
                position_index = int(self.role_position_vars[i].get()) - 1
                target_color = self.target_color_vars[i].get()
                tolerance = int(self.tolerance_vars[i].get())
                
                self.config['roles'].append({
                    'name': role_name,
                    'position_index': position_index,
                    'target_color': target_color,
                    'tolerance': tolerance
                })
            except ValueError:
                continue
        
        self.config['check_interval'] = float(self.interval_var.get())
        self.config['cooldown'] = float(self.cooldown_var.get())
        
        self.save_config()
    
    def log_ui(self, message, tag='normal'):
        """在UI中记录日志"""
        def _update():
            if hasattr(self, 'result_area'):
                self.result_area.config(state='normal')
                timestamp = datetime.now().strftime('%H:%M:%S')
                self.result_area.insert(tk.END, f"[{timestamp}] {message}\n", tag)
                self.result_area.see(tk.END)
                self.result_area.config(state='disabled')
        self.root.after(0, _update)
    
    def clear_records(self):
        """清空记录"""
        if not messagebox.askyesno("确认", "确定要清空所有记录吗？"):
            return
        
        self.trigger_records.clear()
        self.save_records()
        self.refresh_tree()
        self.log_ui("记录已清空", "gray")
    
    def add_record(self, record):
        """添加新记录并刷新表格（同一星系只保留一条）"""
        # 检查是否已有相同星系的记录
        existing = False
        for i, r in enumerate(self.trigger_records):
            if r['system'] == record['system']:
                # 更新已有记录为最新的
                self.trigger_records[i] = record
                existing = True
                break
        
        if not existing:
            self.trigger_records.append(record)
        
        self.save_records()
        
        # 在主线程中更新UI
        self.root.after(0, self.refresh_tree)
    
    def start_monitoring(self):
        """开始监控"""
        if self.monitoring:
            return
        
        self.save_current_config()
        self.monitoring = True
        
        # 初始化角色数据
        self.role_data = {}
        for i, combo in enumerate(self.role_combos):
            role_name = combo.get()
            if role_name:
                file_path = self.log_files_map.get(role_name)
                if file_path:
                    try:
                        pos_index = int(self.role_position_vars[i].get()) - 1
                        target_color = self.target_color_vars[i].get()
                        tolerance = int(self.tolerance_vars[i].get())
                        
                        if pos_index < len(self.config['positions']):
                            pos = self.config['positions'][pos_index]
                            self.role_data[role_name] = {
                                'file_path': file_path,
                                'current_system': '未知',
                                'position': (pos['x'], pos['y']),
                                'position_index': pos_index,
                                'target_color': self.hex_to_rgb(target_color),
                                'tolerance': tolerance,
                                'last_trigger_time': 0,
                                'role_index': i
                            }
                            self.check_initial_location(role_name, file_path)
                    except (ValueError, IndexError) as e:
                        self.log_ui(f"角色 {role_name} 配置错误: {e}", "red")
        
        if not self.role_data:
            self.monitoring = False
            messagebox.showwarning("警告", "没有配置有效的角色监控")
            return
        
        self.log_ui(f"开始监控 {len(self.role_data)} 个角色", "green")
        
        self.btn_start.config(state="disabled")
        self.btn_stop.config(state="normal", bg="red", fg="white")
        
        interval = float(self.interval_var.get())
        cooldown = float(self.cooldown_var.get())
        
        self.monitor_thread = threading.Thread(
            target=self.monitor_loop,
            args=(interval, cooldown),
            daemon=True
        )
        self.monitor_thread.start()
        
        for role_name in self.role_data:
            t = threading.Thread(
                target=self.monitor_location_loop,
                args=(role_name,),
                daemon=True
            )
            t.start()
    
    def stop_monitoring(self):
        """停止监控"""
        self.monitoring = False
        self.log_ui("监控已停止", "gray")
        self.btn_start.config(state="normal")
        self.btn_stop.config(state="disabled", bg="SystemButtonFace", fg="black")
    
    def monitor_loop(self, interval, cooldown):
        """主监控循环 - 检测像素颜色"""
        while self.monitoring:
            current_time = time.time()
            
            for role_name, data in self.role_data.items():
                if not self.monitoring:
                    break
                
                x, y = data['position']
                current_color = self.get_pixel_color(x, y)
                
                if current_color is None:
                    continue
                
                hex_color = f"#{current_color[0]:02x}{current_color[1]:02x}{current_color[2]:02x}"
                canvas = getattr(self, f"live_color_{data['role_index']}", None)
                if canvas:
                    self.root.after(0, lambda c=canvas, col=hex_color: c.config(bg=col))
                
                target = data['target_color']
                distance = self.color_distance(current_color, target)
                
                if distance <= data['tolerance']:
                    if current_time - data['last_trigger_time'] >= cooldown:
                        data['last_trigger_time'] = current_time
                        
                        record = {
                            'time': datetime.now(),
                            'role': role_name,
                            'position': f"({x}, {y})",
                            'system': data['current_system'],
                            'color': hex_color,
                            'target': f"#{target[0]:02x}{target[1]:02x}{target[2]:02x}"
                        }
                        
                        # 添加到记录
                        self.add_record(record)
                        
                        msg = f"ALERT: 角色 [{role_name}] | 位置 {data['position_index'] + 1} | 星系: {data['current_system']} | 颜色: {hex_color}"
                        self.log_ui(msg, "alert")
            
            time.sleep(interval)
    
    def monitor_location_loop(self, role_name):
        """监控角色位置变化"""
        data = self.role_data.get(role_name)
        if not data:
            return
        
        file_path = data['file_path']
        current_file = file_path
        
        while self.monitoring:
            if not os.path.exists(current_file):
                time.sleep(2)
                continue
                
            try:
                with open(current_file, 'r', encoding='utf-16-le', errors='ignore') as f:
                    f.seek(0, 2)
                    while self.monitoring:
                        line = f.readline()
                        if not line:
                            time.sleep(0.5)
                            continue
                            
                        if "Channel changed to Local" in line or "频道更换为本地" in line:
                            match = re.search(r"(?:Local|本地)\s*[:：]\s*(.*)", line)
                            if match:
                                sys_name = match.group(1).strip().rstrip('*')
                                if sys_name in self.system_cache:
                                    data['current_system'] = sys_name
                                    self.log_ui(f"[{role_name}] 进入星系: {sys_name}", "blue")
            except Exception as e:
                time.sleep(1)
    
    def check_initial_location(self, role_name, filepath):
        """回溯历史日志找当前位置"""
        if not os.path.exists(filepath):
            return
        try:
            with open(filepath, 'r', encoding='utf-16-le', errors='ignore') as f:
                lines = f.readlines()
                for line in reversed(lines):
                    if "Channel changed to Local" in line or "频道更换为本地" in line:
                        match = re.search(r"(?:Local|本地)\s*[:：]\s*(.*)", line)
                        if match:
                            sys_name = match.group(1).strip().rstrip('*')
                            if sys_name in self.system_cache:
                                self.role_data[role_name]['current_system'] = sys_name
                                self.log_ui(f"[{role_name}] 当前星系: {sys_name}", "blue")
                        break
        except Exception:
            pass


if __name__ == "__main__":
    root = tk.Tk()
    app = EveMultiPixelMonitor(root)
    root.mainloop()
