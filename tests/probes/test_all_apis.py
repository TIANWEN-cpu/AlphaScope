"""探测所有 API 的连通性和可用模型"""

import os
from dotenv import load_dotenv
from project_paths import ENV_FILE

load_dotenv(ENV_FILE)

from openai import OpenAI

# 候选 API + 候选模型（每家逐个试）
CANDIDATES = [
    (
        "DeepSeek",
        os.getenv("DEEPSEEK_API_KEY"),
        os.getenv("DEEPSEEK_BASE_URL"),
        ["deepseek-chat", "deepseek-reasoner", "deepseek-coder"],
    ),
    (
        "Kimi",
        os.getenv("KIMI_API_KEY"),
        os.getenv("KIMI_BASE_URL"),
        [
            "kimi-k2-0711-preview",
            "moonshot-v1-32k",
            "moonshot-v1-8k",
            "kimi-latest",
            "kimi-thinking-preview",
        ],
    ),
    (
        "Claude",
        os.getenv("CLAUDE_API_KEY"),
        os.getenv("CLAUDE_BASE_URL"),
        [
            "claude-3-5-sonnet-20241022",
            "claude-sonnet-4-20250514",
            "claude-3-5-sonnet",
            "claude-sonnet-4-5",
        ],
    ),
    (
        "GPT",
        os.getenv("GPT_API_KEY"),
        os.getenv("GPT_BASE_URL"),
        ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini", "gpt-5-mini"],
    ),
    (
        "Mimo",
        os.getenv("MIMO_API_KEY"),
        os.getenv("MIMO_BASE_URL") + "/v1",
        ["deepseek-chat", "claude-sonnet-4-5", "gpt-4o-mini", "deepseek-reasoner"],
    ),
    (
        "SenseNova",
        os.getenv("SENSENOVA_API_KEY"),
        os.getenv("SENSENOVA_BASE_URL"),
        ["SenseChat-5", "SenseChat-32K", "SenseChat-Turbo", "SenseChat"],
    ),
]


def probe(name, key, base, model):
    try:
        client = OpenAI(api_key=key, base_url=base, timeout=10.0)
        r = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": "回复一个字：好"}],
            max_tokens=20,
        )
        out = r.choices[0].message.content
        return True, out[:40]
    except Exception as e:
        return False, str(e)[:120]


print(f"{'供应商':<14}{'模型':<30}{'状态':<8}回复/错误")
print("-" * 110)

usable = {}
for vendor, key, base, models in CANDIDATES:
    if not key:
        print(f"{vendor:<14}{'(无 key)':<30}{'SKIP':<8}")
        continue
    found_one = False
    for m in models:
        ok, msg = probe(vendor, key, base, m)
        flag = "OK" if ok else "FAIL"
        msg_show = msg.replace("\n", " ").replace("\r", " ")[:60]
        print(f"{vendor:<14}{m:<30}{flag:<8}{msg_show}")
        if ok and not found_one:
            usable.setdefault(vendor, []).append(m)
            found_one = True

print("\n" + "=" * 70)
print("可用模型汇总：")
for v, ms in usable.items():
    print(f"  {v}: {ms[0]}")
