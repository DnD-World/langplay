// Styles for spun-out tools. Kept as a string so the same look ships inside a single HTML file.
// Same palette and type as the Langplay app.

export const RUNNER_CSS = `
.lpr{--bg:oklch(0.18 0.035 275);--card:oklch(0.225 0.04 275);--sec:oklch(0.28 0.045 275);--fg:oklch(0.95 0.012 100);--muted:oklch(0.74 0.025 245);--pri:oklch(0.79 0.115 170);--pri-fg:oklch(0.2 0.04 275);--acc:oklch(0.7 0.1 190);--coin:oklch(0.9 0.05 95);--bad:oklch(0.66 0.21 22);--border:oklch(0.34 0.035 275);
  position:relative;min-height:100vh;background:var(--bg);color:var(--fg);font:15px/1.55 "Bricolage Grotesque",system-ui,-apple-system,"Segoe UI",sans-serif;overflow:hidden;box-sizing:border-box;padding:32px 16px 24px}
.lpr *,.lpr *::before,.lpr *::after{box-sizing:border-box}
.lpr [hidden]{display:none!important}
.lpr.is-embed{min-height:0;padding:12px;background:transparent}
.lpr-bg{position:absolute;inset:-20%;pointer-events:none;filter:blur(60px);opacity:.75;z-index:0}
.lpr-bg i{position:absolute;width:42vmax;height:42vmax;border-radius:50%;background:radial-gradient(circle,color-mix(in oklab,var(--pri) 55%,transparent),transparent 65%);animation:lpr-float 18s ease-in-out infinite}
.lpr-bg i:nth-child(2){left:55%;top:30%;background:radial-gradient(circle,color-mix(in oklab,var(--acc) 50%,transparent),transparent 65%);animation-duration:23s;animation-direction:reverse}
.lpr-bg i:nth-child(3){left:10%;top:55%;width:30vmax;height:30vmax;background:radial-gradient(circle,color-mix(in oklab,oklch(0.6 0.15 300) 45%,transparent),transparent 65%);animation-duration:27s}
@keyframes lpr-float{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(6%,-8%) scale(1.12)}}
.lpr.is-embed .lpr-bg{display:none}
.lpr-card{position:relative;z-index:1;max-width:720px;margin:0 auto;background:color-mix(in oklab,var(--card) 88%,transparent);border:1px solid var(--border);border-radius:16px;padding:22px;box-shadow:0 30px 80px -30px rgba(0,0,0,.7);backdrop-filter:blur(8px)}
.lpr-card::before{content:"";position:absolute;inset:-1px;border-radius:16px;padding:1px;background:linear-gradient(120deg,var(--pri),transparent 35%,transparent 65%,var(--acc));-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;pointer-events:none;opacity:.7}
.lpr-head{display:flex;align-items:flex-start;gap:12px;margin-bottom:14px}
.lpr-title{margin:0;font-size:1.45rem;font-weight:800;line-height:1.2;letter-spacing:-.01em}
.lpr-sum{margin:4px 0 0;color:var(--muted);font-size:.92rem}
.lpr-gear{margin-left:auto;flex:none;background:transparent;border:1px solid var(--border);color:var(--fg);border-radius:10px;width:36px;height:36px;cursor:pointer;font-size:16px}
.lpr-gear:hover{border-color:var(--pri)}
.lpr textarea,.lpr input,.lpr select{width:100%;background:color-mix(in oklab,oklch(0.3 0.035 275) 45%,transparent);color:var(--fg);border:1px solid var(--border);border-radius:10px;padding:10px 12px;font:inherit;outline:none;transition:border-color .2s,box-shadow .2s}
.lpr textarea{min-height:84px;resize:vertical}
.lpr textarea:focus,.lpr input:focus,.lpr select:focus{border-color:var(--pri);box-shadow:0 0 0 3px color-mix(in oklab,var(--pri) 30%,transparent)}
.lpr-row{display:flex;gap:8px;align-items:center;margin-top:10px;flex-wrap:wrap}
.lpr-btn{appearance:none;border:0;border-radius:10px;padding:10px 18px;font:inherit;font-weight:700;cursor:pointer;background:var(--pri);color:var(--pri-fg);transition:transform .15s,filter .2s;display:inline-flex;align-items:center;gap:8px}
.lpr-btn:hover{filter:brightness(1.08)}.lpr-btn:active{transform:scale(.97)}
.lpr-btn[disabled]{opacity:.55;cursor:default}
.lpr-btn.ghost{background:transparent;color:var(--fg);border:1px solid var(--border)}
.lpr-steps{display:flex;flex-wrap:wrap;gap:6px;margin:16px 0 0;padding:0;list-style:none}
.lpr-step{font-size:.78rem;padding:4px 10px;border-radius:999px;border:1px solid var(--border);color:var(--muted);transition:all .3s}
.lpr-step.is-on{border-color:var(--acc);color:var(--fg);box-shadow:0 0 0 3px color-mix(in oklab,var(--acc) 25%,transparent);animation:lpr-pulse 1s ease-in-out infinite}
.lpr-step.is-done{border-color:color-mix(in oklab,var(--pri) 60%,var(--border));color:var(--pri)}
@keyframes lpr-pulse{50%{transform:translateY(-1px)}}
.lpr-answer{margin-top:16px;padding:16px;border-radius:12px;background:var(--sec);animation:lpr-in .45s cubic-bezier(.2,.8,.2,1) both}
.lpr-answer>*{margin:0 0 .6em}.lpr-answer>*:last-child{margin-bottom:0}.lpr-answer ul,.lpr-answer ol{padding-left:1.3em}.lpr-answer ul{list-style:disc}.lpr-answer ol{list-style:decimal}.lpr-answer li{margin:.2em 0}.lpr-answer h3,.lpr-answer h4,.lpr-answer h5{font-size:1rem;margin-top:.8em}.lpr-answer code{font-family:"JetBrains Mono",monospace;font-size:.88em;background:color-mix(in oklab,var(--bg) 60%,transparent);padding:1px 4px;border-radius:4px}
@keyframes lpr-in{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:none}}
.lpr-meta{margin-top:8px;color:var(--muted);font-size:.78rem}
.lpr-err{margin-top:12px;color:var(--bad);font-size:.9rem}
.lpr details{margin-top:12px;border:1px solid var(--border);border-radius:10px;padding:8px 12px}
.lpr summary{cursor:pointer;color:var(--muted);font-size:.85rem}
.lpr pre{white-space:pre-wrap;word-break:break-word;font:12px/1.5 "JetBrains Mono",ui-monospace,monospace;background:color-mix(in oklab,var(--bg) 70%,black);border-radius:8px;padding:8px;margin:6px 0;max-height:220px;overflow:auto}
.lpr a{color:var(--pri)}
.lpr-panel{margin:0 0 14px;padding:12px;border:1px dashed var(--border);border-radius:12px;display:grid;gap:8px;font-size:.88rem}
.lpr-panel label{display:grid;gap:4px;color:var(--muted);font-size:.8rem}
.lpr-foot{position:relative;z-index:1;max-width:720px;margin:14px auto 0;display:flex;justify-content:space-between;gap:8px;color:var(--muted);font-size:.78rem;flex-wrap:wrap}
.lpr-note{color:var(--coin);font-size:.78rem}
.lpr-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
@media (prefers-reduced-motion:reduce){.lpr *,.lpr *::before{animation:none!important;transition:none!important}}
`;
