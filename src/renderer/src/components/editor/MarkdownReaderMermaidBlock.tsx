import { useCallback, useState } from 'react'
import { translate } from '@/i18n/i18n'
import MermaidBlock from './MermaidBlock'
import { MarkdownReaderMediaViewer } from './MarkdownReaderMediaViewer'

type RenderedMermaidSvg = { contentKey: string; svg: string }

export function MarkdownReaderMermaidBlock({
  content,
  isDark
}: {
  content: string
  isDark: boolean
}): React.JSX.Element {
  const contentKey = `${isDark ? 'dark' : 'light'}\n${content}`
  const [renderedSvg, setRenderedSvg] = useState<RenderedMermaidSvg | null>(null)
  const svg = renderedSvg?.contentKey === contentKey ? renderedSvg.svg : null
  const handleRenderedSvgChange = useCallback(
    (nextSvg: string | null): void => {
      setRenderedSvg((current) => {
        if (nextSvg) {
          return { contentKey, svg: nextSvg }
        }
        return current?.contentKey === contentKey ? null : current
      })
    },
    [contentKey]
  )

  if (!svg) {
    return (
      <MermaidBlock
        key={contentKey}
        content={content}
        isDark={isDark}
        onRenderedSvgChange={handleRenderedSvgChange}
      />
    )
  }

  return (
    <MarkdownReaderMediaViewer
      src={svg}
      alt={translate(
        'auto.components.editor.MarkdownReaderDiagramBlock.imageLabel',
        'Rendered diagram'
      )}
      kind="diagram"
    >
      <span
        className="mermaid-block"
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </MarkdownReaderMediaViewer>
  )
}
