// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./MermaidBlock', () => ({
  default: ({ onRenderedSvgChange }: { onRenderedSvgChange?: (svg: string | null) => void }) => (
    <button
      type="button"
      aria-label="Render Mermaid"
      onClick={() =>
        onRenderedSvgChange?.('<svg xmlns="http://www.w3.org/2000/svg"><text>Mermaid</text></svg>')
      }
    />
  )
}))

import { MarkdownReaderMermaidBlock } from './MarkdownReaderMermaidBlock'

describe('MarkdownReaderMermaidBlock', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it('opens sanitized Mermaid output with the keyboard-accessible media viewer', () => {
    act(() => root.render(<MarkdownReaderMermaidBlock content="flowchart TD" isDark={false} />))
    const renderButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Render Mermaid"]'
    )
    if (!renderButton) {
      throw new Error('Missing Mermaid render fixture')
    }

    act(() => renderButton.click())

    const trigger = container.querySelector<HTMLButtonElement>('button[aria-label="Open diagram"]')
    if (!trigger) {
      throw new Error('Missing Mermaid media trigger')
    }
    act(() => {
      trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    })

    expect(document.querySelector('[role="dialog"] svg text')?.textContent).toBe('Mermaid')
    expect(document.querySelector('button[aria-label="Zoom in"]')).not.toBeNull()
  })
})
