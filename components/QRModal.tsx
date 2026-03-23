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
import { useState } from "react";

interface QRModalProps {
  sessionId: string;
  language: "ar" | "en";
}

export default function QRModal({ sessionId, language }: QRModalProps) {
  const [open, setOpen] = useState(false);

  // Build the shareable URL
  const appUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/?session=${sessionId}&lang=${language}`
      : `http://localhost/?session=${sessionId}&lang=${language}`;

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
      <AnimatePresence>
        {open && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={() => setOpen(false)}
          >
            <motion.div
              key="modal"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="relative rounded-3xl bg-slate-900 border border-white/10 p-8 flex flex-col items-center gap-6 max-w-xs w-full shadow-2xl"
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
              <div className="p-4 bg-white rounded-2xl shadow-inner">
                <QRCodeSVG
                  value={appUrl}
                  size={180}
                  level="M"
                  includeMargin={false}
                  fgColor="#0f172a"
                />
              </div>

              {/* URL preview */}
              <p className="text-white/30 text-xs text-center break-all font-mono">
                {appUrl}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
