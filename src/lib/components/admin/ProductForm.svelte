<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { Card, Label, Input, Textarea, Select, Toggle, Button, Alert } from 'flowbite-svelte';
	import type { Product } from '$lib/server/db/catalog.schema';

	let {
		product,
		brandOptions,
		categoryOptions,
		taxOptions,
		message,
		submitLabel = 'Enregistrer',
		action
	}: {
		product?: Partial<Product>;
		brandOptions: { value: string; name: string }[];
		categoryOptions: { value: string; name: string }[];
		taxOptions: { value: string; name: string; rate: number }[];
		message?: string;
		submitLabel?: string;
		action?: string;
	} = $props();

	function val(n: number | string | null | undefined): string {
		return n === null || n === undefined ? '' : String(n);
	}

	// Prix HT saisi + taux sélectionné → aperçu TTC en direct.
	// untrack : on ne capture que la valeur initiale (le produit ne change pas pendant l'édition).
	let priceHt = $state(untrack(() => val(product?.priceHt)));
	let taxRuleId = $state(untrack(() => val(product?.taxRuleId)));

	const selectedRate = $derived(taxOptions.find((t) => t.value === taxRuleId)?.rate ?? 0);
	const ttcPreview = $derived(
		priceHt && !Number.isNaN(Number(priceHt))
			? (Number(priceHt) * (1 + selectedRate / 100)).toFixed(2)
			: null
	);
</script>

