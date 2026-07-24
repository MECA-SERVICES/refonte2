import type { LayoutLoad } from './$types';

export interface AdminMenuLink {
	id: string;
	label: string;
	href: string;
}

export interface AdminMenuItem {
	id: string;
	label: string;
	icon: string;
	href?: string;
	items?: AdminMenuLink[];
}

export interface AdminMenuSection {
	id: string;
	label: string | null;
	items: AdminMenuItem[];
}

export interface AdminMenu {
	brand: string;
	sections: AdminMenuSection[];
}

export const load: LayoutLoad = async ({ fetch, data }) => {
	// `data` provient de +layout.server.ts (même niveau) et contient adminUser.
	const response = await fetch('/admin-menu.json');
	const menu: AdminMenu = await response.json();

	return { menu, adminUser: data.adminUser };
};
