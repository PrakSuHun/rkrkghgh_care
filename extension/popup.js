document.getElementById("collect").addEventListener("click", async () => {
  const btn = document.getElementById("collect");
  const result = document.getElementById("result");
  btn.disabled = true;
  btn.textContent = "수집 중...";

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = tab.url || "";
    if (!url.includes("longtermcare.or.kr") && !url.includes("nhis.or.kr")) {
      result.className = "result error";
      result.style.display = "block";
      result.textContent = "⚠️ 공단 사이트에서만 작동합니다";
      return;
    }

    chrome.tabs.sendMessage(tab.id, { action: "collect" }, (response) => {
      if (chrome.runtime.lastError) {
        result.className = "result error";
        result.style.display = "block";
        result.textContent = "페이지를 새로고침하고 다시 시도하세요";
      } else if (response?.count > 0) {
        result.className = "result success";
        result.style.display = "block";
        result.textContent = `✅ ${response.count}건 수집 완료`;
      } else {
        result.className = "result error";
        result.style.display = "block";
        result.textContent = "태그 데이터를 찾지 못했습니다";
      }
    });
  } finally {
    setTimeout(() => {
      btn.disabled = false;
      btn.textContent = "태그 수집";
    }, 1500);
  }
});
