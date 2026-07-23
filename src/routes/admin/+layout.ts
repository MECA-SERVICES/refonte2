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

export const load: LayoutLoad = async ({ fetch }) => {
	const response = await fetch('/admin-menu.json');
	const menu: AdminMenu = await response.json();

	return { menu };
};
