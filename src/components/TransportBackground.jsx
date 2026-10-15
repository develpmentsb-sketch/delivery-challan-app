import React from 'react'
import transportImg from '../assets/transport.jpg'

// Full-screen transport photo behind the login page. It slowly "drives"
// forward (zoom + pan) while light streaks sweep across, like trucks passing.
export default function TransportBackground() {
  return (
    <div className="tbg-root" aria-hidden="true">
      <style>{`
        .tbg-root{position:fixed;inset:0;overflow:hidden;background:#0f1a35;z-index:0;pointer-events:none}
        .tbg-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;
          transform-origin:50% 70%;animation:tbg-drive 14s ease-in-out infinite alternate}
        .tbg-streak{position:absolute;top:0;bottom:0;width:30%;left:-50%;
          background:linear-gradient(100deg,transparent 0%,rgba(255,255,255,.22) 50%,transparent 100%);
          transform:skewX(-18deg);animation:tbg-sweep 6s linear infinite}
        .tbg-streak.s2{animation-delay:3s;width:16%;opacity:.7}
        .tbg-shade{position:absolute;inset:0;
          background:linear-gradient(to bottom,rgba(15,26,53,.45),rgba(15,26,53,.25) 45%,rgba(15,26,53,.6))}
        @keyframes tbg-drive{
          0%{transform:scale(1) translate(0,0)}
          100%{transform:scale(1.12) translate(-1.5%,2%)}}
        @keyframes tbg-sweep{
          0%{left:-50%}
          100%{left:130%}}
        @media (prefers-reduced-motion:reduce){
          .tbg-img,.tbg-streak{animation:none}}
      `}</style>
      <img className="tbg-img" src={transportImg} alt="" />
      <div className="tbg-streak" />
      <div className="tbg-streak s2" />
      <div className="tbg-shade" />
    </div>
  )
}
