import React, { useEffect, useState } from 'react'
import DOMPurify from 'dompurify'
import { translate } from '@/i18n/i18n'
import { MarkdownReaderMediaViewer } from './MarkdownReaderMediaViewer'
import {
  renderMarkdownDiagram,
  type MarkdownReaderDiagramKind
} from './markdown-reader-diagram-renderers'

const DIAGRAM_RENDER_TIMEOUT_MS = 15_000

type MarkdownReaderDiagramRenderState =
  | { status: 'loading' }
  | { status: 'success'; svg: string }
  | { status: 'error'; message: string }

export function MarkdownReaderDiagramBlock({
  kind,
  source,
  isDark
}: {
  kind: MarkdownReaderDiagramKind
  source: string
  isDark: boolean
}): React.JSX.Element {
  const [state, setState] = useState<MarkdownReaderDiagramRenderState>({ status: 'loading' })

  useEffect(() => {
    const controller = new AbortController()
    let disposed = false
    let timedOut = false
    setState({ status: 'loading' })

    const timeoutId = window.setTimeout(() => {
      timedOut = true
      controller.abort()
      setState({
        status: 'error',
        message: translate(
          'auto.components.editor.MarkdownReaderDiagramBlock.timeout',
          'Diagram rendering timed out'
        )
      })
    }, DIAGRAM_RENDER_TIMEOUT_MS)

    void renderMarkdownDiagram({ kind, source, isDark, signal: controller.signal })
      .then((svg) => {
        const sanitizedSvg = sanitizeMarkdownDiagramSvg(svg)
        if (!sanitizedSvg) {
          throw new Error('Diagram output contained no safe SVG')
        }
        if (!disposed && !timedOut) {
          setState({ status: 'success', svg: sanitizedSvg })
        }
      })
      .catch((error: unknown) => {
        if (disposed || timedOut || controller.signal.aborted) {
          return
        }
        setState({ status: 'error', message: getErrorMessage(error) })
      })
      .finally(() => window.clearTimeout(timeoutId))

    return () => {
      disposed = true
      window.clearTimeout(timeoutId)
      controller.abort()
    }
  }, [isDark, kind, source])

  if (state.status === 'loading') {
    return (
      <div className="markdown-reader-diagram markdown-reader-diagram-loading" aria-busy="true">
        <div role="status">
          {translate(
            'auto.components.editor.MarkdownReaderDiagramBlock.loading',
            'Rendering diagram…'
          )}
        </div>
        <pre>
          <code>{source}</code>
        </pre>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="markdown-reader-diagram markdown-reader-diagram-error">
        <div role="alert">
          {translateDiagramError(kind)} {state.message}
        </div>
        <pre>
          <code>{source}</code>
        </pre>
      </div>
    )
  }

  return (
    <MarkdownReaderMediaViewer
      src={state.svg}
      alt={translate(
        'auto.components.editor.MarkdownReaderDiagramBlock.imageLabel',
        'Rendered diagram'
      )}
      kind="diagram"
    >
      <span
        className="markdown-reader-diagram"
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: state.svg }}
      />
    </MarkdownReaderMediaViewer>
  )
}

function translateDiagramError(kind: MarkdownReaderDiagramKind): string {
  return kind === 'plantuml'
    ? translate(
        'auto.components.editor.MarkdownReaderDiagramBlock.plantUmlError',
        'PlantUML error:'
      )
    : translate(
        'auto.components.editor.MarkdownReaderDiagramBlock.graphvizError',
        'Graphviz error:'
      )
}

export function sanitizeMarkdownDiagramSvg(svg: string): string {
  if (!/<svg\b/i.test(svg)) {
    return ''
  }

  const sanitized = DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true } })
  const sanitizedTemplate = document.createElement('template')
  sanitizedTemplate.innerHTML = sanitized
  const sanitizedRoot = sanitizedTemplate.content.querySelector('svg')
  const rootAttributes = getSafeSvgRootAttributes(svg)
  const outputTemplate = document.createElement('template')
  outputTemplate.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg"${rootAttributes ? ` ${rootAttributes}` : ''}>${sanitizedRoot?.innerHTML ?? sanitizedTemplate.innerHTML}</svg>`
  const root = outputTemplate.content.querySelector('svg')
  if (!root) {
    return ''
  }

  const forbiddenTags = new Set(['script', 'foreignobject', 'iframe', 'object', 'embed'])
  for (const element of Array.from(root.querySelectorAll('*'))) {
    if (forbiddenTags.has(element.localName.toLowerCase())) {
      element.remove()
      continue
    }
    if (
      element.localName.toLowerCase() === 'style' &&
      /@import|\burl\(\s*(?!#)[^)]+\)/i.test(element.textContent ?? '')
    ) {
      element.remove()
      continue
    }
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase()
      const value = attribute.value.trim()
      if (
        name.startsWith('on') ||
        name === 'src' ||
        ((name === 'href' || name === 'xlink:href') && !value.startsWith('#')) ||
        /\burl\(\s*(?!#)[^)]+\)/i.test(value) ||
        (name === 'style' && /@import/i.test(value))
      ) {
        element.removeAttribute(attribute.name)
      }
    }
  }

  return root.children.length > 0 ? root.outerHTML : ''
}

function getSafeSvgRootAttributes(svg: string): string {
  const rootTag = svg.match(/<svg\b[^>]*>/i)?.[0]
  if (!rootTag) {
    return ''
  }

  const safeAttributes: string[] = []
  const attributePattern = /([a-z][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi
  for (const match of rootTag.matchAll(attributePattern)) {
    const name = match[1]?.toLowerCase()
    const value = match[2] ?? match[3] ?? ''
    if (
      (name === 'width' || name === 'height') &&
      /^[\d.]+(?:px|pt|pc|mm|cm|in|%)?$/i.test(value)
    ) {
      safeAttributes.push(`${name}="${value}"`)
    } else if (
      name === 'viewbox' &&
      /^-?[\d.]+[\s,]+-?[\d.]+[\s,]+-?[\d.]+[\s,]+-?[\d.]+$/.test(value)
    ) {
      safeAttributes.push(`viewBox="${value}"`)
    } else if (name === 'preserveaspectratio' && /^[a-z\d\s,]+$/i.test(value)) {
      safeAttributes.push(`preserveAspectRatio="${value}"`)
    }
  }
  return safeAttributes.join(' ')
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }
  return translate(
    'auto.components.editor.MarkdownReaderDiagramBlock.invalid',
    'Invalid diagram syntax'
  )
}
