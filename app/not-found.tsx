import Link from "next/link";

export default function NotFound() {
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
      <div style={{ textAlign: "center", maxWidth: 460 }}>
        <div
          className="serif"
          style={{
            fontSize: 96,
            letterSpacing: -3,
            fontWeight: 400,
            lineHeight: 1,
            color: "var(--text-tertiary)",
            marginBottom: 8,
          }}
        >
          404
        </div>
        <h1
          className="serif"
          style={{
            fontSize: 28,
            letterSpacing: -0.6,
            fontWeight: 400,
            marginBottom: 10,
          }}
        >
          The agents couldn&apos;t find that page.
        </h1>
        <p
          style={{
            fontSize: 14,
            color: "var(--text-secondary)",
            lineHeight: 1.6,
            marginBottom: 28,
          }}
        >
          Might have been moved, might never have existed. Either way, the
          pipeline is still running.
        </p>
        <Link
          href="/"
          style={{
            display: "inline-block",
            padding: "10px 20px",
            background: "var(--text)",
            color: "#fff",
            borderRadius: 7,
            fontSize: 13,
            fontWeight: 500,
            textDecoration: "none",
          }}
        >
          Back to the dashboard →
        </Link>
      </div>
    </div>
  );
}
