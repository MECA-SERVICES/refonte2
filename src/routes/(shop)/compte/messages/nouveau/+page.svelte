<script lang="ts">
	import { Input, Label, Select, Textarea } from 'flowbite-svelte';
	import Panel from '$lib/components/shop/Panel.svelte';
	import Breadcrumb from '$lib/components/shop/Breadcrumb.svelte';
	import ShopButton from '$lib/components/shop/ShopButton.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const dateFmt = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short' });

	/** Saisie précédente après une erreur, sinon le préremplissage. */
	const v = $derived(
		form?.values ?? {
			subject: data.defaults.subject,
			categoryId: String(
				data.categories.find((c) => c.code === data.defaults.categoryCode)?.id ?? ''
			),
			orderId: data.defaults.orderId,
			content: ''
		}
	);

	const inputClass =
		'rounded-[10px] border-shop-border bg-white focus:border-shop-blue focus:ring-0';
</script>

<svelte:head>
	<title>Nouveau message — MS Shop</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<Breadcrumb
	items={[
		{ label: 'Mon compte', href: '/compte' },
		{ label: 'Mes messages', href: '/compte/messages' },
		{ label: 'Nouveau message' }
	]}
/>

<h1 class="font-display text-2xl font-extrabold tracking-[-0.02em] text-shop-ink sm:text-[30px]">
	Nous contacter
</h1>
<p class="mt-1 text-sm text-shop-muted">
	Une question sur une pièce, une compatibilité, une commande ? Notre équipe vous répond ici.
</p>

{#if form?.message}
	<p
		class="mt-5 rounded-[10px] border-[1.5px] border-shop-red/40 bg-red-50 px-4 py-3 text-sm font-medium text-shop-red"
		role="alert"
	>
		{form.message}
	</p>
{/if}

<Panel class="mt-6 p-5 sm:p-6">
	<form method="POST" class="space-y-5">
		<div>
			<Label for="subject" class="mb-1.5">Objet *</Label>
			<Input
				id="subject"
				name="subject"
				value={v.subject}
				required
				maxlength={255}
				class={inputClass}
			/>
		</div>

		<div class="grid gap-4 sm:grid-cols-2">
			<div>
				<Label for="categoryId" class="mb-1.5">Votre demande concerne</Label>
				<Select
					id="categoryId"
					name="categoryId"
					value={v.categoryId}
					class={inputClass}
					items={[
						{ value: '', name: 'Choisir…' },
						...data.categories.map((c) => ({ value: String(c.id), name: c.label }))
					]}
				/>
			</div>
			<div>
				<Label for="orderId" class="mb-1.5">Commande concernée</Label>
				<Select
					id="orderId"
					name="orderId"
					value={v.orderId}
					class={inputClass}
					items={[
						{ value: '', name: 'Aucune' },
						...data.orders.map((o) => ({
							value: String(o.id),
							name: `${o.reference} — ${dateFmt.format(new Date(o.createdAt))}`
						}))
					]}
				/>
			</div>
		</div>

		<div>
			<Label for="content" class="mb-1.5">Votre message *</Label>
			<Textarea
				id="content"
				name="content"
				rows={8}
				value={v.content}
				required
				class="w-full {inputClass}"
				placeholder="Pour une question de compatibilité, indiquez la marque, le modèle et le numéro de série de votre machine."
			/>
		</div>

		<div class="flex flex-wrap gap-2">
			<ShopButton type="submit" variant="primary">Envoyer</ShopButton>
			<ShopButton href="/compte/messages" variant="outline">Annuler</ShopButton>
		</div>
	</form>
</Panel>
