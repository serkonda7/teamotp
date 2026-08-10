/** Shared plumbing for the valibot request validators used by the routes. */
import type { Context } from 'hono'
import * as v from 'valibot'

/**
 * Turns a single valibot issue into a message a caller can act on.
 * The default texts for a missing or unexpected key read like internals
 * ("Invalid key: Expected never but received ..."), so those two get a
 * dedicated wording.
 */
function format_issue(issue: v.BaseIssue<unknown>): string {
	const path = v.getDotPath(issue)
	if (!path) {
		return issue.message
	}

	if (issue.kind === 'schema' && issue.received === 'undefined') {
		return `Field "${path}" is required`
	}
	if (issue.type === 'strict_object') {
		return `Field "${path}" is not allowed`
	}

	return `${path}: ${issue.message}`
}

/** Joins all issues of a rejected payload into one sentence. */
function format_issues(issues: readonly [v.BaseIssue<unknown>, ...v.BaseIssue<unknown>[]]): string {
	return issues.map(format_issue).join('; ')
}

/**
 * Error hook for `vValidator`. Replaces valibot's default issue array with the
 * `{ error: string }` shape every other endpoint returns, which is what
 * `client/src/util/api_error.ts` reads.
 */
export function onValidationError<T extends v.GenericSchema>(
	result: v.SafeParseResult<T>,
	c: Context,
): Response | undefined {
	if (result.success) {
		return undefined
	}

	return c.json({ error: format_issues(result.issues) }, 400)
}
