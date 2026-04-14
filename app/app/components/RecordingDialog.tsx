"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square, Loader2, X, Play, Pause } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  uploadUrl: string;
  uploadField: string;
  entityId: number | string;
  onComplete: () => void;
};

const MIME_EXT: Record<string, string> = {
  "audio/webm": "webm",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
};

function extOfMime(mime: string): string {
  const base = mime.split(";")[0].trim().toLowerCase();
  return MIME_EXT[base] ?? "webm";
}

export default function RecordingDialog({ open, onClose, title, uploadUrl, uploadField, entityId, onComplete }: Props) {
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pauseSupported, setPauseSupported] = useState(true);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pausedRef = useRef(false);
  const audioElRef = useRef<HTMLAudioElement | null>(null);

  const fixAudioDuration = (el: HTMLAudioElement) => {
    if (el.duration === Infinity || isNaN(el.duration)) {
      const onTimeUpdate = () => {
        el.currentTime = 0;
        el.removeEventListener("timeupdate", onTimeUpdate);
      };
      el.addEventListener("timeupdate", onTimeUpdate);
      el.currentTime = 1e101;
    }
  };

  const acquireWakeLock = async () => {
    try {
      if ("wakeLock" in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request("screen");
      }
    } catch {}
  };

  const releaseWakeLock = async () => {
    try {
      await wakeLockRef.current?.release();
      wakeLockRef.current = null;
    } catch {}
  };

  useEffect(() => {
    // 업로드 중이면 강제 닫기에도 blob 보존
    if (!open && !processing) cleanup();
  }, [open, processing]);

  // 모달 열려있는 동안 body 스크롤 잠금
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = prev; };
    }
  }, [open]);

  // 녹음 시작 후 canvas가 mount된 뒤 파형 루프 시작
  useEffect(() => {
    if (!recording) return;
    if (!analyserRef.current || !canvasRef.current) return;
    rafRef.current = requestAnimationFrame(drawWaveform);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [recording]);

  // 화면 가시성 복귀 시 Wake Lock 재획득
  useEffect(() => {
    function onVisChange() {
      if (document.visibilityState === "visible" && recording) acquireWakeLock();
    }
    document.addEventListener("visibilitychange", onVisChange);
    return () => document.removeEventListener("visibilitychange", onVisChange);
  }, [recording]);

  const cleanup = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (mediaRecorderRef.current?.state !== "inactive") {
      try { mediaRecorderRef.current?.stop(); } catch {}
    }
    mediaRecorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    try { audioCtxRef.current?.close(); } catch {}
    audioCtxRef.current = null;
    analyserRef.current = null;
    releaseWakeLock();
    setRecording(false);
    setPaused(false);
    pausedRef.current = false;
    setElapsed(0);
    setAudioUrl(null);
    setAudioBlob(null);
    setProcessing(false);
    setProgress(0);
    setErrorMsg(null);
    chunksRef.current = [];
  };

  const tryClose = () => {
    if (processing) {
      setErrorMsg("업로드 중에는 닫을 수 없습니다.");
      return;
    }
    onClose();
  };

  const drawWaveform = () => {
    const analyser = analyserRef.current;
    const canvas = canvasRef.current;
    if (!analyser || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.scale(dpr, dpr);
    }
    const bufferLength = analyser.frequencyBinCount;
    const data = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(data);
    ctx.clearRect(0, 0, w, h);
    const bars = 32;
    const step = Math.floor(bufferLength / bars);
    const barWidth = w / bars;
    for (let i = 0; i < bars; i++) {
      let sum = 0;
      for (let j = 0; j < step; j++) sum += data[i * step + j] ?? 0;
      const avg = sum / step;
      const barHeight = Math.max(4, (avg / 255) * h * 0.9);
      ctx.fillStyle = pausedRef.current ? "#9ca3af" : "#ef4444";
      const x = i * barWidth + barWidth * 0.15;
      const y = (h - barHeight) / 2;
      ctx.fillRect(x, y, barWidth * 0.7, barHeight);
    }
    rafRef.current = requestAnimationFrame(drawWaveform);
  };

  const pickMimeType = (): string => {
    if (typeof MediaRecorder === "undefined") return "";
    const candidates = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",
      "audio/mpeg",
      "audio/ogg;codecs=opus",
      "audio/ogg",
      "audio/wav",
    ];
    for (const t of candidates) {
      try { if (MediaRecorder.isTypeSupported(t)) return t; } catch {}
    }
    return "";
  };

  const startRecording = async () => {
    setErrorMsg(null);
    if (!window.isSecureContext) {
      setErrorMsg("보안 연결(HTTPS)이 필요합니다.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setErrorMsg("이 브라우저에서는 녹음이 지원되지 않습니다. 최신 크롬/삼성인터넷/사파리를 사용하세요.");
      return;
    }
    if (typeof MediaRecorder === "undefined") {
      setErrorMsg("이 브라우저는 녹음을 지원하지 않습니다.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chosen = pickMimeType();
      const mediaRecorder = chosen
        ? new MediaRecorder(stream, { mimeType: chosen })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      setPauseSupported(typeof mediaRecorder.pause === "function");

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const type = mediaRecorder.mimeType || chosen || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorder.onerror = (e: Event) => {
        const err = (e as any).error;
        setErrorMsg("녹음 중 오류: " + (err?.message ?? err?.name ?? "알 수 없음"));
      };

      // 파형 분석기 준비
      try {
        const AC: typeof AudioContext =
          window.AudioContext || (window as any).webkitAudioContext;
        const audioCtx = new AC();
        try { await audioCtx.resume(); } catch {}
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        audioCtxRef.current = audioCtx;
        analyserRef.current = analyser;
      } catch {}

      mediaRecorder.start();
      setRecording(true);
      setElapsed(0);
      acquireWakeLock();

      timerRef.current = setInterval(() => {
        setElapsed((e) => e + 1);
      }, 1000);
    } catch (err) {
      const name = (err as Error).name;
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setErrorMsg("마이크 권한이 거부되었습니다. 브라우저 설정에서 허용해주세요.");
      } else if (name === "NotFoundError") {
        setErrorMsg("사용 가능한 마이크를 찾을 수 없습니다.");
      } else if (name === "SecurityError") {
        setErrorMsg("보안 연결(HTTPS) 문제로 마이크를 사용할 수 없습니다.");
      } else {
        setErrorMsg("녹음 시작 실패: " + (err as Error).message);
      }
    }
  };

  const togglePause = () => {
    const mr = mediaRecorderRef.current;
    if (!mr || !pauseSupported) return;
    if (paused) {
      try { mr.resume(); } catch {}
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
      setPaused(false);
      pausedRef.current = false;
    } else {
      try { mr.pause(); } catch {}
      if (timerRef.current) clearInterval(timerRef.current);
      setPaused(true);
      pausedRef.current = true;
    }
  };

  const stopRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    try { mediaRecorderRef.current?.stop(); } catch {}
    setRecording(false);
    setPaused(false);
    pausedRef.current = false;
    releaseWakeLock();
  };

  const handleSubmit = async () => {
    const blob = audioBlob;
    if (!blob) {
      setErrorMsg("녹음이 아직 준비되지 않았습니다. 잠시 후 다시 시도하세요.");
      return;
    }
    setProcessing(true);
    setProgress(0);
    setErrorMsg(null);

    const ext = extOfMime(blob.type);
    const path = `${uploadField === "senior_id" ? "journal" : "counseling"}_${entityId}_${Date.now()}.${ext}`;

    try {
      // 1) 서명 업로드 URL 발급
      const urlRes = await fetch("/api/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path }),
      });
      if (!urlRes.ok) throw new Error(`업로드 URL 발급 실패 (${urlRes.status})`);
      const { signedUrl } = await urlRes.json();

      // 2) Supabase Storage로 직접 업로드 (Vercel 4.5MB 본문 한계 우회)
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", signedUrl);
        xhr.setRequestHeader("Content-Type", blob.type || "audio/webm");
        xhr.setRequestHeader("x-upsert", "true");
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => xhr.status >= 200 && xhr.status < 300
          ? resolve()
          : reject(new Error(`Storage 업로드 실패 (${xhr.status}): ${xhr.responseText?.slice(0, 150)}`));
        xhr.onerror = () => reject(new Error("네트워크 오류로 업로드 실패"));
        xhr.ontimeout = () => reject(new Error("업로드 시간 초과"));
        xhr.timeout = 10 * 60 * 1000;
        xhr.send(blob);
      });

      // 3) 메타데이터 등록 → AI 변환 트리거
      const metaRes = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          [uploadField]: entityId,
          duration: elapsed,
          audio_path: path,
          mime_type: blob.type,
        }),
      });
      if (!metaRes.ok) {
        const text = await metaRes.text();
        throw new Error(`등록 실패 (${metaRes.status}): ${text.slice(0, 200)}`);
      }
      onComplete();
      onClose();
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setProcessing(false);
    }
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={tryClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold truncate pr-2">{title}</h3>
          <button onClick={tryClose} className="p-2 text-gray-400 active:text-gray-700" aria-label="닫기">
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3 break-words">
            {errorMsg}
          </div>
        )}

        <div className="flex flex-col items-center py-4">
          {!recording && !audioUrl && (
            <>
              <button
                onClick={startRecording}
                className="w-24 h-24 bg-red-500 active:bg-red-700 rounded-full flex items-center justify-center shadow-lg"
              >
                <Mic className="w-10 h-10 text-white" />
              </button>
              <p className="mt-4 text-sm text-gray-500">버튼을 눌러 녹음을 시작하세요</p>
            </>
          )}

          {recording && (
            <>
              <canvas
                ref={canvasRef}
                className="w-full h-24 bg-gray-50 rounded-lg"
              />
              <p className="mt-3 text-3xl font-mono font-bold">{formatTime(elapsed)}</p>
              <p className="text-sm text-gray-500">{paused ? "일시정지됨" : "녹음 중..."}</p>
              <div className="flex gap-3 mt-4 w-full">
                {pauseSupported && (
                  <button
                    onClick={togglePause}
                    className="flex-1 min-h-[44px] px-4 py-3 bg-gray-100 active:bg-gray-300 rounded-lg flex items-center justify-center gap-2 font-medium"
                  >
                    {paused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
                    {paused ? "재개" : "일시정지"}
                  </button>
                )}
                <button
                  onClick={stopRecording}
                  className="flex-1 min-h-[44px] px-4 py-3 bg-red-500 active:bg-red-700 text-white rounded-lg flex items-center justify-center gap-2 font-medium"
                >
                  <Square className="w-5 h-5" />
                  정지
                </button>
              </div>
            </>
          )}

          {audioUrl && !recording && (
            <>
              <p className="text-sm text-gray-500 mb-3">녹음 완료 ({formatTime(elapsed)})</p>
              <audio
                ref={audioElRef}
                controls
                src={audioUrl}
                preload="metadata"
                onLoadedMetadata={(e) => fixAudioDuration(e.currentTarget)}
                className="w-full mb-4"
              />
              {processing && (
                <div className="w-full mb-4">
                  <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                    <span>업로드 중...</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-indigo-600 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              )}
              <div className="flex gap-3 w-full">
                <button
                  onClick={() => {
                    setAudioUrl(null);
                    setAudioBlob(null);
                    setElapsed(0);
                    setErrorMsg(null);
                    setProgress(0);
                  }}
                  className="flex-1 min-h-[44px] px-4 py-3 bg-gray-100 active:bg-gray-300 rounded-lg font-medium"
                  disabled={processing}
                >
                  다시 녹음
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={processing}
                  className="flex-1 min-h-[44px] px-4 py-3 bg-indigo-600 active:bg-indigo-800 text-white rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 font-medium"
                >
                  {processing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      업로드 중
                    </>
                  ) : (
                    "일지 생성"
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
