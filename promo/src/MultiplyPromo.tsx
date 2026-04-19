import React from "react";
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
} from "remotion";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadJetBrainsMono } from "@remotion/google-fonts/JetBrainsMono";

const { fontFamily: INTER } = loadInter();
const { fontFamily: MONO } = loadJetBrainsMono();

export const PROMO_FPS = 30;
export const PROMO_WIDTH = 1920;
export const PROMO_HEIGHT = 1080;
export const PROMO_DURATION_FRAMES = 30 * PROMO_FPS;

//  ────────────────────────────────────────────────────────────────────────
//  Scene ranges
//  ────────────────────────────────────────────────────────────────────────
const S = {
  cold: [0, 90] as const,         // 0.0 – 3.0s
  problem: [90, 210] as const,    // 3.0 – 7.0s
  until: [210, 300] as const,     // 7.0 – 10.0s
  title: [300, 420] as const,     // 10.0 – 14.0s
  orchestra: [420, 540] as const, // 14.0 – 18.0s
  swarm: [540, 630] as const,     // 18.0 – 21.0s
  earth: [630, 750] as const,     // 21.0 – 25.0s
  graph: [750, 810] as const,     // 25.0 – 27.0s
  kpi: [810, 870] as const,       // 27.0 – 29.0s
  close: [870, 900] as const,     // 29.0 – 30.0s
};

//  ────────────────────────────────────────────────────────────────────────
//  Palette
//  ────────────────────────────────────────────────────────────────────────
const VIOLET = "#7c5cff";
const COOL = "#5ce6d4";
const WARM = "#ffb347";
const HOT = "#ff5c7a";
const GOLD = "#ffd27a";

//  ────────────────────────────────────────────────────────────────────────
//  Deterministic pseudo-random
//  ────────────────────────────────────────────────────────────────────────
const prng = (i: number, seed = 1) =>
  ((i * 9301 + 49297 + seed * 2333) % 233280) / 233280;

//  ────────────────────────────────────────────────────────────────────────
//  Background layers
//  ────────────────────────────────────────────────────────────────────────
const Background: React.FC = () => {
  const frame = useCurrentFrame();
  const pulse = Math.sin(frame / 22) * 0.05 + 0.95;
  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(ellipse at 50% 50%, #0a1020 0%, #050810 60%, #000000 100%)",
        opacity: pulse,
      }}
    />
  );
};

const Scanlines: React.FC = () => (
  <AbsoluteFill
    style={{
      backgroundImage:
        "repeating-linear-gradient(0deg, rgba(255,255,255,0.02) 0px, rgba(255,255,255,0.02) 1px, transparent 1px, transparent 3px)",
      pointerEvents: "none",
      mixBlendMode: "overlay",
    }}
  />
);

const Grid: React.FC<{ opacity?: number }> = ({ opacity = 0.06 }) => (
  <AbsoluteFill
    style={{
      backgroundImage:
        "linear-gradient(rgba(124,92,255,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(124,92,255,0.35) 1px, transparent 1px)",
      backgroundSize: "80px 80px",
      opacity,
      maskImage:
        "radial-gradient(ellipse at 50% 50%, black 10%, transparent 70%)",
    }}
  />
);

