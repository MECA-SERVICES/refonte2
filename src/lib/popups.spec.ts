import { describe, expect, it } from 'vitest';
import { dismissKey, isDismissed, isLive, matchesPath } from './popups';

describe('matchesPath', () => {
	it('couvre tout le site en portée « all »', () => {
		expect(matchesPath('all', null, '/')).toBe(true);
		expect(matchesPath('all', null, '/blog/article')).toBe(true);
	});

	it('ne vise que la racine en portée « home »', () => {
		expect(matchesPath('home', null, '/')).toBe(true);
		expect(matchesPath('home', null, '/panier')).toBe(false);
	});

	it('compare les adresses listées, une par ligne', () => {
		const paths = '/panier\n/commande';
		expect(matchesPath('paths', paths, '/panier')).toBe(true);
		expect(matchesPath('paths', paths, '/commande')).toBe(true);
		expect(matchesPath('paths', paths, '/blog')).toBe(false);
	});

	it('traite l’astérisque final comme un préfixe', () => {
		expect(matchesPath('paths', '/blog*', '/blog')).toBe(true);
		expect(matchesPath('paths', '/blog*', '/blog/categorie/entretien')).toBe(true);
		expect(matchesPath('paths', '/blog*', '/panier')).toBe(false);
	});

	it('ignore la barre finale et les espaces de saisie', () => {
		expect(matchesPath('paths', '  /panier  ', '/panier')).toBe(true);
		expect(matchesPath('paths', '/panier/', '/panier')).toBe(true);
	});

	it('n’affiche rien si aucune page n’est ciblée', () => {
		// Le contraire ferait apparaître la pop-up partout, à l'opposé de
		// l'intention d'un ciblage.
		expect(matchesPath('paths', null, '/')).toBe(false);
		expect(matchesPath('paths', '   \n  ', '/')).toBe(false);
	});
});

describe('isLive', () => {
	const now = new Date('2026-08-10T12:00:00Z');

	it('exclut une pop-up inactive, même dans sa fenêtre', () => {
		expect(isLive({ isActive: false, startsAt: null, endsAt: null }, now)).toBe(false);
	});

	it('diffuse sans bornes jusqu’à désactivation', () => {
		expect(isLive({ isActive: true, startsAt: null, endsAt: null }, now)).toBe(true);
	});

	it('respecte la date de début', () => {
		expect(isLive({ isActive: true, startsAt: '2026-08-01', endsAt: null }, now)).toBe(true);
		expect(isLive({ isActive: true, startsAt: '2026-09-01', endsAt: null }, now)).toBe(false);
	});

	it('respecte la date de fin', () => {
		expect(isLive({ isActive: true, startsAt: null, endsAt: '2026-08-31' }, now)).toBe(true);
		expect(isLive({ isActive: true, startsAt: null, endsAt: '2026-08-01' }, now)).toBe(false);
	});

	it('n’accepte que l’intérieur d’une fenêtre fermée', () => {
		const within = { isActive: true, startsAt: '2026-08-01', endsAt: '2026-08-31' };
		expect(isLive(within, now)).toBe(true);
		expect(isLive(within, new Date('2026-07-15T12:00:00Z'))).toBe(false);
		expect(isLive(within, new Date('2026-09-15T12:00:00Z'))).toBe(false);
	});
});

describe('isDismissed', () => {
	const now = new Date('2026-08-10T12:00:00Z');
	const threeDaysAgo = String(now.getTime() - 3 * 86_400_000);

	it('tait la pop-up pendant le délai choisi', () => {
		expect(isDismissed(threeDaysAgo, 7, now)).toBe(true);
	});

	it('la réaffiche le délai écoulé', () => {
		expect(isDismissed(threeDaysAgo, 2, now)).toBe(false);
	});

	it('ne tait rien si la pop-up n’a jamais été fermée', () => {
		expect(isDismissed(null, 7, now)).toBe(false);
	});

	it('réaffiche à chaque visite quand le délai est nul', () => {
		expect(isDismissed(threeDaysAgo, 0, now)).toBe(false);
	});

	it('réaffiche plutôt que de taire sur une valeur illisible', () => {
		// Dans le doute, mieux vaut montrer l'annonce que la perdre.
		expect(isDismissed('pas-une-date', 7, now)).toBe(false);
	});
});

describe('dismissKey', () => {
	it('isole chaque pop-up dans sa propre clé', () => {
		expect(dismissKey(1)).not.toBe(dismissKey(2));
		expect(dismissKey(42)).toContain('42');
	});
});
