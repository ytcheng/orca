type MarkdownSourceLine = {
  startOffset: number
  text: string
}

type TaskCheckboxMarker = { statusOffset: number; checked: boolean }

function getMarkdownSourceLine(content: string, sourceLine: number): MarkdownSourceLine | null {
  if (!Number.isSafeInteger(sourceLine) || sourceLine < 1) {
    return null
  }

  let startOffset = 0
  for (let line = 1; line < sourceLine; line += 1) {
    const newline = content.indexOf('\n', startOffset)
    if (newline === -1) {
      return null
    }
    startOffset = newline + 1
  }

  const nextLine = content.indexOf('\n', startOffset)
  const rawEnd = nextLine === -1 ? content.length : nextLine
  const endOffset = rawEnd > startOffset && content[rawEnd - 1] === '\r' ? rawEnd - 1 : rawEnd
  return { startOffset, text: content.slice(startOffset, endOffset) }
}

export function getMarkdownTaskSourceLine(content: string, sourceLine: number): string | null {
  return getMarkdownSourceLine(content, sourceLine)?.text ?? null
}

function taskCheckboxOnLine(
  content: string,
  sourceLine: number,
  expectedSourceLine: string
): TaskCheckboxMarker | null {
  const line = getMarkdownSourceLine(content, sourceLine)
  if (!line || line.text !== expectedSourceLine) {
    return null
  }

  const text = line.text
  let cursor = 0
  const skipWhitespace = (): void => {
    while (text[cursor] === ' ' || text[cursor] === '\t') {
      cursor += 1
    }
  }

  skipWhitespace()
  while (text[cursor] === '>') {
    cursor += 1
    skipWhitespace()
  }

  const listStart = cursor
  if (text[cursor] === '-' || text[cursor] === '+' || text[cursor] === '*') {
    cursor += 1
  } else {
    while (text[cursor] >= '0' && text[cursor] <= '9') {
      cursor += 1
    }
    if (cursor === listStart || (text[cursor] !== '.' && text[cursor] !== ')')) {
      return null
    }
    cursor += 1
  }

  if (text[cursor] !== ' ' && text[cursor] !== '\t') {
    return null
  }
  skipWhitespace()

  if (text[cursor] !== '[' || text[cursor + 2] !== ']') {
    return null
  }
  const state = text[cursor + 1]
  if (state !== ' ' && state !== 'x' && state !== 'X') {
    return null
  }
  const afterMarker = text[cursor + 3]
  if (afterMarker !== undefined && afterMarker !== ' ' && afterMarker !== '\t') {
    return null
  }

  return { statusOffset: line.startOffset + cursor + 1, checked: state !== ' ' }
}

export function setMarkdownTaskCheckedAtLine(
  content: string,
  sourceLine: number,
  expectedSourceLine: string,
  expectedChecked: boolean,
  checked: boolean
): string | null {
  const marker = taskCheckboxOnLine(content, sourceLine, expectedSourceLine)
  if (!marker || marker.checked !== expectedChecked || marker.checked === checked) {
    return null
  }
  return (
    content.slice(0, marker.statusOffset) +
    (checked ? 'x' : ' ') +
    content.slice(marker.statusOffset + 1)
  )
}
