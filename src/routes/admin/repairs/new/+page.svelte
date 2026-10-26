<script lang="ts">
	import { enhance } from '$lib/components/admin/feedback.svelte';
	import { Alert, Button, Card, Input, Label, Radio, Select, Textarea } from 'flowbite-svelte';
	import { UserAddOutline } from 'flowbite-svelte-icons';
	import PageHeader from '$lib/components/admin/PageHeader.svelte';
	import type { SubmitFunction } from '@sveltejs/kit';
	import type { PageData, PageProps } from './$types';

	let { data, form }: PageProps = $props();

	type CustomerOption = PageData['customers'][number];

	/** Prise en charge : la garantie exige une référence de dossier (R14). */
	let orderType = $state<'paid' | 'warranty'>('paid');
	let customerId = $state('');

	/** Saisie d'un nouveau client, ouverte sur demande. */
	let creatingCustomer = $state(false);
	let newCustomerType = $state('particulier');
	/** Client tout juste créé : gardé dans la liste quoi que donne la recherche. */
	let createdCustomer = $state<CustomerOption | null>(null);

	const customerOptions = $derived(
		createdCustomer && !data.customers.some((c) => c.id === createdCustomer?.id)
			? [createdCustomer, ...data.customers]
			: data.customers
	);

	const customerItems = $derived(
		customerOptions.map((c) => ({
			value: String(c.id),
			name:
				[c.companyName, [c.firstName, c.lastName].filter(Boolean).join(' ')]
					.filter(Boolean)
					.join(' — ') + ` (${c.email})`
		}))
	);

	/** Le client créé est aussitôt sélectionné ; la saisie de l'ordre reste intacte. */
	const onCustomerCreated: SubmitFunction =
		() =>
		async ({ result, update }) => {
			await update();
			if (result.type === 'success' && result.data?.createdCustomer) {
				createdCustomer = result.data.createdCustomer as CustomerOption;
				customerId = String(createdCustomer.id);
				creatingCustomer = false;
			}
		};
</script>

<PageHeader title="Nouvel ordre de réparation" subtitle="Intervention au comptoir" />

