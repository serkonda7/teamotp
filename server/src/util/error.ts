/** Normalizes a caught `unknown` into an `Error`. */
export function to_error(err: unknown): Error {
	return err instanceof Error ? err : new Error(String(err))
}
