"use client";

import { useEffect, useRef, useState } from "react";
import type { IScannerControls } from "@zxing/browser";
import { CameraIcon } from "@/components/icons";

export function BarcodeScanner({
  title,
  helpText,
  onDetected,
  onClose,
}: {
  title: string;
  helpText: string;
  onDetected: (value: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const completedRef = useRef(false);
  const [status, setStatus] = useState("Starting camera…");
  const [error, setError] = useState("");
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        if (cancelled || !videoRef.current) return;

        const reader = new BrowserMultiFormatReader(undefined, {
          delayBetweenScanAttempts: 150,
          delayBetweenScanSuccess: 500,
          tryPlayVideoTimeout: 5000,
        });

        const controls = await reader.decodeFromConstraints(
          {
            audio: false,
            video: {
              facingMode: { ideal: "environment" },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          },
          videoRef.current,
          (result, scanError, activeControls) => {
            if (cancelled || completedRef.current) return;
            controlsRef.current = activeControls;
            setTorchAvailable(Boolean(activeControls.switchTorch));

            if (result) {
              const value = result.getText().trim();
              if (!value) return;
              completedRef.current = true;
              activeControls.stop();
              setStatus("Code captured.");
              onDetected(value);
              return;
            }

            if (scanError?.name && !["NotFoundException", "ChecksumException", "FormatException"].includes(scanError.name)) {
              setStatus("Keep the code steady inside the frame.");
            }
          },
        );

        if (cancelled) {
          controls.stop();
          return;
        }

        controlsRef.current = controls;
        setTorchAvailable(Boolean(controls.switchTorch));
        setStatus("Point the camera at the barcode or QR code.");
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "Camera scanning is not available on this device.";
        setError(message.includes("Permission") || message.includes("NotAllowed")
          ? "Camera access was blocked. Allow camera access in your browser settings and try again."
          : message);
      }
    }

    void start();

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [onDetected]);

  async function toggleTorch() {
    const switchTorch = controlsRef.current?.switchTorch;
    if (!switchTorch) return;
    const next = !torchOn;
    try {
      await switchTorch(next);
      setTorchOn(next);
    } catch {
      setError("The phone torch could not be controlled by this browser.");
    }
  }

  return (
    <div className="modalBackdrop" role="dialog" aria-modal="true" aria-labelledby="scanner-title">
      <div className="modalCard scannerModal">
        <div className="scannerHeader">
          <div><p className="eyebrow red">Camera scanner</p><h2 id="scanner-title">{title}</h2><p>{helpText}</p></div>
          <button className="scannerClose" type="button" onClick={onClose} aria-label="Close scanner">×</button>
        </div>

        <div className="scannerViewport">
          <video ref={videoRef} muted playsInline />
          <div className="scannerFrame" aria-hidden="true"><span /><span /><span /><span /></div>
          {!error && <div className="scannerStatus"><CameraIcon /> {status}</div>}
        </div>

        {error && <div className="notice danger">{error}</div>}

        <div className="scannerActions">
          {torchAvailable && <button className="button secondary" type="button" onClick={() => void toggleTorch()}>{torchOn ? "Turn torch off" : "Turn torch on"}</button>}
          <button className="button secondary" type="button" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
