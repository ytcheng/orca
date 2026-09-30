import React from 'react'
import type {
  MarkdownPreviewPositionNode,
  MarkdownPreviewTaskToggle
} from './markdown-preview-types'
import { getMarkdownTaskSourceLine } from './markdown-task-toggle'

type MarkdownTaskLineContextValue = {
  sourceLine?: number
  renderedContent?: string
  onTaskToggle?: (change: MarkdownPreviewTaskToggle) => void
}

const MarkdownTaskLineContext = React.createContext<MarkdownTaskLineContextValue>({})

export function MarkdownPreviewTaskLineProvider({
  sourceLine,
  renderedContent,
  onTaskToggle,
  children
}: MarkdownTaskLineContextValue & { children: React.ReactNode }): React.JSX.Element {
  const value = React.useMemo(
    () => ({ sourceLine, renderedContent, onTaskToggle }),
    [onTaskToggle, renderedContent, sourceLine]
  )
  return (
    <MarkdownTaskLineContext.Provider value={value}>{children}</MarkdownTaskLineContext.Provider>
  )
}

export function MarkdownPreviewTaskInput({
  node,
  type,
  checked,
  ...props
}: React.ComponentProps<'input'> & { node?: MarkdownPreviewPositionNode }): React.JSX.Element {
  const taskLine = React.useContext(MarkdownTaskLineContext)
  const sourceLine = node?.position?.start?.line ?? taskLine.sourceLine
  const expectedSourceLine =
    sourceLine !== undefined && taskLine.renderedContent !== undefined
      ? getMarkdownTaskSourceLine(taskLine.renderedContent, sourceLine)
      : null
  const canToggleTask =
    type === 'checkbox' &&
    sourceLine !== undefined &&
    expectedSourceLine !== null &&
    taskLine.onTaskToggle !== undefined

  return (
    <input
      {...props}
      type={type}
      checked={checked}
      disabled={!canToggleTask}
      onChange={(event) => {
        if (
          !canToggleTask ||
          sourceLine === undefined ||
          expectedSourceLine === null ||
          !taskLine.onTaskToggle
        ) {
          return
        }
        taskLine.onTaskToggle({
          sourceLine,
          expectedSourceLine,
          expectedChecked: checked === true,
          checked: event.currentTarget.checked
        })
      }}
    />
  )
}