const ParticleField: React.FC<{ count?: number; seed?: number }> = ({
  count = 80,
  seed = 3,
}) => {
  const frame = useCurrentFrame();
  const particles = React.useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const r = prng(i, seed);
        const r2 = prng(i + 1000, seed);
        const r3 = prng(i + 2000, seed);
        return {
          x: r * 100,
          y: r2 * 100,
          size: 1 + r3 * 2.5,
          speed: 0.15 + r3 * 0.6,
          phase: r * Math.PI * 2,
        };
      }),
    [count, seed],
  );

  return (
    <AbsoluteFill>
      {particles.map((p, i) => {
        const driftY = (p.y + frame * p.speed * 0.1) % 100;
        const opacity = 0.25 + Math.sin(frame / 30 + p.phase) * 0.2;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${p.x}%`,
              top: `${driftY}%`,
              width: p.size,
              height: p.size,
              borderRadius: "50%",
              background: i % 7 === 0 ? VIOLET : "#ffffff",
              opacity,
              boxShadow: i % 7 === 0 ? `0 0 ${p.size * 6}px ${VIOLET}` : "none",
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

const Vignette: React.FC = () => (
  <AbsoluteFill
    style={{
      background:
        "radial-gradient(ellipse at 50% 50%, transparent 40%, rgba(0,0,0,0.7) 100%)",
      pointerEvents: "none",
    }}
  />
);

//  ────────────────────────────────────────────────────────────────────────
//  Scene 1 — Cold open
//  ────────────────────────────────────────────────────────────────────────
const SceneCold: React.FC = () => {
  const frame = useCurrentFrame();
  const scale = interpolate(frame, [0, 60, 90], [0, 1, 1.4], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const opacity = interpolate(frame, [0, 30, 70, 90], [0, 1, 1, 0]);
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <div
        style={{
          width: 24 * scale,
          height: 24 * scale,
          borderRadius: "50%",
          background: "white",
          opacity,
          boxShadow: `0 0 ${60 * scale}px white, 0 0 ${180 * scale}px ${VIOLET}`,
        }}
      />
    </AbsoluteFill>
  );
};

//  ────────────────────────────────────────────────────────────────────────
//  Scene 2 — Problem
//  ────────────────────────────────────────────────────────────────────────
const SceneProblem: React.FC = () => {
  const frame = useCurrentFrame();
  const fadeIn = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
  });
  const fadeOut = interpolate(frame, [90, 120], [1, 0], {
    extrapolateLeft: "clamp",
  });
  const opacity = Math.min(fadeIn, fadeOut);
  const letterSpacing = interpolate(frame, [0, 90], [0.4, 0.1]);

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <div
        style={{
          fontFamily: INTER,
          fontWeight: 300,
          color: "rgba(255,255,255,0.88)",
          fontSize: 78,
          letterSpacing: `${letterSpacing}em`,
          textAlign: "center",
          opacity,
        }}
      >
        Sales is still mostly human.
      </div>
      <div
        style={{
          fontFamily: MONO,
          fontWeight: 400,
          color: VIOLET,
          fontSize: 22,
          letterSpacing: "0.3em",
          marginTop: 34,
          opacity: opacity * 0.75,
        }}
      >
        70% MECHANICAL · 30% DECISIONS · 100% EXHAUSTING
      </div>
    </AbsoluteFill>
  );
};

//  ────────────────────────────────────────────────────────────────────────
//  Scene 3 — Until now
//  ────────────────────────────────────────────────────────────────────────
const SceneUntilNow: React.FC = () => {
  const frame = useCurrentFrame();
  const fadeIn = interpolate(frame, [0, 22], [0, 1], {
    extrapolateRight: "clamp",
  });
  const fadeOut = interpolate(frame, [60, 90], [1, 0], {
    extrapolateLeft: "clamp",
  });
  const opacity = Math.min(fadeIn, fadeOut);
  const slide = interpolate(frame, [0, 30], [20, 0], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <div
        style={{
          fontFamily: INTER,
          fontWeight: 200,
          color: "white",
          fontSize: 140,
          letterSpacing: "-0.02em",
          transform: `translateY(${slide}px)`,
          opacity,
        }}
      >
        Until now.
      </div>
    </AbsoluteFill>
  );
};

//  ────────────────────────────────────────────────────────────────────────
//  Scene 4 — Title
//  ────────────────────────────────────────────────────────────────────────
const SceneTitle: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const titleSpring = spring({
    fps,
    frame: frame - 6,
    config: { damping: 18, stiffness: 120, mass: 0.9 },
  });
  const titleOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
  });
  const subOpacity = interpolate(frame, [34, 58], [0, 1], {
    extrapolateRight: "clamp",
  });
  const fadeOut = interpolate(frame, [100, 120], [1, 0], {
    extrapolateLeft: "clamp",
  });
  const shimmer = interpolate(frame, [0, 120], [0, 120]);

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <div
        style={{
          fontFamily: INTER,
          fontWeight: 800,
          fontSize: 240,
          letterSpacing: "-0.04em",
          opacity: titleOpacity * fadeOut,
          transform: `scale(${0.9 + titleSpring * 0.1})`,
          backgroundImage: `linear-gradient(100deg, #ffffff 0%, #ffffff 40%, ${VIOLET} 50%, #ffffff 60%, #ffffff 100%)`,
          backgroundSize: "300% 100%",
          backgroundPosition: `${shimmer}% 0`,
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          lineHeight: 1,
        }}
      >
        multiply
      </div>
      <div
        style={{
          fontFamily: MONO,
          fontSize: 26,
          letterSpacing: "0.42em",
          color: "rgba(255,255,255,0.7)",
          marginTop: 32,
          opacity: subOpacity * fadeOut,
          textTransform: "uppercase",
        }}
      >
        The swarm outreach engine
      </div>
      <div
        style={{
          fontFamily: MONO,
          fontSize: 16,
          color: VIOLET,
          letterSpacing: "0.6em",
          marginTop: 14,
          opacity: subOpacity * fadeOut * 0.8,
        }}
      >
        HAPPYROBOT × TUM.AI · 2026
      </div>
    </AbsoluteFill>
  );
};

//  ────────────────────────────────────────────────────────────────────────
//  Scene 5 — Orchestra (procedural: 1 core + 7 orbs)
//  ────────────────────────────────────────────────────────────────────────
const ROLES = [
  "SIGNAL HUNTER",
  "PROSPECTOR",
  "RESEARCHER",
  "PERSONALISER",
  "QUALIFIER",
  "NEGOTIATOR",
  "CLOSER",
];

const SceneOrchestra: React.FC = () => {
  const frame = useCurrentFrame();
  const cx = 960;
  const cy = 560;
  const orbitR = 270;
  const rotation = interpolate(frame, [0, 120], [-8, 14], {
    easing: Easing.inOut(Easing.cubic),
  });
  const sceneOpacity = interpolate(frame, [0, 18, 100, 120], [0, 1, 1, 0]);
  const corePulse = Math.sin(frame / 7) * 8 + 64;
  const coreRing = Math.sin(frame / 11) * 6 + 84;

  return (
    <AbsoluteFill style={{ opacity: sceneOpacity }}>
      <svg
        width={PROMO_WIDTH}
        height={PROMO_HEIGHT}
        style={{ position: "absolute", inset: 0 }}
      >
        <defs>
          <radialGradient id="coreGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity={0.95} />
            <stop offset="35%" stopColor={VIOLET} stopOpacity={0.9} />
            <stop offset="100%" stopColor={VIOLET} stopOpacity={0} />
          </radialGradient>
          <radialGradient id="orbGrad" cx="50%" cy="45%" r="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity={0.9} />
            <stop offset="60%" stopColor={VIOLET} stopOpacity={0.8} />
            <stop offset="100%" stopColor={VIOLET} stopOpacity={0} />
          </radialGradient>
          <filter id="orbBlur" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="12" />
          </filter>
        </defs>

        {/* soft glow around core */}
        <circle
          cx={cx}
          cy={cy}
          r={180}
          fill="url(#coreGrad)"
          opacity={0.25}
          filter="url(#orbBlur)"
        />

        {/* connection lines + orbs */}
        {ROLES.map((role, i) => {
          const angle =
            (i / ROLES.length) * Math.PI * 2 +
            (rotation * Math.PI) / 180 -
            Math.PI / 2;
          const x = cx + Math.cos(angle) * orbitR;
          const y = cy + Math.sin(angle) * orbitR;
          const revealFrame = 16 + i * 7;
          const appear = interpolate(
            frame,
            [revealFrame, revealFrame + 18],
            [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          );
          const linePulse = (Math.sin(frame / 8 + i * 0.6) + 1) / 2;
          const orbPulse = Math.sin(frame / 10 + i) * 3 + 20;

          // data-packet traveling along the line
          const packetT = ((frame + i * 11) % 60) / 60;
          const px = cx + (x - cx) * packetT;
          const py = cy + (y - cy) * packetT;

          return (
            <g key={role} opacity={appear}>
              <line
                x1={cx}
                y1={cy}
                x2={x}
                y2={y}
                stroke={VIOLET}
                strokeWidth={1}
                opacity={0.2 + linePulse * 0.4}
              />
              <circle cx={px} cy={py} r={2.5} fill={VIOLET} opacity={0.9} />
              {/* orb */}
              <circle
                cx={x}
                cy={y}
                r={orbPulse + 14}
                fill="url(#orbGrad)"
                opacity={0.25}
              />
              <circle
                cx={x}
                cy={y}
                r={orbPulse}
                fill="#0a1020"
                stroke={VIOLET}
                strokeWidth={1.5}
              />
              <circle cx={x} cy={y} r={6} fill={VIOLET} />
            </g>
          );
        })}

        {/* role labels — rendered last so they're on top */}
        {ROLES.map((role, i) => {
          const angle =
            (i / ROLES.length) * Math.PI * 2 +
            (rotation * Math.PI) / 180 -
            Math.PI / 2;
          const x = cx + Math.cos(angle) * orbitR;
          const y = cy + Math.sin(angle) * orbitR;
          const revealFrame = 16 + i * 7;
          const appear = interpolate(
            frame,
            [revealFrame, revealFrame + 18],
            [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          );
          const labelOffsetY = Math.sin(angle) > 0 ? 60 : -48;
          return (
            <text
              key={role + "-t"}
              x={x}
              y={y + labelOffsetY}
              textAnchor="middle"
              fontFamily={MONO}
              fontSize={16}
              letterSpacing={3}
              fill="white"
              opacity={appear * 0.92}
            >
              {role}
            </text>
          );
        })}

        {/* core */}
        <circle
          cx={cx}
          cy={cy}
          r={coreRing}
          fill="none"
          stroke={VIOLET}
          strokeWidth={1}
          opacity={0.5}
        />
        <circle cx={cx} cy={cy} r={corePulse} fill="url(#coreGrad)" />
        <circle cx={cx} cy={cy} r={corePulse * 0.55} fill={VIOLET} />
        <text
          x={cx}
          y={cy + 5}
          textAnchor="middle"
          fontFamily={MONO}
          fontSize={13}
          letterSpacing={2.5}
          fill="white"
          fontWeight={600}
        >
          ORCHESTRATOR
        </text>
      </svg>

      {/* caption */}
      <div
        style={{
          position: "absolute",
          left: 120,
          top: 140,
          opacity: interpolate(frame, [8, 28, 100, 120], [0, 1, 1, 0]),
        }}
      >
        <div
          style={{
            fontFamily: MONO,
            fontSize: 18,
            color: VIOLET,
            letterSpacing: "0.45em",
          }}
        >
          ARCHITECTURE · 01
        </div>
        <div
          style={{
            fontFamily: INTER,
            fontWeight: 300,
            fontSize: 62,
            color: "white",
            marginTop: 16,
            lineHeight: 1.05,
            maxWidth: 620,
          }}
        >
          Seven specialist
          <br />
          roles. <span style={{ color: VIOLET }}>One brain.</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

//  ────────────────────────────────────────────────────────────────────────
//  Scene 6 — Swarm grid (25 tiles)
//  ────────────────────────────────────────────────────────────────────────
const SwarmTile: React.FC<{ i: number; frame: number }> = ({ i, frame }) => {
  const appearFrame = 8 + i * 1.6;
  const appear = interpolate(frame, [appearFrame, appearFrame + 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const seed = prng(i, 7);
  const modeCycle = (frame / 20 + seed * 4) % 4;
  let color: string = COOL;
  let label = "COLD";
  let glow = 6;
  if (modeCycle > 1.2) {
    color = WARM;
    label = "WARM";
    glow = 10;
  }
  if (modeCycle > 2.2) {
    color = HOT;
    label = "HOT";
    glow = 22;
  }
  if (modeCycle > 3.2) {
    color = "#a9f7c0";
    label = "BOOKED";
    glow = 30;
  }

  const ping = Math.sin(frame / 5 + seed * 10) * 0.5 + 0.5;
  const wave = Array.from({ length: 16 }, (_, k) =>
    Math.abs(Math.sin(frame / 4 + k * 0.9 + seed * 20)) * 16 + 2,
  );

  return (
    <div
      style={{
        opacity: appear,
        transform: `translateY(${(1 - appear) * 18}px)`,
        background: "rgba(10,16,32,0.75)",
        border: `1px solid ${color}55`,
        borderRadius: 6,
        padding: "10px 12px",
        boxShadow: `0 0 ${glow}px ${color}66`,
        display: "flex",
        flexDirection: "column",
        gap: 6,
        minHeight: 96,
        justifyContent: "space-between",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span
          style={{
            fontFamily: MONO,
            fontSize: 11,
            color: "rgba(255,255,255,0.55)",
            letterSpacing: "0.15em",
          }}
        >
          L{String(i + 1).padStart(2, "0")}
        </span>
        <span
          style={{
            fontFamily: MONO,
            fontSize: 10,
            color,
            letterSpacing: "0.18em",
            background: `${color}22`,
            padding: "2px 6px",
            borderRadius: 2,
          }}
        >
          {label}
        </span>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 2,
          height: 20,
        }}
      >
        {wave.map((h, k) => (
          <div
            key={k}
            style={{
              width: 2,
              height: h,
              background: color,
              opacity: 0.5 + ping * 0.5,
            }}
          />
        ))}
      </div>
      <div
        style={{
          fontFamily: MONO,
          fontSize: 10,
          color: "rgba(255,255,255,0.4)",
          letterSpacing: "0.1em",
        }}
      >
        {["DACH", "ALPS", "DE-S", "AT-E", "CH-N"][i % 5]} ·{" "}
        {(seed * 94 + 12).toFixed(0)}%
      </div>
    </div>
  );
};

const SceneSwarm: React.FC = () => {
  const frame = useCurrentFrame();
  const headOpacity = interpolate(frame, [0, 16, 70, 90], [0, 1, 1, 0]);
  const gridOpacity = interpolate(frame, [4, 36], [0, 1], {
    extrapolateRight: "clamp",
  });
  const fadeOut = interpolate(frame, [70, 90], [1, 0], {
    extrapolateLeft: "clamp",
  });

  return (
    <AbsoluteFill style={{ padding: "110px 120px" }}>
      <div style={{ opacity: headOpacity }}>
        <div
          style={{
            fontFamily: MONO,
            fontSize: 18,
            color: VIOLET,
            letterSpacing: "0.45em",
          }}
        >
          EXECUTION · 02
        </div>
        <div
          style={{
            fontFamily: INTER,
            fontWeight: 300,
            fontSize: 62,
            color: "white",
            marginTop: 12,
            lineHeight: 1.05,
          }}
        >
          25 conversations.{" "}
          <span style={{ color: VIOLET }}>At once.</span>
        </div>
      </div>

      <div
        style={{
          opacity: gridOpacity * fadeOut,
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: 14,
          marginTop: 60,
        }}
      >
        {Array.from({ length: 25 }, (_, i) => (
          <SwarmTile key={i} i={i} frame={frame} />
        ))}
      </div>
    </AbsoluteFill>
  );
};

//  ────────────────────────────────────────────────────────────────────────
//  Scene 7 — EARTH + signal arcs
//  ────────────────────────────────────────────────────────────────────────
type Target = { x: number; y: number };

const GOLD_INDICES = new Set([2, 7, 12, 18, 22]);

const generateTargets = (count: number, hub: Target): Target[] => {
  return Array.from({ length: count }, (_, i) => {
    const r1 = prng(i, 11);
    const r2 = prng(i + 500, 11);
    const angle = r1 * Math.PI * 2;
    // bias the spread to feel european: shorter vertical, wider horizontal
    const dist = 90 + r2 * 250;
    return {
      x: hub.x + Math.cos(angle) * dist,
      y: hub.y + Math.sin(angle) * dist * 0.62 - 20,
    };
  });
};

const SceneEarth: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const sceneOpacity = interpolate(
    frame,
    [0, 18, durationInFrames - 15, durationInFrames],
    [0, 1, 1, 0],
  );
  const rotation = interpolate(frame, [0, durationInFrames], [-10, 15]);
  const camZoom = interpolate(frame, [0, durationInFrames], [0.95, 1.08], {
    easing: Easing.inOut(Easing.cubic),
  });

  const globeCx = 960;
  const globeCy = 560;
  const globeR = 330;
  const hub = { x: globeCx - 20, y: globeCy - 40 };
  const targets = React.useMemo(() => generateTargets(25, hub), []);

  return (
    <AbsoluteFill style={{ opacity: sceneOpacity }}>
      <svg
        width={PROMO_WIDTH}
        height={PROMO_HEIGHT}
        style={{
          position: "absolute",
          inset: 0,
          transform: `scale(${camZoom})`,
          transformOrigin: "center",
        }}
      >
        <defs>
          <radialGradient id="globeSurface" cx="38%" cy="32%" r="65%">
            <stop offset="0%" stopColor="#1a2745" />
            <stop offset="55%" stopColor="#0a1428" />
            <stop offset="100%" stopColor="#02040a" />
          </radialGradient>
          <radialGradient id="globeRim" cx="50%" cy="50%" r="50%">
            <stop offset="70%" stopColor={VIOLET} stopOpacity={0} />
            <stop offset="92%" stopColor={VIOLET} stopOpacity={0.55} />
            <stop offset="100%" stopColor={VIOLET} stopOpacity={0} />
          </radialGradient>
          <filter id="arcGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.5" />
          </filter>
          <filter id="goldGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" />
          </filter>
          <clipPath id="globeClip">
            <circle cx={globeCx} cy={globeCy} r={globeR} />
          </clipPath>
        </defs>

        {/* outer rim glow */}
        <circle
          cx={globeCx}
          cy={globeCy}
          r={globeR + 12}
          fill="url(#globeRim)"
        />

        {/* sphere fill */}
        <circle
          cx={globeCx}
          cy={globeCy}
          r={globeR}
          fill="url(#globeSurface)"
        />

        {/* meridians + parallels, clipped to sphere */}
        <g clipPath="url(#globeClip)" opacity={0.22}>
          <g
            stroke={VIOLET}
            fill="none"
            strokeWidth={1}
            transform={`rotate(${rotation} ${globeCx} ${globeCy})`}
          >
            {[60, 130, 200, 260, 310].map((rx, i) => (
              <ellipse
                key={`m${i}`}
                cx={globeCx}
                cy={globeCy}
                rx={rx}
                ry={globeR}
              />
            ))}
            {[60, 130, 200, 260, 310].map((ry, i) => (
              <ellipse
                key={`p${i}`}
                cx={globeCx}
                cy={globeCy}
                rx={globeR}
                ry={ry}
              />
            ))}
          </g>
          {/* faux continent blobs */}
          <g fill={VIOLET} opacity={0.12}>
            {Array.from({ length: 26 }, (_, i) => {
              const r1 = prng(i, 99);
              const r2 = prng(i + 77, 99);
              const r3 = prng(i + 333, 99);
              const angle = r1 * Math.PI * 2;
              const dist = r2 * (globeR - 20);
              const cx = globeCx + Math.cos(angle) * dist;
              const cy = globeCy + Math.sin(angle) * dist * 0.9;
              return (
                <ellipse
                  key={i}
                  cx={cx}
                  cy={cy}
                  rx={8 + r3 * 22}
                  ry={5 + r3 * 14}
                />
              );
            })}
          </g>
        </g>

        {/* hub (Munich) */}
        <g>
          <circle
            cx={hub.x}
            cy={hub.y}
            r={14 + Math.sin(frame / 4) * 3}
            fill={VIOLET}
            opacity={0.25}
            filter="url(#goldGlow)"
          />
          <circle cx={hub.x} cy={hub.y} r={5} fill={VIOLET} />
          <circle
            cx={hub.x}
            cy={hub.y}
            r={5 + ((frame * 0.9) % 30)}
            fill="none"
            stroke={VIOLET}
            strokeWidth={1}
            opacity={0.5 - ((frame * 0.9) % 30) / 60}
          />
        </g>

        {/* arcs */}
        {targets.map((t, i) => {
          const isGold = GOLD_INDICES.has(i);
          const color = isGold ? GOLD : VIOLET;
          const launchFrame = 22 + i * 2.3;
          const progress = interpolate(
            frame,
            [launchFrame, launchFrame + 22],
            [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          );
          const landed = progress >= 1;
          const midX = (hub.x + t.x) / 2;
          const midY = (hub.y + t.y) / 2;
          const dx = t.x - hub.x;
          const dy = t.y - hub.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          const lift = 40 + len * 0.28;

          // ripple when landed
          const rippleAge = Math.max(0, frame - (launchFrame + 22));
          const rippleR = Math.min(rippleAge * 0.9, 30);
          const rippleOpacity = Math.max(0, 0.7 - rippleAge / 40);

          return (
            <g key={i}>
              <path
                d={`M ${hub.x} ${hub.y} Q ${midX} ${midY - lift} ${t.x} ${t.y}`}
                stroke={color}
                strokeWidth={isGold ? 2.2 : 1.1}
                fill="none"
                pathLength={1}
                strokeDasharray="1 1"
                strokeDashoffset={1 - progress}
                opacity={landed ? 0.55 : 0.95}
                filter={isGold ? "url(#goldGlow)" : "url(#arcGlow)"}
              />
              {landed && (
                <>
                  <circle
                    cx={t.x}
                    cy={t.y}
                    r={isGold ? 6 : 3}
                    fill={color}
                    filter={isGold ? "url(#goldGlow)" : undefined}
                  />
                  <circle
                    cx={t.x}
                    cy={t.y}
                    r={rippleR}
                    fill="none"
                    stroke={color}
                    strokeWidth={1}
                    opacity={rippleOpacity}
                  />
                </>
              )}
            </g>
          );
        })}

        {/* hub label */}
        <g
          opacity={interpolate(frame, [15, 35], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })}
        >
          <line
            x1={hub.x}
            y1={hub.y}
            x2={hub.x + 80}
            y2={hub.y - 50}
            stroke={VIOLET}
            strokeWidth={1}
            opacity={0.5}
          />
          <text
            x={hub.x + 86}
            y={hub.y - 52}
            fontFamily={MONO}
            fontSize={13}
            fill={VIOLET}
            letterSpacing={2}
          >
            MUNICH · HQ
          </text>
          <text
            x={hub.x + 86}
            y={hub.y - 36}
            fontFamily={MONO}
            fontSize={11}
            fill="rgba(255,255,255,0.55)"
            letterSpacing={1.5}
          >
            48.14°N · 11.57°E
          </text>
        </g>
      </svg>

      {/* caption bottom-left */}
      <div
        style={{
          position: "absolute",
          left: 120,
          bottom: 140,
          opacity: interpolate(frame, [20, 40, 100, 120], [0, 1, 1, 0]),
        }}
      >
        <div
          style={{
            fontFamily: MONO,
            fontSize: 18,
            color: VIOLET,
            letterSpacing: "0.45em",
          }}
        >
          GLOBAL · 03
        </div>
        <div
          style={{
            fontFamily: INTER,
            fontWeight: 300,
            fontSize: 54,
            color: "white",
            marginTop: 14,
            lineHeight: 1.05,
            maxWidth: 640,
          }}
        >
          One hub.{" "}
          <span style={{ color: VIOLET }}>25 signals.</span>
          <br />
          <span style={{ color: GOLD }}>5 live connects.</span>
        </div>
      </div>

      {/* corner telemetry */}
      <div
        style={{
          position: "absolute",
          right: 120,
          top: 140,
          textAlign: "right",
          fontFamily: MONO,
          color: "rgba(255,255,255,0.85)",
          opacity: interpolate(frame, [12, 28], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        <div
          style={{
            fontSize: 13,
            color: VIOLET,
            letterSpacing: 3,
            marginBottom: 6,
          }}
        >
          TELEMETRY
        </div>
        <div style={{ fontSize: 14 }}>● carrier : twilio eu</div>
        <div style={{ fontSize: 14 }}>● orch    : happyrobot v3</div>
        <div style={{ fontSize: 14 }}>● region  : dach + eu-w</div>
        <div style={{ fontSize: 14, color: GOLD }}>
          ● live    : {Math.min(5, Math.floor((frame - 40) / 12))} / 25
        </div>
      </div>
    </AbsoluteFill>
  );
};

//  ────────────────────────────────────────────────────────────────────────
//  Scene 8 — Knowledge Graph (procedural: 94 nodes, 157 edges)
//  ────────────────────────────────────────────────────────────────────────
type KGNode = { x: number; y: number; type: number; size: number };

const NODE_COLORS = [
  VIOLET, // persona
  WARM, // objection
  COOL, // outcome
  "#6fa8dc", // industry
  "#5b8cff", // region
  "#b088ff", // rebuttal
  "#9aa0b0", // stage
  "#e64ac8", // temporal
];

const generateKG = (nodeCount: number, edgeCount: number) => {
  const nodes: KGNode[] = Array.from({ length: nodeCount }, (_, i) => {
    const r1 = prng(i, 23);
    const r2 = prng(i + 100, 23);
    const r3 = prng(i + 200, 23);
    const r4 = prng(i + 300, 23);
    const angle = r1 * Math.PI * 2;
    const dist = Math.pow(r2, 0.55) * 340;
    return {
      x: 960 + Math.cos(angle) * dist,
      y: 540 + Math.sin(angle) * dist * 0.78,
      type: Math.floor(r3 * NODE_COLORS.length),
      size: 2.5 + r4 * 5,
    };
  });

  // Build edges by picking spatially-close nodes
  const edges: [number, number][] = [];
  const used = new Set<string>();
  for (let i = 0; i < edgeCount * 3 && edges.length < edgeCount; i++) {
    const a = Math.floor(prng(i, 41) * nodeCount);
    const jitter = 1 + Math.floor(prng(i + 1, 41) * 5);
    let b = (a + jitter) % nodeCount;
    if (a === b) b = (a + 1) % nodeCount;
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (used.has(key)) continue;
    used.add(key);
    edges.push([a, b]);
  }
  return { nodes, edges };
};

const SceneGraph: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const sceneOpacity = interpolate(
    frame,
    [0, 14, durationInFrames - 12, durationInFrames],
    [0, 1, 1, 0],
  );
  const orbit = interpolate(frame, [0, durationInFrames], [0, 6]);
  const zoom = interpolate(frame, [0, durationInFrames], [0.92, 1.05]);

  const { nodes, edges } = React.useMemo(() => generateKG(94, 157), []);

  const nodeRevealPerFrame = 2.2;
  const edgeRevealStart = 18;

  const nodeCountVisible = Math.min(94, Math.floor(frame * nodeRevealPerFrame));
  const edgeCountVisible = Math.max(
    0,
    Math.min(157, Math.floor((frame - edgeRevealStart) * 3.4)),
  );

  return (
    <AbsoluteFill style={{ opacity: sceneOpacity }}>
      <svg
        width={PROMO_WIDTH}
        height={PROMO_HEIGHT}
        style={{
          position: "absolute",
          inset: 0,
          transform: `rotate(${orbit}deg) scale(${zoom})`,
          transformOrigin: "center",
        }}
      >
        <defs>
          <filter id="nodeGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.5" />
          </filter>
        </defs>

        {/* edges */}
        {edges.slice(0, edgeCountVisible).map(([a, b], i) => {
          const na = nodes[a];
          const nb = nodes[b];
          const colorA = NODE_COLORS[na.type];
          const pulse = (Math.sin(frame / 7 + i * 0.3) + 1) / 2;
          return (
            <line
              key={i}
              x1={na.x}
              y1={na.y}
              x2={nb.x}
              y2={nb.y}
              stroke={colorA}
              strokeWidth={0.8}
              opacity={0.18 + pulse * 0.22}
            />
          );
        })}

        {/* nodes */}
        {nodes.slice(0, nodeCountVisible).map((n, i) => {
          const color = NODE_COLORS[n.type];
          const appearedFor = frame - i / nodeRevealPerFrame;
          const scalePop = Math.min(1, appearedFor / 8);
          const pulse = Math.sin(frame / 9 + i * 0.2) * 0.2 + 0.8;
          return (
            <g key={i} opacity={pulse}>
              <circle
                cx={n.x}
                cy={n.y}
                r={(n.size + 5) * scalePop}
                fill={color}
                opacity={0.18}
                filter="url(#nodeGlow)"
              />
              <circle
                cx={n.x}
                cy={n.y}
                r={n.size * scalePop}
                fill={color}
              />
            </g>
          );
        })}
      </svg>

      {/* caption — right side */}
      <div
        style={{
          position: "absolute",
          right: 120,
          top: 160,
          textAlign: "right",
          opacity: interpolate(frame, [10, 28], [0, 1], {
            extrapolateRight: "clamp",
          }),
        }}
      >
        <div
          style={{
            fontFamily: MONO,
            fontSize: 18,
            color: VIOLET,
            letterSpacing: "0.45em",
          }}
        >
          MEMORY · 04
        </div>
        <div
          style={{
            fontFamily: INTER,
            fontWeight: 300,
            fontSize: 52,
            color: "white",
            marginTop: 12,
            lineHeight: 1.05,
            maxWidth: 560,
          }}
        >
          The swarm remembers.
          <br />
          <span style={{ color: VIOLET }}>And teaches itself.</span>
        </div>
      </div>

      {/* counters */}
      <div
        style={{
          position: "absolute",
          left: 120,
          bottom: 120,
          display: "flex",
          gap: 56,
          fontFamily: MONO,
          color: "white",
        }}
      >
        <div>
          <div
            style={{
              fontSize: 13,
              color: "rgba(255,255,255,0.5)",
              letterSpacing: "0.3em",
            }}
          >
            NODES
          </div>
          <div style={{ fontSize: 76, fontWeight: 600, color: VIOLET }}>
            {nodeCountVisible}
          </div>
        </div>
        <div>
          <div
            style={{
              fontSize: 13,
              color: "rgba(255,255,255,0.5)",
              letterSpacing: "0.3em",
            }}
          >
            EDGES
          </div>
          <div style={{ fontSize: 76, fontWeight: 600, color: COOL }}>
            {edgeCountVisible}
          </div>
        </div>
        <div>
          <div
            style={{
              fontSize: 13,
              color: "rgba(255,255,255,0.5)",
              letterSpacing: "0.3em",
            }}
          >
            PER RUN
          </div>
          <div style={{ fontSize: 76, fontWeight: 600, color: WARM }}>+12</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

//  ────────────────────────────────────────────────────────────────────────
//  Scene 9 — KPI
//  ────────────────────────────────────────────────────────────────────────
const KPI: React.FC<{
  label: string;
  target: number;
  color: string;
  frame: number;
  delay?: number;
}> = ({ label, target, color, frame, delay = 0 }) => {
  const val = Math.floor(
    interpolate(frame, [delay, delay + 36], [0, target], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );
  const appear = interpolate(frame, [delay, delay + 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div style={{ textAlign: "center", opacity: appear }}>
      <div
        style={{
          fontFamily: MONO,
          fontSize: 16,
          color: "rgba(255,255,255,0.55)",
          letterSpacing: "0.45em",
          marginBottom: 16,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: INTER,
          fontWeight: 700,
          fontSize: 180,
          color,
          lineHeight: 1,
          textShadow: `0 0 40px ${color}88`,
        }}
      >
        {val}
      </div>
    </div>
  );
};

const SceneKPI: React.FC = () => {
  const frame = useCurrentFrame();
  const fadeOut = interpolate(frame, [48, 60], [1, 0], {
    extrapolateLeft: "clamp",
  });
  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        opacity: fadeOut,
      }}
    >
      <div
        style={{
          fontFamily: MONO,
          fontSize: 16,
          color: VIOLET,
          letterSpacing: "0.5em",
          marginBottom: 50,
        }}
      >
        ONE DEMO RUN · LIVE · IN FRONT OF THE JURY
      </div>
      <div style={{ display: "flex", gap: 120, alignItems: "flex-end" }}>
        <KPI label="DIALS" target={25} color="white" frame={frame} delay={0} />
        <KPI
          label="CONNECTS"
          target={5}
          color={VIOLET}
          frame={frame}
          delay={10}
        />
        <KPI label="MEETINGS" target={1} color={GOLD} frame={frame} delay={24} />
        <KPI
          label="LEARNINGS"
          target={12}
          color={COOL}
          frame={frame}
          delay={18}
        />
      </div>
    </AbsoluteFill>
  );
};

//  ────────────────────────────────────────────────────────────────────────
//  Scene 10 — Close
//  ────────────────────────────────────────────────────────────────────────
const SceneClose: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ fps, frame, config: { damping: 20, stiffness: 100 } });
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <div
        style={{
          fontFamily: INTER,
          fontWeight: 800,
          fontSize: 180,
          color: "white",
          letterSpacing: "-0.04em",
          transform: `scale(${0.92 + s * 0.08})`,
          opacity: s,
        }}
      >
        multiply
      </div>
      <div
        style={{
          fontFamily: MONO,
          fontSize: 22,
          color: VIOLET,
          letterSpacing: "0.3em",
          marginTop: 18,
          opacity: interpolate(frame, [10, 22], [0, 1], {
            extrapolateRight: "clamp",
          }),
        }}
      >
        multiply-danielshxs-projects.vercel.app
      </div>
    </AbsoluteFill>
  );
};

//  ────────────────────────────────────────────────────────────────────────
//  Root composition
//  ────────────────────────────────────────────────────────────────────────
export const MultiplyPromo: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: "black" }}>
      <Background />
      <ParticleField count={80} seed={3} />
      <Grid opacity={0.06} />

      <Sequence from={S.cold[0]} durationInFrames={S.cold[1] - S.cold[0]}>
        <SceneCold />
      </Sequence>

      <Sequence
        from={S.problem[0]}
        durationInFrames={S.problem[1] - S.problem[0]}
      >
        <SceneProblem />
      </Sequence>

      <Sequence from={S.until[0]} durationInFrames={S.until[1] - S.until[0]}>
        <SceneUntilNow />
      </Sequence>

      <Sequence from={S.title[0]} durationInFrames={S.title[1] - S.title[0]}>
        <SceneTitle />
      </Sequence>

      <Sequence
        from={S.orchestra[0]}
        durationInFrames={S.orchestra[1] - S.orchestra[0]}
      >
        <SceneOrchestra />
      </Sequence>

      <Sequence from={S.swarm[0]} durationInFrames={S.swarm[1] - S.swarm[0]}>
        <SceneSwarm />
      </Sequence>

      <Sequence from={S.earth[0]} durationInFrames={S.earth[1] - S.earth[0]}>
        <SceneEarth />
      </Sequence>

      <Sequence from={S.graph[0]} durationInFrames={S.graph[1] - S.graph[0]}>
        <SceneGraph />
      </Sequence>

      <Sequence from={S.kpi[0]} durationInFrames={S.kpi[1] - S.kpi[0]}>
        <SceneKPI />
      </Sequence>

      <Sequence from={S.close[0]} durationInFrames={S.close[1] - S.close[0]}>
        <SceneClose />
      </Sequence>

      <Scanlines />
      <Vignette />
    </AbsoluteFill>
  );
};
