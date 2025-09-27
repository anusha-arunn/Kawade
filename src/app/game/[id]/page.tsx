"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type Player = "A" | "B";

interface Scores {
  A: number;
  B: number;
}

interface GameState {
  board: number[];
  turn: Player;
  scores: Scores;
  over: boolean;
}

export default function GamePage({ params }: { params: { id: string } }) {
  const initialBoard = Array(14).fill(5);

  const [state, setState] = useState<GameState>({
    board: initialBoard,
    turn: "A",
    scores: { A: 0, B: 0 },
    over: false,
  });

  const [animating, setAnimating] = useState(false);

  // Sound engine
  const audioCtxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const [soundOn, setSoundOn] = useState(true);
  const [volume, setVolume] = useState(0.6);

  useEffect(() => {
    const ensureAudio = () => {
      if (!audioCtxRef.current) {
      const ctx = new (window.AudioContext ||
                      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();

        const gain = ctx.createGain();
        gain.gain.value = soundOn ? volume : 0;
        gain.connect(ctx.destination);
        audioCtxRef.current = ctx;
        masterGainRef.current = gain;
      } else {
        audioCtxRef.current.resume?.();
      }
    };
    const onFirst = () => {
      ensureAudio();
      window.removeEventListener("pointerdown", onFirst);
    };
    window.addEventListener("pointerdown", onFirst, { once: true });
    return () => window.removeEventListener("pointerdown", onFirst);
  }, [soundOn, volume]);

  useEffect(() => {
    if (masterGainRef.current) {
      masterGainRef.current.gain.value = soundOn ? volume : 0;
    }
  }, [soundOn, volume]);

  const playTone = (
    freq: number,
    durMs: number,
    type: OscillatorType = "sine",
    gain = 0.5
  ) => {
    const ctx = audioCtxRef.current;
    const master = masterGainRef.current;
    if (!ctx || !master) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(gain, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + durMs / 1000);
    osc.connect(g);
    g.connect(master);
    osc.start(now);
    osc.stop(now + durMs / 1000 + 0.05);
  };

  const sfx = useMemo(
    () => ({
      woodTap: () => playTone(220, 60, "square", 0.3),
      karaDing: () => {
        playTone(880, 120, "triangle", 0.5);
        setTimeout(() => playTone(1320, 120, "triangle", 0.4), 80);
      },
      captureChime: () => {
        playTone(660, 150, "sine", 0.5);
        setTimeout(() => playTone(990, 150, "sine", 0.4), 80);
      },
      sweepFlourish: () => {
        playTone(520, 120, "triangle", 0.5);
        setTimeout(() => playTone(780, 120, "triangle", 0.5), 90);
        setTimeout(() => playTone(1040, 120, "triangle", 0.5), 180);
      },
    }),
    []
  );

  const handleMove = (pitIndex: number) => {
    if (state.over || animating) return;
    if (state.turn === "A" && pitIndex > 6) return;
    if (state.turn === "B" && pitIndex < 7) return;
    if (state.board[pitIndex] === 0) return;

    setAnimating(true);
    const newState = applyMove(state, pitIndex, state.turn, sfx);
    setState(newState);
    setAnimating(false);
  };

  const resetGame = () => {
    setState({
      board: initialBoard,
      turn: "A",
      scores: { A: 0, B: 0 },
      over: false,
    });
  };

  const winner =
    state.over && state.scores.A !== state.scores.B
      ? state.scores.A > state.scores.B
        ? "🎉 Player A Wins!"
        : "🎉 Player B Wins!"
      : state.over
      ? "🤝 It’s a Draw!"
      : null;

  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center p-6"
      style={{ backgroundColor: "#fdf6e3" }}
    >
      <h1 className="text-3xl font-bold mb-2 text-[#4b2e05]">
        Game ID: {params.id}
      </h1>
      {!state.over && (
        <p className="mb-4 text-xl font-bold text-[#4b2e05]">
          Turn: Player {state.turn}
        </p>
      )}

      {/* Board */}
      <div
        className="p-8 rounded-3xl border-4 shadow-[0_5px_20px_rgba(0,0,0,0.5)]"
        style={{
          backgroundColor: "#deb887",
          backgroundImage:
            "url('https://www.transparenttextures.com/patterns/wood-pattern.png')",
          backgroundBlendMode: "multiply",
        }}
      >
        {/* Player B row */}
        <div className="flex flex-row-reverse gap-3 mb-4">
          {state.board.slice(7, 14).map((stones, i) => (
            <Pit
              key={i + 7}
              count={stones}
              onClick={() => handleMove(i + 7)}
              active={!state.over && state.turn === "B" && stones > 0}
            />
          ))}
        </div>

        {/* Scores */}
        <div className="flex gap-12 my-4 justify-center">
          <Store player="A" total={state.scores.A} />
          <Store player="B" total={state.scores.B} />
        </div>

        {/* Player A row */}
        <div className="flex gap-3 mt-4">
          {state.board.slice(0, 7).map((stones, i) => (
            <Pit
              key={i}
              count={stones}
              onClick={() => handleMove(i)}
              active={!state.over && state.turn === "A" && stones > 0}
            />
          ))}
        </div>
      </div>

      {state.over && (
        <div className="mt-6 flex flex-col items-center gap-3">
          <p className="text-2xl font-bold text-[#4b2e05]">{winner}</p>
          <p className="text-[#6b4226]">
            Final — A: <b>{state.scores.A}</b> vs B: <b>{state.scores.B}</b>
          </p>
          <button
            onClick={resetGame}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            New Game
          </button>
        </div>
      )}
    </main>
  );
}

