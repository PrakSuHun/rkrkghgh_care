# CareLink 크롬 확장프로그램

공단 장기요양시스템의 태그 기록을 CareLink로 자동 전송합니다.

## 설치 방법

1. 크롬 주소창에 `chrome://extensions` 입력
2. 우측 상단 **개발자 모드** 켜기
3. 좌측 상단 **압축해제된 확장 프로그램을 로드합니다** 클릭
4. 이 폴더(`/Users/suhunpark/Documents/care/extension`) 선택
5. 확장 아이콘이 툴바에 나타나면 설치 완료

## 사용 방법

1. CareLink 앱 실행 중인지 확인 (`http://localhost:3000`)
2. 공단 장기요양시스템(longtermcare.or.kr)에 로그인
3. 태그 기록 페이지로 이동
4. 크롬 툴바의 CareLink 아이콘 클릭
5. **태그 수집** 버튼 클릭 → 데이터 자동 전송

## ⚠️ 주의사항

**현재 content.js의 DOM 선택자는 범용적으로 작성되어 있습니다.**
공단 사이트의 실제 HTML 구조를 확인한 후 아래 부분을 수정해야 합니다:

```javascript
// content.js 의 extractTagRecords 함수
const tables = document.querySelectorAll("table");
// 실제 공단 사이트 구조에 맞게 선택자 조정 필요
```

공단 사이트에서 F12로 개발자 도구를 열어 태그 테이블의 실제 구조를 확인 후 알려주세요. 그에 맞게 선택자를 수정해드립니다.
