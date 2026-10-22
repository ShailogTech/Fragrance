'use client'

import { useEffect, useRef } from 'react'

/**
 * useScrollReveal - Optimized IntersectionObserver for scroll-triggered reveals.
 * Uses a single shared observer for all elements (better performance).
 * Adds 'revealed' class when elements enter viewport.
 */
export function useScrollReveal() {
  const observerRef = useRef<IntersectionObserver | null>(null)

  useEffect(() => {
    // Single observer with higher threshold for smoother triggering
    observerRef.current = new IntersectionObserver(
      (entries) => {
        // Batch DOM updates with requestAnimationFrame
        requestAnimationFrame(() => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              entry.target.classList.add('revealed')
              observerRef.current?.unobserve(entry.target)
            }
          }
        })
      },
      {
        threshold: 0.05,
        rootMargin: '0px 0px -30px 0px',
      }
    )

    // Observe all scroll-reveal elements
    const selectors = [
      '.scroll-reveal',
      '.scroll-reveal-left',
      '.scroll-reveal-right',
      '.scroll-reveal-scale',
    ]

    const elements: Element[] = []
    for (const selector of selectors) {
      document.querySelectorAll(selector).forEach((el) => {
        elements.push(el)
        observerRef.current?.observe(el)
      })
    }

    return () => {
      observerRef.current?.disconnect()
    }
  }, [])
}

/**
 * useScrollProgress - Throttled scroll progress tracker.
 * Uses requestAnimationFrame for smooth 60fps updates.
 */
export function useScrollProgress() {
  const rafRef = useRef<number>(0)

  useEffect(() => {
    let ticking = false

    const updateProgress = () => {
      const scrollTop = window.scrollY
      const docHeight = document.documentElement.scrollHeight - window.innerHeight
      const progress = docHeight > 0 ? scrollTop / docHeight : 0
      document.documentElement.style.setProperty('--scroll-progress', `${progress * 100}%`)
      ticking = false
    }

    const handleScroll = () => {
      if (!ticking) {
        ticking = true
        rafRef.current = requestAnimationFrame(updateProgress)
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    updateProgress()

    return () => {
      window.removeEventListener('scroll', handleScroll)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])
}
