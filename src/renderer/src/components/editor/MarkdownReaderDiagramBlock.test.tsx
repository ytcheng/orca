// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const renderMarkdownDiagramMock = vi.hoisted(() => vi.fn())
vi.mock('./markdown-reader-diagram-renderers', () => ({
  renderMarkdownDiagram: renderMarkdownDiagramMock
}))

import {
  MarkdownReaderDiagramBlock,
  sanitizeMarkdownDiagramSvg
} from './MarkdownReaderDiagramBlock'

function deferred<T>(): {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason: Error) => void
} {
  let resolve = (_value: T): void => {}
  let reject = (_reason: Error): void => {}
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

describe('MarkdownReaderDiagramBlock', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    renderMarkdownDiagramMock.mockReset()
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.useRealTimers()
  })

  function render(source: string): void {
    act(() => {
      root.render(<MarkdownReaderDiagramBlock kind="plantuml" source={source} isDark={false} />)
    })
  }

  it('shows the original fence when rendering fails', async () => {
    renderMarkdownDiagramMock.mockRejectedValue(new Error('Invalid diagram'))
    render('@startuml\ninvalid\n@enduml')

    await act(async () => {
      await Promise.resolve()
    })

    expect(container.textContent).toContain('Invalid diagram')
    expect(container.querySelector('pre code')?.textContent).toBe('@startuml\ninvalid\n@enduml')
  })

  it('sanitizes event attributes and external resource references', async () => {
    const sourceSvg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="100" viewBox="0 0 100 50"><rect onload="alert(1)"/><image href="https://example.test/x.png"/></svg>'
    renderMarkdownDiagramMock.mockResolvedValue(sourceSvg)
    render('@startuml\nAlice -> Bob\n@enduml')

    await act(async () => {
      await Promise.resolve()
    })

    expect(container.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 100 50')
    expect(container.querySelector('script')).toBeNull()
    expect(container.querySelector('[onload]')).toBeNull()
    expect(container.querySelector('[href^="http"]')).toBeNull()
  })

  it('removes script markup during SVG sanitization', () => {
    const sanitized = sanitizeMarkdownDiagramSvg(
      '<svg><script>alert(1)</script><rect onload="alert(1)"/></svg>'
    )

    expect(sanitized).not.toContain('<script')
    expect(sanitized).not.toContain('onload')
    expect(sanitized).not.toContain('alert(1)')
  })

  it('drops a stale render when source changes before completion', async () => {
    const oldRender = deferred<string>()
    const currentRender = deferred<string>()
    renderMarkdownDiagramMock
      .mockReturnValueOnce(oldRender.promise)
      .mockReturnValueOnce(currentRender.promise)

    render('old')
    render('current')

    await act(async () => {
      oldRender.resolve('<svg><text>old</text></svg>')
      await Promise.resolve()
    })
    expect(container.textContent).not.toContain('old')

    await act(async () => {
      currentRender.resolve('<svg><text>current</text></svg>')
      await Promise.resolve()
    })
    expect(container.textContent).toContain('current')
  })

  it('shows an error fallback after a render exceeds 15 seconds', async () => {
    vi.useFakeTimers()
    renderMarkdownDiagramMock.mockReturnValue(new Promise<string>(() => {}))
    render('slow')

    await act(async () => {
      vi.advanceTimersByTime(15_000)
    })

    expect(container.textContent).toContain('timed out')
    expect(container.querySelector('pre code')?.textContent).toBe('slow')
  })
})
