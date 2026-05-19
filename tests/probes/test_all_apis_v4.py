"""第四轮：用列模型 API 拿到的真实模型名重测"""
import os
from dotenv import load_dotenv
from project_paths import ENV_FILE
load_dotenv(ENV_FILE)
from openai import OpenAI

def probe(label, key, base, model):
    try:
        client = OpenAI(api_key=key, base_url=base, timeout=20.0)
        r = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": "回复：好"}],
            max_tokens=20,
        )
        return True, r.choices[0].message.content[:60]
    except Exception as e:
        return False, str(e)[:140]


TESTS = [
    # GPT 代理 - 用真实存在的模型
    ("GPT", os.getenv("GPT_API_KEY"), os.getenv("GPT_BASE_URL")+"/v1", "gpt-5.2"),
    ("GPT", os.getenv("GPT_API_KEY"), os.getenv("GPT_BASE_URL")+"/v1", "gpt-5.4-mini"),
    ("GPT", os.getenv("GPT_API_KEY"), os.getenv("GPT_BASE_URL")+"/v1", "gpt-5.2-chat-latest"),
    # Claude
    ("Claude", os.getenv("CLAUDE_API_KEY"), os.getenv("CLAUDE_BASE_URL")+"/v1", "claude-haiku-4-5"),
    ("Claude", os.getenv("CLAUDE_API_KEY"), os.getenv("CLAUDE_BASE_URL")+"/v1", "claude-opus-4-7"),
    ("Claude", os.getenv("CLAUDE_API_KEY"), os.getenv("CLAUDE_BASE_URL")+"/v1", "claude-sonnet-4-5"),
    # Mimo - 小米自研
    ("Mimo", os.getenv("MIMO_API_KEY"), os.getenv("MIMO_BASE_URL")+"/v1", "mimo-v2.5-pro"),
    ("Mimo", os.getenv("MIMO_API_KEY"), os.getenv("MIMO_BASE_URL")+"/v1", "mimo-v2.5"),
    ("Mimo", os.getenv("MIMO_API_KEY"), os.getenv("MIMO_BASE_URL")+"/v1", "mimo-v2-pro"),
    # SenseNova
    ("SenseNova", os.getenv("SENSENOVA_API_KEY"), os.getenv("SENSENOVA_BASE_URL"), "sensenova-6.7-flash-lite"),
    ("SenseNova", os.getenv("SENSENOVA_API_KEY"), os.getenv("SENSENOVA_BASE_URL"), "deepseek-v4-flash"),
    ("SenseNova", os.getenv("SENSENOVA_API_KEY"), os.getenv("SENSENOVA_BASE_URL"), "sensenova-u1-fast"),
]

print(f"{'供应商':<14}{'模型':<32}{'状态':<8}回复")
print("-"*120)
ok_set = {}
for label, key, base, m in TESTS:
    ok, msg = probe(label, key, base, m)
    flag = "✅OK" if ok else "❌FAIL"
    print(f"{label:<14}{m:<32}{flag:<8}{msg.replace(chr(10),' ')[:60]}")
    if ok:
        ok_set.setdefault(label, []).append(m)

print("\n" + "="*70)
print("可用模型汇总：")
for v, ms in ok_set.items():
    print(f"  {v}: {ms}")
