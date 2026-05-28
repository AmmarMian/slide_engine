// fox.jsx — FoxMascot sprite animation that tracks the progress bar.
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getSectionIdx } from './shared.js';
import foxSpriteUrl from '../assets/fox-sprite.png';
import foxJumpUrl from '../assets/fox-jump.png';
import foxDangleUrl from '../assets/fox-dangling.png';

const FOX_W = 48, FOX_H = 32, FOX_SCALE = 1.5;
// Row indices (0-based): 0=idle2, 1=walk_a, 2=walk_b, 3=idle
const WALK_FRAMES = [
  { col: 0, row: 1 }, { col: 1, row: 1 }, { col: 2, row: 1 }, { col: 3, row: 1 },
  { col: 0, row: 2 }, { col: 1, row: 2 }, { col: 2, row: 2 }, { col: 3, row: 2 },
];
const IDLE_FRAMES = [
  { col: 0, row: 3 }, { col: 1, row: 3 }, { col: 2, row: 3 }, { col: 3, row: 3 },
];
const WALK_INTERVAL = 80;   // ms per walk frame
const IDLE_INTERVAL = 200;  // ms per idle frame
const WALK_SPEED = 2.5;     // px per animation tick (~60fps)

// fox-jump.png: 5 cols × 2 rows. Row 0 = take-off + in-air, row 1 = landing.
const JUMP_FOX_COLS = 5, JUMP_FOX_ROWS = 2;
const JUMP_FRAMES = Array.from({ length: 5 }, (_, i) => ({ col: i, row: 0 }));
const LAND_FRAMES = Array.from({ length: 5 }, (_, i) => ({ col: i, row: 1 }));
const JUMP_INTERVAL = 75;  // ms per jump frame
const JUMP_PEAK = 40;      // px upward at apex

// fox-dangling.png: 192×47px, 5 cols × 1 row (fox being held by scruff).
const DANGLE_COLS = 5;
const DANGLE_SCALE = FOX_SCALE * 0.67;
const DANGLE_FRAME_W = 192 * DANGLE_SCALE / DANGLE_COLS;
const DANGLE_FRAME_H = 47 * DANGLE_SCALE;
const DANGLE_FRAMES = Array.from({ length: 5 }, (_, i) => ({ col: i, row: 0 }));
const DANGLE_INTERVAL = 130; // ms per dangle frame

