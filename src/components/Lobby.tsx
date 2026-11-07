import { Copy, Play, Plus, Sparkles, Users } from 'lucide-react';
import React, { useState } from 'react';
import type { GameMode } from '../engine/types';
import { isSupabaseConfigured } from '../lib/supabase';
import { Avatar3D } from './poker/Avatar3D';
import { OffsuitCardBack } from './poker/PlayingCard';

interface LobbyProps {
  activeRoomCode: string;
  onlineCount: number;
  onStartInstantTable: () => void;
  onJoinOrCreateRoom: (roomCode: string) => void;
}

interface GameModeOption {
  id: GameMode;
  title: string;
  subtitle: string;
  available: boolean;
}

const GAME_MODES: GameModeOption[] = [
  {
    id: 'texas-holdem',
    title: "Texas Hold'em",
    subtitle: '6-Max · No-Limit · Instant Bots & Friends',
    available: true,
  },
  {
    id: 'blackjack',
    title: 'Blackjack 21',
    subtitle: 'Próximamente · Mismo motor de cartas',
    available: false,
  },
  {
    id: 'truco',
    title: 'Truco',
    subtitle: 'Próximamente · Baraja modular',
    available: false,
  },
  {
    id: 'uno',
    title: 'Uno & Shedding',
    subtitle: 'Próximamente · Multijugador en tiempo real',
    available: false,
  },
];

export const Lobby: React.FC<LobbyProps> = ({
  activeRoomCode,
  onlineCount,
  onStartInstantTable,
  onJoinOrCreateRoom,
}) => {
  const [joinInput, setJoinInput] = useState('');
  const [copied, setCopied] = useState(false);

  const handleGenerateRoom = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    onJoinOrCreateRoom(code);
  };

  const handleCopyCode = () => {
    navigator.clipboard?.writeText(activeRoomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="min-h-[100dvh] w-full bg-black text-white flex justify-center select-none">
      <div className="w-full max-w-[420px] min-h-[100dvh] flex flex-col justify-between px-5 py-7">
        {/* Top Brand + Player Profile Pill */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-12">
              <OffsuitCardBack className="w-full h-full rounded-[10px]" />
            </div>
            <div>
              <h1 className="text-[22px] font-semibold tracking-tight text-white leading-none">
                Offsuit
              </h1>
              <p className="text-[12px] text-[#7c7d85] mt-1">
                {isSupabaseConfigured ? 'Supabase Realtime Ready' : 'Local & Multi-Tab Sync'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 bg-[#16171a] border border-[#23252a] rounded-full pl-2 pr-3.5 py-1.5">
            <Avatar3D avatarId="hero" size={28} />
            <span className="text-[13px] font-medium text-white">200</span>
          </div>
        </div>

        {/* Main Quick Play & Multiplayer Room Card */}
        <div className="my-6 flex flex-col gap-4">
          <div className="bg-[#16171a] border border-[#23252a] rounded-[24px] p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[12px] text-[#7c7d85] font-medium uppercase tracking-wider">
                  Mesa Activa
                </span>
                <h2 className="text-[20px] font-medium text-white mt-0.5">
                  Texas Hold&apos;em
                </h2>
              </div>
              <button
                type="button"
                onClick={handleCopyCode}
                className="flex items-center gap-1.5 bg-black/60 border border-[#23252a] rounded-full px-3 py-1.5 text-[12px] text-[#eab308] font-medium cursor-pointer"
              >
                <span>#{activeRoomCode}</span>
                <Copy className="w-3.5 h-3.5 text-[#7c7d85]" />
                {copied && <span className="text-white text-[11px]">Copied</span>}
              </button>
            </div>

            {/* Avatars preview row */}
            <div className="flex items-center justify-between bg-black/40 rounded-[18px] px-3.5 py-2.5">
              <div className="flex -space-x-2">
                {['hero', 'emma', 'leo', 'akash', 'tori', 'evelyn'].map((av) => (
                  <div
                    key={av}
                    className="w-8 h-8 rounded-full bg-[#16171a] ring-2 ring-black flex items-center justify-center overflow-hidden"
                  >
                    <Avatar3D avatarId={av} size={30} />
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-1.5 text-[12px] text-[#7c7d85]">
                <Users className="w-3.5 h-3.5" />
                <span>{onlineCount} online · Bots fill seats</span>
              </div>
            </div>

            <button
              type="button"
              onClick={onStartInstantTable}
              className="w-full h-[52px] rounded-full bg-white text-black font-semibold text-[16px] flex items-center justify-center gap-2 active:scale-[0.99] transition-transform cursor-pointer"
            >
              <Play className="w-4 h-4 fill-black" />
              <span>Entrar a la Mesa</span>
            </button>
          </div>

          {/* Create or Join Friends Room */}
          <div className="bg-[#16171a] border border-[#23252a] rounded-[24px] p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-[#7c7d85] font-medium">
                Jugar con amigos (Código de Sala)
              </span>
              <button
                type="button"
                onClick={handleGenerateRoom}
                className="flex items-center gap-1 text-[12px] text-white hover:opacity-80 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Crear Sala</span>
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (joinInput.trim()) {
                  onJoinOrCreateRoom(joinInput.trim().toUpperCase());
                  setJoinInput('');
                }
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={joinInput}
                onChange={(e) => setJoinInput(e.target.value.toUpperCase())}
                placeholder="Código (ej. POKER)"
                maxLength={8}
                className="flex-1 h-[44px] rounded-full bg-black border border-[#23252a] px-4 text-[14px] text-white placeholder:text-[#7c7d85] focus:outline-none focus:border-white/40"
              />
              <button
                type="submit"
                className="h-[44px] px-5 rounded-full bg-[#23252a] text-white text-[14px] font-medium active:scale-95 cursor-pointer"
              >
                Unirse
              </button>
            </form>
          </div>

          {/* Multi-Game Engine Selector */}
          <div className="flex flex-col gap-2.5 mt-1">
            <div className="flex items-center gap-1.5 px-1">
              <Sparkles className="w-3.5 h-3.5 text-[#eab308]" />
              <span className="text-[12px] font-medium text-[#7c7d85] uppercase tracking-wider">
                Juegos del Motor
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {GAME_MODES.map((gm) => (
                <button
                  key={gm.id}
                  type="button"
                  disabled={!gm.available}
                  onClick={() => gm.available && onStartInstantTable()}
                  className={`rounded-[20px] p-3.5 text-left border transition-all ${
                    gm.available
                      ? 'bg-[#16171a] border-white/25 text-white cursor-pointer'
                      : 'bg-[#0d0e10] border-[#1a1b1f] text-[#7c7d85] opacity-60 cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[14px] font-medium">{gm.title}</span>
                    {gm.available && (
                      <span className="w-2 h-2 rounded-full bg-[#eab308]" />
                    )}
                  </div>
                  <p className="text-[11px] text-[#7c7d85] mt-1 leading-snug">
                    {gm.subtitle}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer note */}
        <div className="text-center text-[11px] text-[#7c7d85]">
          Offsuit Cards PWA · Fullscreen Dark Mode
        </div>
      </div>
    </div>
  );
};
