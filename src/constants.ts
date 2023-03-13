// ReadyStates, mirrors WhatWG spec, but uses strings instead of numbers.
// Why make it harder to read than it needs to be?

/**
 * ReadyState representing a connection that is connecting or has been scheduled to reconnect.
 * @public
 */
export const CONNECTING = 'connecting'

/**
 * ReadyState representing a connection that is open, eg connected.
 * @public
 */
export const OPEN = 'open'

/**
 * ReadyState representing a connection that has been closed (manually, or due to an error).
 * @public
 */
export const CLOSED = 'closed'
