// 공단 장기요양시스템 페이지에서 태그 기록을 스크랩
// 실제 DOM 구조는 공단 사이트를 직접 보면서 맞춰야 함 (지금은 범용 로직)

(function () {
  const SERVER_URL = "http://localhost:3000/api/tags";

  function extractTagRecords() {
    // 공단 사이트의 태그 테이블을 찾아 데이터 추출
    // ⚠️ 실제 공단 사이트에 맞게 선택자 수정 필요
    const tables = document.querySelectorAll("table");
    const records = [];

    tables.forEach((table) => {
      const rows = table.querySelectorAll("tbody tr");
      rows.forEach((row) => {
        const cells = row.querySelectorAll("td");
        if (cells.length < 3) return;

        const text = Array.from(cells).map((c) => c.innerText.trim());
        // 태그 관련 키워드가 포함된 행만 필터 (시간 포맷이 있는 행 등)
        const hasTime = text.some((t) => /\d{2}:\d{2}/.test(t));
        if (hasTime) {
          records.push({
            raw: text,
            extractedAt: new Date().toISOString(),
            sourceUrl: window.location.href,
          });
        }
      });
    });

    return records;
  }

  function showOverlay(message, color = "#4f46e5") {
    const existing = document.getElementById("carelink-overlay");
    if (existing) existing.remove();

    const div = document.createElement("div");
    div.id = "carelink-overlay";
    div.style.cssText = `
      position: fixed; top: 16px; right: 16px; z-index: 999999;
      background: ${color}; color: white; padding: 12px 20px;
      border-radius: 8px; font-family: sans-serif; font-size: 14px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2); cursor: pointer;
    `;
    div.textContent = message;
    div.onclick = () => div.remove();
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 5000);
  }

  async function sendToServer(records) {
    try {
      const res = await fetch(SERVER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ records, url: window.location.href }),
      });
      if (res.ok) {
        const data = await res.json();
        showOverlay(`✅ CareLink: ${data.saved}건 저장 완료`);
      } else {
        showOverlay("⚠️ CareLink 서버 연결 실패", "#dc2626");
      }
    } catch (err) {
      showOverlay("⚠️ CareLink 서버 미실행", "#dc2626");
    }
  }

  // 메시지 리스너 (팝업에서 수동 수집 요청)
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.action === "collect") {
      const records = extractTagRecords();
      if (records.length === 0) {
        showOverlay("⚠️ 태그 데이터를 찾지 못했습니다", "#f59e0b");
        sendResponse({ count: 0 });
      } else {
        sendToServer(records);
        sendResponse({ count: records.length });
      }
      return true;
    }
  });

  // 페이지 로드 후 자동 수집 안내
  setTimeout(() => {
    if (extractTagRecords().length > 0) {
      showOverlay("📋 태그 페이지 감지됨. 확장 아이콘을 눌러 수집하세요.");
    }
  }, 2000);
})();
