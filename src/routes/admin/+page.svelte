<script lang="ts">
	import { Card, Heading, P } from 'flowbite-svelte';
</script>

<div class="h-full">
	<Card class="h-full w-full">
		<Heading tag="h1" class="mb-4 text-2xl font-bold text-gray-900 dark:text-white">
			Tableau de bord
		</Heading>

		<div class="space-y-4">
			<P class="text-gray-700 dark:text-gray-300">
				Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
			</P>

			<P class="text-gray-700 dark:text-gray-300">
				Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
			</P>

			<P class="text-gray-700 dark:text-gray-300">
				Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.
			</P>

			<div class="mt-6 rounded-lg bg-gray-50 p-6 dark:bg-gray-700">
				<Heading tag="h2" class="mb-3 text-xl font-semibold text-gray-900 dark:text-white">
					Bienvenue dans l'administration
				</Heading>
				<P class="text-gray-700 dark:text-gray-300">
					Cette interface d'administration vous permet de gérer tous les aspects de votre boutique e-commerce. Utilisez le menu de navigation à gauche pour accéder aux différentes sections.
				</P>
			</div>
		</div>
	</Card>
</div>