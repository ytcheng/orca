// @vitest-environment happy-dom
//
// Regression guard for the follow-up to #6695: MarkdownPreview must route its
// Table-of-Contents build through the visibility gate, so the full-document
// remark parse only runs while the panel is open (closed by default). This
// renders the real MarkdownPreview and asserts the parse is skipped when closed
// and a real outline reaches the panel when open. The gate's own semantics are
// unit-tested in markdown-toc-visibility-gate.test.ts; this proves the wiring.

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MarkdownTocItem } from './markdown-table-of-contents'
import type * as MarkdownTableOfContentsModule from './markdown-table-of-contents'
import type { MarkdownPreviewPresentation } from './markdown-preview-types'

const buildMarkdownTableOfContentsSpy = vi.hoisted(() => vi.fn())
const writeClipboardTextMock = vi.hoisted(() => vi.fn(async () => true))

const storeState = {
  openFile: vi.fn(),
  activateMarkdownLink: vi.fn(),
  openMarkdownPreview: vi.fn(),
  setMarkdownViewMode: vi.fn(),
  markdownFrontmatterVisible: {},
  setPendingEditorReveal: vi.fn(),
  addDiffComment: vi.fn(),
  deleteDiffComment: vi.fn(),
  updateDiffComment: vi.fn(),
  clearDeliveredDiffComments: vi.fn(),
  keybindings: {},
  worktreesByRepo: {},
  repos: [],
  folderWorkspaces: [],
  projectGroups: [],
  openFiles: [],
  activeFileIdByWorktree: {},
  settings: { openLinksInApp: true },
  editorFontZoomLevel: 0
}

vi.mock('@/store', () => {
  const useAppStore = Object.assign(
    (selector: (s: typeof storeState) => unknown) => selector(storeState),
    { getState: () => storeState }
  )
  return { useAppStore }
})
vi.mock('@/store/slices/worktree-helpers', () => ({ findWorktreeById: () => null }))
vi.mock('@/runtime/runtime-rpc-client', () => ({
  settingsForRuntimeOwner: (settings: unknown) => settings
}))
vi.mock('@/runtime/runtime-file-client', () => ({
  statRuntimePath: vi.fn(async () => ({ isDirectory: false }))
}))
vi.mock('@/lib/connection-context', () => ({ getConnectionIdForFile: () => null }))
vi.mock('@/lib/connection-owner-resolution', () => ({
  createConnectionIdForFileSelector: () => () => null
}))
vi.mock('@/i18n/i18n', () => ({
  i18n: { language: 'en' },
  translate: (_key: string, fallback: string, values?: Record<string, unknown>) =>
    Object.entries(values ?? {}).reduce(
      (text, [key, value]) => text.replaceAll(`{{${key}}}`, String(value)),
      fallback
    )
}))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('./useLocalImageSrc', () => ({ useLocalImageSrc: (src?: string) => src }))
vi.mock('./MermaidBlock', () => ({ default: () => null }))
vi.mock('./MarkdownReaderDiagramBlock', () => ({
  MarkdownReaderDiagramBlock: ({ kind, source }: { kind: string; source: string }) => (
    <div className="markdown-reader-diagram" data-kind={kind}>
      {source}
    </div>
  )
}))
vi.mock('./CodeBlockCopyButton', () => ({
  default: ({ children }: { children: React.ReactNode }) => children
}))
vi.mock('../diff-comments/DiffCommentCard', () => ({ DiffCommentCard: () => null }))
vi.mock('./NotesSendMenu', () => ({ NotesSendMenu: () => null }))
// Render the items the gate produced so the test can read the outline from the DOM.
vi.mock('./MarkdownTableOfContentsPanel', () => ({
  MarkdownTableOfContentsPanel: ({ items }: { items: MarkdownTocItem[] }) => (
    <nav aria-label="toc-spy">{items.map((item) => item.title).join('|')}</nav>
  )
}))
// Spy on the expensive parse without changing its behavior, so the test can
// assert it is never invoked while the panel is closed.
vi.mock('./markdown-table-of-contents', async (importOriginal) => {
  const actual = await importOriginal<typeof MarkdownTableOfContentsModule>()
  buildMarkdownTableOfContentsSpy.mockImplementation(actual.buildMarkdownTableOfContents)
  return { ...actual, buildMarkdownTableOfContents: buildMarkdownTableOfContentsSpy }
})

import MarkdownPreview from './MarkdownPreview'

const DOC = '# Intro\n\n## Setup\n\n## Usage'

