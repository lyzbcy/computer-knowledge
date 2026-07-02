"""
Vue3 学习地图 · 语音 + 字幕生成（本地增强版）
==============================================
基于 skill 的 tts.py，额外用 edge-tts 的 SentenceBoundary 事件生成整句字幕 JSON。

为什么单独写一个：
  - skill 的 tts.py 是共享脚本，不改它（避免影响别的项目）。
  - 字幕是本项目新增需求。

用法
----
    python tts-sub.py audio-script.json --out-dir audio/

产物（每段音频配套一个字幕文件）：
    audio/ch1.mp3
    audio/ch1.json   ← 整句字幕 [{start, end, text}, ...]（秒）
    audio/ch2.mp3
    audio/ch2.json

字幕 JSON 格式：
    [
      {"start": 0.0, "end": 2.86, "text": "这一章聊..."},
      {"start": 2.86, "end": 5.5, "text": "很多人以为..."},
      ...
    ]
"""
import argparse
import asyncio
import json
import sys
from pathlib import Path

import edge_tts

DEFAULT_VOICE = "zh-CN-XiaoxiaoNeural"
MAX_RETRIES = 3


async def synthesize_with_subs(text: str, voice: str, mp3_path: Path, json_path: Path) -> bool:
    """合成单段 mp3 + 整句字幕 JSON。用 stream() 手动收集 audio 和 SentenceBoundary。"""
    import aiohttp

    last_err = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            communicate = edge_tts.Communicate(text, voice)
            audio_chunks = []
            boundaries = []
            async for ev in communicate.stream():
                etype = ev.get("type")
                if etype == "audio":
                    audio_chunks.append(ev["data"])
                elif etype in ("SentenceBoundary", "WordBoundary"):
                    # offset/duration 单位是 100 纳秒（HundredNanoseconds），转秒
                    offset_s = ev.get("offset", 0) / 1e7
                    dur_s = ev.get("duration", 0) / 1e7
                    seg_text = ev.get("text", "").strip()
                    if seg_text:
                        boundaries.append({
                            "start": round(offset_s, 2),
                            "end": round(offset_s + dur_s, 2),
                            "text": seg_text,
                        })
            # 写 mp3
            mp3_path.write_bytes(b"".join(audio_chunks))
            # 写字幕 JSON
            json_path.write_text(
                json.dumps(boundaries, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
            return True
        except Exception as e:
            last_err = e
            if attempt < MAX_RETRIES:
                wait = attempt * 2
                print(f"           ⚠️  第 {attempt} 次失败（{type(e).__name__}），{wait}s 后重试…")
                await asyncio.sleep(wait)
    raise last_err


async def synthesize_all(items, voice: str, out_dir: Path) -> int:
    ok = 0
    for i, item in enumerate(items, 1):
        item_id = item.get("id") or f"item{i}"
        title = item.get("title", item_id)
        text = item.get("text", "").strip()
        if not text:
            print(f"  [{i}/{len(items)}] ⚠️  跳过 {item_id}（text 为空）")
            continue
        mp3_path = out_dir / f"{item_id}.mp3"
        json_path = out_dir / f"{item_id}.json"
        print(f"  [{i}/{len(items)}] 合成 {item_id} · {title}")
        try:
            await synthesize_with_subs(text, voice, mp3_path, json_path)
            mp3_size = mp3_path.stat().st_size
            sub_count = len(json.loads(json_path.read_text(encoding="utf-8")))
            print(f"           ✅ {mp3_path.name} ({mp3_size // 1024} KB) + {json_path.name} ({sub_count} 句字幕)")
            ok += 1
        except Exception as e:
            print(f"           ❌ 失败：{e}")
    return ok


def main():
    parser = argparse.ArgumentParser(description="Vue3 学习地图 · 语音+字幕生成")
    parser.add_argument("script", help="语音稿 JSON 文件路径")
    parser.add_argument("--out-dir", "-o", default="audio", help="输出目录（默认: audio/）")
    parser.add_argument("--voice", "-v", default=DEFAULT_VOICE, help="音色")
    args = parser.parse_args()

    script_path = Path(args.script)
    if not script_path.exists():
        print(f"❌ 找不到语音稿：{script_path}", file=sys.stderr)
        sys.exit(1)

    data = json.loads(script_path.read_text(encoding="utf-8"))
    items = data.get("items")
    if not items:
        print("❌ 缺少 items", file=sys.stderr)
        sys.exit(1)

    voice = args.voice
    if voice == DEFAULT_VOICE and data.get("voice"):
        voice = data["voice"]

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    print("=" * 60)
    print(f"语音稿  : {script_path}")
    print(f"音色    : {voice}")
    print(f"输出目录: {out_dir}")
    print(f"待合成  : {len(items)} 段（mp3 + 字幕 JSON）")
    print("=" * 60)

    ok = asyncio.run(synthesize_all(items, voice, out_dir))
    print("=" * 60)
    print(f"完成：{ok}/{len(items)} 段成功 → {out_dir}/")
    if ok < len(items):
        sys.exit(1)


if __name__ == "__main__":
    main()
