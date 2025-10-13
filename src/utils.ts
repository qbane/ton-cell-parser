import { Cell } from '@ton/core'

export function stringToCell(str: string, CellClass: typeof Cell = Cell): InstanceType<typeof CellClass> {
  let isHex = false
  if (str.startsWith('0x')) {
    isHex = true
    str = str.slice(2)
  }
  if (isHex || str.match(/^[\da-f]+$/i)) {
    return CellClass.fromHex(str)
  }
  // TODO: check if it contains illegal char
  return CellClass.fromBase64(str)
}
