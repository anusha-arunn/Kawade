"use client";

import { useRouter } from "next/navigation";
import { v4 as uuid } from "uuid";

export default function Home() {
  const router = useRouter();

  const createGame = () => {
    const id = uuid(); // generate random game id
    router.push(`/game/${id}`);
  };

  const joinGame = () => {
    const id = prompt("Enter Game ID:");
    if (id) router.push(`/game/${id}`);
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <h1 className="text-3xl font-bold mb-8">2-Player Board Game</h1>

      <div className="flex gap-4">
        <button
          onClick={createGame}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
        >
          Create Game
        </button>

        <button
          onClick={joinGame}
          className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700"
        >
          Join Game
        </button>
      </div>
    </main>
  );
}
