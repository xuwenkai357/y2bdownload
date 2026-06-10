#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import re
import sys
from pathlib import Path

# ==================== 可配置的过滤规则 ====================

# 1. 允许处理的文件后缀名（不区分大小写）
ALLOWED_EXTENSIONS = {
    '.mp3', '.mp4', '.m4a', '.wav', '.flac', '.aac', '.webm', '.ogg', '.mkv', '.avi'
}

# 2. 正则噪音模式列表（不区分大小写）
# 您可以在这里添加新的正则表达式来过滤更多的噪音词
NOISE_PATTERNS = [
    # 匹配括号/方括号中的 Official, Lyrics, MV, Audio, Music Video 等噪音词（例如: (Official MV)）
    r'\s*[\(\[\{【](?:Official\s+)?(?:Lyrics\s+MV|Lyrics|MV|Music\s+Video|Video|Audio|HD|HQ|1080P|Clip)[\)\]\}】]',
    
    # 匹配末尾的中文噪音（例如: 官方歌詞版MV, 官方MV）
    r'\s*(?:官方)?(?:歌詞版MV|歌词版MV|歌詞版|歌词版|MV|视频|音频|字幕版|字幕)\s*$',
    
    # 匹配末尾的英文噪音（例如: Official MV, Lyrics）
    r'\s*(?:Official\s+)?(?:Lyrics\s+MV|Lyrics|MV|Music\s+Video|Video|Audio)\s*$',
]

# 3. 针对英文歌名与 MV 粘连的特殊规则（如 "ReasonMV" -> "Reason"）
ATTACHED_MV_PATTERN = r'(?<=[a-zA-Z])(?:MV|mv)\s*$'

# ==========================================================

# 终端颜色代码（在 MAC 终端中默认支持）
COLOR_GREEN = "\033[92m"
COLOR_RED = "\033[91m"
COLOR_YELLOW = "\033[93m"
COLOR_CYAN = "\033[96m"
COLOR_RESET = "\033[0m"
COLOR_BOLD = "\033[1m"

def print_colored(text, color_code):
    """打印带颜色的文本"""
    print(f"{color_code}{text}{COLOR_RESET}")

def clean_song_title(title: str) -> str:
    """
    清洗歌曲标题，提取核心歌名并清除推广/版本噪音。
    """
    original_title = title
    
    # 1. 检查是否存在【】中括号，如果存在则优先提取其中的内容作为歌曲名
    bracket_match = re.search(r'【(.*?)】', title)
    if bracket_match:
        extracted = bracket_match.group(1).strip()
        if extracted:
            title = extracted
            
    # 2. 如果没有提取到【】内的内容，或者虽然提取了但还需要进一步清理噪音模式
    for pattern in NOISE_PATTERNS:
        title = re.sub(pattern, '', title, flags=re.IGNORECASE)
        
    # 3. 处理拼写粘连的 MV，例如 "ReasonMV" -> "Reason"
    title = re.sub(ATTACHED_MV_PATTERN, '', title)
    
    # 4. 去除首尾的空格、多余标点符号
    title = title.strip(' -_./\\+ \t')
    
    # 安全保护：如果清理后歌名为空，则回退到原始标题并去掉首尾空格
    if not title:
        title = original_title.strip()
        
    return title

def process_filename(filename: str) -> str:
    """
    处理单个文件名，将其转换为 "音乐名 - 专辑名.后缀" 格式。
    """
    path = Path(filename)
    stem = path.stem
    suffix = path.suffix
    
    # 如果文件名以 "." 开头（隐藏文件），忽略
    if stem.startswith('.'):
        return filename
        
    # 按最后一个 " - " 拆分出前半部分（歌名）和后半部分（专辑/歌手等）
    # 注意：使用 rsplit 确保如果存在多个 " - "，我们只切分最后一个
    parts = stem.rsplit(' - ', 1)
    
    if len(parts) == 2:
        left_part, right_part = parts[0], parts[1]
        
        # 清洗歌名部分
        clean_left = clean_song_title(left_part)
        
        # 清洗后半部分首尾空格（如专辑名/歌手名）
        clean_right = right_part.strip()
        
        # 拼接成新文件名
        new_stem = f"{clean_left} - {clean_right}"
    else:
        # 如果没有 " - "，说明整个文件名就是歌名，直接清洗整段
        new_stem = clean_song_title(stem)
        
    # 去除新文件名中可能产生的双重空格，并去除首尾多余标点
    new_stem = re.sub(r'\s+', ' ', new_stem).strip(' -_./\\+ \t')
    
    return f"{new_stem}{suffix}"

