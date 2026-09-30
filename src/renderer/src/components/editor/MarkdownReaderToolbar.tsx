import type React from 'react'
import { ListTree, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'

export type MarkdownReaderToolbarProps = {
  tocVisible: boolean
  onToggleToc: () => void
  onOpenFind: () => void
}

export function MarkdownReaderToolbar({
  tocVisible,
  onToggleToc,
  onOpenFind
}: MarkdownReaderToolbarProps): React.JSX.Element {
  const tocLabel = tocVisible
    ? translate('auto.components.editor.MarkdownReaderToolbar.hideToc', 'Hide table of contents')
    : translate('auto.components.editor.MarkdownReaderToolbar.showToc', 'Show table of contents')
  const findLabel = translate(
    'auto.components.editor.MarkdownReaderToolbar.find',
    'Find in document'
  )
  const toolbarLabel = translate(
    'auto.components.editor.MarkdownReaderToolbar.label',
    'Markdown reader controls'
  )

  return (
    <TooltipProvider delayDuration={300}>
      <div className="markdown-reader-toolbar" role="toolbar" aria-label={toolbarLabel}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={tocLabel}
              aria-pressed={tocVisible}
              onClick={onToggleToc}
            >
              <ListTree className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" showArrow={false}>
            {tocLabel}
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={findLabel}
              onClick={onOpenFind}
            >
              <Search className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" showArrow={false}>
            {findLabel}
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  )
}
