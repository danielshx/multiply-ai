"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg)",
        padding: 20,
      }}
    >
      <div
        style={{
          maxWidth: 540,
          textAlign: "center",
          padding: 40,
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 14,
          boxShadow: "var(--shadow-md)",
        }}
      >
        <div style={{ fontSize: 48, marginBottom: 12 }}>🌀</div>
        <h1
          className="serif"
          style={{
            fontSize: 32,
            letterSpacing: -0.8,
            fontWeight: 400,
            marginBottom: 8,
          }}
        >
          Something glitched.
        </h1>
        <p
          style={{
            fontSize: 14,
            color: "var(--text-secondary)",
            lineHeight: 1.6,
            marginBottom: 24,
          }}
        >
          An unexpected error happened. The agents are still running — this was
          just the view that stumbled.
        </p>
        {error.digest && (
          <div
            style={{
              fontSize: 11,
              fontFamily: "var(--mono)",
              color: "var(--text-tertiary)",
              padding: "6px 10px",
              background: "var(--bg-subtle)",
              borderRadius: 6,
              marginBottom: 18,
              wordBreak: "break-all",
            }}
          >
            ref: {error.digest}
          </div>
        )}
        <button
          onClick={reset}
          style={{
            padding: "10px 20px",
            background: "var(--text)",
            color: "#fff",
            borderRadius: 7,
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          Try again →
        </button>
      </div>
    </div>
  );
}
