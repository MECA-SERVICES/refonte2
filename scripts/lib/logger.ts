/**
 * Journalisation CLI partagée par tous les scripts (`scripts/`).
 *
 * Volontairement sans dépendance : couleurs ANSI si le flux est un TTY,
 * sortie brute sinon (fichier de log, CI).
 */

const isTty = process.stdout.isTTY === true;
const paint = (code: string, s: string) => (isTty ? `\x1b[${code}m${s}\x1b[0m` : s);

export const color = {
	dim: (s: string) => paint('2', s),
	red: (s: string) => paint('31', s),
	green: (s: string) => paint('32', s),
	yellow: (s: string) => paint('33', s),
	blue: (s: string) => paint('34', s),
	bold: (s: string) => paint('1', s)
};

export const log = {
	title(s: string) {
		console.log(`\n${color.bold(s)}`);
	},
	step(s: string) {
		console.log(`${color.blue('▸')} ${s}`);
	},
	info(s: string) {
		console.log(`  ${s}`);
	},
	muted(s: string) {
		console.log(color.dim(`  ${s}`));
	},
	success(s: string) {
		console.log(`${color.green('✓')} ${s}`);
	},
	warn(s: string) {
		console.warn(`${color.yellow('!')} ${s}`);
	},
	error(s: string) {
		console.error(`${color.red('✗')} ${s}`);
	}
};

/** Formate un entier avec séparateurs de milliers (1302567 → « 1 302 567 »). */
export function count(n: number): string {
	return n.toLocaleString('fr-FR');
}

/** Formate une durée en ms vers « 1 m 04 s » ou « 12,3 s ». */
export function duration(ms: number): string {
	const s = ms / 1000;
	if (s < 60) return `${s.toFixed(1)} s`;
	const m = Math.floor(s / 60);
	return `${m} m ${String(Math.round(s % 60)).padStart(2, '0')} s`;
}

/**
 * Barre de progression réécrite en place (une seule ligne).
 * En non-TTY, n'écrit qu'au début et à la fin pour ne pas noyer les logs.
 */
export function progress(label: string, total: number) {
	const start = Date.now();
	let last = 0;

	return {
		tick(done: number) {
			if (!isTty) return;
			// Limite le rafraîchissement à ~10/s pour ne pas coûter plus cher que le travail.
			const now = Date.now();
			if (now - last < 100 && done < total) return;
			last = now;

			const pct = total > 0 ? (done / total) * 100 : 100;
			const filled = Math.round(pct / 5);
			const bar = '█'.repeat(filled) + '░'.repeat(20 - filled);
			process.stdout.write(
				`\r  ${label} ${bar} ${pct.toFixed(1).padStart(5)}% ` +
					`${count(done)}/${count(total)} — ${duration(now - start)}   `
			);
		},
		done(finalCount = total) {
			if (isTty) process.stdout.write('\r' + ' '.repeat(100) + '\r');
			log.success(`${label} : ${count(finalCount)} en ${duration(Date.now() - start)}`);
		}
	};
}
