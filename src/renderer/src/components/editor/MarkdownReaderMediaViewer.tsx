import { RotateCcw, X, ZoomIn, ZoomOut } from 'lucide-react'
import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import { translate } from '@/i18n/i18n'
import {
  type ApplyImageViewerZoomChange,
  applyAnchoredImageViewerZoomChange,
  applyImageSurfaceWheel,
  getElementSurfaceSize,
  getImageLayoutStyle
} from './image-viewer-dom-zoom'
import {
  IMAGE_VIEWER_ZOOM_STEP,
  MAX_IMAGE_VIEWER_ZOOM,
  MIN_IMAGE_VIEWER_ZOOM,
  type ImageViewerImageDimensions,
  type ImageViewerSurfaceSize,
  getZoomedImageLayoutSize
} from './image-viewer-zoom'

/* oxlint-disable react-doctor/no-adjust-state-on-prop-change -- Why: layout measurements come from the dialog DOM and ResizeObserver. */

export type MarkdownReaderMediaViewerProps = {
  src: string
  alt: string
  kind: 'image' | 'diagram'
  isLinked?: boolean
  onImageClick?: (event: React.MouseEvent<HTMLImageElement>) => void
  children?: React.ReactNode
}

type MediaDimensionsState = {
  mediaKey: string
  dimensions: ImageViewerImageDimensions
}

