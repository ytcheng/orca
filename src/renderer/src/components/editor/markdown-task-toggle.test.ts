import { describe, expect, it } from 'vitest'
import { getMarkdownTaskSourceLine, setMarkdownTaskCheckedAtLine } from './markdown-task-toggle'

describe('setMarkdownTaskCheckedAtLine', () => {
  it('updates only the requested checkbox and keeps CRLF endings', () => {
    const source = '> - [ ] first\r\n> - [x] second\r\n'

    expect(setMarkdownTaskCheckedAtLine(source, 2, '> - [x] second', true, false)).toBe(
      '> - [ ] first\r\n> - [ ] second\r\n'
    )
  })

  it('returns null when the task line changed after render', () => {
    expect(setMarkdownTaskCheckedAtLine('- [x] task', 1, '- [ ] task', false, true)).toBeNull()
  })

  it('rejects a new task that reuses the rendered task line after an Agent insertion', () => {
    const renderedLine = '- [ ] original task'
    const latestContent = `- [ ] Agent-created task\n${renderedLine}`

    expect(setMarkdownTaskCheckedAtLine(latestContent, 1, renderedLine, false, true)).toBeNull()
  })

  it('reads the exact rendered source line without its CRLF terminator', () => {
    expect(getMarkdownTaskSourceLine('> - [ ] task\r\n- [ ] next', 1)).toBe('> - [ ] task')
  })

  it('updates a checkbox in an LF document', () => {
    expect(
      setMarkdownTaskCheckedAtLine('- [ ] first\n- [ ] second', 1, '- [ ] first', false, true)
    ).toBe('- [x] first\n- [ ] second')
  })

  it('accepts indentation and ordered list markers', () => {
    expect(
      setMarkdownTaskCheckedAtLine('  12)   [X] done', 1, '  12)   [X] done', true, false)
    ).toBe('  12)   [ ] done')
  })

  it('accepts nested blockquote prefixes', () => {
    expect(
      setMarkdownTaskCheckedAtLine('> > - [ ] quoted', 1, '> > - [ ] quoted', false, true)
    ).toBe('> > - [x] quoted')
  })

  it('rejects invalid, out-of-range, and non-task lines', () => {
    expect(setMarkdownTaskCheckedAtLine('- [ ] task', 0, '- [ ] task', false, true)).toBeNull()
    expect(setMarkdownTaskCheckedAtLine('- [ ] task', 2, '- [ ] task', false, true)).toBeNull()
    expect(
      setMarkdownTaskCheckedAtLine('plain [ ] text', 1, 'plain [ ] text', false, true)
    ).toBeNull()
    expect(
      setMarkdownTaskCheckedAtLine('- [ ]missing space', 1, '- [ ]missing space', false, true)
    ).toBeNull()
  })

  it('returns null for a same-state update', () => {
    expect(setMarkdownTaskCheckedAtLine('- [x] task', 1, '- [x] task', true, true)).toBeNull()
  })
})