<form method="POST" {action} use:enhance class="space-y-6">
	{#if message}
		<Alert color="red">{message}</Alert>
	{/if}

	<!-- Général -->
	<Card class="max-w-4xl p-6">
		<h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Général</h2>
		<div class="grid gap-4 sm:grid-cols-2">
			<div class="sm:col-span-2">
				<Label for="name" class="mb-2">Nom du produit</Label>
				<Input id="name" name="name" required value={product?.name ?? ''} />
			</div>
			<div>
				<Label for="reference" class="mb-2">Référence (SKU)</Label>
				<Input id="reference" name="reference" required value={product?.reference ?? ''} />
			</div>
			<div>
				<Label for="supplierReference" class="mb-2">Référence fournisseur</Label>
				<Input
					id="supplierReference"
					name="supplierReference"
					value={product?.supplierReference ?? ''}
				/>
			</div>
			<div>
				<Label for="ean13" class="mb-2">Code-barres (EAN13)</Label>
				<Input id="ean13" name="ean13" value={product?.ean13 ?? ''} maxlength={13} />
			</div>
			<div>
				<Label for="brandId" class="mb-2">Marque</Label>
				<Select
					id="brandId"
					name="brandId"
					placeholder=""
					value={val(product?.brandId)}
					items={[{ value: '', name: 'Aucune' }, ...brandOptions]}
				/>
			</div>
			<div>
				<Label for="categoryId" class="mb-2">Catégorie principale</Label>
				<Select
					id="categoryId"
					name="categoryId"
					placeholder=""
					value={val(product?.categoryId)}
					items={[{ value: '', name: 'Aucune' }, ...categoryOptions]}
				/>
			</div>
			<div class="flex items-end">
				<Toggle name="isActive" checked={product?.isActive ?? true}>Produit actif</Toggle>
			</div>
		</div>
	</Card>

	<!-- Tarification -->
	<Card class="max-w-4xl p-6">
		<h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Tarification</h2>
		<div class="grid gap-4 sm:grid-cols-3">
			<div>
				<Label for="priceHt" class="mb-2">Prix HT (€)</Label>
				<Input
					id="priceHt"
					name="priceHt"
					type="number"
					step="0.01"
					required
					bind:value={priceHt}
				/>
			</div>
			<div>
				<Label for="taxRuleId" class="mb-2">TVA</Label>
				<Select
					id="taxRuleId"
					name="taxRuleId"
					placeholder=""
					bind:value={taxRuleId}
					items={[
						{ value: '', name: 'Aucune' },
						...taxOptions.map((t) => ({ value: t.value, name: t.name }))
					]}
				/>
			</div>
			<div>
				<Label class="mb-2">Prix TTC (aperçu)</Label>
				<div
					class="flex h-10 items-center rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm font-medium text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
				>
					{ttcPreview ? `${ttcPreview} €` : '—'}
				</div>
			</div>
			<div>
				<Label for="priceHtStrike" class="mb-2">Prix barré HT (€)</Label>
				<Input
					id="priceHtStrike"
					name="priceHtStrike"
					type="number"
					step="0.01"
					value={val(product?.priceHtStrike)}
				/>
			</div>
			<div>
				<Label for="purchasePrice" class="mb-2">Prix d'achat HT (€)</Label>
				<Input
					id="purchasePrice"
					name="purchasePrice"
					type="number"
					step="0.01"
					value={val(product?.purchasePrice)}
				/>
			</div>
		</div>
	</Card>

	<!-- Stock & logistique -->
	<Card class="max-w-4xl p-6">
		<h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Stock & logistique</h2>
		<div class="grid gap-4 sm:grid-cols-3">
			<div>
				<Label for="stock" class="mb-2">Stock</Label>
				<Input id="stock" name="stock" type="number" value={val(product?.stock ?? 0)} />
			</div>
			<div>
				<Label for="weightKg" class="mb-2">Poids (kg)</Label>
				<Input
					id="weightKg"
					name="weightKg"
					type="number"
					step="0.001"
					value={val(product?.weightKg)}
				/>
			</div>
			<div>
				<Label for="shippingExtraFee" class="mb-2">Frais de port sup. (€)</Label>
				<Input
					id="shippingExtraFee"
					name="shippingExtraFee"
					type="number"
					step="0.01"
					value={val(product?.shippingExtraFee)}
				/>
			</div>
			<div>
				<Label for="lengthCm" class="mb-2">Longueur (cm)</Label>
				<Input
					id="lengthCm"
					name="lengthCm"
					type="number"
					step="0.01"
					value={val(product?.lengthCm)}
				/>
			</div>
			<div>
				<Label for="widthCm" class="mb-2">Largeur (cm)</Label>
				<Input
					id="widthCm"
					name="widthCm"
					type="number"
					step="0.01"
					value={val(product?.widthCm)}
				/>
			</div>
			<div>
				<Label for="heightCm" class="mb-2">Hauteur (cm)</Label>
				<Input
					id="heightCm"
					name="heightCm"
					type="number"
					step="0.01"
					value={val(product?.heightCm)}
				/>
			</div>
		</div>
	</Card>

	<!-- SEO & descriptions -->
	<Card class="max-w-4xl p-6">
		<h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white">SEO & descriptions</h2>
		<div class="space-y-4">
			<div>
				<Label for="slug" class="mb-2">Slug (optionnel)</Label>
				<Input id="slug" name="slug" value={product?.slug ?? ''} />
			</div>
			<div>
				<Label for="shortDescription" class="mb-2">Description courte</Label>
				<Textarea
					id="shortDescription"
					name="shortDescription"
					rows={2}
					value={product?.shortDescription ?? ''}
				/>
			</div>
			<div>
				<Label for="description" class="mb-2">Description longue</Label>
				<Textarea id="description" name="description" rows={5} value={product?.description ?? ''} />
			</div>
			<div>
				<Label for="metaTitle" class="mb-2">Meta title</Label>
				<Input id="metaTitle" name="metaTitle" value={product?.metaTitle ?? ''} />
			</div>
			<div>
				<Label for="metaDescription" class="mb-2">Meta description</Label>
				<Textarea
					id="metaDescription"
					name="metaDescription"
					rows={2}
					value={product?.metaDescription ?? ''}
				/>
			</div>
		</div>
	</Card>

	<div class="flex max-w-4xl justify-end gap-3">
		<Button color="alternative" href="/admin/products">Annuler</Button>
		<Button type="submit">{submitLabel}</Button>
	</div>
</form>
