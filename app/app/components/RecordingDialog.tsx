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

export default function RecordingDialog({ open, onClose, title, uploadUrl, uploadField, entityId, onComplete }: Props) {
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [processing, setProcessing] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const acquireWakeLock = async () => {
    try {
      if ("wakeLock" in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request("screen");
      }
    } catch (err) {
      console.warn("Wake Lock 실패:", err);
    }
  };

  const releaseWakeLock = async () => {
    try {
      await wakeLockRef.current?.release();
      wakeLockRef.current = null;
    } catch {}
  };

  useEffect(() => {
    if (!open) {
      cleanup();
    }
  }, [open]);

  const cleanup = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current?.state !== "inactive") {
      mediaRecorderRef.current?.stop();
    }
    mediaRecorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    releaseWakeLock();
    setRecording(false);
    setPaused(false);
    setElapsed(0);
    setAudioUrl(null);
    setAudioBlob(null);
    setProcessing(false);
    chunksRef.current = [];
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorder.start();
      setRecording(true);
      setElapsed(0);
      acquireWakeLock();

      timerRef.current = setInterval(() => {
        setElapsed((e) => e + 1);
      }, 1000);
    } catch (err) {
      alert("마이크 권한이 필요합니다: " + (err as Error).message);
    }
  };

  const togglePause = () => {
    if (!mediaRecorderRef.current) return;
    if (paused) {
      mediaRecorderRef.current.resume();
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } else {
      mediaRecorderRef.current.pause();
      if (timerRef.current) clearInterval(timerRef.current);
    }
    setPaused(!paused);
  };

  const stopRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    mediaRecorderRef.current?.stop();
    setRecording(false);
    setPaused(false);
    releaseWakeLock();
  };

  const handleSubmit = async () => {
    if (!audioBlob) return;
    setProcessing(true);

    const formData = new FormData();
    formData.append(uploadField, String(entityId));
    formData.append("duration", String(elapsed));
    formData.append("audio", audioBlob, "recording.webm");

    try {
      const res = await fetch(uploadUrl, { method: "POST", body: formData });
      if (!res.ok) throw new Error("업로드 실패");
      onComplete();
      onClose();
    } catch (err) {
      alert("업로드 실패: " + (err as Error).message);
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
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col items-center py-8">
          {!recording && !audioUrl && (
            <>
              <button
                onClick={startRecording}
                className="w-24 h-24 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center shadow-lg transition"
              >
                <Mic className="w-10 h-10 text-white" />
              </button>
              <p className="mt-4 text-sm text-gray-500">버튼을 눌러 녹음을 시작하세요</p>
            </>
          )}

          {recording && (
            <>
              <div className="w-24 h-24 bg-red-500 rounded-full flex items-center justify-center shadow-lg animate-pulse">
                <div className="w-10 h-10 bg-white rounded" />
              </div>
              <p className="mt-4 text-3xl font-mono font-bold">{formatTime(elapsed)}</p>
              <p className="text-sm text-gray-500">{paused ? "일시정지됨" : "녹음 중..."}</p>
              <div className="flex gap-3 mt-4">
                <button
                  onClick={togglePause}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center gap-2"
                >
                  {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                  {paused ? "재개" : "일시정지"}
                </button>
                <button
                  onClick={stopRecording}
                  className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg flex items-center gap-2"
                >
                  <Square className="w-4 h-4" />
                  정지
                </button>
              </div>
            </>
          )}

          {audioUrl && !recording && (
            <>
              <p className="text-sm text-gray-500 mb-3">녹음 완료 ({formatTime(elapsed)})</p>
              <audio controls src={audioUrl} className="w-full mb-6" />
              <div className="flex gap-3 w-full">
                <button
                  onClick={() => {
                    setAudioUrl(null);
                    setAudioBlob(null);
                    setElapsed(0);
                  }}
                  className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg"
                  disabled={processing}
                >
                  다시 녹음
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={processing}
                  className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {processing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      일지 생성 중...
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
