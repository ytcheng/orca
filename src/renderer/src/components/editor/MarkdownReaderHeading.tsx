import { Check, Hash } from 'lucide-react'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import type { MarkdownPreviewPresentation } from './markdown-preview-types'

export type MarkdownReaderHeadingLevel = 1 | 2 | 3 | 4 | 5 | 6

const HEADING_TAGS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] as const

export function renderMarkdownPreviewHeading(
  presentation: MarkdownPreviewPresentation,
  level: MarkdownReaderHeadingLevel,
  props: React.ComponentProps<'h1'>,
  children: React.ReactNode
): React.ReactNode {
  if (presentation === 'reader') {
    return (
      <MarkdownReaderHeading {...props} level={level}>
        {children}
      </MarkdownReaderHeading>
    )
  }
  const Heading = HEADING_TAGS[level - 1]
  return (
    <Heading {...props} tabIndex={-1}>
      {children}
    </Heading>
  )
}

export function MarkdownReaderHeading({
  level,
  children,
  id,
  ...props
}: React.ComponentProps<'h1'> & { level: MarkdownReaderHeadingLevel }): React.JSX.Element {
  const Heading = HEADING_TAGS[level - 1]
  const title = getHeadingText(children)
  return (
    <Heading {...props} id={id} tabIndex={-1}>
      <span className="markdown-reader-heading-text">{children}</span>
      {id ? <MarkdownReaderHeadingLink id={id} title={title || id} /> : null}
    </Heading>
  )
}

function MarkdownReaderHeadingLink({
  id,
  title
}: {
  id: string
  title: string
}): React.JSX.Element {
  useTranslation()
  const [copied, setCopied] = useState(false)
  const isMountedRef = useRef(false)
  const resetTimerRef = useRef<number | null>(null)
  const label = translate(
    copied
      ? 'auto.components.editor.MarkdownReaderHeading.copied'
      : 'auto.components.editor.MarkdownReaderHeading.copy',
    copied ? 'Copied heading link: {{value0}}' : 'Copy link to heading: {{value0}}',
    { value0: title }
  )

  useEffect(
    () => () => {
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current)
      }
    },
    []
  )

  const setCopyButtonRef = useCallback((button: HTMLButtonElement | null): void => {
    isMountedRef.current = button !== null
    if (button === null && resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current)
      resetTimerRef.current = null
    }
  }, [])

  const copyHeadingLink = async (): Promise<void> => {
    try {
      await window.api.ui.writeClipboardText(`#${encodeURIComponent(id)}`)
      if (!isMountedRef.current) {
        return
      }
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current)
      }
      setCopied(true)
      resetTimerRef.current = window.setTimeout(() => {
        resetTimerRef.current = null
        setCopied(false)
      }, 1_400)
    } catch {
      // Clipboard access can fail when the app window has lost permission.
    }
  }

  return (
    <span className="markdown-reader-heading-link">
      <Button
        ref={setCopyButtonRef}
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label={label}
        title={label}
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          void copyHeadingLink()
        }}
      >
        {copied ? <Check className="size-3.5" /> : <Hash className="size-3.5" />}
      </Button>
    </span>
  )
}

function getHeadingText(children: React.ReactNode): string {
  let text = ''
  React.Children.forEach(children, (child) => {
    if (typeof child === 'string' || typeof child === 'number') {
      text += child
    } else if (React.isValidElement<{ children?: React.ReactNode }>(child)) {
      text += getHeadingText(child.props.children)
    }
  })
  return text.trim()
}
