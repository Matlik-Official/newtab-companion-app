import { useRef, useState, useEffect } from "react"
import { motion, useAnimationControls } from "framer-motion"

interface MarqueeTextProps {
  text: string
  className?: string
  speed?: number
  pauseDuration?: number
}

export function MarqueeText({ text, className = "", speed = 30, pauseDuration = 4 }: MarqueeTextProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLSpanElement>(null)
  const [shouldAnimate, setShouldAnimate] = useState(false)
  const [textWidth, setTextWidth] = useState(0)
  const [containerWidth, setContainerWidth] = useState(0)
  const [isHovered, setIsHovered] = useState(false)
  const [currentX, setCurrentX] = useState(0)
  const [leftFadeOpacity, setLeftFadeOpacity] = useState(0)
  const [rightFadeOpacity, setRightFadeOpacity] = useState(0)
  const controls = useAnimationControls()

  useEffect(() => {
    const measure = () => {
      if (containerRef.current && textRef.current) {
        const containerW = containerRef.current.offsetWidth
        const textW = textRef.current.offsetWidth
        setContainerWidth(containerW)
        setTextWidth(textW)
        setShouldAnimate(textW > containerW)
      }
    }
    measure()
    window.addEventListener("resize", measure)
    return () => window.removeEventListener("resize", measure)
  }, [text])

  useEffect(() => {
    if (!shouldAnimate || isHovered) return
    let cancelled = false

    const overflow = textWidth - containerWidth
    const duration = overflow / speed

    const animate = async () => {
      await new Promise((resolve) => setTimeout(resolve, pauseDuration * 1000))

      while (!cancelled) {
        const startTime = Date.now()
        controls.start({
          x: -overflow,
          transition: { duration, ease: "linear" },
        })

        const trackPosition = () => {
          if (cancelled) return
          const elapsed = (Date.now() - startTime) / 1000
          const progress = Math.min(elapsed / duration, 1)
          setCurrentX(-overflow * progress)
          if (progress < 1 && !isHovered) {
            requestAnimationFrame(trackPosition)
          }
        }
        trackPosition()

        await new Promise((resolve) => setTimeout(resolve, duration * 1000))
        if (cancelled) break
        setCurrentX(-overflow)

        await new Promise((resolve) => setTimeout(resolve, pauseDuration * 1000))
        if (cancelled) break

        const returnStartTime = Date.now()
        controls.start({
          x: 0,
          transition: { duration, ease: "linear" },
        })

        const trackReturnPosition = () => {
          if (cancelled) return
          const elapsed = (Date.now() - returnStartTime) / 1000
          const progress = Math.min(elapsed / duration, 1)
          setCurrentX(-overflow * (1 - progress))
          if (progress < 1 && !isHovered) {
            requestAnimationFrame(trackReturnPosition)
          }
        }
        trackReturnPosition()

        await new Promise((resolve) => setTimeout(resolve, duration * 1000))
        if (cancelled) break
        setCurrentX(0)

        await new Promise((resolve) => setTimeout(resolve, pauseDuration * 1000))
      }
    }

    animate()

    return () => {
      cancelled = true
      controls.stop()
    }
  }, [shouldAnimate, textWidth, containerWidth, speed, pauseDuration, controls, isHovered])

  // Reset animation position whenever the text changes
  useEffect(() => {
    controls.stop()
    controls.set({ x: 0 })
    setCurrentX(0)
    setIsHovered(false)
  }, [text, controls])

  useEffect(() => {
    if (isHovered) {
      controls.stop()
    }
  }, [isHovered, controls])

  const overflow = textWidth - containerWidth
  const showLeftFade = shouldAnimate && currentX < -2
  const showRightFade = shouldAnimate && currentX > -overflow + 2

  // Update fade opacities with smooth transitions
  useEffect(() => {
    setLeftFadeOpacity(showLeftFade ? 1 : 0)
    setRightFadeOpacity(showRightFade ? 1 : 0)
  }, [showLeftFade, showRightFade])

  const getMaskStyle = (): React.CSSProperties => {
    if (!shouldAnimate) return {}

    const fadeWidth = 20
    
    // Create smooth fade colors based on opacity
    const leftStart = `rgba(0,0,0,${1 - leftFadeOpacity})`
    const leftEnd = "black"
    const rightStart = "black"
    const rightEnd = `rgba(0,0,0,${1 - rightFadeOpacity})`

    return {
      maskImage: `linear-gradient(to right, ${leftStart}, ${leftEnd} ${fadeWidth}px, ${rightStart} calc(100% - ${fadeWidth}px), ${rightEnd})`,
      WebkitMaskImage: `linear-gradient(to right, ${leftStart}, ${leftEnd} ${fadeWidth}px, ${rightStart} calc(100% - ${fadeWidth}px), ${rightEnd})`,
      transition: "mask-image 0.3s ease, -webkit-mask-image 0.3s ease",
    }
  }

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden whitespace-nowrap transition-all duration-300 ease-out ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={getMaskStyle()}
    >
      {/* <div
        className={`pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-black to-transparent z-10 transition-opacity duration-200 ${showLeftFade ? "opacity-100" : "opacity-0"
          }`}
      />
      <div
        className={`pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-black to-transparent z-10 transition-opacity duration-200 ${showRightFade ? "opacity-100" : "opacity-0"
          }`}
      /> */}

      {shouldAnimate ? (
        <motion.span className="inline-block" initial={{ x: 0 }} animate={controls}>
          {text}
        </motion.span>
      ) : (
        <span className="inline-block">{text}</span>
      )}

      <span ref={textRef} className="invisible absolute left-0 top-0 whitespace-nowrap" aria-hidden="true">
        {text}
      </span>
    </div>
  )
}
