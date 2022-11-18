type MessageReceiver = jest.Mock & {receivedMessages: (num: number) => Promise<void>}

export function getMessageReceiver(): MessageReceiver {
  const listeners: [number, () => void][] = []

  let messagesReceived = 0
  const fn = jest.fn(() => {
    messagesReceived++
    listeners.forEach(([wanted, resolve]) => {
      if (wanted === messagesReceived) {
        resolve()
      }
    })
  }) as MessageReceiver

  fn.receivedMessages = (num: number) => {
    return new Promise<void>((resolve) => {
      if (messagesReceived === num) {
        resolve()
      } else {
        listeners.push([num, resolve])
      }
    })
  }

  return fn
}