// ----------------------
// Pit Component
// ----------------------
function Pit({
  count,
  onClick,
  active,
}: {
  count: number;
  onClick: () => void;
  active: boolean;
}) {
  const beads = Array.from({ length: count });

  return (
    <button
      onClick={onClick}
      disabled={!active}
      className={`w-28 h-28 rounded-full border-6 shadow-inner relative transition-colors duration-300
      flex flex-col items-center justify-center ${
        active
          ? "bg-[#f9e0bb] hover:bg-[#f4d9a9] border-[#b8860b]"
          : "bg-[#f9e0bb] border-[#b8860b] opacity-70"
      }`}
    >
      <div className="flex flex-wrap w-24 h-24 justify-center items-center">
        <AnimatePresence>
          {beads.map((_, i) => (
            <motion.div
              key={i}
              className="w-4 h-4 rounded-full m-[2px] border"
              style={{
                background: `
                  radial-gradient(circle at 30% 30%, #fff6d5, #d2a679 70%, #8b5e3c 100%)
                `,
                borderColor: "#6b4226",
                boxShadow:
                  "0 1px 2px rgba(0,0,0,0.4), inset -1px -1px 2px rgba(255,255,255,0.6)",
              }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
            />
          ))}
        </AnimatePresence>
      </div>
      <span className="absolute bottom-1 text-[14px] font-bold text-[#3a240f]">
        {count}
      </span>
    </button>
  );
}

// ----------------------
// Store Component
// ----------------------
function Store({ player, total }: { player: Player; total: number }) {
  return (
    <div className="flex flex-col items-center text-[#3a240f]">
      <div className="w-24 h-24 rounded-lg border-4 border-[#b8860b] bg-[#f9e0bb] shadow-inner flex flex-col justify-center items-center">
        <span className="text-xl font-bold text-[#3a240f]">{total}</span>
      </div>
      <span className="mt-1 font-semibold text-[#3a240f]">Store {player}</span>
    </div>
  );
}

// ----------------------
// Rules Engine (frontend-only)
// ----------------------
function applyMove(
  state: GameState,
  pitIndex: number,
  mover: Player,
  sfx: {
    woodTap: () => void;
    karaDing: () => void;
    captureChime: () => void;
    sweepFlourish: () => void;
  }
): GameState {
  if (state.over) return state;

  let board = [...state.board];
  const scores = { ...state.scores };
  let idx = pitIndex;

  while (true) {
    let stones = board[idx];
    if (stones === 0) break;
    board[idx] = 0;

    while (stones > 0) {
      idx = (idx + 1) % 14;
      board[idx]++;
      sfx.woodTap();

      // Kāra check
      if (board[idx] === 4) {
        const owner: Player = idx <= 6 ? "A" : "B";
        scores[owner] += 4;
        board[idx] = 0;
        sfx.karaDing();
      }
      stones--;
    }

    const next = (idx + 1) % 14;
    if (board[next] === 0) {
      if ((mover === "A" && idx <= 6) || (mover === "B" && idx >= 7)) {
        const afterEmpty = (next + 1) % 14;
        const opp = 13 - afterEmpty;
        const captured = board[afterEmpty] + board[opp];
        if (captured > 0) {
          scores[mover] += captured;
          board[afterEmpty] = 0;
          board[opp] = 0;
          sfx.captureChime();
        }
      }
      break;
    }
    idx = next;
  }

  const aEmpty = board.slice(0, 7).every((v) => v === 0);
  const bEmpty = board.slice(7, 14).every((v) => v === 0);

  if (aEmpty || bEmpty) {
    const sweepA = board.slice(0, 7).reduce((a, b) => a + b, 0);
    const sweepB = board.slice(7, 14).reduce((a, b) => a + b, 0);
    scores.A += sweepA;
    scores.B += sweepB;
    board = Array(14).fill(0);
    sfx.sweepFlourish();
    return { board, turn: state.turn, scores, over: true };
  }

  return {
    board,
    turn: state.turn === "A" ? "B" : "A",
    scores,
    over: false,
  };
}
