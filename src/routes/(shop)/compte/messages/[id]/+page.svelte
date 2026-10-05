<script lang="ts">
	import { enhance } from '$app/forms';
	import { Textarea } from 'flowbite-svelte';
	import { PaperClipOutline } from 'flowbite-svelte-icons';
	import Panel from '$lib/components/shop/Panel.svelte';
	import Breadcrumb from '$lib/components/shop/Breadcrumb.svelte';
	import ShopButton from '$lib/components/shop/ShopButton.svelte';
	import { SUPPORT_CUSTOMER_STATUS } from '$lib/support';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const t = $derived(data.thread);
	const status = $derived(SUPPORT_CUSTOMER_STATUS[t.status]);

	const dateFmt = new Intl.DateTimeFormat('fr-FR', {
		day: 'numeric',
		month: 'long',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	});

	let content = $state('');
</script>

<svelte:head>
	<title>{t.subject} — MS Shop</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<Breadcrumb
	items={[
		{ label: 'Mon compte', href: '/compte' },
		{ label: 'Mes messages', href: '/compte/messages' },
		{ label: t.reference }
	]}
/>

<div class="flex flex-wrap items-start justify-between gap-3">
	<div class="min-w-0">
		<h1
			class="font-display text-2xl font-extrabold tracking-[-0.02em] text-balance text-shop-ink sm:text-[28px]"
		>
			{t.subject}
		</h1>
		<p class="mt-1 text-sm text-shop-muted">
			{t.reference}
			{#if t.categoryLabel}· {t.categoryLabel}{/if}
			{#if t.order}
				· Commande
				<a
					href="/compte/commandes/{t.order.id}"
					class="font-semibold text-shop-blue hover:underline"
				>
					{t.order.reference}
				</a>
			{/if}
		</p>
	</div>
	<span class="rounded-full px-3 py-1 text-xs font-bold {status.tone}">{status.label}</span>
</div>

{#if t.previous}
	<p class="mt-3 text-sm text-shop-muted">
		Suite de votre demande
		<a href="/compte/messages/{t.previous.id}" class="font-semibold text-shop-blue hover:underline">
			{t.previous.reference}
		</a>
	</p>
{/if}

<!-- ================= Fil ================= -->
<ol class="mt-6 space-y-4">
	{#each t.messages as m (m.id)}
		<li class="flex {m.fromTeam ? 'justify-start' : 'justify-end'}">
			<div
				class="max-w-[85%] rounded-[14px] border-[1.5px] px-4 py-3 text-[14.5px] {m.fromTeam
					? 'border-primary-200 bg-primary-50'
					: 'border-shop-border-soft bg-white'}"
			>
				<p class="mb-1.5 flex flex-wrap gap-x-2 text-xs text-shop-muted">
					<span class="font-bold text-shop-ink">{m.fromTeam ? m.author : 'Vous'}</span>
					<time>{dateFmt.format(new Date(m.createdAt))}</time>
				</p>
				<div class="message-body leading-relaxed break-words text-shop-ink-soft">
					<!-- eslint-disable-next-line svelte/no-at-html-tags -- assaini côté serveur -->
					{@html m.html}
				</div>
				{#if m.files.length}
					<ul class="mt-2 space-y-0.5">
						{#each m.files as file (file)}
							<li class="flex items-center gap-1.5 text-xs text-shop-muted">
								<PaperClipOutline class="h-3.5 w-3.5" />
								{file}
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		</li>
	{/each}
</ol>

{#if t.followUps.length}
	<p class="mt-4 text-sm text-shop-muted">
		Cette demande continue dans
		{#each t.followUps as f, i (f.id)}
			{#if i > 0},
			{/if}
			<a href="/compte/messages/{f.id}" class="font-semibold text-shop-blue hover:underline">
				{f.reference}
			</a>
		{/each}
	</p>
{/if}

<!-- ================= Réponse ================= -->
<Panel class="mt-6 p-5">
	<h2 class="font-display text-[17px] font-extrabold text-shop-ink">Répondre</h2>
	{#if t.status === 'closed'}
		<p class="mt-1 text-[13.5px] text-shop-muted">
			Cette demande est clôturée. Votre message la relancera auprès de notre équipe.
		</p>
	{/if}
	{#if form?.message}
		<p
			class="mt-3 rounded-[10px] border-[1.5px] border-shop-red/40 bg-red-50 px-4 py-3 text-sm font-medium text-shop-red"
			role="alert"
		>
			{form.message}
		</p>
	{/if}
	<form
		method="POST"
		action="?/reply"
		use:enhance={() =>
			async ({ result, update }) => {
				await update();
				if (result.type === 'success') content = '';
			}}
		class="mt-3 space-y-3"
	>
		<Textarea
			name="content"
			rows={5}
			bind:value={content}
			required
			placeholder="Votre message…"
			class="w-full rounded-[10px] border-shop-border bg-white focus:border-shop-blue focus:ring-0"
		/>
		<ShopButton type="submit" variant="primary">Envoyer</ShopButton>
	</form>
</Panel>

<style>
	.message-body :global(p) {
		margin: 0 0 0.5rem;
	}
	.message-body :global(p:last-child) {
		margin-bottom: 0;
	}
	.message-body :global(a) {
		text-decoration: underline;
	}
</style>
