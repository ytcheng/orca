import { describe, expect, it } from 'vitest'
import { setMarkdownTaskCheckedAtLine } from './markdown-task-toggle'

describe('setMarkdownTaskCheckedAtLine', () => {
  it('updates only the requested checkbox and keeps CRLF endings', () => {
    const source = '> - [ ] first\r\n> - [x] second\r\n'

    expect(setMarkdownTaskCheckedAtLine(source, 2, true, false)).toBe(
      '> - [ ] first\r\n> - [ ] second\r\n'
    )
  })

  it('returns null when the task line changed after render', () => {
    expect(setMarkdownTaskCheckedAtLine('- [x] task', 1, false, true)).toBeNull()
  })

  it('updates a checkbox in an LF document', () => {
    expect(setMarkdownTaskCheckedAtLine('- [ ] first\n- [ ] second', 1, false, true)).toBe(
      '- [x] first\n- [ ] second'
    )
  })

  it('accepts indentation and ordered list markers', () => {
    expect(setMarkdownTaskCheckedAtLine('  12)   [X] done', 1, true, false)).toBe(
      '  12)   [ ] done'
    )
  })

  it('accepts nested blockquote prefixes', () => {
    expect(setMarkdownTaskCheckedAtLine('> > - [ ] quoted', 1, false, true)).toBe(
      '> > - [x] quoted'
    )
  })

  it('rejects invalid, out-of-range, and non-task lines', () => {
    expect(setMarkdownTaskCheckedAtLine('- [ ] task', 0, false, true)).toBeNull()
    expect(setMarkdownTaskCheckedAtLine('- [ ] task', 2, false, true)).toBeNull()
    expect(setMarkdownTaskCheckedAtLine('plain [ ] text', 1, false, true)).toBeNull()
    expect(setMarkdownTaskCheckedAtLine('- [ ]missing space', 1, false, true)).toBeNull()
  })

  it('returns null for a same-state update', () => {
    expect(setMarkdownTaskCheckedAtLine('- [x] task', 1, true, true)).toBeNull()
  })
})
