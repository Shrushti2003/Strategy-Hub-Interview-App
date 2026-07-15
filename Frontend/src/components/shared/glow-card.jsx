"use client"
import { useRef, useState } from 'react'
import { motion } from 'framer-motion'

export default function GlowCard({ children, className }) {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const cardRef = useRef(null)

  const handleMouseMove = (e) => {
    if (!cardRef.current) return
    const rect = cardRef.current.getBoundingClientRect()
    setMousePosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    })
  }

  return (
    <motion.div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      className={`relative overflow-hidden rounded-xl glass-card transition-colors hover:border-brand/30 ${className}`}
      whileHover="hover"
      initial="initial"
    >
      <motion.div
        className="pointer-events-none absolute -inset-px rounded-xl opacity-0 transition duration-300 group-hover:opacity-100"
        style={{
          background: `radial-gradient(600px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(139, 92, 246, 0.1), transparent 40%)`,
        }}
        variants={{
          hover: { opacity: 1 },
          initial: { opacity: 0 }
        }}
      />
      <div className="relative z-10 h-full">{children}</div>
    </motion.div>
  )
}
