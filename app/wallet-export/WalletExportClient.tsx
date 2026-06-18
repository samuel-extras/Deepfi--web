"use client";
/* eslint-disable */

import { usePrivy } from "@privy-io/react-auth";
import { useState } from "react";
import { LogOut, Shield, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export default function WalletExportClient() {
  const { ready, authenticated, user, login, logout, exportWallet } =
    usePrivy();
  const [isExporting, setIsExporting] = useState(false);
  const [hasAgreed, setHasAgreed] = useState(false);

  const handleExport = async () => {
    if (!hasAgreed) return;

    setIsExporting(true);
    try {
      await exportWallet();
    } catch (error: any) {
      console.error("Error exporting wallet:", error);
      if (
        error?.message?.toLowerCase().includes("rejected") ||
        error?.message?.toLowerCase().includes("cancelled")
      ) {
        toast.error("Export cancelled by user");
      } else {
        toast.error("Failed to export wallet");
      }
    } finally {
      setIsExporting(false);
    }
  };

  if (!ready) {
    return (
      <>
        <style jsx global>{`
          nav,
          header {
            display: none !important;
          }
          main {
            min-height: 100vh !important;
          }
        `}</style>
        <div
          className="min-h-screen flex items-center justify-center"
          style={{ backgroundColor: "#121417" }}
        >
          <div className="flex flex-col items-center gap-4">
            <div
              className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: "#02DA8B", borderTopColor: "transparent" }}
            />
            <p style={{ color: "#A9A9A9" }} className="text-sm">
              Loading...
            </p>
          </div>
        </div>
      </>
    );
  }

  if (!authenticated) {
    return (
      <>
        <style jsx global>{`
          nav,
          header {
            display: none !important;
          }
          main {
            min-height: 100vh !important;
          }
        `}</style>
        <div
          className="min-h-screen flex items-center justify-center p-4"
          style={{ backgroundColor: "#121417" }}
        >
          <div className="max-w-md w-full">
            <div
              className="rounded-2xl p-8"
              style={{
                backgroundColor: "#121417",
                border: "1px solid #2D3134",
              }}
            >
              <div className="text-center mb-8">
                <div
                  className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4"
                  style={{ backgroundColor: "rgba(2, 218, 139, 0.1)" }}
                >
                  <Shield className="w-8 h-8" style={{ color: "#02DA8B" }} />
                </div>
                <h1
                  className="text-2xl font-bold mb-2"
                  style={{ color: "white" }}
                >
                  Wallet Export
                </h1>
                <p className="text-sm" style={{ color: "#A9A9A9" }}>
                  Securely access and export your private key
                </p>
              </div>

              <button
                onClick={login}
                className="w-full font-semibold transition-all duration-200"
                style={{
                  backgroundColor: "#02DA8B",
                  color: "#1F1F1F",
                  height: "48px",
                  borderRadius: "62px",
                }}
              >
                Login
              </button>

              <div
                className="mt-6 p-4 rounded-xl"
                style={{
                  backgroundColor: "rgba(169, 169, 169, 0.1)",
                  border: "1px solid rgba(169, 169, 169, 0.2)",
                }}
              >
                <div className="flex gap-3">
                  <AlertTriangle
                    className="w-5 h-5 flex-shrink-0 mt-0.5"
                    style={{ color: "#A9A9A9" }}
                  />
                  <div>
                    <p
                      className="text-sm font-medium mb-1"
                      style={{ color: "#A9A9A9" }}
                    >
                      Security Warning
                    </p>
                    <p className="text-xs" style={{ color: "#A9A9A9" }}>
                      Never share your private key with anyone. Anyone with
                      access to your private key can control your wallet.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style jsx global>{`
        nav,
        header {
          display: none !important;
        }
        main {
          min-height: 100vh !important;
        }
      `}</style>
      <div className="min-h-screen p-4" style={{ backgroundColor: "#121417" }}>
        <div className="max-w-2xl mx-auto py-8">
          <div
            className="rounded-2xl p-6 flex flex-col space-y-5"
            style={{ backgroundColor: "#121417" }}
          >
            <h2
              className="text-lg font-semibold mb-4"
              style={{ color: "white" }}
            >
              Export Private Key
            </h2>
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={hasAgreed}
                onChange={e => setHasAgreed(e.target.checked)}
                className="mt-1 w-5 h-5 rounded cursor-pointer"
                style={{
                  accentColor: "#02DA8B",
                  borderColor: "#2D3134",
                }}
              />
              <span
                className="text-sm transition-colors"
                style={{ color: "#A9A9A9" }}
              >
                I understand that exposing my private key can lead to loss of
                funds, and I take full responsibility for keeping it secure.
              </span>
            </label>
            <p className="text-sm mb-6" style={{ color: "#A9A9A9" }}>
              Click the button below to securely export your wallet&apos;s
              private key. Privy will guide you through the process.
            </p>

            <button
              onClick={handleExport}
              disabled={!hasAgreed || isExporting}
              className="w-full font-semibold transition-all duration-200"
              style={{
                backgroundColor:
                  hasAgreed && !isExporting ? "#02DA8B" : "#2D3134",
                color: hasAgreed && !isExporting ? "#1F1F1F" : "#A9A9A9",
                height: "48px",
                borderRadius: "62px",
                cursor: hasAgreed && !isExporting ? "pointer" : "not-allowed",
              }}
            >
              {isExporting ? (
                <span className="flex items-center justify-center gap-2">
                  <div
                    className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
                    style={{
                      borderColor: "#1F1F1F",
                      borderTopColor: "transparent",
                    }}
                  />
                  Exporting...
                </span>
              ) : (
                "Export Private Key"
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
