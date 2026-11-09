type Variant = 'verticale' | 'festa' | 'statico'

interface Props {
  variant?: Variant
  className?: string
}

export function PaloBarbiere({ variant = 'statico', className = '' }: Props) {
  const anim =
    variant === 'verticale' ? ' palo-verticale--ruota' : variant === 'festa' ? ' palo-verticale--festa' : ''
  return (
    <div
      className={`palo-barbiere palo-verticale${anim}${className ? ` ${className}` : ''}`}
      role="presentation"
      aria-hidden
    />
  )
}
