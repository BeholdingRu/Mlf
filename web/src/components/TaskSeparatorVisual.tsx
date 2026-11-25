import { useId } from 'react'
import { normalizeTaskSeparatorStyle, type TaskSeparatorStyle } from '../lib/task-separator-styles'
import './task-separator-visual.css'

const PATTERN_WIDTHS: Record<TaskSeparatorStyle, number> = {
  line: 40,
  wave: 40,
  snake: 48,
  zigzag: 32,
  dots: 16,
  dashes: 28,
  double: 40,
  diamonds: 32,
  braid: 48,
  fade: 40,
}

function PatternArtwork({ style }: { style: TaskSeparatorStyle }) {
  switch (style) {
    case 'wave':
      return <path d="M0 12Q10 4 20 12T40 12" />
    case 'snake':
      return <path d="M0 12C8-1 16-1 24 12S40 25 48 12" />
    case 'zigzag':
      return <path d="M0 12 8 5 24 19 32 12" />
    case 'dots':
      return <circle cx="8" cy="12" r="2.3" fill="currentColor" stroke="none" />
    case 'dashes':
      return <path d="M5 12H19" strokeWidth="3" />
    case 'double':
      return <path d="M0 8H40M0 16H40" strokeWidth="1.6" />
    case 'diamonds':
      return <path d="M0 12H10L16 6 22 12 16 18 10 12M22 12H32" strokeWidth="1.6" />
    case 'braid':
      return (
        <>
          <path d="M0 12C8 22 16 22 24 12S40 2 48 12" opacity="0.45" />
          <path d="M0 12C8 2 16 2 24 12S40 22 48 12" />
        </>
      )
    default:
      return null
  }
}

export function TaskSeparatorVisual({ style }: { style?: string | null }) {
  const separatorStyle = normalizeTaskSeparatorStyle(style)
  const instanceId = useId().replace(/:/g, '')
  const patternId = `task-separator-pattern-${instanceId}`
  const gradientId = `task-separator-gradient-${instanceId}`
  const maskId = `task-separator-mask-${instanceId}`
  const isFade = separatorStyle === 'fade'
  const isLine = separatorStyle === 'line'

  return (
    <span className={`task-separator-visual task-separator-visual--${separatorStyle}`} aria-hidden="true">
      <svg width="100%" height="24" focusable="false">
        <defs>
          <linearGradient id={gradientId} x1="0" x2="1">
            <stop offset="0" stopColor="white" stopOpacity={isFade ? 0 : 0.4} />
            <stop offset={isFade ? '38%' : '18%'} stopColor="white" />
            <stop offset={isFade ? '62%' : '82%'} stopColor="white" />
            <stop offset="1" stopColor="white" stopOpacity={isFade ? 0 : 0.4} />
          </linearGradient>
          <mask id={maskId} x="0" y="0" width="100%" height="24" maskUnits="userSpaceOnUse">
            <rect width="100%" height="24" fill={`url(#${gradientId})`} />
          </mask>
          {!isFade && !isLine && (
            <pattern id={patternId} width={PATTERN_WIDTHS[separatorStyle]} height="24" patternUnits="userSpaceOnUse">
              <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <PatternArtwork style={separatorStyle} />
              </g>
            </pattern>
          )}
        </defs>
        <g mask={`url(#${maskId})`}>
          {isLine ? (
            <rect y="10.5" width="100%" height="3" rx="1.5" fill="currentColor" />
          ) : isFade ? (
            <g fill="currentColor">
              <rect y="7" width="100%" height="10" rx="5" opacity="0.1" />
              <rect y="9" width="100%" height="6" rx="3" opacity="0.2" />
              <rect y="10.5" width="100%" height="3" rx="1.5" />
            </g>
          ) : (
            <rect width="100%" height="24" fill={`url(#${patternId})`} />
          )}
        </g>
      </svg>
    </span>
  )
}
