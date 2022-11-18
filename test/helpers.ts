type MessageReceiver = jest.Mock & {callCount: (num: number) => Promise<void>}

export function getCallCounter(): MessageReceiver {
  const listeners: [number, () => void][] = []

  let numCalls = 0
  const fn = jest.fn(() => {
    numCalls++
    listeners.forEach(([wanted, resolve]) => {
      if (wanted === numCalls) {
        resolve()
      }
    })
  }) as MessageReceiver

  fn.callCount = (num: number) => {
    return new Promise<void>((resolve) => {
      if (numCalls === num) {
        resolve()
      } else {
        listeners.push([num, resolve])
      }
    })
  }

  return fn
}