def get_rename_list(directory_path: str):
    """
    遍历目录，生成需要重命名的文件列表，并处理命名冲突。
    """
    dir_path = Path(directory_path)
    if not dir_path.is_dir():
        print_colored(f"错误：路径 '{directory_path}' 不是一个有效的目录！", COLOR_RED)
        return []
        
    rename_list = []
    seen_targets = {}  # 记录目标文件名，用于冲突检测 {new_name: [original_paths]}
    
    # 获取目录下所有文件
    files = [f for f in dir_path.iterdir() if f.is_file()]
    
    # 排序使输出更整洁
    files.sort(key=lambda x: x.name)
    
    for file_path in files:
        # 仅处理符合后缀要求的音乐/视频文件
        if file_path.suffix.lower() not in ALLOWED_EXTENSIONS:
            continue
            
        original_name = file_path.name
        new_name = process_filename(original_name)
        
        # 如果文件名没有发生变化，无需重命名
        if original_name == new_name:
            continue
            
        rename_list.append({
            'original_name': original_name,
            'new_name': new_name,
            'file_path': file_path,
        })
        
    # 冲突检测与自动重命名解决（例如两个文件重命名后名字相同，则自动加上数字序号）
    final_rename_list = []
    target_counts = {}  # 统计每个新名字的使用次数
    
    # 阶段 1：先检查目录中是否已经存在同名文件
    for item in rename_list:
        orig_name = item['original_name']
        new_name = item['new_name']
        file_path = item['file_path']
        
        target_path = file_path.with_name(new_name)
        
        # 如果新名字在目录中已经存在（且不是它自己），需要重命名规避冲突
        if target_path.exists() and target_path != file_path:
            # 自动生成不冲突的名字，形如 "音乐名 - 专辑名 (1).mp4"
            stem = target_path.stem
            suffix = target_path.suffix
            counter = 1
            while True:
                resolved_name = f"{stem} ({counter}){suffix}"
                resolved_path = file_path.with_name(resolved_name)
                if not resolved_path.exists():
                    new_name = resolved_name
                    break
                counter += 1
                
        # 阶段 2：解决本次重命名队列内部的命名碰撞
        if new_name not in target_counts:
            target_counts[new_name] = []
        target_counts[new_name].append(item)
        
    # 根据碰撞结果重新分配文件名
    for target_name, items in target_counts.items():
        if len(items) == 1:
            # 没有碰撞，保持原样
            item = items[0]
            final_rename_list.append({
                'original_name': item['original_name'],
                'new_name': target_name,
                'file_path': item['file_path']
            })
        else:
            # 队列内部有多个文件重命名为相同名字，增加序号区分
            path = Path(target_name)
            stem = path.stem
            suffix = path.suffix
            for index, item in enumerate(items):
                # 第一个保留原名，后面的加 (1), (2)...
                if index == 0:
                    resolved_name = target_name
                else:
                    resolved_name = f"{stem} ({index}){suffix}"
                    
                final_rename_list.append({
                    'original_name': item['original_name'],
                    'new_name': resolved_name,
                    'file_path': item['file_path']
                })
                
    return final_rename_list

def main():
    print_colored("=" * 60, COLOR_CYAN)
    print_colored("        🎵  音乐文件名整理工具 (Python Music Rename Tool)  🎵", COLOR_CYAN + COLOR_BOLD)
    print_colored("=" * 60, COLOR_CYAN)
    
    # 获取目标文件夹路径
    default_dir = os.getcwd()
    print_colored(f"提示：您可以直接拖拽文件夹到本窗口，或直接回车使用当前目录。", COLOR_YELLOW)
    user_input = input(f"请输入目标文件夹路径 (默认: {default_dir}): ").strip()
    
    # 去除拖拽文件时可能产生的首尾单引号/双引号/空格
    if user_input:
        user_input = user_input.strip("'\" ")
        target_dir = os.path.abspath(user_input)
    else:
        target_dir = default_dir
        
    if not os.path.isdir(target_dir):
        print_colored(f"\n❌ 错误：'{target_dir}' 不是一个有效的目录，程序已退出。", COLOR_RED)
        return
        
    print(f"\n正在扫描目录: {COLOR_CYAN}{target_dir}{COLOR_RESET}")
    
    # 获取重命名任务列表
    rename_tasks = get_rename_list(target_dir)
    
    if not rename_tasks:
        print_colored("\n✨ 没有发现需要整理文件名的音乐/视频文件。所有文件都已符合规范！", COLOR_GREEN)
        return
        
    # 展示 Dry Run 预览
    print_colored(f"\n🔍 扫描完成！共发现 {len(rename_tasks)} 个文件需要重命名：\n", COLOR_CYAN)
    
    for idx, task in enumerate(rename_tasks, 1):
        print(f"[{idx}] {COLOR_RED}原文件名: {task['original_name']}{COLOR_RESET}")
        print(f"    {COLOR_GREEN}新文件名: {task['new_name']}{COLOR_RESET}\n")
        
    # 用户确认
    print_colored("=" * 60, COLOR_CYAN)
    confirm = input("⚠️ 是否确认执行以上重命名操作？(y/确定，其他键取消): ").strip().lower()
    
    if confirm in ('y', 'yes', '确定', 'qieding'):
        print_colored("\n🚀 开始重命名文件...", COLOR_CYAN)
        success_count = 0
        error_count = 0
        
        for task in rename_tasks:
            src_path = task['file_path']
            dest_path = src_path.with_name(task['new_name'])
            try:
                os.rename(src_path, dest_path)
                success_count += 1
            except Exception as e:
                print_colored(f"❌ 重命名失败: {task['original_name']} -> {e}", COLOR_RED)
                error_count += 1
                
        print_colored(f"\n🎉 整理完成！成功重命名 {success_count} 个文件" + 
                      (f"，失败 {error_count} 个" if error_count > 0 else "") + "。", COLOR_GREEN)
    else:
        print_colored("\n🚫 操作已取消，未修改任何文件。", COLOR_YELLOW)

if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print_colored("\n\n👋 程序已由用户强制退出。", COLOR_YELLOW)
        sys.exit(0)