describe('MarkdownPreview TOC visibility gate', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    Object.defineProperty(window.navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      configurable: true
    })
    ;(window as unknown as { api: unknown }).api = {
      shell: { openUrl: vi.fn(), openFileUri: vi.fn(), pathExists: vi.fn(async () => true) },
      ui: { writeClipboardText: writeClipboardTextMock }
    }
    buildMarkdownTableOfContentsSpy.mockClear()
    writeClipboardTextMock.mockClear()
    storeState.openMarkdownPreview.mockClear()
    storeState.worktreesByRepo = {}
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    container.remove()
  })

  function render(
    showTableOfContents: boolean,
    presentation: MarkdownPreviewPresentation = 'reader',
    content = DOC,
    markdownAnnotationsEnabled = false
  ): void {
    act(() => {
      root.render(
        <MarkdownPreview
          content={content}
          filePath="/repo/docs/README.md"
          sourceWorktreeId="wt-1"
          scrollCacheKey="test-key"
          showTableOfContents={showTableOfContents}
          presentation={presentation}
          markdownAnnotationsEnabled={markdownAnnotationsEnabled}
        />
      )
    })
  }

  it('routes Reader and diff through separate surface variants', () => {
    render(false, 'reader')
    expect(container.querySelector('.markdown-reader-surface')).not.toBeNull()
    expect(container.querySelector('.markdown-reader-toolbar')).not.toBeNull()

    render(false, 'diff')
    expect(container.querySelector('.markdown-reader-surface')).toBeNull()
    expect(container.querySelector('.markdown-reader-toolbar')).toBeNull()
    expect(container.querySelector('.markdown-preview')).not.toBeNull()
  })

  it('skips the full-document parse and renders no panel while the panel is closed', () => {
    render(false)
    expect(buildMarkdownTableOfContentsSpy).not.toHaveBeenCalled()
    expect(container.querySelector('nav[aria-label="toc-spy"]')).toBeNull()
  })

  it('builds and shows the outline when the panel is open', () => {
    render(true)
    expect(buildMarkdownTableOfContentsSpy).toHaveBeenCalledWith(DOC)
    expect(container.querySelector('nav[aria-label="toc-spy"]')?.textContent).toBe('Intro')
  })

  it('opens the rendered-text search from the Reader toolbar', () => {
    render(false)
    const findButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Find in document"]'
    )
    if (!findButton) {
      throw new Error('Missing Reader find button')
    }

    act(() => findButton.click())
    expect(container.querySelector('.markdown-preview-search')).not.toBeNull()
  })

  it('renders PlantUML fences only in the Reader presentation', () => {
    const source = '```plantuml\n@startuml\nAlice -> Bob\n@enduml\n```'
    render(false, 'reader', source)
    const diagram = container.querySelector('.markdown-reader-diagram[data-kind="plantuml"]')
    expect(diagram?.textContent).toContain('Alice -> Bob')

    render(false, 'diff', source)
    expect(container.querySelector('.markdown-reader-diagram')).toBeNull()
    expect(container.querySelector('code.language-plantuml')?.textContent).toContain('Alice -> Bob')
  })

  it('copies an encoded heading fragment without opening another preview', async () => {
    render(false, 'reader', '# 中文 标题')
    const button = container.querySelector<HTMLButtonElement>(
      '[aria-label="Copy link to heading: 中文 标题"]'
    )
    if (!button) {
      throw new Error('Missing heading copy button')
    }

    await act(async () => button.click())

    expect(writeClipboardTextMock).toHaveBeenCalledWith('#%E4%B8%AD%E6%96%87-%E6%A0%87%E9%A2%98')
    expect(button.getAttribute('aria-label')).toBe('Copied heading link: 中文 标题')
    expect(storeState.openMarkdownPreview).not.toHaveBeenCalled()
  })

  it('does not add copy-link controls to the diff presentation', () => {
    render(false, 'diff', '# 中文 标题')
    expect(container.querySelector('.markdown-reader-heading-link')).toBeNull()
  })

  it('preserves source line ranges and review note navigation in Reader', () => {
    storeState.worktreesByRepo = {
      repo: [
        {
          id: 'wt-1',
          path: '/repo',
          diffComments: [
            {
              id: 'note-1',
              worktreeId: 'wt-1',
              filePath: 'docs/README.md',
              source: 'markdown',
              lineNumber: 3,
              body: 'Review this paragraph',
              side: 'modified',
              createdAt: 1
            }
          ]
        }
      ]
    }
    render(false, 'reader', '# Intro\n\nParagraph', true)
    const block = container.querySelector<HTMLElement>(
      '.markdown-annotation-block[data-source-line="3"][data-source-end-line="3"]'
    )
    if (!block) {
      throw new Error('Missing Reader annotation block')
    }
    const note = block.querySelector<HTMLElement>('[data-markdown-review-note-id="note-1"]')
    expect(note).not.toBeNull()

    act(() => block.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })))
    expect(
      container.querySelector<HTMLElement>('[data-markdown-review-note-id="note-1"]')?.className
    ).toContain('is-active')
  })
})
