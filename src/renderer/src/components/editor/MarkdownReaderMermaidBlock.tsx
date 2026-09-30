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
      const sizedSvg = nextSvg ? sizeMermaidSvgFromViewBox(nextSvg) : null
      setRenderedSvg((current) => {
        if (sizedSvg) {
          return { contentKey, svg: sizedSvg }
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

function sizeMermaidSvgFromViewBox(svg: string): string {
  const template = document.createElement('template')
  template.innerHTML = svg
  const root = template.content.querySelector('svg')
  const dimensions = root
    ?.getAttribute('viewBox')
    ?.trim()
    .split(/[\s,]+/)
    .map(Number)
  const width = dimensions?.[2]
  const height = dimensions?.[3]
  if (
    !root ||
    dimensions?.length !== 4 ||
    width === undefined ||
    height === undefined ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return svg
  }

  root.setAttribute('width', String(Math.ceil(width)))
  root.setAttribute('height', String(Math.ceil(height)))
  if (root.style.width.endsWith('%')) {
    root.style.removeProperty('width')
  }
  if (root.style.height.endsWith('%')) {
    root.style.removeProperty('height')
  }
  return template.innerHTML
}
