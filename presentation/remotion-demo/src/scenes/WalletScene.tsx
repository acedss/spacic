import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { theme } from "../theme";
import { BrowserChrome, Caption } from "../components/Phone";

export const WalletScene: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const slide = spring({ frame: f, fps, config: { damping: 18 } });

  const stripeOpen = f > 240;

  return (
    <AbsoluteFill style={{ background: theme.gradHero, justifyContent: "center", alignItems: "center" }}>
      <div style={{ transform: `translateY(${(1 - slide) * 40}px)`, opacity: slide, position: "relative" }}>
        <BrowserChrome url="spacic.app/wallet">
          <div style={{ height: "100%", padding: "32px 40px", background: "#FAFBFC" }}>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 14, color: theme.accent1, letterSpacing: 4, fontWeight: 700 }}>WALLET</div>
                <h1 style={{ margin: "8px 0 0", fontSize: 48, fontWeight: 800, color: theme.fg, letterSpacing: -1.4 }}>1,150 coins</h1>
                <div style={{ marginTop: 6, color: theme.muted, fontSize: 16 }}>≈ $11.50 · last topped up: 2 days ago</div>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button style={{ padding: "12px 20px", borderRadius: 10, background: theme.fg, color: "#fff", fontWeight: 700, border: "none" }}>＋ Buy coins</button>
                <button style={{ padding: "12px 20px", borderRadius: 10, background: "#fff", color: theme.fg, border: `1px solid ${theme.border}`, fontWeight: 600 }}>Withdraw</button>
              </div>
            </div>

            <div style={{ marginTop: 26, display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
              {[
                { c: 100, p: "$0.99",  bonus: "" , feat: false },
                { c: 500, p: "$4.99",  bonus: "+10%", feat: false },
                { c: 1500, p: "$12.99", bonus: "+20%", feat: true },
                { c: 5000, p: "$39.99", bonus: "+30%", feat: false },
              ].map((pk, i) => (
                <div key={i} style={{
                  background: "#fff", borderRadius: 14, padding: 22,
                  border: pk.feat ? `2px solid ${theme.accent1}` : `1px solid ${theme.border}`,
                  position: "relative",
                }}>
                  {pk.feat && <div style={{ position: "absolute", top: -10, right: 14, padding: "3px 10px", background: theme.accent1, color: "#fff", fontSize: 10, fontWeight: 700, borderRadius: 4 }}>BEST VALUE</div>}
                  <div style={{ fontSize: 26, fontWeight: 800, color: theme.fg }}>{pk.c.toLocaleString()} 💰</div>
                  {pk.bonus && <div style={{ marginTop: 4, fontSize: 12, color: theme.ok, fontWeight: 700 }}>{pk.bonus} bonus</div>}
                  <div style={{ marginTop: 14, fontSize: 18, fontWeight: 700, color: theme.fg }}>{pk.p}</div>
                  <button style={{
                    marginTop: 16, width: "100%", padding: "10px 0",
                    background: pk.feat ? theme.accent1 : theme.fg,
                    color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13,
                  }}>Buy</button>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 28, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
              <div style={{ background: "#fff", borderRadius: 14, border: `1px solid ${theme.border}`, padding: 18 }}>
                <div style={{ fontSize: 13, color: theme.muted, letterSpacing: 2, marginBottom: 10 }}>RECENT TRANSACTIONS</div>
                {[
                  { lab: "Tip → Aki",                 amt: -100, sub: "Late-Night Lo-Fi · just now" },
                  { lab: "Top-up · 1500 coins",       amt: 1500, sub: "Stripe checkout · 1d ago" },
                  { lab: "Onboarding bonus",          amt: 50,   sub: "welcome reward · 5d ago" },
                  { lab: "Tip → SOLA",                amt: -250, sub: "Focus / Ambient · 6d ago" },
                  { lab: "Minigame win · Velvet",      amt: 50,   sub: "Aki's room · 1w ago" },
                ].map((tx, i) => (
                  <div key={i} style={{
                    padding: "10px 0", borderBottom: i < 4 ? `1px solid ${theme.border}` : "none",
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                  }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: theme.fg }}>{tx.lab}</div>
                      <div style={{ fontSize: 12, color: theme.muted }}>{tx.sub}</div>
                    </div>
                    <div style={{
                      fontSize: 16, fontWeight: 700,
                      color: tx.amt > 0 ? theme.ok : theme.err,
                    }}>{tx.amt > 0 ? "+" : ""}{tx.amt}</div>
                  </div>
                ))}
              </div>

              <div style={{ background: "#fff", borderRadius: 14, border: `1px solid ${theme.border}`, padding: 18 }}>
                <div style={{ fontSize: 13, color: theme.muted, letterSpacing: 2, marginBottom: 10 }}>SUBSCRIPTION</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: theme.fg }}>Premium</div>
                <div style={{ marginTop: 4, color: theme.muted, fontSize: 13 }}>$5.99/mo · renews May 21 · 180 min/session</div>
                <div style={{ marginTop: 14, padding: 12, background: "rgba(243,111,58,0.06)", borderRadius: 10, fontSize: 12, color: theme.fg }}>
                  Upgrade to <b>Creator</b> for unlimited room sessions + Stripe payouts.
                </div>
                <button style={{
                  marginTop: 14, padding: "10px 16px",
                  background: theme.fg, color: "#fff", border: "none",
                  borderRadius: 10, fontSize: 13, fontWeight: 700,
                }}>Manage subscription →</button>
              </div>
            </div>
          </div>
        </BrowserChrome>

        {/* Stripe checkout overlay */}
        {stripeOpen && (
          <div style={{
            position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(15,15,18,0.55)",
          }}>
            <div style={{
              width: 540, background: "#fff", borderRadius: 18, padding: 32,
              boxShadow: "0 30px 80px rgba(0,0,0,0.45)",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#0F0F12" }}>Stripe Checkout</div>
                <div style={{ fontSize: 12, color: theme.muted, padding: "3px 10px", background: "#F1F2F4", borderRadius: 6 }}>TEST MODE</div>
              </div>
              <div style={{ marginTop: 14, fontSize: 14, color: theme.muted }}>
                Spacic · 1500 coins (+20% bonus)
              </div>
              <div style={{ marginTop: 14, padding: 16, borderRadius: 12, border: `1px solid ${theme.border}` }}>
                <div style={{ fontSize: 12, color: theme.muted }}>Card number</div>
                <div style={{ fontSize: 18, fontWeight: 600, color: theme.fg, marginTop: 4 }}>4242 4242 4242 4242</div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, fontSize: 13, color: theme.muted }}>
                  <span>Exp 04/27</span><span>CVC •••</span><span>12345</span>
                </div>
              </div>
              <div style={{ marginTop: 16, display: "flex", justifyContent: "space-between", fontSize: 14, color: theme.fg }}>
                <span>Subtotal</span><b>$12.99</b>
              </div>
              <button style={{
                marginTop: 18, width: "100%", padding: "14px",
                background: "#635BFF", color: "#fff", border: "none", borderRadius: 10,
                fontWeight: 700, fontSize: 16,
              }}>Pay $12.99</button>
              <div style={{ marginTop: 12, fontSize: 11, color: theme.muted, textAlign: "center" }}>
                POST /api/wallet/topup · Stripe webhook → wallet:balance_updated
              </div>
            </div>
          </div>
        )}
      </div>

      <Caption
        title={stripeOpen ? "Stripe Checkout · Idempotency-Key on /api/wallet/topup" : "Wallet · coin packages · transaction ledger"}
        subtitle="GET /api/wallet · POST /api/wallet/topup · webhook /api/wallet/topup/webhook (raw body, svix-verified)"
      />
    </AbsoluteFill>
  );
};
