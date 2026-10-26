/**
 * Retour visuel des enregistrements du back-office.
 *
 * `enhance` remplace celui de `$app/forms` dans les formulaires d'administration,
 * avec la même signature. Il ajoute, sans rien changer au reste :
 * - pendant l'envoi : le formulaire passe en `aria-busy`, le bouton cliqué est
 *   désactivé et affiche une roue (styles dans `AdminFeedback.svelte`) — plus de
 *   double envoi ;
 * - au retour : une notification de confirmation, ou le motif de l'échec.
 *
 * Les attributs du formulaire ajustent le message :
 * - `data-success="Pièce retirée."` remplace la confirmation par défaut ;
 * - `data-feedback="errors"` ne signale que les échecs (actions sans
 *   enregistrement, comme un téléchargement).
 */
import { enhance as kitEnhance } from '$app/forms';
import type { ActionResult, SubmitFunction } from '@sveltejs/kit';

export type FeedbackTone = 'success' | 'error';

type Notice = { id: number; tone: FeedbackTone; message: string };

/** Durée d'affichage : un échec reste plus longtemps, le temps de le lire. */
const DISPLAY_MS: Record<FeedbackTone, number> = { success: 3500, error: 8000 };

/** Au-delà, les plus anciennes notifications cèdent la place. */
const MAX_NOTICES = 3;

const DEFAULT_SUCCESS = 'Modifications enregistrées.';
const DEFAULT_FAILURE = "L'enregistrement n'a pas abouti : vérifiez les champs signalés.";
const DEFAULT_ERROR = "Erreur inattendue : l'enregistrement n'a pas abouti. Réessayez.";

let nextId = 0;

/** État partagé entre les formulaires et le layout, qui l'affiche. */
export const adminFeedback = $state<{ notices: Notice[]; pending: number }>({
	notices: [],
	pending: 0
});

export function notify(tone: FeedbackTone, message: string) {
	const id = ++nextId;
	adminFeedback.notices = [
		...adminFeedback.notices.slice(-(MAX_NOTICES - 1)),
		{ id, tone, message }
	];
	setTimeout(() => dismiss(id), DISPLAY_MS[tone]);
}

export function dismiss(id: number) {
	adminFeedback.notices = adminFeedback.notices.filter((n) => n.id !== id);
}

/**
 * Motif d'un échec : `message`, ou le premier champ `…Error` (`partError`,
 * `statusError`…) que renvoient les actions.
 */
export function failureMessage(data: Record<string, unknown> | undefined): string {
	if (!data) return DEFAULT_FAILURE;
	if (typeof data.message === 'string' && data.message.trim()) return data.message;
	for (const [key, value] of Object.entries(data)) {
		if (key.endsWith('Error') && typeof value === 'string' && value.trim()) return value;
	}
	return DEFAULT_FAILURE;
}

function report(form: HTMLFormElement, result: ActionResult) {
	switch (result.type) {
		case 'success':
		case 'redirect':
			if (form.dataset.feedback !== 'errors') {
				notify('success', form.dataset.success || DEFAULT_SUCCESS);
			}
			break;
		case 'failure':
			notify('error', failureMessage(result.data));
			break;
		case 'error':
			notify('error', DEFAULT_ERROR);
			break;
	}
}

/** Marque l'envoi en cours ; retourne la fonction qui lève la marque. */
function markBusy(form: HTMLFormElement, submitter: HTMLElement | null) {
	adminFeedback.pending += 1;
	form.setAttribute('aria-busy', 'true');

	const button =
		submitter instanceof HTMLButtonElement || submitter instanceof HTMLInputElement
			? submitter
			: null;
	const wasDisabled = button?.disabled ?? false;
	if (button) {
		button.disabled = true;
		button.dataset.loading = '';
	}

	return () => {
		adminFeedback.pending -= 1;
		form.removeAttribute('aria-busy');
		if (button) {
			button.disabled = wasDisabled;
			delete button.dataset.loading;
		}
	};
}

export function enhance(form: HTMLFormElement, submit: SubmitFunction = () => {}) {
	return kitEnhance(form, async (input) => {
		let cancelled = false;
		const after = await submit({
			...input,
			cancel: () => {
				cancelled = true;
				input.cancel();
			}
		});
		if (cancelled) return;

		const release = markBusy(form, input.submitter);

		return async (opts) => {
			try {
				if (after) await after(opts);
				else await opts.update();
			} finally {
				release();
			}
			report(form, opts.result);
		};
	});
}
