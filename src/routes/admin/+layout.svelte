<script lang="ts">
	import { page } from '$app/state';
	import {
		Sidebar,
		SidebarGroup,
		SidebarItem,
		SidebarDropdownWrapper,
		Navbar,
		Avatar,
		Dropdown,
		DropdownHeader,
		DropdownItem,
		DropdownDivider
	} from 'flowbite-svelte';
	import {
		ChartPieSolid,
		ShoppingBagSolid,
		GridSolid,
		UsersSolid,
		HeadphonesSolid,
		ChartLineUpOutline,
		LayersSolid,
		PaletteSolid,
		TruckSolid,
		CreditCardSolid,
		GlobeSolid,
		CogSolid,
		ToolsOutline,
		BellSolid,
		SearchOutline,
		BarsOutline
	} from 'flowbite-svelte-icons';
	import type { Component } from 'svelte';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	// Mapping des icônes du JSON vers les composants flowbite-svelte-icons
	const iconMap: Record<string, Component> = {
		chart: ChartPieSolid,
		'shopping-bag': ShoppingBagSolid,
		grid: GridSolid,
		users: UsersSolid,
		headset: HeadphonesSolid,
		'chart-line': ChartLineUpOutline,
		puzzle: LayersSolid,
		palette: PaletteSolid,
		truck: TruckSolid,
		'credit-card': CreditCardSolid,
		globe: GlobeSolid,
		cog: CogSolid,
		tools: ToolsOutline
	};

	let sidebarOpen = $state(false);

	const activeUrl = $derived(page.url.pathname);

	const itemIconClass =
		'h-5 w-5 shrink-0 text-gray-400 transition duration-75 group-hover:text-white';
</script>

<div class="min-h-screen bg-gray-100 dark:bg-gray-900">
	<!-- Sidebar (style PrestaShop : sombre, fixe) -->
	<Sidebar
		{activeUrl}
		bind:isOpen={sidebarOpen}
		closeSidebar={() => (sidebarOpen = false)}
		breakpoint="lg"
		position="fixed"
		class="h-screen w-64 border-e border-gray-700 bg-gray-800"
		classes={{
			div: 'flex h-full flex-col overflow-y-auto bg-gray-800 px-3 py-4',
			nonactive:
				'group flex items-center rounded-md p-2 text-sm font-normal text-gray-300 hover:bg-gray-700 hover:text-white group-has-[ul]:ms-6',
			active:
				'group flex items-center rounded-md bg-cyan-600 p-2 text-sm font-medium text-white group-has-[ul]:ms-6'
		}}
	>
		<!-- Logo -->
		<a href="/admin" class="mb-4 flex items-center border-b border-gray-700 px-2 pb-4">
			<span class="text-xl font-semibold whitespace-nowrap text-white">
				{data.menu.brand}
			</span>
		</a>

		{#each data.menu.sections as section (section.id)}
			{#if section.label}
				<div class="mt-4 mb-1 px-2 text-xs font-semibold tracking-wider text-gray-500 uppercase">
					{section.label}
				</div>
			{/if}
			<SidebarGroup class="space-y-1">
				{#each section.items as item (item.id)}
					{#if item.items}
						<SidebarDropdownWrapper
							label={item.label}
							classes={{
								btn: 'group flex w-full items-center rounded-md p-2 text-sm font-normal text-gray-300 transition duration-75 hover:bg-gray-700 hover:text-white',
								span: 'ms-3 flex-1 text-left whitespace-nowrap',
								svg: 'h-3 w-3 text-gray-400',
								ul: 'space-y-1 py-1'
							}}
						>
							{#snippet icon()}
								{@const Icon = iconMap[item.icon]}
								<Icon class={itemIconClass} />
							{/snippet}
							{#each item.items as subItem (subItem.id)}
								<SidebarItem label={subItem.label} href={subItem.href} spanClass="ms-3 text-sm" />
							{/each}
						</SidebarDropdownWrapper>
					{:else}
						<SidebarItem label={item.label} href={item.href}>
							{#snippet icon()}
								{@const Icon = iconMap[item.icon]}
								<Icon class={itemIconClass} />
							{/snippet}
						</SidebarItem>
					{/if}
				{/each}
			</SidebarGroup>
		{/each}
	</Sidebar>

	<!-- Contenu principal -->
	<div class="flex min-h-screen flex-col lg:ms-64">
		<!-- Navbar du haut -->
		<Navbar
			fluid
			class="sticky top-0 z-30 border-b border-gray-200 bg-white px-4 py-2.5 dark:border-gray-700 dark:bg-gray-800"
		>
			<div class="flex w-full items-center justify-between">
				<div class="flex items-center gap-3">
					<!-- Hamburger (mobile) -->
					<button
						type="button"
						onclick={() => (sidebarOpen = !sidebarOpen)}
						aria-label="Ouvrir le menu"
						class="rounded-lg p-2 text-gray-600 hover:bg-gray-100 lg:hidden dark:text-gray-400 dark:hover:bg-gray-700"
					>
						<BarsOutline class="h-6 w-6" />
					</button>

					<!-- Recherche -->
					<form class="hidden lg:block">
						<label for="topbar-search" class="sr-only">Rechercher</label>
						<div class="relative lg:w-96">
							<div class="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3">
								<SearchOutline class="h-5 w-5 text-gray-500 dark:text-gray-400" />
							</div>
							<input
								type="text"
								id="topbar-search"
								class="focus:border-primary-500 focus:ring-primary-500 block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 ps-10 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
								placeholder="Rechercher..."
							/>
						</div>
					</form>
				</div>

				<div class="flex items-center gap-3">
					<!-- Notifications -->
					<button
						type="button"
						aria-label="Notifications"
						class="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
					>
						<BellSolid class="h-5 w-5" />
					</button>

					<!-- Menu utilisateur -->
					<Avatar id="avatar-menu" class="cursor-pointer" />
					<Dropdown simple triggeredBy="#avatar-menu" placement="bottom-end">
						<DropdownHeader>
							<span class="block text-sm">Admin User</span>
							<span class="block truncate text-sm font-medium">admin@msshop.com</span>
						</DropdownHeader>
						<DropdownItem href="/admin">Tableau de bord</DropdownItem>
						<DropdownItem href="/admin/administration">Paramètres</DropdownItem>
						<DropdownDivider />
						<DropdownItem>Déconnexion</DropdownItem>
					</Dropdown>
				</div>
			</div>
		</Navbar>

		<!-- Contenu de la page -->
		<main class="flex-1 p-4">
			{@render children()}
		</main>
	</div>
</div>
