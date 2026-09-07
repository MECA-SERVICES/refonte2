<script lang="ts">
	import { Button, Input, Label } from 'flowbite-svelte';
	import Breadcrumb from '$lib/components/shop/Breadcrumb.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<svelte:head>
	<title>Connexion — MS Shop</title>
	<meta name="robots" content="noindex, follow" />
</svelte:head>

<Breadcrumb items={[{ label: 'Connexion' }]} />

<div class="mx-auto grid max-w-4xl gap-8 md:grid-cols-2 md:gap-10">
	<!-- ================= Connexion ================= -->
	<section class="border-[1.5px] border-shop-border bg-white p-6 sm:p-8">
		<h1 class="font-display text-xl font-extrabold tracking-tight text-shop-ink">Je me connecte</h1>
		<p class="mt-1 text-sm text-shop-muted">Accédez à votre compte et à vos commandes.</p>

		{#if form?.message}
			<p class="mt-4 border border-shop-red bg-white px-4 py-3 text-sm font-medium text-shop-red">
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
				/>
			</div>

			<Button type="submit" size="lg" class="w-full">Se connecter</Button>
		</form>

		<p class="mt-4 text-xs text-shop-muted">
			La réinitialisation du mot de passe par email sera disponible prochainement. En cas de
			difficulté, appelez-nous au
			<a href="tel:0950922336" class="font-semibold text-shop-blue hover:underline">
				09 50 92 23 36
			</a>.
		</p>
	</section>

	<!-- ================= Création de compte ================= -->
	<section class="border-[1.5px] border-shop-border bg-white p-6 sm:p-8">
		<h2 class="font-display text-xl font-extrabold tracking-tight text-shop-ink">
			Je crée mon compte
		</h2>
		<p class="mt-1 text-sm text-shop-muted">
			Suivez vos commandes, retrouvez vos factures et gagnez du temps à chaque achat.
		</p>

		<ul class="mt-5 space-y-2 text-sm text-shop-muted">
			<li>· Historique et suivi de vos commandes</li>
			<li>· Carnet d'adresses de livraison</li>
			<li>· Comptes professionnels et collectivités : tarifs HT et mandat administratif</li>
		</ul>

		<Button href="/inscription" size="lg" color="alternative" class="mt-6 w-full">
			Créer un compte
		</Button>
	</section>
</div>
