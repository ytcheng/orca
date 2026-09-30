import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { expect, test } from './helpers/orca-app'
import {
  cleanupMarkdownFixture,
  createMarkdownFixture,
  getActiveWorktreeContext,
  openMarkdownFixture
} from './helpers/markdown-editor-fixture'
import { waitForActiveWorktree, waitForSessionReady } from './helpers/store'

const READER_FIXTURE_DIRECTORY = 'orca-e2e-native-markdown-reader'
const READER_DOCUMENT = [
  '# Native Reader',
  '',
  '## Tasks',
  '',
  '- [ ] Complete the review',
  '',
  '## Diagrams',
  '',
  '```mermaid',
  'flowchart TD',
  '  A --> B',
  '```',
  '',
  '```plantuml',
  '@startuml',
  'Alice -> Bob: hello',
  '@enduml',
  '```',
  '',
  '```dot',
  'digraph G { A -> B }',
  '```',
  '',
  '```plantuml',
  '!includeurl https://example.test/diagram.puml',
  '@enduml',
  '```',
  ''
].join('\n')

test('opens new Markdown edit tabs in Reader and keeps Source and Rich available', async ({
  orcaPage
}, testInfo) => {
  await waitForSessionReady(orcaPage)
  await waitForActiveWorktree(orcaPage)
  const context = await getActiveWorktreeContext(orcaPage)
  const readerDocumentPath = await createMarkdownFixture(
    context,
    READER_FIXTURE_DIRECTORY,
    'reader',
    testInfo.workerIndex,
    READER_DOCUMENT
  )

  try {
    await openMarkdownFixture(orcaPage, context, path.join(context.rootPath, 'README.md'))
    const readerToggle = orcaPage.getByRole('radio', { name: 'Reader', exact: true })
    const sourceToggle = orcaPage.getByRole('radio', { name: 'Source', exact: true })
    const richToggle = orcaPage.getByRole('radio', { name: 'Rich Editor', exact: true })

    await expect(readerToggle).toHaveAttribute('aria-checked', 'true')
    await expect(orcaPage.locator('.markdown-reader-surface')).toBeVisible()

    await sourceToggle.click()
    await expect(sourceToggle).toHaveAttribute('aria-checked', 'true')
    await expect(orcaPage.locator('.monaco-editor')).toBeVisible()

    await richToggle.click()
    await expect(richToggle).toHaveAttribute('aria-checked', 'true')
    await expect(orcaPage.locator('.rich-markdown-editor')).toBeVisible()

    await openMarkdownFixture(orcaPage, context, readerDocumentPath)
    await expect(orcaPage.getByRole('radio', { name: 'Reader', exact: true })).toHaveAttribute(
      'aria-checked',
      'true'
    )
    const reader = orcaPage.locator('.markdown-reader-surface')
    await expect(reader).toBeVisible()
    await expect(reader.locator('.markdown-body h1')).toContainText('Native Reader')

    const task = reader.getByRole('checkbox')
    await expect(task).toBeEnabled()
    await task.click()
    await expect(task).toBeChecked()

    await orcaPage.setViewportSize({ width: 960, height: 720 })
    const toolbar = orcaPage.locator('.markdown-reader-toolbar')
    await toolbar.getByRole('button', { name: 'Show table of contents' }).click()
    const toc = orcaPage.getByRole('complementary', { name: 'Table of contents' })
    await expect(toc).toBeVisible()
    await expect(toc.getByRole('button', { name: 'Native Reader', exact: true })).toBeVisible()

    await toolbar.getByRole('button', { name: 'Find in document' }).click()
    const search = orcaPage.getByRole('textbox', { name: 'Find in markdown preview' })
    await search.fill('Complete the review')
    await expect(orcaPage.locator('.markdown-preview-search-status')).toContainText('1/1')

    await expect(reader.locator('.markdown-reader-diagram svg')).toHaveCount(2, {
      timeout: 30_000
    })
    await expect(reader.locator('.mermaid-block svg')).toHaveCount(1, { timeout: 30_000 })
    await expect(reader.locator('.markdown-reader-diagram-error [role="alert"]')).toContainText(
      'PlantUML error:'
    )
    await expect(reader.locator('.markdown-reader-diagram-error pre code')).toContainText(
      '!includeurl'
    )

    await toc.getByRole('button', { name: 'Close table of contents' }).click()
    await reader
      .locator('.markdown-preview-search')
      .getByRole('button', { name: 'Close search' })
      .click()
    await orcaPage.setViewportSize({ width: 1280, height: 900 })
    await reader
      .locator('.markdown-reader-scroll')
      .evaluate((element) => element.scrollTo({ top: 0 }))

    await orcaPage.evaluate(async () => {
      await window.__store!.getState().updateSettingsOrThrow({ theme: 'light' })
    })
    await expect
      .poll(() => orcaPage.evaluate(() => document.documentElement.classList.contains('dark')))
      .toBe(false)
    const lightBackground = await reader.evaluate(
      (element) => getComputedStyle(element).backgroundColor
    )
    const lightScreenshotPath = testInfo.outputPath('markdown-reader-light-theme.png')
    await orcaPage.screenshot({ path: lightScreenshotPath })
    await testInfo.attach('markdown-reader-light-theme', {
      path: lightScreenshotPath,
      contentType: 'image/png'
    })

    await orcaPage.evaluate(async () => {
      await window.__store!.getState().updateSettingsOrThrow({ theme: 'dark' })
    })
    await expect
      .poll(() => orcaPage.evaluate(() => document.documentElement.classList.contains('dark')))
      .toBe(true)
    const darkBackground = await reader.evaluate(
      (element) => getComputedStyle(element).backgroundColor
    )
    expect(darkBackground).not.toBe(lightBackground)
    const darkScreenshotPath = testInfo.outputPath('markdown-reader-dark-theme.png')
    await orcaPage.screenshot({ path: darkScreenshotPath })
    await testInfo.attach('markdown-reader-dark-theme', {
      path: darkScreenshotPath,
      contentType: 'image/png'
    })

    await orcaPage.emulateMedia({ forcedColors: 'active', contrast: 'more' })
    await expect(toolbar.getByRole('button', { name: 'Find in document' })).toBeVisible()
    const contrastScreenshotPath = testInfo.outputPath('markdown-reader-forced-colors.png')
    await orcaPage.screenshot({ path: contrastScreenshotPath })
    await testInfo.attach('markdown-reader-forced-colors', {
      path: contrastScreenshotPath,
      contentType: 'image/png'
    })
    await orcaPage.emulateMedia({ forcedColors: 'none', contrast: 'no-preference' })
  } finally {
    await cleanupMarkdownFixture(readerDocumentPath)
  }
})

