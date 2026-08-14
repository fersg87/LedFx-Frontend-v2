/* eslint-disable @typescript-eslint/no-unused-vars */
import { test, expect } from './fixtures'
import { clearDialogs } from './helpers'

/**
 * @title How to: Gel a room with a Flow Pad Grid
 * @intro
 * A **Pad Grid** is a Flow sender node holding a grid of one-tap colour pads.
 * Tapping a pad tints the effects running on the virtuals it targets, leaving
 * those effects running underneath. Tapping the lit pad again restores the
 * original colours exactly — nothing is written to the effect's config.
 */
test('Flow: add a pad grid, apply a colour override, then clear it', async ({ page }) => {
  test.setTimeout(90000)

  await page.goto('/#/')
  await clearDialogs(page)

  const virtualName = 'Pad Grid Test Virtual'

  /**
   * @doc
   * Create a Virtual Device from the **Devices** page FAB, so the pad grid has
   * something to send to.
   */
  await test.step('1. Create a Virtual Device', async () => {
    await page.locator('.MuiBottomNavigationAction-root').filter({ hasText: 'Devices' }).click()
    await page.waitForTimeout(1000)

    await page.locator('.MuiFab-root[aria-label="add"]').click()
    await page.waitForTimeout(500)
    await page.getByRole('menuitem', { name: 'Add Virtual' }).click()

    const dialog = page.getByRole('dialog')
    await dialog.waitFor({ state: 'visible' })
    const nameInput = dialog.locator('input').first()
    await nameInput.waitFor({ state: 'visible', timeout: 10000 })
    await nameInput.fill(virtualName)

    await page.getByRole('button', { name: 'Add & Setup Segments' }).click()
    await page.waitForTimeout(2000)

    // "Add & Setup Segments" opens the full-screen segment editor - go Back
    await page.getByRole('button', { name: 'Back' }).click()
    await page.waitForTimeout(500)
    await page.screenshot({ path: 'test-results/padgrid-1-virtual-created.png' })
  })

  /**
   * @doc
   * Open the **Flow** view and expand the toolbar actions with the chevron.
   */
  await test.step('2. Open the Flow view', async () => {
    await page.goto('/#/reactflow')
    await page.waitForTimeout(1500)
    await expect(page.locator('.react-flow')).toBeVisible()
    await page.screenshot({ path: 'test-results/padgrid-2-flow-open.png' })
  })

  /**
   * @doc
   * Click **Add Pad Grid** and name the node. It is added to the canvas with a
   * default 4x4 auto-palette grid, already expanded.
   */
  await test.step('3. Add a Pad Grid node', async () => {
    // The toolbar actions live behind the chevron toggle
    await page.locator('button:has(svg[data-testid="ChevronRightIcon"])').first().click()
    await page.waitForTimeout(500)

    await page.getByRole('button', { name: 'Add Pad Grid' }).click()

    const dialog = page.getByRole('dialog')
    await dialog.waitFor({ state: 'visible' })
    await dialog.locator('input').first().fill('Main Room')
    await dialog.getByRole('button', { name: 'Add' }).click()
    await dialog.waitFor({ state: 'detached', timeout: 10000 })

    await expect(page.getByTestId('pad-0')).toBeVisible()
    await page.screenshot({ path: 'test-results/padgrid-3-node-added.png' })
  })

  /**
   * @doc
   * A fresh pad grid is scoped: it does nothing until it is connected to a
   * virtual. Switch it to **all virtuals** with the globe button in the node
   * header so the pads go live without drawing an edge.
   */
  await test.step('4. Target all virtuals', async () => {
    await expect(page.getByTestId('pad-grid-hint')).toHaveText(/Connect to a virtual/)

    await page.locator('button:has(svg[data-testid="HubIcon"])').first().click()
    await page.waitForTimeout(500)

    await expect(page.getByTestId('pad-grid-hint')).toHaveText(/Tap a pad/)
    await page.screenshot({ path: 'test-results/padgrid-4-global-scope.png' })
  })

  /**
   * @doc
   * Tap a pad. The backend applies the override and reports it back over the
   * websocket, so the pad lights up with an `ON` badge from server state rather
   * than from the click itself.
   */
  await test.step('5. Apply a colour override', async () => {
    await page.getByTestId('pad-2').click()
    await page.waitForTimeout(1500)

    await expect(page.getByTestId('pad-2')).toContainText('ON')
    await expect(page.getByRole('button', { name: 'Clear' })).toBeVisible()
    await page.screenshot({ path: 'test-results/padgrid-5-override-active.png' })
  })

  /**
   * @doc
   * Tap the lit pad again to drop the override. The `ON` badge disappears and
   * the effects underneath are showing their own colours again.
   */
  await test.step('6. Clear the override', async () => {
    await page.getByTestId('pad-2').click()
    await page.waitForTimeout(1500)

    await expect(page.getByTestId('pad-2')).not.toContainText('ON')
    await expect(page.getByRole('button', { name: 'Clear' })).toHaveCount(0)
    await page.screenshot({ path: 'test-results/padgrid-6-override-cleared.png' })
  })

  /**
   * @doc
   * Pads are stored on the node, so they survive a reload along with the rest
   * of the Flow layout.
   */
  await test.step('7. Pads persist across a reload', async () => {
    await page.reload()
    await page.waitForTimeout(2000)

    await expect(page.getByTestId('pad-0')).toBeVisible()
    await page.screenshot({ path: 'test-results/padgrid-7-persisted.png' })
  })
})
