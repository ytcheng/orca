// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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
  editorFontZoomLevel: 0,
  setMarkdownRichModeSizeOverride: vi.fn()
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
vi.mock('./useLocalImageSrc', () => ({ useLocalImageSrc: (src?: string) => src }))
vi.mock('./MermaidBlock', () => ({ default: () => null }))
vi.mock('./CodeBlockCopyButton', () => ({
  default: ({ children }: { children: React.ReactNode }) => children
}))
vi.mock('../diff-comments/DiffCommentCard', () => ({ DiffCommentCard: () => null }))
vi.mock('./NotesSendMenu', () => ({ NotesSendMenu: () => null }))
vi.mock('./MarkdownTableOfContentsPanel', () => ({ MarkdownTableOfContentsPanel: () => null }))
vi.mock('./editor-lazy-views', () => ({
  MarkdownPreview: ({
    onTaskToggle
  }: {
    onTaskToggle?: (change: {
      sourceLine: number
      expectedChecked: boolean
      checked: boolean
    }) => void
  }) => (
    <button
      type="button"
      aria-label="Toggle Markdown task"
      onClick={() => onTaskToggle?.({ sourceLine: 1, expectedChecked: false, checked: true })}
    />
  ),
  RichMarkdownEditor: () => null
}))

import MarkdownPreview from './MarkdownPreview'
import { EditorMarkdownFileSurface } from './EditorMarkdownFileSurface'

describe('MarkdownPreview task checkbox interaction', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
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
  })

  function renderPreview(
    presentation: 'reader' | 'diff',
    content: string,
    onTaskToggle?: (change: {
      sourceLine: number
      expectedChecked: boolean
      checked: boolean
    }) => void
  ): void {
    act(() => {
      root.render(
        <MarkdownPreview
          content={content}
          filePath="/repo/README.md"
          presentation={presentation}
          sourceFileId="/repo/README.md"
          sourceWorktreeId="wt-1"
          scrollCacheKey="task-toggle-test"
          onTaskToggle={onTaskToggle}
        />
      )
    })
  }

  it('passes the rendered task line and checked transition to the edit callback', () => {
    const onTaskToggle = vi.fn()
    renderPreview('reader', '- [ ] first\n- [x] second', onTaskToggle)
    const checkbox = container.querySelector<HTMLInputElement>('input[type="checkbox"]')
    if (!checkbox) {
      throw new Error('Missing task checkbox')
    }

    expect(checkbox.disabled).toBe(false)
    act(() => checkbox.click())
    expect(onTaskToggle).toHaveBeenCalledWith({
      sourceLine: 1,
      expectedChecked: false,
      checked: true
    })
  })

  it('keeps standalone Reader checkboxes disabled', () => {
    renderPreview('reader', '- [ ] read-only task')
    expect(container.querySelector<HTMLInputElement>('input[type="checkbox"]')?.disabled).toBe(true)
  })

  it('keeps diff checkboxes disabled even if a callback is provided', () => {
    renderPreview('diff', '- [ ] diff task', vi.fn())
    expect(container.querySelector<HTMLInputElement>('input[type="checkbox"]')?.disabled).toBe(true)
  })

  it('writes the guarded checkbox update into the current edit buffer', () => {
    const handleContentChange = vi.fn()
    const markdownDocuments = {
      mdSave: vi.fn(async () => true),
      onOpenDocLink: vi.fn(),
      openMarkdownDocument: vi.fn(async () => {}),
      markdownDocuments: [],
      previewProps: { markdownDocuments: [], onOpenDocument: vi.fn(async () => {}) }
    } satisfies Parameters<typeof EditorMarkdownFileSurface>[0]['markdownDocuments']

    act(() => {
      root.render(
        <EditorMarkdownFileSurface
          activeFile={{
            id: '/repo/README.md',
            filePath: '/repo/README.md',
            relativePath: 'README.md',
            worktreeId: 'wt-1',
            language: 'markdown',
            mode: 'edit',
            isDirty: false
          }}
          viewStateScopeId="/repo/README.md"
          editorViewStateKey="/repo/README.md"
          currentContent={'- [ ] task\n- [ ] later'}
          mdViewMode="preview"
          inlineMarkdownRenderState={{
            renderMode: 'preview',
            richModeUnsupportedMessage: null
          }}
          showMarkdownTableOfContents={false}
          showMarkdownFrontmatter={false}
          onCloseMarkdownTableOfContents={() => {}}
          onToggleMarkdownTableOfContents={() => {}}
          markdownAnnotationsEnabled={false}
          markdownDocuments={markdownDocuments}
          getMarkdownSourceLineOffset={() => 0}
          handleContentChange={handleContentChange}
          handleDirtyStateHint={vi.fn()}
          monacoEditor={<div />}
        />
      )
    })

    const toggle = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Toggle Markdown task"]'
    )
    if (!toggle) {
      throw new Error('Missing mocked task toggle')
    }
    act(() => toggle.click())
    expect(handleContentChange).toHaveBeenCalledWith('- [x] task\n- [ ] later')
  })
})
