import React, { useMemo } from 'react'
import type { Components } from 'react-markdown'
import type { MarkdownDocument } from '../../../../shared/filesystem-entry-types'
import CodeBlockCopyButton from './CodeBlockCopyButton'
import MermaidBlock from './MermaidBlock'
import {
  getMarkdownDocLinkAnchor,
  parseMarkdownDocLinkHref,
  resolveMarkdownDocLink
} from './markdown-doc-links'
import {
  getMarkdownPreviewAnnotationQuote,
  getMarkdownPreviewBlockRange,
  hasMarkdownPreviewNestedBlock
} from './markdown-preview-block-model'
import { handleMarkdownPreviewLinkClick } from './markdown-preview-link-actions'
import { isMarkdownPreviewOpenModifier } from './markdown-preview-links'
import { MarkdownReaderDiagramBlock } from './MarkdownReaderDiagramBlock'
import { MarkdownReaderMediaViewer } from './MarkdownReaderMediaViewer'
import { renderMarkdownPreviewHeading } from './MarkdownReaderHeading'
import type {
  MarkdownPreviewPresentation,
  MarkdownPreviewPositionNode,
  MarkdownPreviewTaskToggle
} from './markdown-preview-types'
import {
  getMarkdownReaderCodeText,
  getMarkdownReaderDiagramKind
} from './markdown-reader-code-fence'
import type { MarkdownPreviewAnnotationRenderers } from './use-markdown-preview-annotation-renderers'
import type { MarkdownPreviewFoundation } from './use-markdown-preview-foundation'
import type { MarkdownPreviewReviewActions } from './use-markdown-preview-review-actions'
import type { MarkdownPreviewViewport } from './use-markdown-preview-viewport'
import { useLocalImageSrc } from './useLocalImageSrc'

type MarkdownTaskLineContextValue = {
  sourceLine?: number
  onTaskToggle?: (change: MarkdownPreviewTaskToggle) => void
}

const MarkdownTaskLineContext = React.createContext<MarkdownTaskLineContextValue>({})
const MarkdownLinkChildContext = React.createContext(false)

function MarkdownTaskLineProvider({
  sourceLine,
  onTaskToggle,
  children
}: MarkdownTaskLineContextValue & { children: React.ReactNode }): React.JSX.Element {
  const value = React.useMemo(() => ({ sourceLine, onTaskToggle }), [onTaskToggle, sourceLine])
  return (
    <MarkdownTaskLineContext.Provider value={value}>{children}</MarkdownTaskLineContext.Provider>
  )
}

function MarkdownTaskInput({
  node,
  type,
  checked,
  ...props
}: React.ComponentProps<'input'> & { node?: MarkdownPreviewPositionNode }): React.JSX.Element {
  const taskLine = React.useContext(MarkdownTaskLineContext)
  const sourceLine = node?.position?.start?.line ?? taskLine.sourceLine
  const canToggleTask =
    type === 'checkbox' && sourceLine !== undefined && taskLine.onTaskToggle !== undefined

  return (
    <input
      {...props}
      type={type}
      checked={checked}
      disabled={!canToggleTask}
      onChange={(event) => {
        if (!canToggleTask || sourceLine === undefined || !taskLine.onTaskToggle) {
          return
        }
        taskLine.onTaskToggle({
          sourceLine,
          expectedChecked: checked === true,
          checked: event.currentTarget.checked
        })
      }}
    />
  )
}

