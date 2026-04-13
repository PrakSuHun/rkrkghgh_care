"""
기획 에이전트와 대화하며 기획을 완성하는 스크립트.
기획 확정 후 pipeline.py를 자동으로 실행합니다.
"""

import subprocess
import os

CLAUDE_PATH = "/Users/suhunpark/.vscode/extensions/anthropic.claude-code-2.1.101-darwin-x64/resources/native-binary/claude"
WORKSPACE = "workspace"

SYSTEM_PROMPT = """당신은 소프트웨어 기획 전문가입니다.

사용자와 대화를 통해 웹 서비스 기획을 완성합니다.

## 대화 규칙
- 한 번에 너무 많은 질문을 하지 마세요. 한두 가지씩만 질문하세요.
- 사용자의 답변을 바탕으로 기획을 구체화해 나가세요.
- 기술적인 용어는 최대한 쉽게 설명해주세요.
- 기획이 충분히 구체화됐다고 판단되면 자연스럽게 알려주세요.

## 파악해야 할 핵심 내용
1. 서비스 목적과 해결하고 싶은 문제
2. 주요 사용자 (누가 쓰는지)
3. 핵심 기능 (꼭 있어야 할 것)
4. 부가 기능 (있으면 좋은 것)
5. 특별한 요구사항 (디자인, 성능, 보안 등)

## 기획 확정 방법
사용자가 "기획 확정", "확정", "시작해", "개발 시작" 등의 말을 하면
반드시 다음 형식으로 최종 기획서를 출력하세요:

[기획확정]
서비스 설명: (전체 내용을 상세하게 요약)
[/기획확정]
"""

def run_claude_chat(messages: list) -> str:
    """대화 형식으로 Claude 실행"""
    # 메시지를 하나의 프롬프트로 구성
    conversation = ""
    for msg in messages:
        role = "사용자" if msg["role"] == "user" else "기획 에이전트"
        conversation += f"{role}: {msg['content']}\n\n"

    prompt = f"{SYSTEM_PROMPT}\n\n---\n\n{conversation}기획 에이전트:"

    result = subprocess.run(
        [CLAUDE_PATH, "--print", prompt],
        capture_output=True,
        text=True
    )
    return result.stdout.strip()


def save_plan(content: str):
    os.makedirs(f"{WORKSPACE}/plan", exist_ok=True)
    with open(f"{WORKSPACE}/plan/master_plan.md", "w", encoding="utf-8") as f:
        f.write(content)


def extract_plan(text: str) -> str:
    """[기획확정] 블록에서 서비스 설명 추출"""
    if "[기획확정]" not in text:
        return ""
    start = text.index("[기획확정]") + len("[기획확정]")
    end = text.index("[/기획확정]") if "[/기획확정]" in text else len(text)
    return text[start:end].strip()


def main():
    print("=" * 60)
    print("기획 에이전트와 대화를 시작합니다.")
    print("기획이 완료되면 '확정' 또는 '개발 시작'이라고 말해주세요.")
    print("종료하려면 Ctrl+C를 누르세요.")
    print("=" * 60)

    messages = []
    service_description = None

    # 첫 인사
    first_response = run_claude_chat([{
        "role": "user",
        "content": "안녕하세요, 웹 서비스 기획을 도와주세요."
    }])
    print(f"\n기획 에이전트: {first_response}\n")
    messages.append({"role": "user", "content": "안녕하세요, 웹 서비스 기획을 도와주세요."})
    messages.append({"role": "assistant", "content": first_response})

    while True:
        try:
            user_input = input("나: ").strip()
            if not user_input:
                continue

            messages.append({"role": "user", "content": user_input})
            response = run_claude_chat(messages)
            print(f"\n기획 에이전트: {response}\n")
            messages.append({"role": "assistant", "content": response})

            # 기획 확정 감지
            if "[기획확정]" in response:
                service_description = extract_plan(response)
                print("\n" + "=" * 60)
                print("기획이 확정되었습니다!")
                print("=" * 60)
                save_plan(service_description)
                break

        except KeyboardInterrupt:
            print("\n\n기획을 중단합니다.")
            return

    # 파이프라인 시작 여부 확인
    print("\n전체 개발 파이프라인을 시작할까요? (y/n): ", end="")
    answer = input().strip().lower()

    if answer == "y":
        print("\npipeline.py를 시작합니다...\n")
        # pipeline.py에 service_description 전달
        import pipeline
        pipeline.run_pipeline(service_description)
    else:
        print(f"\n기획서가 저장되었습니다: {WORKSPACE}/plan/master_plan.md")
        print("나중에 pipeline.py를 실행하면 개발을 시작할 수 있습니다.")


if __name__ == "__main__":
    main()