export function MarkdownReaderMediaViewer({
  src,
  alt,
  kind,
  isLinked = false,
  onImageClick,
  children
}: MarkdownReaderMediaViewerProps): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false)
  const mediaKey = `${kind}\n${src}`
  const [zoomState, setZoomState] = useState({ mediaKey, zoom: 1 })
  const [surfaceSize, setSurfaceSize] = useState<ImageViewerSurfaceSize | null>(null)
  const [mediaDimensionsState, setMediaDimensionsState] = useState<MediaDimensionsState | null>(
    null
  )
  const surfaceRef = useRef<HTMLDivElement | null>(null)
  const diagramContainerRef = useRef<HTMLDivElement | null>(null)
  const zoom = zoomState.mediaKey === mediaKey ? zoomState.zoom : 1
  const mediaDimensions =
    mediaDimensionsState?.mediaKey === mediaKey ? mediaDimensionsState.dimensions : null
  const openLabel =
    kind === 'diagram'
      ? translate('auto.components.editor.MarkdownReaderMediaViewer.openDiagram', 'Open diagram')
      : translate('auto.components.editor.MarkdownReaderMediaViewer.openImage', 'Open image')
  const closeLabel = translate('auto.components.editor.MarkdownReaderMediaViewer.close', 'Close')
  const zoomInLabel = translate(
    'auto.components.editor.MarkdownReaderMediaViewer.zoomIn',
    'Zoom in'
  )
  const zoomOutLabel = translate(
    'auto.components.editor.MarkdownReaderMediaViewer.zoomOut',
    'Zoom out'
  )
  const resetZoomLabel = translate(
    'auto.components.editor.MarkdownReaderMediaViewer.resetZoom',
    'Reset zoom'
  )
  const dialogDescription = translate(
    'auto.components.editor.MarkdownReaderMediaViewer.description',
    'Use the zoom controls to resize the media and scroll to pan.'
  )
  const zoomPercent = Math.round(zoom * 100)

  const setZoom = useCallback<Dispatch<SetStateAction<number>>>(
    (nextZoom) => {
      setZoomState((current) => {
        const currentZoom = current.mediaKey === mediaKey ? current.zoom : 1
        return {
          mediaKey,
          zoom: typeof nextZoom === 'function' ? nextZoom(currentZoom) : nextZoom
        }
      })
    },
    [mediaKey]
  )
  const imageLayoutSize = useMemo(
    () =>
      getZoomedImageLayoutSize({
        imageDimensions: mediaDimensions,
        surfaceSize,
        zoom
      }),
    [mediaDimensions, surfaceSize, zoom]
  )
  const imageLayoutStyle = useMemo(() => getImageLayoutStyle(imageLayoutSize), [imageLayoutSize])
  const applyZoomChange = useCallback<ApplyImageViewerZoomChange>(
    (getNextZoom, anchor) => {
      applyAnchoredImageViewerZoomChange(surfaceRef.current, setZoom, getNextZoom, anchor)
    },
    [setZoom]
  )
  const handleWheel = useCallback(
    (event: WheelEvent) => applyImageSurfaceWheel(event, applyZoomChange),
    [applyZoomChange]
  )
  const setSurfaceRef = useCallback(
    (surface: HTMLDivElement | null) => {
      if (surfaceRef.current) {
        surfaceRef.current.removeEventListener('wheel', handleWheel)
      }
      surfaceRef.current = surface
      if (surface) {
        setSurfaceSize(getElementSurfaceSize(surface))
        surface.addEventListener('wheel', handleWheel, { passive: false })
      } else {
        setSurfaceSize(null)
      }
    },
    [handleWheel]
  )
  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        setZoom(1)
      }
      setIsOpen(open)
    },
    [setZoom]
  )
  const handleTriggerKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        handleOpenChange(true)
      }
    },
    [handleOpenChange]
  )

  useEffect(() => {
    if (!isOpen) {
      setSurfaceSize(null)
      return
    }
    const surface = surfaceRef.current
    if (!surface) {
      return
    }
    const updateSize = (): void => setSurfaceSize(getElementSurfaceSize(surface))
    updateSize()
    if (typeof ResizeObserver === 'undefined') {
      return
    }
    const observer = new ResizeObserver(updateSize)
    observer.observe(surface)
    return () => observer.disconnect()
  }, [isOpen])

  useEffect(() => {
    if (!isOpen || kind !== 'diagram') {
      return
    }
    const svg = diagramContainerRef.current?.querySelector('svg')
    if (!svg) {
      return
    }
    const viewBox = svg
      .getAttribute('viewBox')
      ?.trim()
      .split(/[\s,]+/)
      .map(Number)
    const width = viewBox?.[2] || Number.parseFloat(svg.getAttribute('width') ?? '')
    const height = viewBox?.[3] || Number.parseFloat(svg.getAttribute('height') ?? '')
    if (width > 0 && height > 0) {
      setMediaDimensionsState({ mediaKey, dimensions: { width, height } })
    }
  }, [isOpen, kind, mediaKey])

  const handleImageLoad = useCallback(
    (event: React.SyntheticEvent<HTMLImageElement>) => {
      const { naturalWidth, naturalHeight } = event.currentTarget
      if (naturalWidth > 0 && naturalHeight > 0) {
        setMediaDimensionsState({
          mediaKey,
          dimensions: { width: naturalWidth, height: naturalHeight }
        })
      }
    },
    [mediaKey]
  )

  const inlineMedia =
    children ??
    (kind === 'image' ? (
      <img src={src} alt={alt} onClick={onImageClick} />
    ) : (
      <div aria-hidden="true" dangerouslySetInnerHTML={{ __html: src }} />
    ))

  if (isLinked) {
    return <>{inlineMedia}</>
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="markdown-reader-media-trigger h-auto max-w-full min-w-0 p-0"
          aria-label={openLabel}
          title={openLabel}
          onKeyDown={handleTriggerKeyDown}
        >
          {inlineMedia}
        </Button>
      </DialogTrigger>
      <DialogContent
        showCloseButton={false}
        className="markdown-reader-media-dialog flex h-[85vh] w-[92vw] max-w-6xl flex-col gap-0 overflow-hidden p-0 sm:max-w-6xl"
      >
        <DialogTitle className="sr-only">{alt || openLabel}</DialogTitle>
        <DialogDescription className="sr-only">{dialogDescription}</DialogDescription>
        <div className="markdown-reader-media-header">
          <span className="min-w-0 flex-1 truncate text-sm font-medium" title={alt}>
            {alt || openLabel}
          </span>
          <Button type="button" variant="ghost" size="sm" onClick={() => handleOpenChange(false)}>
            <X className="size-4" />
            {closeLabel}
          </Button>
        </div>
        <div ref={setSurfaceRef} className="markdown-reader-media-surface scrollbar-editor">
          <div className="markdown-reader-media-canvas">
            <div className="markdown-reader-media-layout" style={imageLayoutStyle}>
              {kind === 'image' ? (
                <img
                  src={src}
                  alt={alt}
                  onLoad={handleImageLoad}
                  className={`markdown-reader-media-image ${imageLayoutSize ? 'is-sized' : ''}`.trim()}
                />
              ) : (
                <div
                  ref={diagramContainerRef}
                  className={`markdown-reader-media-svg ${imageLayoutSize ? 'is-sized' : ''}`.trim()}
                  dangerouslySetInnerHTML={{ __html: src }}
                />
              )}
            </div>
          </div>
        </div>
        <div className="markdown-reader-media-controls">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={zoomOutLabel}
            title={zoomOutLabel}
            onClick={() => applyZoomChange((currentZoom) => currentZoom / IMAGE_VIEWER_ZOOM_STEP)}
            disabled={zoom <= MIN_IMAGE_VIEWER_ZOOM}
          >
            <ZoomOut className="size-4" />
          </Button>
          <span data-zoom-percent="true" className="tabular-nums text-xs text-muted-foreground">
            {zoomPercent}%
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={resetZoomLabel}
            title={resetZoomLabel}
            onClick={() => applyZoomChange(() => 1)}
            disabled={zoom === 1}
          >
            <RotateCcw className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={zoomInLabel}
            title={zoomInLabel}
            onClick={() => applyZoomChange((currentZoom) => currentZoom * IMAGE_VIEWER_ZOOM_STEP)}
            disabled={zoom >= MAX_IMAGE_VIEWER_ZOOM}
          >
            <ZoomIn className="size-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
