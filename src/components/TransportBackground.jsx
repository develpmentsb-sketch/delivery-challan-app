import React from 'react'
import transportImg from '../assets/transport.jpg'

// Full-screen background made ONLY of sharp copies of the photo (no blur).
// The photo is repeated side by side, every second copy mirrored so the edges
// join seamlessly, and the whole strip drifts slowly sideways so the trucks
// feel like they are moving. Light streaks sweep across for extra motion.
const TILES = [0, 1, 2, 3, 4, 5, 6, 7, 8] // tile 4 is centred on screen

export default function TransportBackground() {
  return (
    <div className="tbg-root" aria-hidden="true">
      <style>{`
        .tbg-root{position:fixed;inset:0;overflow:hidden;background:#0f1a35;z-index:0;pointer-events:none}
        .tbg-row{position:absolute;top:0;height:100vh;width:900vh;left:calc(50% - 450vh);
          display:flex;animation:tbg-pan 90s linear infinite}
        .tbg-tile{flex:none;display:block;height:100vh;width:100vh;object-fit:cover}
        .tbg-tile.flip{transform:scaleX(-1)}
        .tbg-cover{display:none;position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
        .tbg-streak{position:absolute;top:0;bottom:0;width:26%;left:-50%;
          background:linear-gradient(100deg,transparent 0%,rgba(255,255,255,.16) 50%,transparent 100%);
          transform:skewX(-18deg);animation:tbg-sweep 7s linear infinite}
        .tbg-streak.s2{animation-delay:3.5s;width:14%;opacity:.7}
        .tbg-shade{position:absolute;inset:0;
          background:linear-gradient(to bottom,rgba(15,26,53,.35),rgba(15,26,53,.15) 45%,rgba(15,26,53,.5))}
        @keyframes tbg-pan{from{transform:translateX(0)}to{transform:translateX(-200vh)}}
        @keyframes tbg-sweep{from{left:-50%}to{left:130%}}
        @media (orientation:portrait){
          .tbg-row{display:none}
          .tbg-cover{display:block}}
        @media (prefers-reduced-motion:reduce){
          .tbg-row,.tbg-streak{animation:none}}
      `}</style>
      <div className="tbg-row">
        {TILES.map((i) => (
          <img key={i} className={`tbg-tile${(i - 4) % 2 !== 0 ? ' flip' : ''}`} src={transportImg} alt="" />
        ))}
      </div>
      <img className="tbg-cover" src={transportImg} alt="" />
      <div className="tbg-streak" />
      <div className="tbg-streak s2" />
      <div className="tbg-shade" />
    </div>
  )
}
