// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest'

const graphvizRenderStringMock = vi.hoisted(() => vi.fn(() => '<svg><text>graph</text></svg>'))
const graphvizInstanceMock = vi.hoisted(() =>
  vi.fn(async () => ({ renderString: graphvizRenderStringMock }))
)
const plantumlRenderMock = vi.hoisted(() => vi.fn())

vi.mock('@viz-js/viz', () => ({ instance: graphvizInstanceMock }))
vi.mock('@plantuml/core/plantuml.js', () => ({ render: plantumlRenderMock }))

import { renderMarkdownDiagram, toGraphvizHex } from './markdown-reader-diagram-renderers'

describe('renderMarkdownDiagram', () => {
  beforeEach(() => {
    graphvizRenderStringMock.mockClear()
    graphvizInstanceMock.mockClear()
    plantumlRenderMock.mockClear()
  })

  it('renders Graphviz through the local WASM API', async () => {
    await expect(
      renderMarkdownDiagram({
        kind: 'graphviz',
        source: 'digraph { a -> b }',
        isDark: false
      })
    ).resolves.toContain('<svg')
    expect(graphvizInstanceMock).toHaveBeenCalledTimes(1)
    expect(graphvizRenderStringMock).toHaveBeenCalledWith(
      'digraph { a -> b }',
      expect.objectContaining({ format: 'svg' })
    )
  })

  it('rejects PlantUML include directives without loading a renderer', async () => {
    await expect(
      renderMarkdownDiagram({
        kind: 'plantuml',
        source: '!include https://example.test/diagram.puml',
        isDark: false
      })
    ).rejects.toThrow(/include/i)
    expect(plantumlRenderMock).not.toHaveBeenCalled()
  })

  it('rejects PlantUML theme directives that could fetch an external theme bundle', async () => {
    await expect(
      renderMarkdownDiagram({ kind: 'plantuml', source: '!theme spacelab', isDark: false })
    ).rejects.toThrow(/theme/i)
    expect(plantumlRenderMock).not.toHaveBeenCalled()
  })

  it('loads PlantUML support locally and applies Orca dark mode', async () => {
    const scriptElements: HTMLScriptElement[] = []
    const appendScriptSpy = vi.spyOn(document.head, 'append').mockImplementation((...nodes) => {
      for (const node of nodes) {
        if (node instanceof HTMLScriptElement) {
          scriptElements.push(node)
        }
      }
    })
    plantumlRenderMock.mockImplementation((_lines: string[], targetId: string) => {
      const target = document.getElementById(targetId)
      if (target) {
        target.innerHTML = '<svg><text>local</text></svg>'
      }
    })
    const rendered = renderMarkdownDiagram({
      kind: 'plantuml',
      source: '@startuml\nAlice -> Bob\n@enduml',
      isDark: true
    })
    try {
      const script = scriptElements[0]
      if (!script) {
        throw new Error('Missing local PlantUML Viz script')
      }
      script.dispatchEvent(new Event('load'))

      await expect(rendered).resolves.toContain('<svg')
      expect(plantumlRenderMock).toHaveBeenCalledWith(
        ['@startuml', 'Alice -> Bob', '@enduml'],
        expect.any(String),
        { dark: true }
      )
    } finally {
      appendScriptSpy.mockRestore()
    }
  })

  it('converts resolved RGB tokens to Graphviz hex colors', () => {
    document.documentElement.style.setProperty('--diagram-test-foreground', '#0a0b0c')
    const probe = document.createElement('span')
    document.documentElement.appendChild(probe)
    probe.style.color = 'var(--diagram-test-foreground)'
    const computedColor = getComputedStyle(probe).color
    probe.remove()

    expect(toGraphvizHex(computedColor)).toBe('#0a0b0c')
  })
})
