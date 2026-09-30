import React from 'react'
import MermaidBlock from './MermaidBlock'
import { MarkdownReaderDiagramBlock } from './MarkdownReaderDiagramBlock'
import { MarkdownReaderMermaidBlock } from './MarkdownReaderMermaidBlock'
import type { MarkdownPreviewPresentation } from './markdown-preview-types'
import {
  getMarkdownReaderCodeText,
  getMarkdownReaderDiagramKind
} from './markdown-reader-code-fence'

type MarkdownPreviewCodeFenceProps = React.ComponentProps<'code'> & {
  node?: unknown
  isDark: boolean
  presentation: MarkdownPreviewPresentation
}

export function MarkdownPreviewCodeFence(props: MarkdownPreviewCodeFenceProps): React.JSX.Element {
  const { node, className, children, isDark, presentation, ...codeProps } = props
  void node
  if (/language-mermaid/.test(className || '')) {
    const mermaidContent = String(children).trimEnd()
    return presentation === 'reader' ? (
      <MarkdownReaderMermaidBlock content={mermaidContent} isDark={isDark} />
    ) : (
      <MermaidBlock content={mermaidContent} isDark={isDark} htmlLabels={false} />
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
    <code className={className} {...codeProps}>
      {children}
    </code>
  )
}
