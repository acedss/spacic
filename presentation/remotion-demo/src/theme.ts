// Spacic theme — derived from frontend/src/index.css (shadcn neutral + chart accents)
// All colors converted from oklch -> hex for Remotion's image renderer.

export const theme = {
  bg:        "#0B0B0F",        // deep cinematic background for the demo
  card:      "#FFFFFF",
  cardDark:  "#161922",
  fg:        "#0F0F12",         // primary text
  fgInverse: "#F5F5F6",
  muted:     "#6B7280",
  border:    "#E5E7EB",
  borderDark:"#252A33",

  // Spacic accent palette — built from the chart variables in index.css
  accent1:   "#F36F3A",         // warm orange (chart-1)
  accent2:   "#3FA09E",         // teal (chart-2)
  accent3:   "#1D9BF0",         // bright blue
  accent4:   "#E8B23C",         // amber (chart-4)
  accent5:   "#D04CD0",         // magenta
  ok:        "#16A34A",
  warn:      "#F59E0B",
  err:       "#EF4444",

  // gradients
  gradWarm:  "linear-gradient(135deg,#F36F3A 0%,#D04CD0 100%)",
  gradCool:  "linear-gradient(135deg,#1D9BF0 0%,#3FA09E 100%)",
  gradHero:  "linear-gradient(135deg,#0B0B0F 0%,#1A1F2E 60%,#322341 100%)",
} as const;

export const fonts = {
  sans:   '"Inter","SF Pro Display","Helvetica Neue",Arial,sans-serif',
  mono:   '"JetBrains Mono",ui-monospace,monospace',
  display:'"Inter","SF Pro Display","Helvetica Neue",Arial,sans-serif',
};
