'use client'

import { useState } from 'react'
import { Heart, MessageCircle, Send, Bookmark, MoreHorizontal } from 'lucide-react'

interface InstagramMockupProps {
  imageUrl: string | null
  copy: string
  username?: string
}

export function InstagramMockup({
  imageUrl,
  copy,
  username = 'urielfgx'
}: InstagramMockupProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [liked, setLiked] = useState(false)
  const [saved, setSaved] = useState(false)

  const cleanUsername = username.replace(/^@/, '')
  const initial = cleanUsername.charAt(0).toUpperCase()

  return (
    <div className="w-full max-w-[340px] mx-auto bg-black border border-zinc-800/80 rounded-[2.5rem] overflow-hidden shadow-2xl relative select-none">
      
      {/* Notch superior simulado */}
      <div className="absolute top-0 inset-x-0 h-4 flex justify-center z-20">
        <div className="w-20 h-3.5 bg-zinc-900/90 rounded-b-xl border-b border-zinc-800/50" />
      </div>

      {/* Header del Post */}
      <div className="flex items-center justify-between p-3 pt-6 border-b border-zinc-900">
        <div className="flex items-center gap-2.5">
          {/* Anillo degradado de historias */}
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500 via-pink-500 to-purple-600 p-[2px] flex-shrink-0">
            <div className="w-full h-full bg-black rounded-full border border-black flex items-center justify-center text-[10px] font-bold text-white uppercase">
              {initial}
            </div>
          </div>
          <div>
            <span className="text-xs font-semibold text-white tracking-tight block">
              {cleanUsername}
            </span>
            <span className="text-[10px] text-zinc-500 block -mt-0.5">Publicidad</span>
          </div>
        </div>
        <button type="button" className="text-zinc-400 hover:text-white p-1">
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>

      {/* Imagen del Post (Relación 4:5 oficial de Instagram) */}
      <div className="w-full aspect-[4/5] bg-zinc-950 relative border-b border-zinc-900 overflow-hidden flex items-center justify-center">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt="Vista previa del post"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-zinc-600 space-y-2 p-4 text-center">
            <span className="text-3xl">📸</span>
            <span className="text-xs font-medium text-zinc-500">Sin imagen visual cargada</span>
          </div>
        )}
      </div>

      {/* Barra de Acciones */}
      <div className="p-3 space-y-2">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3.5">
            <button
              type="button"
              onClick={() => setLiked(!liked)}
              className={`transition-transform active:scale-125 ${liked ? 'text-red-500 fill-red-500' : 'text-white hover:text-zinc-300'}`}
            >
              <Heart className={`w-5 h-5 ${liked ? 'fill-current' : ''}`} />
            </button>
            <button type="button" className="text-white hover:text-zinc-300 transform -scale-x-100">
              <MessageCircle className="w-5 h-5" />
            </button>
            <button type="button" className="text-white hover:text-zinc-300">
              <Send className="w-5 h-5" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => setSaved(!saved)}
            className={`transition-colors ${saved ? 'text-white fill-white' : 'text-white hover:text-zinc-300'}`}
          >
            <Bookmark className={`w-5 h-5 ${saved ? 'fill-current' : ''}`} />
          </button>
        </div>

        {/* Contador de Likes */}
        <p className="text-[12px] font-semibold text-white">
          {liked ? '1,433' : '1,432'} Me gusta
        </p>

        {/* Caption con truncado dinámico estilo Instagram */}
        <div className="text-[12px] text-zinc-200 leading-[17px]">
          <span className="font-semibold text-white mr-1.5">{cleanUsername}</span>
          <span className={isExpanded ? 'whitespace-pre-wrap' : 'line-clamp-2'}>
            {copy}
          </span>
          {copy.length > 80 && (
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-[11px] text-zinc-500 hover:text-zinc-300 font-medium ml-1 block mt-0.5"
            >
              {isExpanded ? 'menos' : '... más'}
            </button>
          )}
        </div>

        <p className="text-[10px] text-zinc-600 uppercase tracking-wider pt-1 font-medium">
          Hace 2 horas
        </p>
      </div>
    </div>
  )
}
