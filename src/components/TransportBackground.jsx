import React from 'react'
import sceneImg from '../assets/login-truck.jpg'
import truckImg from '../assets/login-truck-cutout.png'

// Full-screen sunset-highway background. The photo slowly drifts (camera move),
// and the white truck is a separate cut-out layer that keeps driving forward
// toward the viewer, then a fresh one pulls out from the same spot, on a loop.
// Positions are in percent of the photo so the truck always lines up with it.
export default function TransportBackground() {
  return (
    <div className="tbg-root" aria-hidden="true">
      <style>{`
        .tbg-root{position:fixed;inset:0;overflow:hidden;background:#0b1530;z-index:0;pointer-events:none}
        .tbg-center{position:absolute;left:50%;top:50%;width:max(100vw,calc(100vh * 1.3333));
          aspect-ratio:612/459;transform:translate(-50%,-50%)}
        .tbg-scene{position:absolute;inset:0;transform-origin:62% 62%;animation:tbg-drift 24s ease-in-out infinite alternate}
        .tbg-photo{position:absolute;inset:0;width:100%;height:100%;display:block}
        .tbg-truck{position:absolute;left:45.95%;top:57.5%;width:32.2%;transform-origin:1% 66%;
          animation:tbg-drive 9s cubic-bezier(.45,.05,.8,.6) infinite;
          filter:drop-shadow(0 6px 8px rgba(0,0,0,.35))}
        .tbg-sun{position:absolute;left:31%;top:40%;width:30%;aspect-ratio:1;border-radius:50%;
          background:radial-gradient(circle,rgba(255,220,140,.55),rgba(255,200,100,0) 65%);
          transform:translate(-50%,-50%);mix-blend-mode:screen;animation:tbg-sun 5s ease-in-out infinite alternate}
        .tbg-streak{position:absolute;top:0;bottom:0;width:22%;left:-40%;
          background:linear-gradient(100deg,transparent 0%,rgba(255,235,190,.14) 50%,transparent 100%);
          transform:skewX(-18deg);animation:tbg-sweep 9s linear infinite}
        .tbg-shade{position:absolute;inset:0;
          background:linear-gradient(to bottom,rgba(8,16,40,.30),rgba(8,16,40,.12) 45%,rgba(8,16,40,.45))}
        @keyframes tbg-drift{from{transform:scale(1) translate(0,0)}to{transform:scale(1.14) translate(-2.5%,-1.5%)}}
        @keyframes tbg-drive{
          0%,10%{transform:translateY(0) scale(1);opacity:1;filter:drop-shadow(0 6px 8px rgba(0,0,0,.35))}
          50%{opacity:1}
          80%{opacity:0}
          100%{transform:translateY(1%) scale(1.9);opacity:0;filter:blur(2px) drop-shadow(0 12px 14px rgba(0,0,0,.4))}}
        @keyframes tbg-sun{from{opacity:.55;transform:translate(-50%,-50%) scale(.92)}to{opacity:1;transform:translate(-50%,-50%) scale(1.08)}}
        @keyframes tbg-sweep{from{left:-40%}to{left:130%}}
        @media (prefers-reduced-motion:reduce){
          .tbg-scene,.tbg-truck,.tbg-sun,.tbg-streak{animation:none}}
      `}</style>
      <div className="tbg-center">
        <div className="tbg-scene">
          <img className="tbg-photo" src={sceneImg} alt="" />
          <div className="tbg-sun" />
          <img className="tbg-truck" src={truckImg} alt="" />
        </div>
      </div>
      <div className="tbg-streak" />
      <div className="tbg-shade" />
    </div>
  )
}
