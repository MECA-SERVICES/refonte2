import { describe, expect, it } from 'vitest';
import { parseDecisionForm } from './account-validation';

/** Construit un FormData à partir d'un objet, en ignorant les valeurs nulles. */
function form(fields: Record<string, string | null>) {
	const data = new FormData();
	for (const [key, value] of Object.entries(fields)) {
		if (value !== null) data.set(key, value);
	}
	return data;
}

describe('parseDecisionForm', () => {
	it('retient les trois décisions du CDC (§5.4)', () => {
		expect(parseDecisionForm(form({ decision: 'validate' }))).toMatchObject({
			decision: 'validate'
		});
		expect(parseDecisionForm(form({ decision: 'reject' }))).toMatchObject({ decision: 'reject' });
		expect(parseDecisionForm(form({ decision: 'request_info' }))).toMatchObject({
			decision: 'request_info'
		});
	});

	it('écarte une décision inconnue ou absente', () => {
		expect(parseDecisionForm(form({ decision: 'supprimer' }))).toMatchObject({
			error: expect.any(String)
		});
		expect(parseDecisionForm(form({}))).toMatchObject({ error: expect.any(String) });
	});

	it('sépare le motif transmis au client de la note interne (R9, R13)', () => {
		const out = parseDecisionForm(
			form({ decision: 'reject', message: 'KBIS illisible', reviewNotes: 'Relancé par téléphone' })
		);
		expect(out).toMatchObject({
			decision: 'reject',
			message: 'KBIS illisible',
			reviewNotes: 'Relancé par téléphone'
		});
	});

	it('ramène un message vide à null, pour que la règle R9 le refuse', () => {
		expect(parseDecisionForm(form({ decision: 'reject', message: '   ' }))).toMatchObject({
			message: null
		});
	});
});
