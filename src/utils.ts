import { Cell } from '@ton/core'

export function stringToCell(str: string) {
  let isHex = false
  if (str.startsWith('0x')) {
    isHex = true
    str = str.slice(2)
  }
  if (isHex || str.match(/^[\da-f]+$/i)) {
    return Cell.fromHex(str)
  }
  // TODO: check if it contains illegal char
  return Cell.fromBase64(str)
}