export function useMarkdownPreviewComponents({
  foundation,
  viewport,
  reviewActions,
  annotationRenderers,
  filePath,
  presentation,
  onOpenDocument,
  onTaskToggle
}: {
  foundation: MarkdownPreviewFoundation
  viewport: MarkdownPreviewViewport
  reviewActions: MarkdownPreviewReviewActions
  annotationRenderers: MarkdownPreviewAnnotationRenderers
  filePath: string
  presentation: MarkdownPreviewPresentation
  onOpenDocument?: (
    document: MarkdownDocument,
    options?: { anchor?: string | null }
  ) => void | Promise<void>
  onTaskToggle?: (change: MarkdownPreviewTaskToggle) => void
}): Components {
  const {
    markdownDocumentIndex,
    activateMarkdownLink,
    isDark,
    isMac,
    imageRuntimeContext,
    sourceRoutingWorktreeId,
    worktreeRoot,
    resolvedSourceRuntimeEnvironmentId,
    sourceOwner,
    sourceConnectionId,
    worktreesByRepo,
    sourceWorktree,
    openFile,
    openMarkdownPreview,
    setMarkdownViewMode,
    pendingEditorRevealFrameIdsRef,
    setPendingEditorReveal
  } = foundation
  const { scrollToAnchor } = viewport
  const { getMarkdownCommentsForRange, handleAnnotatedMarkdownBlockClick } = reviewActions
  const { renderAnnotationControls, wrapAnnotatedBlock } = annotationRenderers

  return useMemo(() => {
    const linkContext = {
      isMac,
      sourceOwner,
      sourceRoutingWorktreeId,
      sourceConnectionId,
      resolvedSourceRuntimeEnvironmentId,
      worktreeRoot,
      worktreesByRepo,
      sourceWorktree,
      activateMarkdownLink,
      openFile,
      openMarkdownPreview,
      setMarkdownViewMode,
      pendingEditorRevealFrameIdsRef,
      setPendingEditorReveal,
      scrollToAnchor
    }

    return {
      a: ({ href, children, className, ...props }) => {
        const docLinkTarget = parseMarkdownDocLinkHref(href)
        if (docLinkTarget !== null) {
          const resolution = resolveMarkdownDocLink(docLinkTarget, markdownDocumentIndex)
          const resolvedDocument = resolution.status === 'resolved' ? resolution.document : null
          const title =
            resolution.status === 'ambiguous' ? 'Document link is ambiguous' : 'Document not found'

          const handleDocLinkClick = (event: React.MouseEvent<HTMLAnchorElement>): void => {
            event.preventDefault()
            if (resolvedDocument && onOpenDocument) {
              void onOpenDocument(resolvedDocument, {
                anchor: getMarkdownDocLinkAnchor(docLinkTarget)
              })
            }
          }

          return (
            <a
              {...props}
              href={href}
              className={`${className ?? ''} ${
                resolvedDocument ? 'markdown-doc-link' : 'markdown-doc-link-broken'
              }`.trim()}
              title={resolvedDocument ? undefined : title}
              onClick={handleDocLinkClick}
            >
              <MarkdownLinkChildContext.Provider value>
                {children}
              </MarkdownLinkChildContext.Provider>
            </a>
          )
        }

        return (
          <a
            {...props}
            href={href}
            className={className}
            onClick={(event) =>
              void handleMarkdownPreviewLinkClick({ event, href, filePath, context: linkContext })
            }
            style={{ cursor: 'pointer' }}
          >
            <MarkdownLinkChildContext.Provider value>{children}</MarkdownLinkChildContext.Provider>
          </a>
        )
      },
      img: function MarkdownImg({ src, alt, ...props }) {
        const isLinkedImage = React.useContext(MarkdownLinkChildContext)
        const resolvedSrc = useLocalImageSrc(src, filePath, undefined, imageRuntimeContext)
        const handleImageClick = (event: React.MouseEvent<HTMLImageElement>): void => {
          if (!isMarkdownPreviewOpenModifier(event, isMac)) {
            return
          }

          if (!src || !sourceRoutingWorktreeId || !worktreeRoot) {
            return
          }

          event.preventDefault()
          event.stopPropagation()
          void activateMarkdownLink(src, {
            sourceFilePath: filePath,
            worktreeId: sourceRoutingWorktreeId,
            worktreeRoot,
            runtimeEnvironmentId: resolvedSourceRuntimeEnvironmentId,
            sourceOwner
          })
        }

        const image = (
          <img {...props} src={resolvedSrc} alt={alt ?? ''} onClick={handleImageClick} />
        )
        if (presentation !== 'reader' || !resolvedSrc) {
          return image
        }
        return (
          <MarkdownReaderMediaViewer
            src={resolvedSrc}
            alt={alt ?? ''}
            kind="image"
            isLinked={isLinkedImage}
            onImageClick={handleImageClick}
          >
            {image}
          </MarkdownReaderMediaViewer>
        )
      },
      code: ({ className, children, ...props }) => {
        if (/language-mermaid/.test(className || '')) {
          return (
            <MermaidBlock content={String(children).trimEnd()} isDark={isDark} htmlLabels={false} />
          )
        }
        const diagramKind = getMarkdownReaderDiagramKind(className, presentation)
        if (diagramKind) {
          return (
            <MarkdownReaderDiagramBlock
              kind={diagramKind}
              source={getMarkdownReaderCodeText(children).replace(/\n$/, '')}
              isDark={isDark}
            />
          )
        }
        return (
          <code className={className} {...props}>
            {children}
          </code>
        )
      },
      input: (props) => <MarkdownTaskInput {...props} />,
      pre: ({ node, children, ...props }) => {
        const child = React.Children.toArray(children)[0]
        if (React.isValidElement(child) && child.type === MermaidBlock) {
          return <>{children}</>
        }
        if (React.isValidElement(child) && child.type === MarkdownReaderDiagramBlock) {
          return wrapAnnotatedBlock(
            'pre',
            node as MarkdownPreviewPositionNode,
            <div className="markdown-reader-diagram-block">{children}</div>
          )
        }
        return wrapAnnotatedBlock(
          'pre',
          node as MarkdownPreviewPositionNode,
          <CodeBlockCopyButton {...props}>{children}</CodeBlockCopyButton>
        )
      },
      p: ({ node, children, ...props }) =>
        wrapAnnotatedBlock('p', node as MarkdownPreviewPositionNode, <p {...props}>{children}</p>),
      blockquote: ({ node, children, ...props }) =>
        wrapAnnotatedBlock(
          'blockquote',
          node as MarkdownPreviewPositionNode,
          <blockquote {...props}>{children}</blockquote>
        ),
      table: ({ node, children, ...props }) =>
        wrapAnnotatedBlock(
          'table',
          node as MarkdownPreviewPositionNode,
          <table {...props}>{children}</table>
        ),
      li: ({ node, children, ...props }) => {
        const positionNode = node as MarkdownPreviewPositionNode
        const sourceLine = positionNode.position?.start?.line
        const range = hasMarkdownPreviewNestedBlock(positionNode)
          ? null
          : getMarkdownPreviewBlockRange(positionNode)
        if (!range) {
          return (
            <MarkdownTaskLineProvider sourceLine={sourceLine} onTaskToggle={onTaskToggle}>
              <li {...props}>{children}</li>
            </MarkdownTaskLineProvider>
          )
        }
        const blockKey = `li:${range.startLine}-${range.endLine}`
        const hasReviewNotes = getMarkdownCommentsForRange(range).length > 0
        const controls = renderAnnotationControls(
          range,
          blockKey,
          getMarkdownPreviewAnnotationQuote(children)
        )
        return (
          <MarkdownTaskLineProvider sourceLine={sourceLine} onTaskToggle={onTaskToggle}>
            <li {...props}>
              <div
                className={`markdown-annotation-list-block ${
                  hasReviewNotes ? 'has-review-notes' : ''
                }`.trim()}
                data-source-line={range.startLine}
                data-source-end-line={range.endLine}
                data-annotation-block-key={controls ? blockKey : undefined}
                onClick={(event) => handleAnnotatedMarkdownBlockClick(range, event)}
              >
                <span className="markdown-annotation-list-content">{children}</span>
                {controls}
              </div>
            </li>
          </MarkdownTaskLineProvider>
        )
      },
      h1: ({ node, children, ...props }) =>
        wrapAnnotatedBlock(
          'h1',
          node as MarkdownPreviewPositionNode,
          renderMarkdownPreviewHeading(presentation, 1, props, children)
        ),
      h2: ({ node, children, ...props }) =>
        wrapAnnotatedBlock(
          'h2',
          node as MarkdownPreviewPositionNode,
          renderMarkdownPreviewHeading(presentation, 2, props, children)
        ),
      h3: ({ node, children, ...props }) =>
        wrapAnnotatedBlock(
          'h3',
          node as MarkdownPreviewPositionNode,
          renderMarkdownPreviewHeading(presentation, 3, props, children)
        ),
      h4: ({ node, children, ...props }) =>
        wrapAnnotatedBlock(
          'h4',
          node as MarkdownPreviewPositionNode,
          renderMarkdownPreviewHeading(presentation, 4, props, children)
        ),
      h5: ({ node, children, ...props }) =>
        wrapAnnotatedBlock(
          'h5',
          node as MarkdownPreviewPositionNode,
          renderMarkdownPreviewHeading(presentation, 5, props, children)
        ),
      h6: ({ node, children, ...props }) =>
        wrapAnnotatedBlock(
          'h6',
          node as MarkdownPreviewPositionNode,
          renderMarkdownPreviewHeading(presentation, 6, props, children)
        )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the image override is a hook component; listed inputs preserve its identity.
  }, [
    filePath,
    presentation,
    activateMarkdownLink,
    isDark,
    isMac,
    imageRuntimeContext,
    getMarkdownCommentsForRange,
    handleAnnotatedMarkdownBlockClick,
    markdownDocumentIndex,
    onOpenDocument,
    onTaskToggle,
    openFile,
    openMarkdownPreview,
    renderAnnotationControls,
    scrollToAnchor,
    setMarkdownViewMode,
    setPendingEditorReveal,
    sourceConnectionId,
    sourceOwner,
    sourceWorktree,
    resolvedSourceRuntimeEnvironmentId,
    sourceRoutingWorktreeId,
    worktreeRoot,
    worktreesByRepo,
    wrapAnnotatedBlock
  ])
}
