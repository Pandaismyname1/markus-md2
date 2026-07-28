# PR #482 — Optimistic task mutations

`acme/web` · 6 files changed · author **@panda**

:::risk-map{title="Risk map"}

- :badge[useOptimisticTasks.ts]{severity=blocking} :jump[review]{to=#hook}
- :badge[TaskList.svelte]{severity=warning} :jump[review]{to=#list}
- :badge[api/tasks.ts]{severity=nit} :jump[review]{to=#api}
- :badge[schema.ts]{severity=success} :jump[review]{to=#schema}

:::

## Summary

Adds optimistic updates for task mutations so the UI reacts instantly without waiting on the server round-trip. Falls back to server truth on error.

:::columns

:::column
**Why now**
Users on slow links saw 600–900 ms before the task appeared. Mobile users complained twice this week.
:::

:::column
**What changed**
New `useOptimisticTasks` hook wraps `queryClient.setQueryData` around the mutation. Server still owns truth on error.
:::

:::

## Annotated diff

### `src/lib/client/useOptimisticTasks.ts` <a id="hook"></a>

:::annotate-code{lang=ts}

```ts
export function useOptimisticTasks(qc: QueryClient) {
	const key = ['tasks'] as const;
	return useMutation({
		mutationFn: createTask,
		onMutate: async (input) => {
			const prev = qc.getQueryData<Task[]>(key) ?? [];
			const optimistic = { ...input, id: crypto.randomUUID(), pending: true };
			qc.setQueryData<Task[]>(key, [optimistic, ...prev]);
			return { prev, tempId: optimistic.id };
		},
		onError: (_e, _v, ctx) => {
			if (ctx) qc.setQueryData(key, ctx.prev);
		},
		onSuccess: (saved, _v, ctx) => {
			qc.setQueryData<Task[]>(key, (cur = []) =>
				cur.map((t) => (t.id === ctx?.tempId ? saved : t))
			);
		}
	});
}
```

@7 blocking: `onMutate` doesn't call `qc.cancelQueries(key)` first — concurrent refetches will clobber the optimistic state.
@9 warning: `crypto.randomUUID()` is fine for IDs but server returns its own. Reconciliation in `onSuccess` matches by `tempId`, OK.
@15 nit: rollback uses cached `prev`; if a refetch ran between `onMutate` and `onError`, this restores stale data.

:::

### `src/routes/tasks/TaskList.svelte` <a id="list"></a>

:::annotate-code{lang=svelte collapsed}

```svelte
<script lang="ts">
	let { tasks } = $props<{ tasks: Task[] }>();
	const mutation = useOptimisticTasks(getQueryClient());
</script>

{#each tasks as t (t.id)}
	<li class:pending={t.pending}>
		<span>{t.title}</span>
		{#if t.pending}<small>saving…</small>{/if}
	</li>
{/each}
```

@7 warning: key by `t.id` is unstable when the temp UUID swaps for the server ID — Svelte will tear down + remount the row.

:::

## Suggested next steps

:::callout{severity=blocking title="Must fix before merge"}
Move idempotency-key generation into the mutation context so retries reuse the same key, and call `qc.cancelQueries(key)` at the top of `onMutate`.
:::

:::callout{severity=warning title="Worth a look"}
Switch list key from `t.id` to a stable `t.tempId ?? t.id` so the row doesn't remount on swap.
:::

:::details[Out of scope for this PR]

These came up in review but don't block the merge:

- Add a retry budget to `onError` so we don't hammer the API on flaky links.
- Surface a toast on permanent failure instead of silent rollback.
- Telemetry: log time-to-server-confirm so we can prove the perf win.

:::
