"use client";

/**
 * QRModal – Displays a QR code for the current session link
 *
 * Encodes the current page URL (optionally with a session ID) so users
 * can continue browsing on their mobile device.
 */

import { motion, AnimatePresence } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import { X, QrCode } from "lucide-react";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

interface QRModalProps {
  sessionId: string;
  language: "ar" | "en";
}

export default function QRModal({ sessionId, language }: QRModalProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [networkIp, setNetworkIp] = useState<string | null>(null);

  // Mount guard for createPortal (must run client-side only)
  useEffect(() => {
    setMounted(true);
    // Fetch external network IP for correct QR generation
    fetch("/api/network-ip")
      .then((res) => res.json())
      .then((data) => {
        if (data.ip && data.ip !== "localhost") {
          setNetworkIp(data.ip);
        }
      })
      .catch((err) => console.error("Could not fetch network IP", err));
  }, []);

  // Build the shareable URL
  let baseUrl = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";

  // Override localhost with real network IP for remote phone access
  if (networkIp && typeof window !== "undefined") {
    const port = window.location.port ? `:${window.location.port}` : "";
    baseUrl = `http://${networkIp}${port}`;
  }

  const appUrl = `${baseUrl}/?session=${sessionId}&lang=${language}`;

  const label = language === "ar" ? "مشاركة على الموبايل" : "Share to Mobile";
  const subtitle =
    language === "ar"
      ? "امسح الكود للمتابعة على هاتفك"
      : "Scan to continue on your phone";

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        title={label}
        className="flex items-center gap-2 rounded-full border border-white/20 bg-white/10 hover:bg-white/20 px-4 py-2 text-sm font-medium text-white transition-colors"
      >
        <QrCode size={16} />
        {label}
      </button>

      {/* Modal overlay */}
      {mounted && typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                key="backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
                onClick={() => setOpen(false)}
              >
                <motion.div
                  key="modal"
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 20 }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  className="relative rounded-3xl bg-slate-900 border-2 border-white/20 p-8 flex flex-col items-center gap-6 max-w-xs w-full shadow-[0_0_40px_rgba(0,0,0,0.5)] m-4"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Close button */}
                  <button
                    onClick={() => setOpen(false)}
                    className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors"
                    aria-label="Close"
                  >
                    <X size={20} />
                  </button>

                  {/* Title */}
                  <div className="text-center">
                    <h2 className="text-white font-semibold text-lg">
                      {language === "ar" ? "مشاركة الجلسة" : "Share Session"}
                    </h2>
                    <p className="text-white/50 text-sm mt-1">{subtitle}</p>
                  </div>

                  {/* QR Code */}
                  <div className="flex items-center justify-center p-4 bg-white rounded-2xl shadow-[0_0_20px_rgba(255,255,255,0.1)] border-4 border-white/10 mx-auto transition-transform hover:scale-105 duration-300">
                    <QRCodeSVG
                      value={appUrl}
                      size={180}
                      level="M"
                      includeMargin={false}
                      fgColor="#0f172a"
                    />
                  </div>

                  {/* URL preview */}
                  <p className="text-white/40 text-[10px] sm:text-xs text-center break-all font-mono bg-white/5 p-3 rounded-xl w-full border border-white/10">
                    {appUrl}
                  </p>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}
