<script lang="ts">
	import { Input, Label } from 'flowbite-svelte';
	import ShopButton from '$lib/components/shop/ShopButton.svelte';
	import Heading from '$lib/components/shop/Heading.svelte';
	import Breadcrumb from '$lib/components/shop/Breadcrumb.svelte';
	import Panel from '$lib/components/shop/Panel.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	/** Style v2 des champs : angles à 10 px, focus bleu de marque. */
	const inputClass =
		'rounded-[10px] border-shop-border bg-white focus:border-shop-blue focus:ring-0';

	const benefits = [
		'Historique et suivi de vos commandes',
		"Carnet d'adresses de livraison",
		'Comptes professionnels et collectivités : tarifs HT et mandat administratif'
	];
</script>

<svelte:head>
	<title>Connexion — MS Shop</title>
	<meta name="robots" content="noindex, follow" />
</svelte:head>

<Breadcrumb items={[{ label: 'Connexion' }]} />

<div class="mx-auto grid max-w-4xl gap-6 md:grid-cols-2 md:gap-8">
	<!-- ================= Connexion ================= -->
	<Panel padded={false} class="p-6 sm:p-8">
		<Heading as="h1" size="block">Je me connecte</Heading>
		<p class="mt-1 text-sm text-shop-muted">Accédez à votre compte et à vos commandes.</p>

		{#if form?.message}
			<p
				class="mt-4 rounded-[10px] bg-shop-promo px-4 py-3 text-sm font-semibold text-shop-orange-deep"
			>
				{form.message}
			</p>
		{/if}

		<form method="POST" class="mt-6 space-y-4">
			<input type="hidden" name="redirectTo" value={data.redirectTo} />

			<div>
				<Label for="email" class="mb-1.5">Adresse email</Label>
				<Input
					id="email"
					name="email"
					type="email"
					autocomplete="email"
					required
					value={form?.email ?? ''}
					placeholder="vous@exemple.fr"
					class={inputClass}
				/>
			</div>

			<div>
				<Label for="password" class="mb-1.5">Mot de passe</Label>
				<Input
					id="password"
					name="password"
					type="password"
					autocomplete="current-password"
					required
					class={inputClass}
				/>
			</div>

			<ShopButton type="submit" size="lg" block>Se connecter</ShopButton>
		</form>

		<p class="mt-4 text-xs text-shop-muted">
			La réinitialisation du mot de passe par email sera disponible prochainement. En cas de
			difficulté, appelez-nous au
			<a href="tel:0950922336" class="font-semibold text-shop-blue hover:underline">
				09 50 92 23 36
			</a>.
		</p>
	</Panel>

	<!-- ================= Création de compte ================= -->
	<Panel padded={false} class="p-6 sm:p-8">
		<Heading size="block">Je crée mon compte</Heading>
		<p class="mt-1 text-sm text-shop-muted">
			Suivez vos commandes, retrouvez vos factures et gagnez du temps à chaque achat.
		</p>

		<ul class="mt-5 space-y-2.5 text-sm text-shop-ink-soft">
			{#each benefits as benefit (benefit)}
				<li class="flex items-start gap-2.5">
					<span class="font-extrabold text-shop-green" aria-hidden="true">✓</span>
					{benefit}
				</li>
			{/each}
		</ul>

		<ShopButton href="/inscription" variant="outline" size="lg" block class="mt-6">
			Créer un compte
		</ShopButton>
	</Panel>
</div>
