type TaskCheckboxMarker = { statusOffset: number; checked: boolean }

function taskCheckboxOnLine(content: string, sourceLine: number): TaskCheckboxMarker | null {
  if (!Number.isSafeInteger(sourceLine) || sourceLine < 1) {
    return null
  }

  let lineStart = 0
  for (let line = 1; line < sourceLine; line += 1) {
    const newline = content.indexOf('\n', lineStart)
    if (newline === -1) {
      return null
    }
    lineStart = newline + 1
  }

  const nextLine = content.indexOf('\n', lineStart)
  const rawEnd = nextLine === -1 ? content.length : nextLine
  const lineEnd = rawEnd > lineStart && content[rawEnd - 1] === '\r' ? rawEnd - 1 : rawEnd
  const text = content.slice(lineStart, lineEnd)
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

  return { statusOffset: lineStart + cursor + 1, checked: state !== ' ' }
}

export function setMarkdownTaskCheckedAtLine(
  content: string,
  sourceLine: number,
  expectedChecked: boolean,
  checked: boolean
): string | null {
  const marker = taskCheckboxOnLine(content, sourceLine)
  if (!marker || marker.checked !== expectedChecked || marker.checked === checked) {
    return null
  }
  return (
    content.slice(0, marker.statusOffset) +
    (checked ? 'x' : ' ') +
    content.slice(marker.statusOffset + 1)
  )
}
