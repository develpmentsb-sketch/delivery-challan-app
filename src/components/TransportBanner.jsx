import React from 'react'
import transportImg from '../assets/transport.jpg'

// Transport photo with a "running" effect: the picture slowly drives forward
// (zoom + pan) and light streaks sweep across it, like vehicles moving past.
export default function TransportBanner({ className = '' }) {
  return (
    <div className={`tb-frame ${className}`}>
      <style>{`
        .tb-frame{position:relative;width:100%;max-width:420px;aspect-ratio:1/1;border-radius:24px;overflow:hidden;
          box-shadow:0 20px 50px rgba(28,42,77,.28);background:#1c2a4d}
        .tb-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;
          transform-origin:50% 75%;animation:tb-drive 9s ease-in-out infinite alternate}
        .tb-streak{position:absolute;top:0;bottom:0;width:40%;left:-60%;
          background:linear-gradient(100deg,transparent 0%,rgba(255,255,255,.35) 50%,transparent 100%);
          transform:skewX(-18deg);animation:tb-sweep 3.6s linear infinite}
        .tb-streak.s2{animation-delay:1.8s;width:22%;opacity:.7}
        .tb-vignette{position:absolute;inset:0;pointer-events:none;
          background:linear-gradient(to top,rgba(15,26,53,.55),transparent 45%)}
        .tb-tag{position:absolute;left:18px;bottom:16px;right:18px;color:#fff;font-family:Inter,Arial,sans-serif}
        .tb-tag b{display:block;font-size:18px;letter-spacing:.06em}
        .tb-tag span{font-size:12px;color:#ffd36b;letter-spacing:.12em;font-weight:600}
        @keyframes tb-drive{
          0%{transform:scale(1) translate(0,0)}
          100%{transform:scale(1.22) translate(-2.5%,3%)}}
        @keyframes tb-sweep{
          0%{left:-60%}
          100%{left:130%}}
        @media (prefers-reduced-motion:reduce){
          .tb-img,.tb-streak{animation:none}}
      `}</style>
      <img className="tb-img" src={transportImg} alt="Trucks on the move" />
      <div className="tb-streak" />
      <div className="tb-streak s2" />
      <div className="tb-vignette" />
      <div className="tb-tag">
        <b>ALWAYS ON THE MOVE</b>
        <span>CHALLANS &amp; E-WAY BILLS, DELIVERED</span>
      </div>
    </div>
  )
}
