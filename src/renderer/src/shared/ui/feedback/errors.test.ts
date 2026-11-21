import { describe, expect, it } from 'vitest'
import { errorDetails, errorMessage } from './errors'

describe('errorMessage', () => {
  it('drops the IPC wrapper so the user sees the cause', () => {
    expect(
      errorMessage(
        new Error(
          "Error invoking remote method 'jobs:start': Error: build.py not found in builds/tower"
        )
      )
    ).toBe('build.py not found in builds/tower')
    expect(errorMessage('TypeError: x is undefined')).toBe('x is undefined')
    expect(errorMessage({ code: 1 })).toBe('Something went wrong. Try again.')
  })

  it('keeps transport dumps and long diagnostics out of the summary', () => {
    const raw = 'Request failed. Headers: {"set-cookie":"sensitive-value"}'
    expect(errorMessage(raw)).toBe('Something went wrong. Try again.')
    expect(errorDetails(raw)).toBe('Request failed.\n[HTTP headers removed]')
    expect(errorMessage('ENOENT: no such file')).toBe('A required file or folder is missing.')
    expect(errorMessage('The report could not be saved. '.repeat(20)).length).toBeLessThan(162)
  })
})

describe('errorDetails', () => {
  it('keeps the stack, and serialises plain objects', () => {
    const e = new Error('boom')
    expect(errorDetails(e)).toContain('boom')
    expect(errorDetails(e)).toContain('errors.test')
    expect(errorDetails({ code: 'ENOENT', path: 'out/v3.litematic' })).toContain('"ENOENT"')
    expect(errorDetails('plain')).toBe('plain')
  })
})
