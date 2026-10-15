import React from 'react'
import transportImg from '../assets/transport.jpg'

// Full-screen background that always shows the WHOLE photo (nothing cropped).
// The sharp picture sits in the centre at the biggest square that fits the
// screen; its soft edges blend into a blurred copy of the same photo that
// fills the rest of the screen. Light streaks sweep across for a moving feel.
export default function TransportBackground() {
  return (
    <div className="tbg-root" aria-hidden="true">
      <style>{`
        .tbg-root{position:fixed;inset:0;overflow:hidden;background:#0f1a35;z-index:0;pointer-events:none}
        .tbg-fill{position:absolute;top:-6%;left:-6%;width:112%;height:112%;object-fit:cover;
          filter:blur(26px) brightness(.85) saturate(1.1)}
        .tbg-img{position:absolute;top:50%;left:50%;height:min(100vh,100vw);width:min(100vh,100vw);
          object-fit:contain;transform:translate(-50%,-50%);animation:tbg-drive 12s ease-in-out infinite alternate;
          -webkit-mask-image:linear-gradient(to right,transparent,#000 7%,#000 93%,transparent),
                             linear-gradient(to bottom,transparent,#000 7%,#000 93%,transparent);
          -webkit-mask-composite:source-in;
          mask-image:linear-gradient(to right,transparent,#000 7%,#000 93%,transparent),
                     linear-gradient(to bottom,transparent,#000 7%,#000 93%,transparent);
          mask-composite:intersect}
        .tbg-streak{position:absolute;top:0;bottom:0;width:26%;left:-50%;
          background:linear-gradient(100deg,transparent 0%,rgba(255,255,255,.18) 50%,transparent 100%);
          transform:skewX(-18deg);animation:tbg-sweep 7s linear infinite}
        .tbg-streak.s2{animation-delay:3.5s;width:14%;opacity:.7}
        .tbg-shade{position:absolute;inset:0;
          background:linear-gradient(to bottom,rgba(15,26,53,.35),rgba(15,26,53,.15) 45%,rgba(15,26,53,.5))}
        @keyframes tbg-drive{
          0%{transform:translate(-50%,-50%) scale(1)}
          100%{transform:translate(-50%,-50%) scale(1.04)}}
        @keyframes tbg-sweep{
          0%{left:-50%}
          100%{left:130%}}
        @media (prefers-reduced-motion:reduce){
          .tbg-img,.tbg-streak{animation:none}}
      `}</style>
      <img className="tbg-fill" src={transportImg} alt="" />
      <img className="tbg-img" src={transportImg} alt="" />
      <div className="tbg-streak" />
      <div className="tbg-streak s2" />
      <div className="tbg-shade" />
    </div>
  )
}