<form method="POST" action="?/create" use:enhance class="space-y-6">
	{#if form && 'message' in form && form.message}
		<Alert color="red">{form.message}</Alert>
	{/if}

	<!-- ===== Client ===== -->
	<Card class="max-w-none p-6">
		<h2 class="mb-1 text-lg font-semibold text-gray-900 dark:text-white">Client</h2>
		<p class="mb-4 text-xs text-gray-500 dark:text-gray-400">
			Recherchez le client, ou créez-le s'il n'existe pas encore. L'accord sur les travaux est
			recueilli à l'atelier.
		</p>

		<!--
			Recherche en GET séparée du formulaire principal : la liste complète des
			clients est trop volumineuse pour une liste déroulante.
		-->
		<div class="mb-4 flex gap-2">
			<Input
				name="client"
				form="customer-search"
				value={data.customerSearch}
				placeholder="Rechercher par nom, société ou adresse électronique"
				class="flex-1"
			/>
			<Button type="submit" form="customer-search" size="sm" color="alternative">Rechercher</Button>
		</div>

		{#if data.customerSearch && data.customers.length === 0}
			<p class="mb-3 text-sm text-gray-500 dark:text-gray-400">Aucun client ne correspond.</p>
		{/if}

		<div>
			<Label for="customerId" class="mb-2">Client propriétaire</Label>
			<Select
				id="customerId"
				name="customerId"
				bind:value={customerId}
				placeholder="Sélectionnez un client"
				items={customerItems}
				disabled={customerItems.length === 0}
			/>
		</div>

		{#if !creatingCustomer}
			<Button
				type="button"
				size="sm"
				color="alternative"
				class="mt-4"
				onclick={() => (creatingCustomer = true)}
			>
				<UserAddOutline class="me-2 h-4 w-4" /> Nouveau client
			</Button>
		{:else}
			<!--
				Champs rattachés au formulaire « new-customer » (attribut `form`) : ils
				ne partent pas avec l'ordre, et l'ordre en cours de saisie est conservé.
			-->
			<div class="mt-4 rounded-lg border border-gray-200 p-4 dark:border-gray-700">
				<h3 class="mb-3 text-sm font-semibold text-gray-900 dark:text-white">Nouveau client</h3>
				{#if form && 'customerError' in form && form.customerError}
					<Alert color="red" class="mb-3">{form.customerError}</Alert>
				{/if}
				<div class="grid gap-4 sm:grid-cols-2">
					<div>
						<Label for="newFirstName" class="mb-2">Prénom</Label>
						<Input id="newFirstName" name="firstName" form="new-customer" required />
					</div>
					<div>
						<Label for="newLastName" class="mb-2">Nom</Label>
						<Input id="newLastName" name="lastName" form="new-customer" required />
					</div>
					<div>
						<Label for="newEmail" class="mb-2">Adresse e-mail</Label>
						<Input id="newEmail" name="email" type="email" form="new-customer" required />
					</div>
					<div>
						<Label for="newPhone" class="mb-2">Téléphone</Label>
						<Input id="newPhone" name="phone" type="tel" form="new-customer" />
					</div>
					<div>
						<Label for="newType" class="mb-2">Type de client</Label>
						<Select
							id="newType"
							name="type"
							form="new-customer"
							placeholder=""
							bind:value={newCustomerType}
							items={[
								{ value: 'particulier', name: 'Particulier' },
								{ value: 'entreprise', name: 'Entreprise' },
								{ value: 'collectivite', name: 'Collectivité' }
							]}
						/>
					</div>
					{#if newCustomerType !== 'particulier'}
						<div>
							<Label for="newCompanyName" class="mb-2">Raison sociale</Label>
							<Input id="newCompanyName" name="companyName" form="new-customer" />
						</div>
					{/if}
				</div>
				<p class="mt-3 text-xs text-gray-500 dark:text-gray-400">
					L'adresse e-mail sert d'identifiant au compte client. Le client choisira son mot de passe
					avec « Mot de passe oublié ».
				</p>
				<div class="mt-4 flex justify-end gap-2">
					<Button
						type="button"
						size="sm"
						color="alternative"
						onclick={() => (creatingCustomer = false)}
					>
						Annuler
					</Button>
					<Button type="submit" size="sm" form="new-customer">Créer et sélectionner</Button>
				</div>
			</div>
		{/if}
	</Card>

	<!-- ===== Prise en charge ===== -->
	<Card class="max-w-none p-6">
		<h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Prise en charge</h2>

		<div class="mb-4 max-w-xs">
			<Label for="workshopLabel" class="mb-2">Étiquette</Label>
			<Input id="workshopLabel" name="workshopLabel" placeholder="N° de l'étiquette atelier" />
			<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
				Numéro de l'étiquette posée sur la machine. Modifiable ensuite.
			</p>
		</div>

		<div class="mb-4 flex gap-6">
			<Radio name="orderType" value="paid" bind:group={orderType}>Payante</Radio>
			<Radio name="orderType" value="warranty" bind:group={orderType}>Sous garantie</Radio>
		</div>

		{#if orderType === 'warranty'}
			<div>
				<Label for="warrantyReference" class="mb-2">Référence du dossier de garantie</Label>
				<Input id="warrantyReference" name="warrantyReference" required />
				<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
					Les montants restent calculés pour le suivi, mais rien n'est facturé au client.
				</p>
			</div>
		{/if}
	</Card>

	<!-- ===== Machine ===== -->
	<Card class="max-w-none p-6">
		<h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Machine</h2>
		<div class="grid gap-4 sm:grid-cols-2">
			<div>
				<Label for="machineType" class="mb-2">Type de matériel</Label>
				<Select
					id="machineType"
					name="machineType"
					placeholder="Non précisé"
					items={data.equipmentTypes.map((t) => ({ value: t, name: t }))}
				/>
			</div>
			<div>
				<Label for="machineBrand" class="mb-2">Marque</Label>
				<Input id="machineBrand" name="machineBrand" />
			</div>
			<div>
				<Label for="machineModel" class="mb-2">Modèle</Label>
				<Input id="machineModel" name="machineModel" />
			</div>
			<div>
				<Label for="serialNumber" class="mb-2">Numéro de série</Label>
				<Input id="serialNumber" name="serialNumber" />
			</div>
			<div>
				<Label for="engineModel" class="mb-2">Modèle du moteur</Label>
				<Input id="engineModel" name="engineModel" />
			</div>
			<div>
				<Label for="engineSerialNumber" class="mb-2">Numéro de série du moteur</Label>
				<Input id="engineSerialNumber" name="engineSerialNumber" />
			</div>
			<div class="sm:col-span-2">
				<Label for="machineCondition" class="mb-2">État constaté à la prise en charge</Label>
				<Textarea class="w-full" id="machineCondition" name="machineCondition" rows={2} />
			</div>
		</div>
	</Card>

	<!-- ===== Travaux et montants ===== -->
	<Card class="max-w-none p-6">
		<h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Travaux et montants</h2>
		<div class="space-y-4">
			<div>
				<Label for="workDescription" class="mb-2">Description des travaux</Label>
				<Textarea class="w-full" id="workDescription" name="workDescription" rows={3} />
				<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
					Peut être complétée en cours d'intervention. Obligatoire avant l'achèvement.
				</p>
			</div>

			<div class="grid gap-4 sm:grid-cols-2">
				<div>
					<Label for="diagnosticFee" class="mb-2">Frais de diagnostic HT (€)</Label>
					<Input id="diagnosticFee" name="diagnosticFee" type="number" step="0.01" min="0" />
				</div>
				<div>
					<Label for="laborAmount" class="mb-2">Main-d'œuvre HT (€)</Label>
					<Input id="laborAmount" name="laborAmount" type="number" step="0.01" min="0" />
				</div>
			</div>
		</div>
	</Card>

	<!-- ===== Notes ===== -->
	<Card class="max-w-none p-6">
		<h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Notes</h2>
		<div class="space-y-4">
			<div>
				<Label for="notes" class="mb-2">Note visible du client</Label>
				<Textarea class="w-full" id="notes" name="notes" rows={2} />
			</div>
			<div>
				<Label for="privateNote" class="mb-2">Note interne</Label>
				<Textarea class="w-full" id="privateNote" name="privateNote" rows={2} />
				<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
					Jamais visible du client ni portée sur un document.
				</p>
			</div>
		</div>
	</Card>

	<div class="flex justify-end gap-3">
		<Button color="alternative" href="/admin/repairs">Annuler</Button>
		<Button type="submit">Créer l'ordre</Button>
	</div>
</form>

<!-- Recherche client : formulaire GET distinct, hors de la soumission principale. -->
<form id="customer-search" method="GET"></form>

<!-- Création d'un client au comptoir : champs rattachés depuis le bloc « Client ». -->
<form
	id="new-customer"
	method="POST"
	action="?/createCustomer"
	use:enhance={onCustomerCreated}
	data-success="Client créé et sélectionné."
></form>
