import React from 'react'
import type { MarkdownPreviewPresentation } from './markdown-preview-types'
import type { MarkdownReaderDiagramKind } from './markdown-reader-diagram-renderers'

export function getMarkdownReaderDiagramKind(
  className: string | undefined,
  presentation: MarkdownPreviewPresentation
): MarkdownReaderDiagramKind | null {
  if (presentation !== 'reader') {
    return null
  }
  const language = className?.match(/(?:^|\s)language-(plantuml|puml|dot|graphviz)(?:\s|$)/i)?.[1]
  if (language === 'plantuml' || language === 'puml') {
    return 'plantuml'
  }
  if (language === 'dot' || language === 'graphviz') {
    return 'graphviz'
  }
  return null
}

export function getMarkdownReaderCodeText(children: React.ReactNode): string {
  let text = ''
  React.Children.forEach(children, (child) => {
    if (typeof child === 'string' || typeof child === 'number') {
      text += child
    } else if (React.isValidElement<{ children?: React.ReactNode }>(child)) {
      text += getMarkdownReaderCodeText(child.props.children)
    }
  })
  return text
}
