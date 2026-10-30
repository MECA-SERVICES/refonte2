import type { LayoutLoad } from './$types';
import { canAccess } from '$lib/roles';

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

/**
 * Menu réduit à ce que le rôle ouvre (`canAccess`) : un employé ne voit ni le
 * paramétrage ni l'équipe. Un groupe vidé disparaît, une section vide aussi.
 */
function visibleMenu(menu: AdminMenu, role: string | null): AdminMenu {
	const sections = menu.sections
		.map((section) => ({
			...section,
			items: section.items.flatMap((item) => {
				if (item.href) return canAccess(role, item.href) ? [item] : [];
				const items = (item.items ?? []).filter((link) => canAccess(role, link.href));
				return items.length ? [{ ...item, items }] : [];
			})
		}))
		.filter((section) => section.items.length);
	return { ...menu, sections };
}

export const load: LayoutLoad = async ({ fetch, data }) => {
	// `data` provient de +layout.server.ts (même niveau) et contient adminUser.
	const response = await fetch('/admin-menu.json');
	const menu: AdminMenu = await response.json();

	return {
		menu: visibleMenu(menu, data.adminUser?.role ?? null),
		adminUser: data.adminUser,
		supportUnread: data.supportUnread
	};
};
