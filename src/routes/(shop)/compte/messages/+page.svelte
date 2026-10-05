<script lang="ts">
	import Panel from '$lib/components/shop/Panel.svelte';
	import Breadcrumb from '$lib/components/shop/Breadcrumb.svelte';
	import Heading from '$lib/components/shop/Heading.svelte';
	import ShopButton from '$lib/components/shop/ShopButton.svelte';
	import { SUPPORT_CUSTOMER_STATUS } from '$lib/support';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const dateFmt = new Intl.DateTimeFormat('fr-FR', {
		day: 'numeric',
		month: 'long',
		year: 'numeric'
	});
</script>

<svelte:head>
	<title>Mes messages — MS Shop</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<Breadcrumb items={[{ label: 'Mon compte', href: '/compte' }, { label: 'Mes messages' }]} />

<div class="flex flex-wrap items-end justify-between gap-4">
	<div>
		<h1
			class="font-display text-2xl font-extrabold tracking-[-0.02em] text-shop-ink sm:text-[30px]"
		>
			Mes messages
		</h1>
		<p class="mt-1 text-sm text-shop-muted">Vos échanges avec notre service client.</p>
	</div>
	<ShopButton variant="primary" href="/compte/messages/nouveau">Nouveau message</ShopButton>
</div>

{#if data.threads.length === 0}
	<Panel class="mt-6 p-6">
		<Heading size="card">Aucun message</Heading>
		<p class="mt-2 max-w-[52ch] text-[14.5px] text-shop-muted">
			Une question sur une pièce, une commande ou une livraison ? Écrivez-nous, nous vous répondons
			ici.
		</p>
	</Panel>
{:else}
	<ul class="mt-6 space-y-3">
		{#each data.threads as t (t.id)}
			{@const status = SUPPORT_CUSTOMER_STATUS[t.status]}
			{@const unread = t.unreadByCustomer > 0}
			<li>
				<a
					href="/compte/messages/{t.id}"
					class="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border-[1.5px] bg-white px-5 py-4 transition-colors hover:border-shop-blue {unread
						? 'border-shop-orange'
						: 'border-shop-border-soft'}"
				>
					<div class="min-w-0 flex-1">
						<p class="flex items-center gap-2">
							{#if unread}
								<span
									class="h-2.5 w-2.5 shrink-0 rounded-full bg-shop-red"
									aria-label="Nouvelle réponse"
								></span>
							{/if}
							<span
								class="truncate font-display text-[15.5px] {unread
									? 'font-extrabold text-shop-ink'
									: 'font-bold text-shop-ink-soft'}"
							>
								{t.subject}
							</span>
						</p>
						<p class="mt-0.5 text-[13px] text-shop-muted">
							{t.reference}
							{#if t.orderReference}· Commande {t.orderReference}{/if}
							· {dateFmt.format(new Date(t.lastMessageAt))}
						</p>
					</div>
					<span class="rounded-full px-3 py-1 text-xs font-bold {status.tone}">
						{status.label}
					</span>
				</a>
			</li>
		{/each}
	</ul>
{/if}