test('keeps the single-file diff Markdown surface outside the Reader layout', async ({
  orcaPage
}, testInfo) => {
  await waitForSessionReady(orcaPage)
  await waitForActiveWorktree(orcaPage)
  const context = await getActiveWorktreeContext(orcaPage)
  const diffDocumentPath = await createMarkdownFixture(
    context,
    READER_FIXTURE_DIRECTORY,
    'diff',
    testInfo.workerIndex,
    '# Diff document\n\nChanged body.\n'
  )
  const relativePath = path.relative(context.rootPath, diffDocumentPath)

  try {
    execFileSync('git', ['add', '--', relativePath], { cwd: context.rootPath, stdio: 'pipe' })
    await orcaPage.evaluate(
      ({ worktreeId, filePath, relativePath }) => {
        const store = window.__store!
        store.getState().openDiff(worktreeId, filePath, relativePath, 'markdown', true)
        const fileId = store.getState().activeFileId
        if (!fileId) {
          throw new Error('The Markdown diff did not open')
        }
      },
      { worktreeId: context.worktreeId, filePath: diffDocumentPath, relativePath }
    )

    await expect(orcaPage.locator('.monaco-diff-editor')).toBeVisible()
    await expect(orcaPage.locator('.markdown-reader-toolbar')).toHaveCount(0)
    await expect(orcaPage.getByRole('radio', { name: 'Reader', exact: true })).toHaveCount(0)
  } finally {
    execFileSync('git', ['reset', '--', relativePath], { cwd: context.rootPath, stdio: 'pipe' })
    await cleanupMarkdownFixture(diffDocumentPath)
  }
})
