import { describe, expect, it } from 'vitest'
import { BRAND_DISPLAY, BRAND_NAME, REGION_LABEL } from './brand'

describe('brand config', () => {
  it('exposes the brand name and region label', () => {
    expect(BRAND_NAME).toBe('새벽사람들')
    expect(REGION_LABEL).toBe('부천')
  })

  it('combines brand and region into the display name', () => {
    expect(BRAND_DISPLAY).toBe(`${BRAND_NAME} in ${REGION_LABEL}`)
  })
})
