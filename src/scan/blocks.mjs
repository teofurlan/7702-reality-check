/**
 * Every block number in the contiguous range `fromBlock..toBlock`, step 1.
 * There is no stride/step parameter anywhere in this module — a contiguous
 * scan is the only supported mode.
 *
 * @param {number} fromBlock
 * @param {number} toBlock
 * @returns {number[]}
 */
export function blockNumbersInRange(fromBlock, toBlock) {
  const numbers = []
  for (let block = fromBlock; block <= toBlock; block++) {
    numbers.push(block)
  }
  return numbers
}

/**
 * Splits `items` into fixed-size groups of at most `size` elements, in
 * order. The final group may be shorter than `size`.
 *
 * `size` must be a positive integer. A size of 0 or less would never advance
 * the cursor, so the loop below would spin forever on a non-empty input with
 * no timeout and no escape path; that is a hang, not a bad result, so it is
 * rejected at the boundary rather than tolerated.
 *
 * @template T
 * @param {T[]} items
 * @param {number} size
 * @returns {T[][]}
 * @throws {RangeError} when `size` is not a positive integer
 */
export function chunk(items, size) {
  if (!Number.isInteger(size) || size < 1) {
    throw new RangeError(`chunk size must be a positive integer, received ${size}`)
  }

  const groups = []
  for (let start = 0; start < items.length; start += size) {
    groups.push(items.slice(start, start + size))
  }
  return groups
}
