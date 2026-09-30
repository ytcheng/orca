import type { Components } from 'react-markdown'
import { translate } from '@/i18n/i18n'
import { MarkdownTableOfContentsPanel } from './MarkdownTableOfContentsPanel'
import { MarkdownPreviewBody } from './MarkdownPreviewBody'
import { MarkdownPreviewReviewToolbar } from './MarkdownPreviewReviewToolbar'
import { MarkdownPreviewSearchBar } from './MarkdownPreviewSearchBar'
import { MarkdownReaderToolbar } from './MarkdownReaderToolbar'
import type { MarkdownPreviewFoundation } from './use-markdown-preview-foundation'
import type { MarkdownPreviewReviewActions } from './use-markdown-preview-review-actions'
import type { MarkdownPreviewViewport } from './use-markdown-preview-viewport'
import type { MarkdownPreviewPresentation } from './markdown-preview-types'

const noopToggleTableOfContents = (): void => {}

export function MarkdownPreviewSurface({
  foundation,
  viewport,
  reviewActions,
  components,
  filePath,
  presentation,
  showTableOfContents,
  onCloseTableOfContents,
  onToggleTableOfContents
}: {
  foundation: MarkdownPreviewFoundation
  viewport: MarkdownPreviewViewport
  reviewActions: MarkdownPreviewReviewActions
  components: Components
  filePath: string
  presentation: MarkdownPreviewPresentation
  showTableOfContents: boolean
  onCloseTableOfContents?: () => void
  onToggleTableOfContents?: () => void
}): React.JSX.Element {
  const {
    isSearchOpen,
    canShowReviewTools,
    tableOfContentsItems,
    editorFontSize,
    isDark,
    bodyRef,
    frontMatter,
    frontmatterVisible,
    frontMatterInner,
    renderedContent
  } = foundation
  const tableOfContentsPanel = showTableOfContents ? (
    <MarkdownTableOfContentsPanel
      items={tableOfContentsItems}
      onClose={onCloseTableOfContents ?? noopToggleTableOfContents}
      onNavigate={viewport.navigateToTableOfContentsItem}
    />
  ) : null
  const searchBar = isSearchOpen ? (
    <MarkdownPreviewSearchBar foundation={foundation} viewport={viewport} />
  ) : null
  const reviewToolbar = canShowReviewTools ? (
    <MarkdownPreviewReviewToolbar
      foundation={foundation}
      reviewActions={reviewActions}
      filePath={filePath}
    />
  ) : null
  const documentContent = (
    <>
      {frontMatter && frontmatterVisible ? (
        <div className="mb-4 rounded border border-border/60 bg-muted/40 px-3 py-2">
          <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {translate('auto.components.editor.MarkdownPreview.2b2b31382c', 'Front Matter')}
          </div>
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap text-xs text-muted-foreground font-mono scrollbar-editor">
            {frontMatterInner}
          </pre>
        </div>
      ) : null}
      <MarkdownPreviewBody content={renderedContent} components={components} />
    </>
  )
  const themeClassName = isDark ? 'markdown-dark' : 'markdown-light'

  return (
    <div
      className={
        presentation === 'reader'
          ? `markdown-preview-shell markdown-reader-surface ${themeClassName}`
          : 'markdown-preview-shell'
      }
    >
      {tableOfContentsPanel}
      {presentation === 'reader' ? (
        <div className="markdown-reader-main">
          <MarkdownReaderToolbar
            tocVisible={showTableOfContents}
            onToggleToc={onToggleTableOfContents ?? noopToggleTableOfContents}
            onOpenFind={() => foundation.setIsSearchOpen(true)}
          />
          <div
            ref={viewport.setRootRef}
            tabIndex={0}
            style={{ fontSize: `${editorFontSize}px` }}
            className={`markdown-reader-scroll scrollbar-editor ${themeClassName}`}
          >
            {searchBar}
            {reviewToolbar}
            <article className="markdown-reader-article">
              {/* Why: OS page translation can replace react-owned text nodes and crash reconciliation. */}
              <div ref={bodyRef} className="markdown-body" translate="no">
                {documentContent}
              </div>
            </article>
          </div>
        </div>
      ) : (
        <div
          ref={viewport.setRootRef}
          tabIndex={0}
          style={{ fontSize: `${editorFontSize}px` }}
          className={`markdown-preview h-full min-h-0 overflow-auto scrollbar-editor ${themeClassName}`}
        >
          {searchBar}
          {reviewToolbar}
          {/* Why: OS page translation can replace react-owned text nodes and crash reconciliation. */}
          <div ref={bodyRef} className="markdown-body" translate="no">
            {documentContent}
          </div>
        </div>
      )}
    </div>
  )
}
