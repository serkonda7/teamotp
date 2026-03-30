/**
 * Helper to convert a Solid `refetch` (which may return T[] | Promise<T[]> | null | undefined)
 * into a guaranteed Promise that resolves to a non-null array.
 */
export function makeArrayRefetch<T>(
	refetch: (...args: unknown[]) => T[] | Promise<T[]> | null | undefined,
): () => Promise<T[]> {
	return async () => {
		const res = await refetch()
		return (res ?? []) as T[]
	}
}
