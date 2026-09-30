// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  MarkdownReaderMediaViewer,
  type MarkdownReaderMediaViewerProps
} from './MarkdownReaderMediaViewer'

function mountMediaViewer(props: MarkdownReaderMediaViewerProps) {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  act(() => root.render(<MarkdownReaderMediaViewer {...props} />))
  return { host, root }
}

function requireTrigger(host: HTMLElement, label: string): HTMLButtonElement {
  const trigger = host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)
  if (!trigger) {
    throw new Error(`Missing media trigger: ${label}`)
  }
  return trigger
}

describe('MarkdownReaderMediaViewer', () => {
  let root: Root | undefined
  let host: HTMLDivElement | undefined

  beforeEach(() => {
    root = undefined
    host = undefined
  })

  afterEach(() => {
    if (root) {
      act(() => root?.unmount())
    }
    host?.remove()
  })

  it('opens an image dialog when its inline trigger is clicked', () => {
    const mounted = mountMediaViewer({
      src: 'data:image/png;base64,ZmFrZQ==',
      alt: 'small diagram',
      kind: 'image'
    })
    root = mounted.root
    host = mounted.host

    act(() => requireTrigger(mounted.host, 'Open image').click())

    expect(document.querySelector('[role="dialog"]')).not.toBeNull()
  })

  it('does not wrap linked images in a zoom trigger', () => {
    const mounted = mountMediaViewer({
      src: 'data:image/png;base64,ZmFrZQ==',
      alt: 'linked image',
      kind: 'image',
      isLinked: true
    })
    root = mounted.root
    host = mounted.host

    expect(mounted.host.querySelector('img')).not.toBeNull()
    expect(mounted.host.querySelector('button[aria-label="Open image"]')).toBeNull()
    expect(document.querySelector('[role="dialog"]')).toBeNull()
  })

  it.each(['Enter', ' '])('opens diagrams with the %s key', (key) => {
    const mounted = mountMediaViewer({
      src: '<svg xmlns="http://www.w3.org/2000/svg"><text>diagram</text></svg>',
      alt: 'diagram',
      kind: 'diagram'
    })
    root = mounted.root
    host = mounted.host
    const trigger = requireTrigger(mounted.host, 'Open diagram')

    act(() => {
      trigger.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
    })

    expect(document.querySelector('[role="dialog"]')).not.toBeNull()
  })

  it('closes on Escape and returns focus to the inline trigger', async () => {
    const mounted = mountMediaViewer({
      src: '<svg xmlns="http://www.w3.org/2000/svg"><text>diagram</text></svg>',
      alt: 'diagram',
      kind: 'diagram'
    })
    root = mounted.root
    host = mounted.host
    const trigger = requireTrigger(mounted.host, 'Open diagram')
    trigger.focus()
    act(() => trigger.click())
    expect(document.querySelector('[role="dialog"]')).not.toBeNull()

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })

    expect(document.querySelector('[role="dialog"]')).toBeNull()
    await waitFor(() => expect(document.activeElement).toBe(trigger))
  })

  it('provides zoom controls in the media dialog', () => {
    const mounted = mountMediaViewer({
      src: 'data:image/png;base64,ZmFrZQ==',
      alt: 'small image',
      kind: 'image'
    })
    root = mounted.root
    host = mounted.host
    act(() => requireTrigger(mounted.host, 'Open image').click())
    const zoomIn = document.querySelector<HTMLButtonElement>('button[aria-label="Zoom in"]')
    if (!zoomIn) {
      throw new Error('Missing zoom-in button')
    }

    act(() => zoomIn.click())
    expect(document.querySelector('[data-zoom-percent]')?.textContent).toBe('125%')
  })
})
