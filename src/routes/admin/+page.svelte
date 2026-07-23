<script lang="ts">
	import { Button, Card, Heading, P } from 'flowbite-svelte';
	import {
		BellOutline,
		CartOutline,
		ChartOutline,
		CogOutline,
		EditOutline,
		EnvelopeOutline,
		HomeOutline,
		TrashBinOutline,
		UserCircleSolid
	} from 'flowbite-svelte-icons';
	import {
		ManCarServiceRepairing,
		ManCarServiceRepairingDark,
		CreditCardPaymentReceipt,
		CreditCardPaymentReceiptDark
	} from 'flowbite-svelte-illustrations';
</script>

<div class="space-y-8 p-8">
	<Heading tag="h1" class="text-3xl">Admin</Heading>

	<section class="space-y-4">
		<Heading tag="h2" class="text-xl">Démo Boutons</Heading>
		<div class="flex flex-wrap gap-2">
			<Button>Default</Button>
			<Button color="alternative">Alternative</Button>
			<Button color="dark">Dark</Button>
			<Button color="light">Light</Button>
			<Button color="blue">Blue</Button>
			<Button color="green">Green</Button>
			<Button color="red">Red</Button>
			<Button color="yellow">Yellow</Button>
			<Button color="purple">Purple</Button>
		</div>
	</section>

	<section class="space-y-4">
		<Heading tag="h2" class="text-xl">Démo Icons</Heading>
		<div class="flex flex-wrap items-center gap-4 text-gray-700 dark:text-gray-300">
			<HomeOutline class="h-6 w-6" />
			<UserCircleSolid class="h-6 w-6" />
			<CartOutline class="h-6 w-6" />
			<ChartOutline class="h-6 w-6" />
			<BellOutline class="h-6 w-6" />
			<CogOutline class="h-6 w-6" />
			<EnvelopeOutline class="h-6 w-6" />
			<EditOutline class="h-6 w-6" />
			<TrashBinOutline class="h-6 w-6" />
		</div>
		<div class="flex flex-wrap gap-2">
			<Button>
				<CartOutline class="me-2 h-5 w-5" />
				Ajouter au panier
			</Button>
			<Button color="red" outline>
				<TrashBinOutline class="me-2 h-5 w-5" />
				Supprimer
			</Button>
		</div>
	</section>

	<section class="space-y-4">
		<Heading tag="h2" class="text-xl">Démo Illustrations</Heading>
		<div class="flex flex-wrap gap-6">
			<Card class="items-center p-6">
				<div class="dark:hidden">
					<ManCarServiceRepairing />
				</div>
				<div class="hidden dark:block">
					<ManCarServiceRepairingDark />
				</div>
				<P class="mt-4 text-center font-medium">Atelier mécanique</P>
			</Card>
			<Card class="items-center p-6">
				<div class="dark:hidden">
					<CreditCardPaymentReceipt
						title={{ id: 'paiement-title', title: 'Paiement par carte' }}
						desc={{ id: 'paiement-desc', desc: 'Illustration de paiement par carte bancaire' }}
					/>
				</div>
				<div class="hidden dark:block">
					<CreditCardPaymentReceiptDark />
				</div>
				<P class="mt-4 text-center font-medium">Paiement sécurisé</P>
			</Card>
		</div>
	</section>
</div>