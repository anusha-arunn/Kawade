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
  const [lastMsg, setLastMsg] = useState<string | null>(null);

  // Auto-clear feedback messages
  useEffect(() => {
    if (!lastMsg) return;
    const t = setTimeout(() => setLastMsg(null), 2000);
    return () => clearTimeout(t);
  }, [lastMsg]);

  // Speed controls
  const [speed, setSpeed] = useState<"slow" | "medium" | "fast">("medium");
  const delayMap: Record<"slow" | "medium" | "fast", number> = {
    slow: 400,
    medium: 200,
    fast: 80,
  };

  // Sound setup
  const audioCtxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const [soundOn, setSoundOn] = useState(true);
  const [volume, setVolume] = useState(0.6);

  useEffect(() => {
    const ensureAudio = () => {
      if (!audioCtxRef.current) {
        const Ctor =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        const ctx = new Ctor();
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

    // Ensure context is resumed before playing
    if (ctx.state === "suspended") {
      ctx.resume();
    }

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

  const ensureAudioManual = () => {
    if (audioCtxRef.current && audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume();
    }
  };

  const sfx = useMemo(
    () => ({
      woodTap: () => playTone(220, 60, "square", 0.35),
      karaDing: () => {
        playTone(880, 120, "triangle", 0.55);
        setTimeout(() => playTone(1320, 120, "triangle", 0.45), 80);
      },
      captureChime: () => {
        playTone(660, 150, "sine", 0.5);
        setTimeout(() => playTone(990, 150, "sine", 0.4), 90);
      },
      sweepFlourish: () => {
        playTone(520, 140, "triangle", 0.5);
        setTimeout(() => playTone(780, 140, "triangle", 0.5), 100);
        setTimeout(() => playTone(1040, 140, "triangle", 0.5), 200);
      },
    }),
    []
  );

  const sleep = (ms: number): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, ms));

  const setBoardImmediate = (b: number[]) =>
    setState((prev) => ({ ...prev, board: b }));

  const handleMove = async (pitIndex: number) => {
    if (state.over || animating) return;
    if (state.turn === "A" && pitIndex > 6) return;
    if (state.turn === "B" && pitIndex < 7) return;
    if (state.board[pitIndex] === 0) return;
    ensureAudioManual();

    setAnimating(true);
    const newState = await applyMove(
      state,
      pitIndex,
      state.turn,
      setBoardImmediate,
      sfx,
      delayMap[speed],
      sleep,
      setLastMsg
    );
    setState(newState);
    setAnimating(false);
  };

  const resetGame = () => {
    ensureAudioManual();
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
      className="flex min-h-screen flex-col items-center justify-center p-3 sm:p-4"
      style={{ backgroundColor: "#fdf6e3" }}
    >
      <h1 className="text-lg sm:text-xl md:text-3xl font-bold mb-2 text-[#4b2e05]">
        Game ID: {params.id}
      </h1>

      {!state.over && (
        <motion.p
          key={state.turn}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.35 }}
          className={`mb-3 text-base sm:text-lg md:text-2xl font-extrabold ${
            state.turn === "A" ? "text-red-700" : "text-blue-700"
          }`}
        >
          👉 Player {state.turn}’s Turn
        </motion.p>
      )}

      {/* Feedback messages */}
      <AnimatePresence>
        {lastMsg && (
          <motion.div
            key={lastMsg}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.3 }}
            className={`mb-2 px-4 py-2 rounded-lg font-bold text-white ${
              lastMsg.startsWith("Kara") ? "bg-blue-600" : "bg-green-600"
            }`}
          >
            {lastMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controls */}
      <div className="mb-4 flex flex-wrap items-center gap-3 text-xs sm:text-sm md:text-base">
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
          className={`px-2 sm:px-3 py-1 rounded ${
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
          className="w-20 sm:w-28 md:w-40"
        />
      </div>

      {/* Board */}
      <div className="w-full max-w-5xl aspect-[3/1] flex items-center justify-center">
        <div
          className="w-full h-full p-3 sm:p-5 md:p-8 rounded-2xl border-4 shadow-lg flex flex-col justify-between"
          style={{
            backgroundColor: "#deb887",
            backgroundImage:
              "url('https://www.transparenttextures.com/patterns/wood-pattern.png')",
            backgroundBlendMode: "multiply",
          }}
        >
          {/* Player B row */}
          <div className="flex flex-row-reverse justify-center gap-[1vw]">
            {state.board.slice(7, 14).map((stones, i) => (
              <Pit
                key={i + 7}
                pitIndex={i + 7}
                count={stones}
                onClick={() => handleMove(i + 7)}
                active={
                  !state.over && state.turn === "B" && stones > 0 && !animating
                }
              />
            ))}
          </div>

          {/* Stores */}
          <div className="flex gap-8 sm:gap-12 md:gap-16 justify-center">
            <Store player="A" total={state.scores.A} />
            <Store player="B" total={state.scores.B} />
          </div>

          {/* Player A row */}
          <div className="flex justify-center gap-[1vw]">
            {state.board.slice(0, 7).map((stones, i) => (
              <Pit
                key={i}
                pitIndex={i}
                count={stones}
                onClick={() => handleMove(i)}
                active={
                  !state.over && state.turn === "A" && stones > 0 && !animating
                }
              />
            ))}
          </div>
        </div>
      </div>

      {state.over && (
        <div className="mt-6 flex flex-col items-center gap-2 sm:gap-3">
          <motion.p
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.45 }}
            className="text-base sm:text-lg md:text-2xl font-bold text-[#4b2e05]"
          >
            {winner}
          </motion.p>
          <p className="text-xs sm:text-sm md:text-base text-[#6b4226]">
            Final — A: <b>{state.scores.A}</b> vs B: <b>{state.scores.B}</b>
          </p>
          <button
            onClick={resetGame}
            className="bg-blue-600 text-white px-3 sm:px-4 py-1 sm:py-2 rounded-lg hover:bg-blue-700"
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
  pitIndex,
  count,
  onClick,
  active,
}: {
  pitIndex: number;
  count: number;
  onClick: () => void;
  active: boolean;
}) {
  const beads = Array.from(
    { length: count },
    (_, i) => `pit-${pitIndex}-bead-${i}`
  );

  return (
    <button
      onClick={onClick}
      disabled={!active}
      className={`
        w-[8vw] h-[8vw] sm:w-[7vw] sm:h-[7vw] md:w-[6vw] md:h-[6vw]
        min-w-10 min-h-10 max-w-24 max-h-24
        rounded-full border-4 shadow-inner relative flex items-center justify-center
        transition-colors duration-300
        ${
          active
            ? "bg-[#f9e0bb] hover:bg-[#f4d9a9] border-[#b8860b]"
            : "bg-[#f9e0bb] border-[#b8860b] opacity-70"
        }
      `}
    >
      <div className="flex flex-wrap w-full h-full justify-center items-center p-[0.3vw]">
        <AnimatePresence>
          {beads.map((id) => (
            <motion.div
              key={id}
              className="rounded-full border"
              style={{
                width: "0.8vw",
                height: "0.8vw",
                minWidth: "6px",
                minHeight: "6px",
                maxWidth: "14px",
                maxHeight: "14px",
                margin: "1px",
                background:
                  "radial-gradient(circle at 30% 30%, #fff6d5, #d2a679 70%, #8b5e3c 100%)",
                borderColor: "#6b4226",
                boxShadow:
                  "0 1px 2px rgba(0,0,0,0.4), inset -1px -1px 2px rgba(255,255,255,0.6)",
              }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0, y: -8 }}
              transition={{ duration: 0.22 }}
            />
          ))}
        </AnimatePresence>
      </div>
      <span className="absolute bottom-0 text-[1.2vw] sm:text-[1vw] md:text-sm font-bold text-[#3a240f]">
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
      <div
        className="
        w-[8vw] h-[8vw] sm:w-[6vw] sm:h-[6vw] md:w-[5vw] md:h-[5vw]
        min-w-12 min-h-12 max-w-20 max-h-20
        rounded-lg border-4 border-[#b8860b] bg-[#f9e0bb] shadow-inner
        flex flex-col justify-center items-center
      "
      >
        <span className="text-[1.4vw] sm:text-base md:text-lg font-bold text-[#3a240f]">
          {total}
        </span>
      </div>
      <span className="mt-1 text-[1vw] sm:text-xs md:text-base font-semibold text-[#3a240f]">
        Store {player}
      </span>
    </div>
  );
}

// ----------------------
// Game logic
// ----------------------
async function applyMove(
  state: GameState,
  pitIndex: number,
  mover: Player,
  setBoard: (b: number[]) => void,
  sfx: {
    woodTap: () => void;
    karaDing: () => void;
    captureChime: () => void;
    sweepFlourish: () => void;
  },
  delayMs: number,
  sleep: (ms: number) => Promise<void>,
  setLastMsg: (msg: string) => void
): Promise<GameState> {
  if (state.over) return state;

  let board = [...state.board];
  const scores = { ...state.scores };
  let idx = pitIndex;

  const next = (i: number) => (i + 1) % 14;
  const ownSide = (p: Player, i: number) => (p === "A" ? i <= 6 : i >= 7);

  while (true) {
    let stones = board[idx];
    if (stones === 0) break;

    board[idx] = 0;
    setBoard([...board]);

    while (stones > 0) {
      idx = next(idx);
      board[idx]++;
      setBoard([...board]);
      sfx.woodTap();
      await sleep(delayMs);

      // Kara rule
      if (board[idx] === 4) {
        const owner: Player = idx <= 6 ? "A" : "B";
        scores[owner] += 4;
        board[idx] = 0;
        setBoard([...board]);
        sfx.karaDing();
        setLastMsg(`Kara! +4 to Player ${owner}`);
        await sleep(Math.max(120, Math.floor(delayMs * 0.8)));
      }

      stones--;
    }

    const nxt = next(idx);
    if (board[nxt] === 0) {
      if (ownSide(mover, idx)) {
        const afterEmpty = next(nxt);
        const opp = 13 - afterEmpty;
        const captured = board[afterEmpty] + board[opp];
        if (captured > 0) {
          scores[mover] += captured;
          board[afterEmpty] = 0;
          board[opp] = 0;
          setBoard([...board]);
          sfx.captureChime();
          setLastMsg(`Capture! +${captured} to Player ${mover}`);
          await sleep(Math.max(150, Math.floor(delayMs)));
        }
      }
      break;
    }

    idx = nxt;
  }

  const aEmpty = board.slice(0, 7).every((v) => v === 0);
  const bEmpty = board.slice(7, 14).every((v) => v === 0);

  if (aEmpty || bEmpty) {
    const sweepA = board.slice(0, 7).reduce((a, b) => a + b, 0);
    const sweepB = board.slice(7, 14).reduce((a, b) => a + b, 0);
    scores.A += sweepA;
    scores.B += sweepB;
    board = Array(14).fill(0);
    setBoard([...board]);
    sfx.sweepFlourish();
    setLastMsg("Game over — sweeping beads!");
    return { board, turn: state.turn, scores, over: true };
  }

  return {
    board,
    turn: state.turn === "A" ? "B" : "A",
    scores,
    over: false,
  };
}
