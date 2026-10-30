'use client'

import { toast } from 'sonner'

export function CopyButton({ text }: { text: string }) {
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success('¡Copiado al portapapeles!')
    } catch (err) {
      console.error('Error al copiar:', err)
      toast.error('No se pudo copiar el texto')
    }
  }

  return (
    <button 
      onClick={handleCopy}
      type="button"
      className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors px-2 py-1 rounded bg-blue-50 hover:bg-blue-100"
    >
      📋 Copiar
    </button>
  )
}
