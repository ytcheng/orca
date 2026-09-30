// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { MarkdownReaderToolbar, type MarkdownReaderToolbarProps } from './MarkdownReaderToolbar'

function mountReaderToolbar(props: MarkdownReaderToolbarProps) {
  const host = document.createElement('div')
  const root = createRoot(host)
  act(() => root.render(<MarkdownReaderToolbar {...props} />))
  return { host, unmount: () => act(() => root.unmount()) }
}

function clickButton(host: HTMLElement, label: string): void {
  const button = Array.from(host.querySelectorAll('button')).find(
    (candidate) => candidate.getAttribute('aria-label') === label
  )
  if (!button) {
    throw new Error(`Missing button: ${label}`)
  }
  act(() => button.click())
}

it('delegates TOC and find actions to the current preview state', () => {
  const onToggleToc = vi.fn()
  const onOpenFind = vi.fn()
  const mounted = mountReaderToolbar({ tocVisible: true, onToggleToc, onOpenFind })

  clickButton(mounted.host, 'Hide table of contents')
  clickButton(mounted.host, 'Find in document')
  expect(onToggleToc).toHaveBeenCalledTimes(1)
  expect(onOpenFind).toHaveBeenCalledTimes(1)
  mounted.unmount()
})
