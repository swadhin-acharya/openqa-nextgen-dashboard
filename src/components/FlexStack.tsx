import { Stack as MuiStack, type StackProps as MuiStackProps } from '@mui/material'
import type { SxProps, Theme } from '@mui/material/styles'
import type { CSSProperties } from 'react'

/**
 * MUI v9's <Stack> no longer accepts `alignItems` / `justifyContent` as
 * first-class props (they must go through `sx`). This wrapper restores the
 * old, more ergonomic API - same fix as
 * resideo-nextgen-dashboard/src/components/common/FlexStack.tsx.
 */
type Responsive<T> = T | Partial<Record<'xs' | 'sm' | 'md' | 'lg' | 'xl', T>>

export interface FlexStackProps extends MuiStackProps {
  alignItems?: Responsive<CSSProperties['alignItems']>
  justifyContent?: Responsive<CSSProperties['justifyContent']>
}

export function Stack({ alignItems, justifyContent, sx, ...rest }: FlexStackProps) {
  const mergedSx: SxProps<Theme> = [
    { alignItems, justifyContent },
    ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
  ] as SxProps<Theme>

  return <MuiStack component="div" sx={mergedSx} {...rest} />
}
