import React from 'react'
import bgImg from '../assets/login-network.jpg'

// Full-screen glowing network background. The photo drifts and zooms slowly, soft orange and
// blue light orbs float across it, and a faint light sweep passes over it, so the page always
// feels alive. (File name kept so Login.jsx does not need to change.)
const ORBS = [
  // [left %, top %, size px, colour, duration s, delay s]
  [8, 62, 150, 'rgba(255,150,60,.42)', 16, 0],
  [22, 18, 110, 'rgba(255,190,90,.38)', 19, -4],
  [38, 74, 90, 'rgba(255,120,50,.35)', 14, -7],
  [55, 30, 130, 'rgba(90,180,255,.30)', 21, -2],
  [72, 68, 170, 'rgba(100,190,255,.28)', 18, -9],
  [86, 22, 100, 'rgba(150,215,255,.32)', 15, -5],
  [64, 8, 80, 'rgba(255,170,80,.30)', 17, -11]
]

export default function TransportBackground() {
  return (
    <div className="tbg-root" aria-hidden="true">
      <style>{`
        .tbg-root{position:fixed;inset:0;overflow:hidden;background:#05070d;z-index:0;pointer-events:none}
        .tbg-photo{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;
          transform-origin:35% 55%;animation:tbg-drift 28s ease-in-out infinite alternate}
        .tbg-orb{position:absolute;border-radius:50%;filter:blur(18px);mix-blend-mode:screen;
          animation:tbg-float var(--d) ease-in-out infinite alternate;animation-delay:var(--s)}
        .tbg-streak{position:absolute;top:0;bottom:0;width:20%;left:-40%;
          background:linear-gradient(100deg,transparent 0%,rgba(255,225,180,.10) 50%,transparent 100%);
          transform:skewX(-18deg);animation:tbg-sweep 11s linear infinite}
        .tbg-shade{position:absolute;inset:0;
          background:linear-gradient(to bottom,rgba(5,8,18,.30),rgba(5,8,18,.10) 45%,rgba(5,8,18,.40))}
        @keyframes tbg-drift{from{transform:scale(1.04) translate(0,0)}to{transform:scale(1.2) translate(-3%,-2%)}}
        @keyframes tbg-float{from{transform:translate3d(-30px,20px,0) scale(.9);opacity:.55}
          to{transform:translate3d(40px,-35px,0) scale(1.15);opacity:1}}
        @keyframes tbg-sweep{from{left:-40%}to{left:130%}}
        @media (prefers-reduced-motion:reduce){.tbg-photo,.tbg-orb,.tbg-streak{animation:none}}
      `}</style>
      <img className="tbg-photo" src={bgImg} alt="" />
      {ORBS.map(([l, t, s, c, d, delay], i) => (
        <span
          key={i}
          className="tbg-orb"
          style={{ left: `${l}%`, top: `${t}%`, width: s, height: s, background: c, '--d': `${d}s`, '--s': `${delay}s` }}
        />
      ))}
      <div className="tbg-streak" />
      <div className="tbg-shade" />
    </div>
  )
}
