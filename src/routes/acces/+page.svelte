<script lang="ts">
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
</script>

<svelte:head>
	<title>Accès réservé — MS Shop</title>
	<!-- Le site est en préparation : aucun moteur ne doit l'indexer. -->
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-shop-subtle px-4">
	<div class="w-full max-w-sm border-[1.5px] border-shop-ink bg-white p-8">
		<div class="flex items-center gap-3">
			<span
				class="flex h-11 w-11 items-center justify-center bg-shop-blue font-display text-base font-extrabold text-white"
			>
				MS
			</span>
			<span class="font-display text-lg font-extrabold text-shop-ink">MECA SERVICES</span>
		</div>

		<h1 class="mt-6 font-display text-xl font-extrabold text-shop-ink">Site en préparation</h1>
		<p class="mt-2 text-sm text-shop-muted">
			La nouvelle boutique est en cours de finalisation. Saisissez le mot de passe d'accès pour la
			consulter.
		</p>

		{#if form?.message}
			<p class="mt-4 border border-shop-red px-3 py-2 text-sm font-medium text-shop-red">
				{form.message}
			</p>
		{/if}

		<form method="POST" class="mt-6">
			<label for="password" class="mb-1.5 block text-xs font-bold text-shop-muted">
				Mot de passe
			</label>
			<input
				id="password"
				name="password"
				type="password"
				autocomplete="current-password"
				required
				class="w-full border-[1.5px] border-shop-border px-3.5 py-2.5 text-sm text-shop-ink focus:border-shop-ink focus:ring-0"
			/>

			<button
				type="submit"
				class="mt-4 w-full bg-shop-blue px-5 py-3 font-display text-[15px] font-bold text-white transition-colors hover:bg-shop-blue-dark"
			>
				Accéder au site
			</button>
		</form>

		<p class="mt-6 text-xs text-shop-muted">
			Meca Services — Carantilly (50) ·
			<a href="tel:0950922336" class="font-semibold text-shop-blue hover:underline">
				09 50 92 23 36
			</a>
		</p>
	</div>
</div>
