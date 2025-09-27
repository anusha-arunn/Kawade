"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type Player = "A" | "B";

export default function GamePage({ params }: { params: { id: string } }) {
  const initialBoard = Array(14).fill(5);
  const [board, setBoard] = useState<number[]>(initialBoard);
  const [turn, setTurn] = useState<Player>("A");

  const [stores, setStores] = useState<{
    A: { total: number; capture: number; kara: number; sweep: number };
    B: { total: number; capture: number; kara: number; sweep: number };
  }>({
    A: { total: 0, capture: 0, kara: 0, sweep: 0 },
    B: { total: 0, capture: 0, kara: 0, sweep: 0 },
  });

  const [gameOver, setGameOver] = useState(false);
  const [lastCaptureMsg, setLastCaptureMsg] = useState<string | null>(null);
  const [karaPit, setKaraPit] = useState<number | null>(null);
  const [capturePits, setCapturePits] = useState<number[]>([]);
  const [animating, setAnimating] = useState(false);

  const [speed, setSpeed] = useState<"slow" | "medium" | "fast">("medium");
  const delayMap = { slow: 400, medium: 200, fast: 80 };

  // ---------- SOUND ----------
  const audioCtxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const [soundOn, setSoundOn] = useState(true);
  const [volume, setVolume] = useState(0.6);

  useEffect(() => {
    const ensure = () => {
      if (!audioCtxRef.current) {
        const ctx = new (window.AudioContext ||
          (window as any).webkitAudioContext)();
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
      ensure();
      window.removeEventListener("pointerdown", onFirst);
    };
    window.addEventListener("pointerdown", onFirst, { once: true });
    return () => window.removeEventListener("pointerdown", onFirst);
  }, []);

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

  const sfx = {
    woodTap: () => playTone(220, 60, "square", 0.3),
    karaDing: () => {
      playTone(880, 120, "triangle", 0.5);
      setTimeout(() => playTone(1320, 120, "triangle", 0.4), 80);
    },
    captureChime: () => {
      playTone(660, 150, "sine", 0.5);
      setTimeout(() => playTone(990, 150, "sine", 0.4), 80);
    },
    scoopTick: () => playTone(450, 60, "square", 0.4),
    sweepFlourish: () => {
      playTone(520, 120, "triangle", 0.5);
      setTimeout(() => playTone(780, 120, "triangle", 0.5), 90);
      setTimeout(() => playTone(1040, 120, "triangle", 0.5), 180);
    },
  };

  // ---------- GAME FLOW ----------
  const handleMove = async (index: number) => {
    if (gameOver || animating) return;
    if (turn === "A" && index > 6) return;
    if (turn === "B" && index < 7) return;

    setAnimating(true);

    const {
      finalBoard,
      captures,
      gameOver: ended,
    } = await playRelayTurn(
      index,
      board,
      turn,
      setBoard,
      setStores,
      setLastCaptureMsg,
      setKaraPit,
      setCapturePits,
      delayMap[speed],
      sfx
    );

    setStores((s) => {
      const updated = { ...s };
      if (turn === "A") {
        updated.A.capture += captures;
        updated.A.total += captures;
      } else {
        updated.B.capture += captures;
        updated.B.total += captures;
      }
      return updated;
    });

    if (ended) {
      setGameOver(true);
      sfx.sweepFlourish();
    } else {
      setTurn(turn === "A" ? "B" : "A");
    }

    setAnimating(false);
  };

  const resetGame = () => {
    setBoard(initialBoard);
    setTurn("A");
    setStores({
      A: { total: 0, capture: 0, kara: 0, sweep: 0 },
      B: { total: 0, capture: 0, kara: 0, sweep: 0 },
    });
    setGameOver(false);
    setLastCaptureMsg(null);
    setKaraPit(null);
    setCapturePits([]);
  };

  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center p-6"
      style={{ backgroundColor: "#fdf6e3" }}
    >
      <h1 className="text-3xl font-bold mb-2 text-[#4b2e05]">
        Game ID: {params.id}
      </h1>

      {!gameOver && (
        <p className="mb-4 text-xl font-bold text-[#4b2e05]">
          Turn: Player {turn}
        </p>
      )}

      <div className="mb-4 flex items-center gap-4">
        <label className="font-semibold text-[#6b4226]">Speed:</label>
        <select
          value={speed}
          onChange={(e) =>
            setSpeed(e.target.value as "slow" | "medium" | "fast")
          }
          className="border rounded px-2 py-1"
          disabled={animating}
        >
          <option value="slow">🐢 Slow</option>
          <option value="medium">⚖️ Medium</option>
          <option value="fast">⚡ Fast</option>
        </select>

        <button
          onClick={() => setSoundOn((m) => !m)}
          className={`px-3 py-1 rounded ${
            soundOn ? "bg-green-600 text-white" : "bg-gray-600 text-white"
          }`}
        >
          {soundOn ? "🔊" : "🔇"}
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
        />
      </div>

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
          {board.slice(7, 14).map((stones, i) => (
            <Pit
              key={i + 7}
              count={stones}
              onClick={() => handleMove(i + 7)}
              active={!gameOver && turn === "B" && stones > 0 && !animating}
              karaFlash={karaPit === i + 7}
              captureFlash={capturePits.includes(i + 7)}
            />
          ))}
        </div>

        {/* Stores */}
        <div className="flex gap-12 my-4 justify-center">
          <Store player="A" {...stores.A} />
          <Store player="B" {...stores.B} />
        </div>

        {/* Player A row */}
        <div className="flex gap-3 mt-4">
          {board.slice(0, 7).map((stones, i) => (
            <Pit
              key={i}
              count={stones}
              onClick={() => handleMove(i)}
              active={!gameOver && turn === "A" && stones > 0 && !animating}
              karaFlash={karaPit === i}
              captureFlash={capturePits.includes(i)}
            />
          ))}
        </div>
      </div>

      {gameOver && (
        <div className="mt-6 flex flex-col items-center gap-3">
          <p className="text-2xl font-bold text-[#4b2e05]">
            {stores.A.total > stores.B.total
              ? "🎉 Player A Wins!"
              : stores.B.total > stores.A.total
              ? "🎉 Player B Wins!"
              : "🤝 It’s a Draw!"}
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
  karaFlash,
  captureFlash,
}: {
  count: number;
  onClick: () => void;
  active: boolean;
  karaFlash: boolean;
  captureFlash: boolean;
}) {
  const beads = Array.from({ length: count });

  return (
    <button
      onClick={onClick}
      disabled={!active}
      className={`w-28 h-28 rounded-full border-6 shadow-inner relative transition-colors duration-300
      flex flex-col items-center justify-center ${
        karaFlash
          ? "bg-blue-200 border-blue-500 ring-4 ring-blue-300 animate-pulse"
          : captureFlash
          ? "bg-green-200 border-green-500 ring-4 ring-green-300 animate-pulse"
          : active
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
              transition={{ duration: 0.3 }}
            />
          ))}
        </AnimatePresence>
      </div>
      <span
        className="absolute bottom-1 text-[14px] font-bold text-[#3a240f]"
        style={{
          textShadow:
            "1px 1px 0 rgba(255,255,255,0.6), -1px -1px 0 rgba(0,0,0,0.2)",
        }}
      >
        {count}
      </span>
    </button>
  );
}

// ----------------------
// Store Component
// ----------------------
function Store({
  player,
  total,
  capture,
  kara,
  sweep,
}: {
  player: "A" | "B";
  total: number;
  capture: number;
  kara: number;
  sweep: number;
}) {
  return (
    <div className="flex flex-col items-center text-[#3a240f]">
      <div className="w-24 h-24 rounded-lg border-4 border-[#b8860b] bg-[#f9e0bb] shadow-inner flex flex-col justify-center items-center">
        <span className="text-xl font-bold text-[#3a240f]">{total}</span>
      </div>
      <span className="mt-1 font-semibold text-[#3a240f]">Store {player}</span>
      <span className="text-xs text-[#5c3b16]">Capture: {capture}</span>
      <span className="text-xs text-[#5c3b16]">Kāra: {kara}</span>
      <span className="text-xs text-[#5c3b16]">Sweep: {sweep}</span>
    </div>
  );
}

// ----------------------
// Relay-Sowing Logic
// ----------------------
async function playRelayTurn(
  startIndex: number,
  board: number[],
  player: Player,
  setBoard: (b: number[]) => void,
  setStores: any,
  setLastCaptureMsg: any,
  setKaraPit: any,
  setCapturePits: any,
  delayMs: number,
  sfx: any
): Promise<{ finalBoard: number[]; captures: number; gameOver: boolean }> {
  let newBoard = [...board];
  let captures = 0;
  let index = startIndex;

  const nextIndex = (i: number) => (i + 1) % 14;
  const isOwnSide = (p: Player, i: number) => (p === "A" ? i <= 6 : i >= 7);

  const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

  while (true) {
    let stones = newBoard[index];
    if (stones === 0) break;
    newBoard[index] = 0;

    while (stones > 0) {
      index = nextIndex(index);
      newBoard[index]++;
      setBoard([...newBoard]);
      sfx.woodTap();
      stones--;
      await delay(delayMs);

      if (newBoard[index] === 4) {
        const owner: Player = index <= 6 ? "A" : "B";
        setStores((s: any) => ({
          ...s,
          [owner]: {
            ...s[owner],
            kara: s[owner].kara + 4,
            total: s[owner].total + 4,
          },
        }));
        newBoard[index] = 0;
        setBoard([...newBoard]);
        setLastCaptureMsg(`Kāra: Player ${owner} got 4 beads!`);
        setKaraPit(index);
        sfx.karaDing();
        sfx.scoopTick();
        setTimeout(() => setKaraPit(null), 800);
        await delay(300);
      }
    }

    const next = nextIndex(index);
    if (newBoard[next] === 0) {
      if (isOwnSide(player, index)) {
        const afterEmpty = nextIndex(next);
        const opp = 13 - afterEmpty;
        const captured = newBoard[afterEmpty] + newBoard[opp];
        captures += captured;
        newBoard[afterEmpty] = 0;
        newBoard[opp] = 0;
        setBoard([...newBoard]);
        setLastCaptureMsg(`Player ${player} captured ${captured} beads!`);
        setCapturePits([afterEmpty, opp]);
        sfx.captureChime();
        sfx.scoopTick();
        setTimeout(() => setCapturePits([]), 800);
        await delay(300);
      }
      break;
    }
    index = next;
  }

  const aEmpty = newBoard.slice(0, 7).every((v) => v === 0);
  const bEmpty = newBoard.slice(7, 14).every((v) => v === 0);

  return { finalBoard: newBoard, captures, gameOver: aEmpty || bEmpty };
}
