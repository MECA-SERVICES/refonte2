/**
 * Petit orchestrateur de tâches CLI, partagé par tous les scripts (`scripts/`).
 *
 * Il n'est pas spécifique à PrestaShop : tout script fait d'étapes nommées
 * (import, réindexation, nettoyage…) peut le réutiliser.
 *
 * Il fournit :
 *  - l'enchaînement des tâches, avec dépendances déclarées,
 *  - la sélection en ligne de commande (`--only`, `--from`, `--list`),
 *  - le mode simulation (`--dry-run`) propagé aux tâches,
 *  - un compte-rendu final, et une sortie propre (code ≠ 0 si échec).
 */
import { log, color, duration } from './logger.ts';

/** Contexte transmis à chaque tâche. */
export interface TaskContext {
	/** `true` si `--dry-run` : la tâche doit calculer sans écrire. */
	dryRun: boolean;
	/** Limite de lignes à traiter (`--limit`), pour les essais. */
	limit: number | null;
	/** Options brutes restantes (`--foo=bar` → `{ foo: 'bar' }`). */
	options: Record<string, string | boolean>;
}

/** Résultat d'une tâche, affiché dans le compte-rendu. */
export interface TaskResult {
	/** Nombre d'éléments traités, pour le récapitulatif. */
	processed?: number;
	/** Message libre affiché à la fin (ex. « 12 ignorés »). */
	note?: string;
}

export interface Task {
	/** Identifiant court utilisé en ligne de commande (ex. `brands`). */
	name: string;
	/** Description affichée par `--list`. */
	description: string;
	/** Noms des tâches devant avoir été jouées avant (documentaire + contrôle). */
	dependsOn?: string[];
	run(ctx: TaskContext): Promise<TaskResult | void>;
}

interface RunnerOptions {
	/** Nom affiché en tête (ex. « Migration PrestaShop »). */
	title: string;
	tasks: Task[];
	/** Appelé en fin de course, succès ou échec, pour fermer les connexions. */
	cleanup?: () => Promise<void>;
}

/** Découpe `process.argv` en positionnels et options `--clé[=valeur]`. */
function parseArgv(argv: string[]) {
	const positional: string[] = [];
	const options: Record<string, string | boolean> = {};

	for (const arg of argv) {
		if (!arg.startsWith('--')) {
			positional.push(arg);
			continue;
		}
		const [key, value] = arg.slice(2).split('=');
		options[key] = value ?? true;
	}

	return { positional, options };
}

/** Sélectionne les tâches à jouer selon `--only` / `--from`. */
function selectTasks(tasks: Task[], options: Record<string, string | boolean>): Task[] {
	const only = typeof options.only === 'string' ? options.only.split(',') : null;
	if (only) {
		const selected = only.map((name) => {
			const task = tasks.find((t) => t.name === name.trim());
			if (!task) throw new Error(`Tâche inconnue : « ${name.trim()} »`);
			return task;
		});
		return selected;
	}

	const from = typeof options.from === 'string' ? options.from : null;
	if (from) {
		const index = tasks.findIndex((t) => t.name === from);
		if (index === -1) throw new Error(`Tâche inconnue : « ${from} »`);
		return tasks.slice(index);
	}

	return tasks;
}

export async function runTasks({ title, tasks, cleanup }: RunnerOptions): Promise<void> {
	const { options } = parseArgv(process.argv.slice(2));

	if (options.list) {
		log.title(title);
		for (const task of tasks) {
			const deps = task.dependsOn?.length ? color.dim(` (après ${task.dependsOn.join(', ')})`) : '';
			console.log(`  ${color.bold(task.name.padEnd(18))} ${task.description}${deps}`);
		}
		console.log(color.dim('\n  Options : --only=a,b  --from=a  --dry-run  --limit=N  --list\n'));
		return;
	}

	const ctx: TaskContext = {
		dryRun: options['dry-run'] === true,
		limit: typeof options.limit === 'string' ? Number(options.limit) : null,
		options
	};

	let selected: Task[];
	try {
		selected = selectTasks(tasks, options);
	} catch (err) {
		log.error((err as Error).message);
		process.exitCode = 1;
		return;
	}

	log.title(title);
	if (ctx.dryRun) log.warn('Mode simulation (--dry-run) : aucune écriture ne sera effectuée.');
	if (ctx.limit) log.warn(`Limite active : ${ctx.limit} lignes par tâche.`);

	const started = Date.now();
	const results: { task: Task; result: TaskResult; ms: number }[] = [];
	let failed: { task: Task; error: Error } | null = null;

	for (const task of selected) {
		const taskStart = Date.now();
		log.step(`${color.bold(task.name)} — ${task.description}`);

		try {
			const result = (await task.run(ctx)) ?? {};
			results.push({ task, result, ms: Date.now() - taskStart });
		} catch (err) {
			failed = { task, error: err as Error };
			break;
		}
	}

	// Le nettoyage doit passer même en cas d'échec : tunnel SSH et pools ouverts.
	if (cleanup) await cleanup().catch((err) => log.warn(`Nettoyage : ${(err as Error).message}`));

	console.log();
	if (failed) {
		log.error(`Échec sur « ${failed.task.name} » : ${failed.error.message}`);
		if (failed.error.stack) log.muted(failed.error.stack.split('\n').slice(1, 4).join('\n'));
		process.exitCode = 1;
	} else {
		log.success(`Terminé en ${duration(Date.now() - started)}`);
	}

	for (const { task, result, ms } of results) {
		const processed = result.processed != null ? result.processed.toLocaleString('fr-FR') : '—';
		const note = result.note ? color.dim(` · ${result.note}`) : '';
		log.muted(`${task.name.padEnd(18)} ${processed.padStart(10)}  ${duration(ms)}${note}`);
	}
}
