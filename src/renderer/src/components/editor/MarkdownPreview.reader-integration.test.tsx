// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { scrollTopCache } from '@/lib/scroll-cache'

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
  translate: (_key: string, fallback: string) => fallback
}))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('./useLocalImageSrc', () => ({
  useLocalImageSrc: (src?: string) => src,
  getLocalImageCacheKey: () => 'image-cache-key',
  loadLocalImageAbsolutePath: vi.fn(async () => null)
}))
vi.mock('./MermaidBlock', () => ({ default: () => null }))
vi.mock('./MarkdownTableOfContentsPanel', () => ({ MarkdownTableOfContentsPanel: () => null }))
vi.mock('./MarkdownReaderDiagramBlock', () => ({ MarkdownReaderDiagramBlock: () => null }))
vi.mock('./CodeBlockCopyButton', () => ({
  default: ({ children }: { children: React.ReactNode }) => children
}))
vi.mock('../diff-comments/DiffCommentCard', () => ({ DiffCommentCard: () => null }))
vi.mock('./NotesSendMenu', () => ({ NotesSendMenu: () => null }))

import MarkdownPreview from './MarkdownPreview'

const SCROLL_CACHE_KEY = 'reader-external-edit'

describe('MarkdownPreview Reader refresh', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    vi.useFakeTimers()
    scrollTopCache.delete(SCROLL_CACHE_KEY)
    Object.defineProperty(window.navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      configurable: true
    })
    ;(window as unknown as { api: unknown }).api = {
      shell: { openUrl: vi.fn(), openFileUri: vi.fn(), pathExists: vi.fn(async () => true) },
      ui: { writeClipboardText: vi.fn(async () => true) }
    }
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    scrollTopCache.delete(SCROLL_CACHE_KEY)
    vi.useRealTimers()
  })

  function render(content: string): void {
    act(() => {
      root.render(
        <MarkdownPreview
          content={content}
          filePath="/repo/README.md"
          presentation="reader"
          sourceFileId="/repo/README.md"
          sourceWorktreeId="wt-1"
          scrollCacheKey={SCROLL_CACHE_KEY}
        />
      )
    })
  }

  it('shows externally updated content and restores the Reader scroll position', async () => {
    render('## Kept section\n\nOld body\n\nAdditional text')
    const scrollRoot = container.querySelector<HTMLDivElement>('.markdown-reader-scroll')
    if (!scrollRoot) {
      throw new Error('Missing Reader scroll surface')
    }
    Object.defineProperty(scrollRoot, 'clientHeight', { configurable: true, value: 100 })
    Object.defineProperty(scrollRoot, 'scrollHeight', { configurable: true, value: 800 })
    scrollRoot.scrollTop = 180
    act(() => scrollRoot.dispatchEvent(new Event('scroll')))
    act(() => vi.advanceTimersByTime(150))
    expect(scrollTopCache.get(SCROLL_CACHE_KEY)).toBe(180)

    render('## Kept section\n\nUpdated body\n\nNew additional text')
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(container.querySelector('.markdown-body')?.textContent).toContain('Updated body')
    expect(container.querySelector('.markdown-reader-scroll')?.scrollTop).toBe(180)
    expect(container.querySelector('#kept-section')).not.toBeNull()
  })

  it('drops headings removed by an external content update', async () => {
    render('## Removed section\n\nOld body')
    expect(container.querySelector('#removed-section')).not.toBeNull()

    render('## Current section\n\nNew body')
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(container.querySelector('#removed-section')).toBeNull()
    expect(container.querySelector('#current-section')).not.toBeNull()
    expect(container.querySelector('.markdown-body')?.textContent).toContain('New body')
  })
})
