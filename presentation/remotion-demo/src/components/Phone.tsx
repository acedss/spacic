import React from "react";
import { theme } from "../theme";

// Generic browser-chrome window used throughout the demo
export const BrowserChrome: React.FC<React.PropsWithChildren<{ url?: string; width?: number; height?: number; style?: React.CSSProperties; }>> = ({
  url = "spacic.app",
  width = 1500,
  height = 870,
  style,
  children,
}) => {
  return (
    <div
      style={{
        width,
        height,
        background: "#FFFFFF",
        borderRadius: 18,
        boxShadow: "0 30px 80px rgba(0,0,0,0.45)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        border: `1px solid ${theme.border}`,
        ...style,
      }}
    >
      <div style={{
        height: 38,
        background: "#F1F2F4",
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "0 14px",
        borderBottom: `1px solid ${theme.border}`,
      }}>
        <div style={{ width: 12, height: 12, borderRadius: 6, background: "#FF5F57" }} />
        <div style={{ width: 12, height: 12, borderRadius: 6, background: "#FEBC2E" }} />
        <div style={{ width: 12, height: 12, borderRadius: 6, background: "#28C840" }} />
        <div style={{
          marginLeft: 18,
          flex: 1,
          maxWidth: 460,
          height: 22,
          background: "#FFFFFF",
          borderRadius: 11,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 12,
          color: "#67707D",
          fontFamily: "system-ui",
          border: `1px solid ${theme.border}`,
        }}>
          {url}
        </div>
      </div>
      <div style={{ flex: 1, overflow: "hidden", background: "#FFFFFF" }}>{children}</div>
    </div>
  );
};

export const SpacicLogo: React.FC<{ size?: number; mono?: boolean }> = ({ size = 36, mono = false }) => {
  const grad = "url(#sp-grad)";
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <defs>
        <linearGradient id="sp-grad" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={mono ? "#FFFFFF" : theme.accent1} />
          <stop offset="100%" stopColor={mono ? "#FFFFFF" : theme.accent5} />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="30" fill={mono ? "#0F0F12" : grad} />
      <path d="M22 24 Q32 14 42 24 T42 44 Q32 54 22 44 T22 24 Z" stroke="#FFFFFF" strokeWidth="3" fill="none" />
      <circle cx="32" cy="32" r="4.5" fill="#FFFFFF" />
    </svg>
  );
};

export const Caption: React.FC<{ title: string; subtitle?: string; }> = ({ title, subtitle }) => {
  return (
    <div style={{
      position: "absolute",
      left: 0, right: 0, bottom: 64,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 8,
      pointerEvents: "none",
    }}>
      <div style={{
        background: "rgba(11,11,15,0.85)",
        backdropFilter: "blur(10px)",
        color: "#fff",
        padding: "18px 32px",
        borderRadius: 18,
        fontSize: 30,
        fontWeight: 600,
        textAlign: "center",
        letterSpacing: -0.3,
      }}>{title}</div>
      {subtitle && <div style={{
        color: "#D7DBE3",
        fontSize: 20,
        textAlign: "center",
        textShadow: "0 2px 16px rgba(0,0,0,0.6)",
      }}>{subtitle}</div>}
    </div>
  );
};

export const Cursor: React.FC<{ x: number; y: number; tone?: "light" | "dark" }> = ({ x, y, tone = "dark" }) => {
  const fill = tone === "light" ? "#FFFFFF" : "#0F0F12";
  const stroke = tone === "light" ? "#0F0F12" : "#FFFFFF";
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" style={{
      position: "absolute",
      left: x, top: y,
      pointerEvents: "none",
      filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.4))",
      zIndex: 50,
    }}>
      <path d="M5 3 L5 19 L9.5 14.5 L13 21 L15.5 19.8 L12 13.5 L18 13 Z" fill={fill} stroke={stroke} strokeWidth={1.4} strokeLinejoin="round" />
    </svg>
  );
};

export const Pulse: React.FC<{ color?: string; size?: number }> = ({ color = theme.err, size = 8 }) => {
  return (
    <span style={{
      display: "inline-block",
      width: size,
      height: size,
      borderRadius: size,
      background: color,
      boxShadow: `0 0 0 2px rgba(239,68,68,0.18)`,
    }} />
  );
};