export function FoxMascot({ trackRef, idx, sections }) {
  const [pos, setPos] = useState(null);
  const [dangleY, setDangleY] = useState(0);
  const [facingLeft, setFacingLeft] = useState(false);
  const [frame, setFrame] = useState(0);
  const [walking, setWalking] = useState(false);
  const [dragging, setDragging] = useState(false);
  // jumpPhase: null | 'prejump' | 'jumping' | 'landing'
  const [jumpPhase, setJumpPhase] = useState(null);
  const [jumpFr, setJumpFr] = useState(0);
  const [jumpY, setJumpY] = useState(0);
  const stateRef = useRef({
    pos: null, target: null, walking: false, frame: 0, lastFrameT: 0,
    jumpPhase: null, jumpFr: 0, jumpLastFrameT: 0, jumpY: 0,
    jumpStartX: 0, jumpEndX: 0, jumpAnimStartT: 0, prejumpTarget: 0,
    dragging: false,
  });
  const dragRef = useRef({ active: false, cursorX: 0, cursorY: 0 });
  const prevSecIdxRef = useRef(null);
  const rafRef = useRef(null);

  const computeTarget = useCallback(() => {
    const track = trackRef.current;
    if (!track) return null;
    const segs = track.querySelectorAll('.progress-seg');
    if (!segs.length) return null;
    const secIdx = getSectionIdx(idx, sections);
    const sec = sections[secIdx];
    const seg = segs[secIdx];
    if (!seg) return null;
    const fill = idx > sec.end ? 1 : idx >= sec.start ? (idx - sec.start + 1) / (sec.end - sec.start + 1) : 0;
    const segRect = seg.getBoundingClientRect();
    const fillRight = segRect.left + segRect.width * fill;
    const sprW = FOX_W * FOX_SCALE;
    return Math.min(fillRight - 40, window.innerWidth - sprW - 30);
  }, [trackRef, idx, sections]);

  // Single animation loop for all modes.
  useEffect(() => {
    const s = stateRef.current;
    const TOTAL_JUMP_MS = (JUMP_FRAMES.length + LAND_FRAMES.length) * JUMP_INTERVAL;

    const tick = (t) => {
      rafRef.current = requestAnimationFrame(tick);

      if (s.dragging) {
        if (t - s.lastFrameT >= DANGLE_INTERVAL) {
          s.frame = (s.frame + 1) % DANGLE_FRAMES.length;
          s.lastFrameT = t;
          setFrame(s.frame);
        }
        return;
      }

      if (s.jumpPhase === 'prejump') {
        if (t - s.lastFrameT >= WALK_INTERVAL) {
          s.frame = (s.frame + 1) % WALK_FRAMES.length;
          s.lastFrameT = t;
          setFrame(s.frame);
        }
        const diff = s.prejumpTarget - s.pos;
        if (Math.abs(diff) < 1) {
          s.pos = s.prejumpTarget;
          s.jumpStartX = s.pos;
          s.jumpPhase = 'jumping';
          s.jumpFr = 0;
          s.jumpLastFrameT = t;
          s.jumpAnimStartT = t;
          s.jumpY = 0;
          setJumpPhase('jumping'); setJumpFr(0); setJumpY(0); setPos(s.pos);
        } else {
          s.pos += Math.sign(diff) * Math.min(WALK_SPEED, Math.abs(diff));
          setFacingLeft(diff < 0);
          setPos(s.pos);
        }
        return;
      }

      if (s.jumpPhase === 'jumping' || s.jumpPhase === 'landing') {
        if (t - s.jumpLastFrameT >= JUMP_INTERVAL) {
          s.jumpLastFrameT = t;
          const jFrames = s.jumpPhase === 'jumping' ? JUMP_FRAMES : LAND_FRAMES;
          s.jumpFr++;
          if (s.jumpFr >= jFrames.length) {
            if (s.jumpPhase === 'jumping') {
              s.jumpPhase = 'landing'; s.jumpFr = 0;
            } else {
              s.jumpPhase = null; s.jumpFr = 0; s.jumpY = 0;
              s.pos = s.jumpEndX; s.target = s.jumpEndX;
              setJumpPhase(null); setJumpFr(0); setJumpY(0); setPos(s.pos);
              return;
            }
          }
          if (s.jumpPhase === 'jumping') {
            const p = s.jumpFr / Math.max(1, JUMP_FRAMES.length - 1);
            s.jumpY = -Math.sin(p * Math.PI) * JUMP_PEAK;
          } else if (s.jumpPhase === 'landing') {
            const p = s.jumpFr / Math.max(1, LAND_FRAMES.length - 1);
            s.jumpY = Math.sin(p * Math.PI) * JUMP_PEAK * 0.15;
          } else {
            s.jumpY = 0;
          }
          setJumpPhase(s.jumpPhase); setJumpFr(s.jumpFr); setJumpY(s.jumpY);
        }
        const xProgress = Math.min(1, (t - s.jumpAnimStartT) / TOTAL_JUMP_MS);
        s.pos = s.jumpStartX + xProgress * (s.jumpEndX - s.jumpStartX);
        setPos(s.pos);
        setFacingLeft(s.jumpEndX < s.jumpStartX);
        return;
      }

      const frames = s.walking ? WALK_FRAMES : IDLE_FRAMES;
      const interval = s.walking ? WALK_INTERVAL : IDLE_INTERVAL;
      if (t - s.lastFrameT >= interval) {
        s.frame = (s.frame + 1) % frames.length;
        s.lastFrameT = t;
        setFrame(s.frame);
      }
      if (s.walking && s.target !== null && s.pos !== null) {
        const diff = s.target - s.pos;
        if (Math.abs(diff) < 1) {
          s.pos = s.target; s.walking = false;
          setWalking(false); setPos(s.pos);
        } else {
          s.pos += Math.sign(diff) * Math.min(WALK_SPEED, Math.abs(diff));
          setFacingLeft(diff < 0); setPos(s.pos);
        }
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);

  // On slide change: trigger jump on section boundary, otherwise walk.
  useEffect(() => {
    const secIdx = getSectionIdx(idx, sections);
    const prevSec = prevSecIdxRef.current;
    prevSecIdxRef.current = secIdx;

    const timer = setTimeout(() => {
      const target = computeTarget();
      if (target === null) return;
      const s = stateRef.current;
      if (s.pos === null) {
        s.pos = target; s.target = target; s.walking = false;
        setPos(target); return;
      }
      if (s.dragging) { s.target = target; return; }
      s.target = target;
      const sectionChanged = prevSec !== null && prevSec !== secIdx;
      if (sectionChanged && !s.jumpPhase) {
        const goingRight = target >= s.pos;
        s.walking = false; setWalking(false);
        if (goingRight) {
          s.jumpPhase = 'jumping'; s.jumpFr = 0; s.jumpLastFrameT = 0;
          s.jumpAnimStartT = performance.now(); s.jumpY = 0;
          s.jumpStartX = s.pos; s.jumpEndX = target;
          setFacingLeft(false); setJumpPhase('jumping'); setJumpFr(0); setJumpY(0);
        } else {
          const track = trackRef.current;
          let walkBack = 30;
          if (track && prevSec != null) {
            const segs = track.querySelectorAll('.progress-seg');
            const prevSegEl = segs[prevSec];
            if (prevSegEl) {
              const sec = sections[prevSec];
              const span = Math.max(1, sec.end - sec.start + 1);
              walkBack = prevSegEl.getBoundingClientRect().width / span;
            }
          }
          s.jumpPhase = 'prejump';
          s.prejumpTarget = Math.max(0, s.pos - walkBack);
          s.jumpEndX = target; s.frame = 0; s.lastFrameT = 0;
          setFacingLeft(true); setJumpPhase('prejump');
        }
      } else if (!s.jumpPhase && Math.abs(target - s.pos) > 2) {
        s.walking = true; s.frame = 0; s.lastFrameT = 0; setWalking(true);
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [idx, computeTarget, sections]);

  const sprW = FOX_W * FOX_SCALE;
  const sprH = FOX_H * FOX_SCALE;

  const onPointerDown = (e) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const s = stateRef.current;
    s.jumpPhase = null; s.jumpY = 0; s.walking = false;
    s.dragging = true; s.frame = 0; s.lastFrameT = 0;
    const initPosX = Math.max(0, Math.min(window.innerWidth - DANGLE_FRAME_W, e.clientX - DANGLE_FRAME_W / 2));
    s.pos = initPosX; s.target = initPosX;
    dragRef.current = { active: true, cursorX: e.clientX, cursorY: e.clientY };
    setJumpPhase(null); setJumpY(0); setWalking(false);
    setDragging(true); setPos(initPosX); setDangleY(e.clientY);
  };

  const onPointerMove = (e) => {
    if (!dragRef.current.active) return;
    const prevX = dragRef.current.cursorX;
    dragRef.current.cursorX = e.clientX;
    dragRef.current.cursorY = e.clientY;
    const newPosX = Math.max(0, Math.min(window.innerWidth - DANGLE_FRAME_W, e.clientX - DANGLE_FRAME_W / 2));
    stateRef.current.pos = newPosX; stateRef.current.target = newPosX;
    if (Math.abs(e.clientX - prevX) > 0) setFacingLeft(e.clientX < prevX);
    setPos(newPosX); setDangleY(e.clientY);
  };

  const onPointerUp = () => {
    if (!dragRef.current.active) return;
    dragRef.current.active = false;
    stateRef.current.dragging = false;
    stateRef.current.walking = false;
    setDragging(false); setWalking(false);

    const cursorX = dragRef.current.cursorX;
    const track = trackRef.current;
    const stage = document.querySelector('deck-stage');
    if (track && stage) {
      const segs = [...track.querySelectorAll('.progress-seg')];
      for (let si = 0; si < sections.length; si++) {
        const seg = segs[si];
        if (!seg) continue;
        const rect = seg.getBoundingClientRect();
        if (cursorX >= rect.left && cursorX <= rect.right) {
          const sec = sections[si];
          const t = (cursorX - rect.left) / rect.width;
          const slideIdx = sec.start + Math.round(t * (sec.end - sec.start));
          stage.goTo(Math.max(sec.start, Math.min(sec.end, slideIdx)));
          break;
        }
      }
    }
    setTimeout(() => {
      const target = computeTarget();
      if (target === null) return;
      const s = stateRef.current;
      s.pos = target; s.target = target; setPos(target);
    }, 80);
  };

  if (pos === null) return null;

  const isAirborne = jumpPhase === 'jumping' || jumpPhase === 'landing';
  let bgUrl, bgSize, bpX, bpY, elW, elH;

  if (dragging) {
    const fr = DANGLE_FRAMES[frame % DANGLE_FRAMES.length];
    bgUrl = foxDangleUrl;
    bgSize = `${192 * DANGLE_SCALE}px ${47 * DANGLE_SCALE}px`;
    bpX = -(fr.col * DANGLE_FRAME_W); bpY = 0;
    elW = DANGLE_FRAME_W; elH = DANGLE_FRAME_H;
  } else if (isAirborne) {
    const jFrames = jumpPhase === 'jumping' ? JUMP_FRAMES : LAND_FRAMES;
    const fr = jFrames[Math.min(jumpFr, jFrames.length - 1)] || jFrames[0];
    bgUrl = foxJumpUrl;
    bgSize = `${JUMP_FOX_COLS * sprW}px ${JUMP_FOX_ROWS * sprH}px`;
    bpX = -(fr.col * sprW); bpY = -(fr.row * sprH);
    elW = sprW; elH = sprH;
  } else {
    const frames = (walking || jumpPhase === 'prejump') ? WALK_FRAMES : IDLE_FRAMES;
    const fr = frames[frame] || frames[0];
    bgUrl = foxSpriteUrl;
    bgSize = `${FOX_W * FOX_SCALE * 4}px ${FOX_H * FOX_SCALE * 4}px`;
    bpX = -(fr.col * FOX_W * FOX_SCALE); bpY = -(fr.row * FOX_H * FOX_SCALE);
    elW = sprW; elH = sprH;
  }

  const posStyle = dragging
    ? { top: dangleY, bottom: 'auto', left: pos }
    : { top: 'auto', bottom: 1, left: pos };

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{
        position: 'fixed',
        ...posStyle,
        width: elW, height: elH,
        zIndex: 2147483641,
        pointerEvents: 'auto',
        cursor: dragging ? 'grabbing' : 'grab',
        imageRendering: 'pixelated',
        filter: 'grayscale(1)',
        transform: dragging
          ? (facingLeft ? 'scaleX(-1)' : 'none')
          : `${facingLeft ? 'scaleX(-1) ' : ''}translateY(${jumpY}px)`,
        backgroundImage: `url(${bgUrl})`,
        backgroundSize: bgSize,
        backgroundPosition: `${bpX}px ${bpY}px`,
        backgroundRepeat: 'no-repeat',
      }} />
  );
}
