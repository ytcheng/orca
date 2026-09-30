import plantUmlVizGlobalUrl from '@plantuml/core/viz-global.js?url'
import type { Viz as GraphvizInstance } from '@viz-js/viz'
import type { PlantUmlModule } from '@plantuml/core/plantuml.js'

export type MarkdownReaderDiagramKind = 'plantuml' | 'graphviz'

export type RenderMarkdownDiagram = (args: {
  kind: MarkdownReaderDiagramKind
  source: string
  isDark: boolean
  signal?: AbortSignal
}) => Promise<string>

const PLANTUML_RENDER_TIMEOUT_MS = 15_000
const DISALLOWED_PLANTUML_DIRECTIVE = /^\s*!\s*(?:include\w*|import|theme)\b/im

let graphvizPromise: Promise<GraphvizInstance> | undefined
let plantUmlModulePromise: Promise<PlantUmlModule> | undefined
let plantUmlVizGlobalPromise: Promise<void> | undefined
let plantUmlRenderQueue: Promise<void> = Promise.resolve()
let plantUmlTargetSequence = 0

export function renderMarkdownDiagram({
  kind,
  source,
  isDark,
  signal
}: Parameters<RenderMarkdownDiagram>[0]): Promise<string> {
  if (signal?.aborted) {
    return Promise.reject(createAbortError())
  }
  if (kind === 'graphviz') {
    return renderGraphviz(source, signal)
  }
  if (DISALLOWED_PLANTUML_DIRECTIVE.test(source)) {
    return Promise.reject(
      new Error('PlantUML include and theme directives are disabled to prevent external requests')
    )
  }
  return renderPlantUml(source, isDark, signal)
}

export function toGraphvizHex(cssToken: string): string | null {
  if (!cssToken.trim()) {
    return null
  }

  const probe = document.createElement('span')
  probe.style.color = cssToken
  probe.style.display = 'none'
  document.documentElement.append(probe)
  const resolved = getComputedStyle(probe).color.trim()
  probe.remove()

  const hex = resolved.match(/^#([\da-f]{3}|[\da-f]{6})$/i)?.[1]
  if (hex?.length === 6) {
    return `#${hex.toLowerCase()}`
  }
  if (hex?.length === 3) {
    return `#${Array.from(hex, (channel) => channel + channel)
      .join('')
      .toLowerCase()}`
  }
  if (!/^rgba?\(/i.test(resolved)) {
    return null
  }

  const channels = resolved
    .match(/[\d.]+/g)
    ?.slice(0, 3)
    .map(Number)
  if (!channels || channels.length !== 3 || channels.some((channel) => !Number.isFinite(channel))) {
    return null
  }
  return `#${channels
    .map((channel) =>
      Math.min(255, Math.max(0, Math.round(channel)))
        .toString(16)
        .padStart(2, '0')
    )
    .join('')}`
}

function renderGraphviz(source: string, signal?: AbortSignal): Promise<string> {
  return getGraphviz().then((graphviz) => {
    throwIfAborted(signal)
    const foreground = toGraphvizHex(
      getComputedStyle(document.documentElement).getPropertyValue('--foreground')
    )
    const svg = graphviz.renderString(source, {
      format: 'svg',
      graphAttributes: {
        bgcolor: 'transparent',
        ...(foreground ? { fontcolor: foreground } : {})
      }
    })
    throwIfAborted(signal)
    return svg
  })
}

function getGraphviz(): Promise<GraphvizInstance> {
  graphvizPromise ??= import('@viz-js/viz')
    .then(({ instance }) => instance())
    .catch((error: unknown) => {
      graphvizPromise = undefined
      throw error
    })
  return graphvizPromise
}

async function renderPlantUml(
  source: string,
  isDark: boolean,
  signal?: AbortSignal
): Promise<string> {
  await loadPlantUmlVizGlobal()
  throwIfAborted(signal)
  const plantUml = await loadPlantUmlModule()
  throwIfAborted(signal)

  const render = (): Promise<string> => renderPlantUmlIntoTarget(plantUml, source, isDark, signal)
  const result = plantUmlRenderQueue.then(render, render)
  plantUmlRenderQueue = result.then(
    () => undefined,
    () => undefined
  )
  return result
}

function loadPlantUmlVizGlobal(): Promise<void> {
  plantUmlVizGlobalPromise ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.dataset.orcaPlantumlVizGlobal = 'true'
    script.src = plantUmlVizGlobalUrl
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => {
      plantUmlVizGlobalPromise = undefined
      script.remove()
      reject(new Error('Unable to load the local PlantUML rendering engine'))
    }
    document.head.append(script)
  })
  return plantUmlVizGlobalPromise
}

function loadPlantUmlModule(): Promise<PlantUmlModule> {
  plantUmlModulePromise ??= import('@plantuml/core/plantuml.js').catch((error: unknown) => {
    plantUmlModulePromise = undefined
    throw error
  })
  return plantUmlModulePromise
}

function renderPlantUmlIntoTarget(
  plantUml: PlantUmlModule,
  source: string,
  isDark: boolean,
  signal?: AbortSignal
): Promise<string> {
  throwIfAborted(signal)
  const target = document.createElement('div')
  target.id = `orca-markdown-plantuml-${(plantUmlTargetSequence += 1)}`
  target.setAttribute('aria-hidden', 'true')
  target.style.position = 'fixed'
  target.style.left = '-10000px'
  target.style.top = '0'
  target.style.visibility = 'hidden'
  target.style.pointerEvents = 'none'
  document.body.append(target)

  let observer: MutationObserver | undefined
  let timeoutId: number | undefined
  let handleAbort: (() => void) | undefined
  const cleanup = (): void => {
    observer?.disconnect()
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId)
    }
    if (handleAbort) {
      signal?.removeEventListener('abort', handleAbort)
    }
    target.remove()
  }

  return new Promise<string>((resolve, reject) => {
    handleAbort = (): void => reject(createAbortError())
    observer = new MutationObserver(() => {
      const svg = target.querySelector('svg')
      if (svg) {
        resolve(svg.outerHTML)
      }
    })
    observer.observe(target, { childList: true, subtree: true })
    timeoutId = window.setTimeout(
      () => reject(new Error('PlantUML rendering timed out')),
      PLANTUML_RENDER_TIMEOUT_MS
    )
    signal?.addEventListener('abort', handleAbort, { once: true })

    try {
      plantUml.render(source.split(/\r\n|\r|\n/), target.id, { dark: isDark })
    } catch (error) {
      reject(error)
    }
  }).finally(cleanup)
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw createAbortError()
  }
}

function createAbortError(): Error {
  const error = new Error('Diagram rendering cancelled')
  error.name = 'AbortError'
  return error
}
